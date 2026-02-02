import { NextResponse } from "next/server";
import { Dropbox } from "dropbox";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createSupabaseServer();

  const { data: video, error: videoErr } = await supabase
    .from("videos")
    .select("dropbox_file_id, path")
    .eq("id", id)
    .single();

  if (videoErr || !video?.dropbox_file_id) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const { data: creds } = await supabase
    .from("dropbox_credentials")
    .select("access_token")
    .limit(1)
    .single();

  if (!creds?.access_token) {
    return NextResponse.json({ error: "Dropbox not connected" }, { status: 401 });
  }

  const dbx = new Dropbox({ accessToken: creds.access_token });
  try {
    const link = await dbx.filesGetTemporaryLink({ path: video.path ?? video.dropbox_file_id });
    const result = link.result as { link: string };
    return NextResponse.redirect(result.link);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to get preview link" },
      { status: 500 }
    );
  }
}
