import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/jobs/[id]
 * Devuelve el job para mostrar estado y errores (polling desde el frontend).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createSupabaseServer();
  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, type, status, payload, result, error, created_at, started_at, completed_at")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(job);
}
