import { NextResponse } from "next/server";
import { Dropbox } from "dropbox";
import { createSupabaseServer } from "@/lib/supabase/server";

const VIDEO_EXT = [".mp4", ".mov", ".mxf", ".mkv"];

function isVideo(path: string): boolean {
  const lower = path.toLowerCase();
  return VIDEO_EXT.some((ext) => lower.endsWith(ext));
}

type ScanBody = { folders?: string[] };

export async function POST(request: Request) {
  const supabase = createSupabaseServer();

  let body: ScanBody = {};
  try {
    body = await request.json();
  } catch {
    // body vacío o inválido
  }
  const folders = Array.isArray(body.folders) ? body.folders : [];

  if (!folders.length) {
    if (process.env.NODE_ENV === "development") {
      console.log("[scan] carpetas recibidas: 0 → 400");
    }
    return NextResponse.json({ error: "No folders selected" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[scan] carpetas recibidas:", folders.length, folders);
  }

  const { data: creds, error: credError } = await supabase
    .from("dropbox_credentials")
    .select("access_token")
    .limit(1)
    .single();

  if (credError || !creds?.access_token) {
    if (process.env.NODE_ENV === "development") {
      console.log("[scan] token presente: false");
    }
    return NextResponse.json({ error: "Dropbox not connected" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[scan] token presente: true");
  }

  const dbx = new Dropbox({
    accessToken: creds.access_token,
    fetch: globalThis.fetch.bind(globalThis),
  });

  const { data: allSources } = await supabase.from("sources").select("id, dropbox_folder_id, path, cursor");
  const pathSet = new Set(folders.map((p) => (p.startsWith("/") ? p : `/${p}`)));
  const sources = (allSources ?? []).filter((s) => pathSet.has(s.path));

  if (!sources.length) {
    return NextResponse.json({ error: "No matching sources for selected folders" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[scan] path enviado a Dropbox (sources):", sources.map((s) => s.path));
  }

  let totalAdded = 0;

  for (const source of sources) {
    let cursor = source.cursor;
    let hasMore = true;

    while (hasMore) {
      let entries: { id: string; path_display?: string; ".tag": string }[] = [];
      let nextCursor: string | undefined;

      if (cursor) {
        const deltaRes = await dbx.filesListFolderContinue({ cursor });
        entries = (deltaRes.result.entries as { id: string; path_display?: string; ".tag": string }[]) ?? [];
        hasMore = deltaRes.result.has_more;
        nextCursor = deltaRes.result.cursor;
      } else {
        const listRes = await dbx.filesListFolder({
          path: source.dropbox_folder_id,
          recursive: true,
          include_has_explicit_shared_members: false,
          include_media_info: false,
        });
        entries = (listRes.result.entries as { id: string; path_display?: string; ".tag": string }[]) ?? [];
        hasMore = listRes.result.has_more;
        nextCursor = listRes.result.cursor;
      }

      for (const entry of entries) {
        if (entry[".tag"] !== "file") continue;
        const path = entry.path_display ?? (entry as { path_display?: string }).path_display ?? "";
        if (!isVideo(path)) continue;

        const { data: existing } = await supabase
          .from("videos")
          .select("id")
          .eq("dropbox_file_id", entry.id)
          .maybeSingle();

        if (existing) continue;

        const { data: video, error: insertErr } = await supabase
          .from("videos")
          .insert({
            source_id: source.id,
            dropbox_file_id: entry.id,
            path,
            filename: path.split("/").pop() ?? path,
            status: "pending_ingest",
          })
          .select("id")
          .single();

        if (insertErr) continue;
        if (video) {
          await supabase.from("jobs").insert({
            video_id: video.id,
            type: "ingest",
            status: "pending",
            payload: {},
          });
          totalAdded++;
        }
      }

      if (nextCursor) {
        await supabase
          .from("sources")
          .update({ cursor: nextCursor, updated_at: new Date().toISOString() })
          .eq("id", source.id);
        cursor = nextCursor;
      } else {
        hasMore = false;
      }
    }
  }

  return NextResponse.json({ message: "Scan complete", added: totalAdded });
}
