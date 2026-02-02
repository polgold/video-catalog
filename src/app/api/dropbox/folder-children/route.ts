import { NextResponse } from "next/server";
import { Dropbox } from "dropbox";
import { createSupabaseServer } from "@/lib/supabase/server";

type DropboxEntry = { ".tag": string; name?: string; path_display?: string; id?: string };

function normPath(p: string): string {
  const s = (p ?? "").trim().replace(/\/+/g, "/");
  const withLead = s.startsWith("/") ? s : `/${s}`;
  return withLead.endsWith("/") && withLead.length > 1 ? withLead.slice(0, -1) : withLead;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pathParam = searchParams.get("path");
  const path = pathParam ? normPath(pathParam) : "";

  if (!path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

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
    const listPath = path === "/" ? "" : path;

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
        const fullPath = e.path_display ?? (e.name ? `${listPath ? listPath + "/" : "/"}${e.name}` : "");
        const pathNorm = fullPath ? (fullPath.startsWith("/") ? fullPath : `/${fullPath}`) : "";
        return {
          name: e.name ?? fullPath.split("/").filter(Boolean).pop() ?? "",
          path: pathNorm,
        };
      })
      .filter((f) => f.path)
      .sort((a, b) => (a.name || a.path).localeCompare(b.name || b.path, undefined, { sensitivity: "base" }));

    return NextResponse.json({ folders });
  } catch (err: unknown) {
    const dropboxError = err as { status?: number; error?: unknown; message?: string };
    const status = dropboxError.status ?? 500;
    const detail = dropboxError.error
      ? JSON.stringify(dropboxError.error)
      : dropboxError.message ?? "Failed to list folder";
    return NextResponse.json({ error: String(detail) }, { status: status >= 400 ? status : 500 });
  }
}
