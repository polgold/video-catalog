import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

type Body = { selectedFolders?: string[] };

/**
 * POST /api/scan/start
 * Crea un job de tipo "scan" con los paths exactos enviados y responde rápido con { jobId }.
 * El worker procesa el scan en background (usa EXACTAMENTE los paths en payload.paths).
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServer();

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.selectedFolders;
  const selectedFolders = Array.isArray(raw)
    ? (raw as unknown[])
        .filter((p): p is string => typeof p === "string")
        .map((p) => (p ?? "").trim().replace(/\/+/g, "/"))
        .map((p) => (p.startsWith("/") ? p : p ? `/${p}` : p))
        .filter((p) => p.length > 0)
    : [];

  if (selectedFolders.length === 0) {
    return NextResponse.json({ error: "selectedFolders required (non-empty array of paths)" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[scan/start] paths recibidos:", selectedFolders.length, selectedFolders);
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      video_id: null,
      type: "scan",
      status: "pending",
      payload: { paths: selectedFolders },
    })
    .select("id")
    .single();

  if (error) {
    if (process.env.NODE_ENV === "development") console.error("[scan/start] insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobId: job.id });
}
