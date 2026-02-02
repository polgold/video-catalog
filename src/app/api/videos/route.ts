import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sourceId = searchParams.get("source_id");
  const genre = searchParams.get("genre");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const minDuration = searchParams.get("min_duration");
  const maxDuration = searchParams.get("max_duration");

  const supabase = createSupabaseServer();
  let q = supabase
    .from("videos")
    .select("*, sources(path)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);
  if (sourceId) q = q.eq("source_id", sourceId);
  if (genre) q = q.eq("genre", genre);
  if (fromDate) q = q.gte("created_at", fromDate);
  if (toDate) q = q.lte("created_at", toDate);
  if (minDuration != null && minDuration !== "") q = q.gte("duration_sec", Number(minDuration));
  if (maxDuration != null && maxDuration !== "") q = q.lte("duration_sec", Number(maxDuration));

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}
