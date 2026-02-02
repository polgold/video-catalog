import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createSupabaseServer();
  const { data: duplicates, error } = await supabase
    .from("duplicates")
    .select("*")
    .eq("video_id", id)
    .order("score", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = [...new Set((duplicates ?? []).map((d) => d.duplicate_video_id))];
  const { data: videos } = ids.length
    ? await supabase.from("videos").select("id, filename, title, duration_sec, keyframe_urls").in("id", ids)
    : { data: [] };
  const byId = Object.fromEntries((videos ?? []).map((v) => [v.id, v]));
  const data = (duplicates ?? []).map((d) => ({ ...d, duplicate_video: byId[d.duplicate_video_id] ?? null }));

  return NextResponse.json(data);
}
