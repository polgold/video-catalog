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
    if (process.env.NODE_ENV === "development") {
      console.log("[root-folders] token presente: false");
    }
    return NextResponse.json({ error: "Dropbox not connected" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[root-folders] token presente: true");
  }

  const dbx = new Dropbox({
    accessToken: creds.access_token,
    fetch: globalThis.fetch.bind(globalThis),
  });

  const ROOT_PATH = "";
  if (process.env.NODE_ENV === "development") {
    console.log("[root-folders] path enviado a Dropbox:", JSON.stringify(ROOT_PATH));
  }

  try {
    const allEntries: DropboxEntry[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const res = cursor
        ? await dbx.filesListFolderContinue({ cursor })
        : await dbx.filesListFolder({
            path: ROOT_PATH,
            recursive: false,
            include_has_explicit_shared_members: false,
            include_media_info: false,
          });

      const entries = (res.result.entries as DropboxEntry[]) ?? [];
      allEntries.push(...entries);
      hasMore = res.result.has_more ?? false;
      cursor = res.result.cursor;
    }

    const folders = allEntries
      .filter((e) => e[".tag"] === "folder")
      .map((e) => ({
        name: e.name ?? (e.path_display ?? "").split("/").pop() ?? "",
        path: e.path_display ?? (e.name ? `/${e.name}` : ""),
      }))
      .filter((f) => f.path);

    if (process.env.NODE_ENV === "development") {
      console.log("[root-folders] carpetas recibidas:", folders.length, folders.map((f) => f.path));
    }

    return NextResponse.json({ folders });
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
