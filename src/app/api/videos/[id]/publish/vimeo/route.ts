import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createSupabaseServer();

  const { data: video, error: videoErr } = await supabase
    .from("videos")
    .select("id, title, description, tags, status")
    .eq("id", id)
    .single();

  if (videoErr || !video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (video.status !== "approved") {
    return NextResponse.json(
      { error: "Video must be approved before publishing" },
      { status: 400 }
    );
  }

  const { data: creds } = await supabase
    .from("platform_credentials")
    .select("id")
    .eq("platform", "vimeo")
    .single();

  if (!creds) {
    return NextResponse.json(
      { error: "Vimeo not connected. Connect in Settings." },
      { status: 400 }
    );
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      video_id: id,
      type: "publish_vimeo",
      status: "pending",
      payload: {
        title: video.title,
        description: video.description,
        tags: Array.isArray(video.tags) ? video.tags : [],
      },
    })
    .select()
    .single();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  return NextResponse.json({ message: "Publish job queued", job });
}
