import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

function normPath(p: string): string {
  const s = (p ?? "").trim().replace(/\/+/g, "/");
  const withLead = s.startsWith("/") ? s : `/${s}`;
  return withLead.endsWith("/") && withLead.length > 1 ? withLead.slice(0, -1) : withLead;
}

export async function GET() {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.from("sources").select("*").order("path");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const pathRaw = (body.path as string)?.trim();
  if (!pathRaw) return NextResponse.json({ error: "path required" }, { status: 400 });

  const normalized = normPath(pathRaw);
  const supabase = createSupabaseServer();

  const { data: allSources } = await supabase.from("sources").select("id, path, dropbox_folder_id");
  const exists = (allSources ?? []).some(
    (s) => normPath(s.path) === normalized || normPath(s.dropbox_folder_id) === normalized
  );
  if (exists) {
    return NextResponse.json({ error: "Folder already added" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("sources")
    .insert({
      dropbox_folder_id: normalized,
      path: normalized,
      provider: "dropbox",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createSupabaseServer();
  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
