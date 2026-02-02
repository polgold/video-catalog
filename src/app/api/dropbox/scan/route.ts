import { NextResponse } from "next/server";
import { Dropbox } from "dropbox";
import { createSupabaseServer } from "@/lib/supabase/server";

const VIDEO_EXT = [".mp4", ".mov", ".mxf", ".mkv"];

function isVideo(path: string): boolean {
  const lower = path.toLowerCase();
  return VIDEO_EXT.some((ext) => lower.endsWith(ext));
}

export async function POST() {
  const supabase = createSupabaseServer();

  const { data: creds, error: credError } = await supabase
    .from("dropbox_credentials")
    .select("access_token")
    .limit(1)
    .single();

  if (credError || !creds?.access_token) {
    return NextResponse.json({ error: "Dropbox not connected" }, { status: 401 });
  }

  const dbx = new Dropbox({ accessToken: creds.access_token });

  const { data: sources } = await supabase.from("sources").select("id, dropbox_folder_id, path, cursor");

  if (!sources?.length) {
    return NextResponse.json({ message: "No folders to scan", added: 0 });
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
