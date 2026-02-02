import { NextResponse } from "next/server";
import { Dropbox } from "dropbox";
import { createSupabaseServer } from "@/lib/supabase/server";

type DropboxEntry = {
  ".tag": string;
  name?: string;
  path_display?: string;
  path_lower?: string;
};

/**
 * GET /api/dropbox/list-folders?path=
 * path="" → raíz de Dropbox
 * path="/2024" → subcarpetas de /2024 (usar path_lower)
 * Devuelve { folders: [{ name, path_lower, path_display }] } filtrando .tag === "folder"
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pathParam = searchParams.get("path");
  const path = pathParam === null || pathParam === "" ? "" : pathParam.trim().replace(/\/+/g, "/");
  const listPath = path.startsWith("/") ? path : path ? `/${path}` : "";

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
    const allEntries: DropboxEntry[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const res = cursor
        ? await dbx.filesListFolderContinue({ cursor })
        : await dbx.filesListFolder({
            path: listPath,
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
      .map((e) => {
        const path_display = e.path_display ?? (e.name ? (listPath ? `${listPath}/${e.name}` : `/${e.name}`) : "");
        const path_lower = e.path_lower ?? path_display.toLowerCase();
        return {
          name: e.name ?? path_display.split("/").filter(Boolean).pop() ?? "",
          path_lower: path_lower || "",
          path_display: path_display || path_lower,
        };
      })
      .filter((f) => f.path_lower || f.path_display)
      .sort((a, b) => (a.name || a.path_lower).localeCompare(b.name || b.path_lower, undefined, { sensitivity: "base" }));

    return NextResponse.json({ folders });
  } catch (err: unknown) {
    const dropboxError = err as { status?: number; error?: unknown; message?: string };
    const status = dropboxError.status ?? 500;
    const detail = dropboxError.error
      ? JSON.stringify(dropboxError.error)
      : dropboxError.message ?? "Failed to list folders";
    return NextResponse.json({ error: String(detail) }, { status: status >= 400 ? status : 500 });
  }
}
