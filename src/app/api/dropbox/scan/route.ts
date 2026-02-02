import { NextResponse } from "next/server";
import { Dropbox } from "dropbox";
import { createSupabaseServer } from "@/lib/supabase/server";

const VIDEO_EXT = [".mp4", ".mov", ".mxf", ".mkv"];

function isVideo(path: string): boolean {
  const lower = path.toLowerCase();
  return VIDEO_EXT.some((ext) => lower.endsWith(ext));
}

type ScanBody = { folders?: string[]; sourceIds?: string[]; stream?: boolean };

export async function POST(request: Request) {
  const supabase = createSupabaseServer();

  let body: ScanBody = {};
  try {
    body = await request.json();
  } catch {
    // body vacío o inválido
  }
  const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds.filter((id) => typeof id === "string") : [];
  const folders = Array.isArray(body.folders) ? body.folders : [];

  if (sourceIds.length === 0 && !folders.length) {
    if (process.env.NODE_ENV === "development") {
      console.log("[scan] sin sourceIds ni folders → 400");
    }
    return NextResponse.json({ error: "No folders selected" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[scan] sourceIds:", sourceIds.length, "folders:", folders.length);
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

  let sources: { id: string; dropbox_folder_id: string; path: string; cursor: string | null }[];

  if (sourceIds.length > 0) {
    const { data: byId, error: errId } = await supabase
      .from("sources")
      .select("id, dropbox_folder_id, path, cursor")
      .in("id", sourceIds);
    if (errId) return NextResponse.json({ error: errId.message }, { status: 500 });
    sources = byId ?? [];
  } else {
    function normPathForMatch(p: string): string {
      const s = (p ?? "").trim().replace(/\/+/g, "/");
      const withLead = s.startsWith("/") ? s : `/${s}`;
      return withLead.endsWith("/") && withLead.length > 1 ? withLead.slice(0, -1) : withLead;
    }
    const { data: allSources } = await supabase.from("sources").select("id, dropbox_folder_id, path, cursor");
    const pathSet = new Set(folders.map(normPathForMatch));
    sources = (allSources ?? []).filter(
      (s) => pathSet.has(normPathForMatch(s.path)) || pathSet.has(normPathForMatch(s.dropbox_folder_id))
    );
  }

  if (!sources.length) {
    const payload: { error: string; hint?: string } = { error: "No matching sources for selected folders" };
    if (process.env.NODE_ENV === "development" && folders.length > 0) {
      const { data: allSources } = await supabase.from("sources").select("path");
      payload.hint =
        "Requested paths: " + folders.join(" | ") + ". In DB: " + (allSources ?? []).map((s) => s.path).join(" | ");
    }
    return NextResponse.json(payload, { status: 400 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[scan] path enviado a Dropbox (sources):", sources.map((s) => s.path));
  }

  const streamProgress = body.stream === true;
  const encoder = new TextEncoder();

  async function* runScan(): AsyncGenerator<string> {
    let totalAdded = 0;
    const total = sources.length;
    for (let idx = 0; idx < sources.length; idx++) {
      const source = sources[idx];
      if (streamProgress) {
        yield `data: ${JSON.stringify({ type: "progress", folder: source.path, index: idx + 1, total, added: 0 })}\n\n`;
      }
      let cursor = source.cursor;
      let hasMore = true;
      let addedThisFolder = 0;

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
            addedThisFolder++;
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

      if (streamProgress) {
        yield `data: ${JSON.stringify({ type: "progress", folder: source.path, index: idx + 1, total, added: addedThisFolder, totalAdded })}\n\n`;
      }
    }
    yield `data: ${JSON.stringify({ type: "done", totalAdded })}\n\n`;
  }

  if (streamProgress) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of runScan()) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" },
    });
  }

  try {
    let totalAdded = 0;
    for await (const chunk of runScan()) {
      const line = chunk.replace(/^data: /, "").trim();
      if (line) {
        try {
          const data = JSON.parse(line) as { type?: string; totalAdded?: number };
          if (data.type === "done" && typeof data.totalAdded === "number") totalAdded = data.totalAdded;
        } catch {
          // ignore parse errors
        }
      }
    }
    return NextResponse.json({ message: "Scan complete", added: totalAdded });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === "development") console.error("[scan] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
