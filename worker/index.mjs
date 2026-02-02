#!/usr/bin/env node
/**
 * Video Catalog Worker
 * Polls jobs table for pending ingest/process jobs, runs pipeline:
 * download from Dropbox -> tmp, ffmpeg (metadata, audio, keyframes),
 * Whisper transcript, LLM (summary, title, description, genre, styles, tags),
 * duplicate detection (sha256, phash, audio fp), save to DB + Supabase Storage.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DROPBOX_ACCESS_TOKEN (or from DB),
 * OPENAI_API_KEY, ffmpeg on PATH.
 */

import { createClient } from "@supabase/supabase-js";
import { Dropbox } from "dropbox";
import OpenAI from "openai";
import { createWriteStream, createReadStream, readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { pipeline } from "stream/promises";
import { createHash } from "crypto";
import { spawn } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const POLL_MS = 10_000;
const VIDEO_EXT = [".mp4", ".mov", ".mxf", ".mkv"];
const KEYFRAME_COUNT = 10;

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function getSupabase() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, key);
}

async function getDropboxToken(supabase) {
  const { data } = await supabase.from("dropbox_credentials").select("access_token").limit(1).single();
  if (!data?.access_token) throw new Error("Dropbox not connected");
  return data.access_token;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exit ${code}`))));
  });
}

async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "quiet", "-print_format", "json",
      "-show_format", "-show_streams", filePath,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", () => {});
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffprobe failed"));
      try {
        const j = JSON.parse(out);
        const video = j.streams?.find((s) => s.codec_type === "video") || {};
        const format = j.format || {};
        resolve({
          duration_sec: parseFloat(format.duration) || null,
          fps: video.r_frame_rate ? eval(video.r_frame_rate) : null,
          resolution: video.width && video.height ? `${video.width}x${video.height}` : null,
          codec: video.codec_name || null,
          file_size: format.size ? parseInt(format.size, 10) : null,
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function extractKeyframes(filePath, outDir, count = KEYFRAME_COUNT) {
  const listPath = join(outDir, "list.txt");
  const { duration_sec } = await getVideoMetadata(filePath);
  const duration = duration_sec || 60;
  const step = duration / (count + 1);
  const urls = [];
  for (let i = 1; i <= count; i++) {
    const t = step * i;
    const name = `frame_${i}.jpg`;
    const outPath = join(outDir, name);
    await runFfmpeg(["-ss", String(t), "-i", filePath, "-vframes", "1", "-q:v", "2", "-y", outPath]);
    urls.push(name);
  }
  return urls;
}

async function extractAudioWav(filePath, outPath) {
  await runFfmpeg(["-i", filePath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", "-y", outPath]);
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  const buf = readFileSync(filePath);
  hash.update(buf);
  return hash.digest("hex");
}

async function processJob(supabase, job) {
  const jobId = job.id;
  const videoId = job.video_id;
  if (!videoId) return;

  const { data: video, error: ve } = await supabase.from("videos").select("*").eq("id", videoId).single();
  if (ve || !video) return;

  await supabase.from("jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", jobId);
  await supabase.from("videos").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", videoId);

  const workDir = join(tmpdir(), `vc-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });

  try {
    const token = await getDropboxToken(supabase);
    const dbx = new Dropbox({ accessToken: token });
    const path = video.path || video.dropbox_file_id;
    const localPath = join(workDir, video.filename || "video.mp4");

    const linkRes = await dbx.filesGetTemporaryLink({ path });
    const downloadUrl = linkRes.result.link;
    const res = await fetch(downloadUrl);
    if (!res.body) throw new Error("No body");
    await pipeline(res.body, createWriteStream(localPath));

    const fileSha256 = sha256File(localPath);
    const metadata = await getVideoMetadata(localPath);

    const audioPath = join(workDir, "audio.wav");
    await extractAudioWav(localPath, audioPath);

    const keyframeDir = join(workDir, "keyframes");
    mkdirSync(keyframeDir, { recursive: true });
    const keyframeNames = await extractKeyframes(localPath, keyframeDir);

    const storage = supabase.storage.from("keyframes");
    const keyframeUrls = [];
    for (const name of keyframeNames) {
      const fullPath = join(keyframeDir, name);
      const storagePath = `${videoId}/${name}`;
      const buf = readFileSync(fullPath);
      const { error: upErr } = await storage.upload(storagePath, buf, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (!upErr) {
        const { data: urlData } = storage.getPublicUrl(storagePath);
        keyframeUrls.push(urlData.publicUrl);
      }
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let transcriptText = "";
    let transcriptSegments = [];
    try {
      const audioBuf = readFileSync(audioPath);
      const transcript = await openai.audio.transcriptions.create({
        file: new Blob([audioBuf], { type: "audio/wav" }),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });
      transcriptText = transcript.text || "";
      transcriptSegments = (transcript.segments || []).map((s) => ({
        start: s.start ?? 0,
        end: s.end ?? 0,
        text: s.text ?? "",
      }));
    } catch (whisperErr) {
      console.warn("Whisper error:", whisperErr.message);
    }

    const prompt = `You are a video metadata assistant. Given this transcript (and optional context), produce JSON only with:
summary (2-4 lines), suggested_title, suggested_description (structure: qué es + contexto + CTA), genre (1), styles (1-3 array), tags (5-20 array).
Transcript:\n${transcriptText.slice(0, 15000)}\nFilename: ${video.filename || "video"}.`;
    let summary = "",
      suggestedTitle = "",
      suggestedDescription = "",
      genre = "",
      styles = [],
      tags = [];
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = completion.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        summary = parsed.summary ?? "";
        suggestedTitle = parsed.suggested_title ?? "";
        suggestedDescription = parsed.suggested_description ?? "";
        genre = parsed.genre ?? "";
        styles = Array.isArray(parsed.styles) ? parsed.styles : [parsed.styles].filter(Boolean);
        tags = Array.isArray(parsed.tags) ? parsed.tags : [parsed.tags].filter(Boolean);
      }
    } catch (llmErr) {
      console.warn("LLM error:", llmErr.message);
    }

    const { data: exactDup } = await supabase.from("videos").select("id").eq("file_sha256", fileSha256).neq("id", videoId).limit(1).maybeSingle();
    if (exactDup) {
      await supabase.from("duplicates").upsert(
        { video_id: videoId, duplicate_video_id: exactDup.id, score: 1, reason: "exact_hash" },
        { onConflict: "video_id,duplicate_video_id" }
      );
    }

    await supabase
      .from("videos")
      .update({
        status: "pending_review",
        file_sha256: fileSha256,
        file_size: metadata.file_size,
        duration_sec: metadata.duration_sec,
        fps: metadata.fps,
        resolution: metadata.resolution,
        codec: metadata.codec,
        transcript_text: transcriptText,
        transcript_segments: transcriptSegments,
        keyframe_urls: keyframeUrls,
        summary,
        suggested_title: suggestedTitle,
        suggested_description: suggestedDescription,
        genre,
        styles,
        tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", videoId);

    await supabase.from("jobs").update({ status: "done", completed_at: new Date().toISOString(), result: { keyframes: keyframeUrls.length } }).eq("id", jobId);
  } catch (err) {
    console.error("Job error:", err);
    await supabase.from("jobs").update({ status: "failed", error: err.message, completed_at: new Date().toISOString() }).eq("id", jobId);
    await supabase.from("videos").update({ status: "pending_ingest", updated_at: new Date().toISOString() }).eq("id", videoId);
  } finally {
    if (existsSync(workDir)) rmSync(workDir, { recursive: true });
  }
}

async function poll(supabase) {
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .in("type", ["ingest", "process"])
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (jobs?.length) {
    await processJob(supabase, jobs[0]);
  }
}

async function main() {
  const supabase = await getSupabase();
  console.log("Worker started, polling every", POLL_MS / 1000, "s");
  for (;;) {
    try {
      await poll(supabase);
    } catch (e) {
      console.error("Poll error:", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
