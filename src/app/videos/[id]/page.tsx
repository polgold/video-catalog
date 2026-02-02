import { createSupabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import VideoDetailClient from "./VideoDetailClient";

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseServer();
  const { data: video, error } = await supabase
    .from("videos")
    .select("*, sources(path)")
    .eq("id", id)
    .single();

  if (error || !video) notFound();

  const { data: duplicates } = await supabase
    .from("duplicates")
    .select("*")
    .eq("video_id", id)
    .order("score", { ascending: false });

  const duplicateIds = [...new Set((duplicates ?? []).map((d) => d.duplicate_video_id))];
  const { data: dupVideos } = duplicateIds.length
    ? await supabase.from("videos").select("id, filename, title, duration_sec, keyframe_urls").in("id", duplicateIds)
    : { data: [] };
  const dupById = Object.fromEntries((dupVideos ?? []).map((v) => [v.id, v]));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const previewUrl = baseUrl ? `${baseUrl}/api/videos/${id}/preview` : `/api/videos/${id}/preview`;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/inbox" className="text-zinc-400 hover:text-white text-sm">
          ← Inbox
        </Link>
        <h1 className="text-xl font-semibold truncate">
          {video.title || video.filename || video.id.slice(0, 8)}
        </h1>
        <span className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-300">
          {video.status}
        </span>
      </div>

      <VideoDetailClient
        video={video}
        previewUrl={previewUrl}
        duplicates={(duplicates ?? []).map((d) => ({
          ...d,
          duplicate_video: dupById[d.duplicate_video_id] ?? null,
        }))}
      />
    </div>
  );
}
