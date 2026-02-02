import { NextResponse } from "next/server";
import { Dropbox } from "dropbox";
import { createSupabaseServer } from "@/lib/supabase/server";

type DropboxEntry = { ".tag": string; name?: string; path_display?: string; id?: string };

export async function GET() {
  const supabase = createSupabaseServer();

  const { data: creds, error: credError } = await supabase
    .from("dropbox_credentials")
    .select("access_token")
    .limit(1)
    .single();

  if (credError || !creds?.access_token) {
    return NextResponse.json({ error: "Dropbox not connected" }, { status: 401 });
  }

  const dbx = new Dropbox({
    accessToken: creds.access_token,
    fetch: globalThis.fetch.bind(globalThis),
  });

  try {
    const res = await dbx.filesListFolder({
      path: "",
      recursive: false,
      include_has_explicit_shared_members: false,
      include_media_info: false,
    });

    const entries = (res.result.entries as DropboxEntry[]) ?? [];
    const folders = entries
      .filter((e) => e[".tag"] === "folder")
      .map((e) => ({
        path: e.path_display ?? (e.name ? `/${e.name}` : ""),
        name: e.name ?? (e.path_display ?? "").split("/").pop() ?? "",
      }))
      .filter((f) => f.path);

    return NextResponse.json(folders);
  } catch (err: unknown) {
    const dropboxError = err as { status?: number; error?: unknown; message?: string };
    const status = dropboxError.status ?? 500;
    const detail = dropboxError.error
      ? JSON.stringify(dropboxError.error)
      : dropboxError.message ?? "Failed to list folders";
    const message =
      status === 400
        ? `Dropbox API 400. Revisá que la app tenga permisos "files.metadata.read". Detalle: ${detail}`
        : detail;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
