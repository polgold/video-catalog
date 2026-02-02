import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.from("sources").select("*").order("path");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const path = (body.path as string)?.trim();
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const supabase = createSupabaseServer();
  const dropboxFolderId = path.startsWith("/") ? path : `/${path}`;

  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("dropbox_folder_id", dropboxFolderId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Folder already added" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("sources")
    .insert({
      dropbox_folder_id: dropboxFolderId,
      path: dropboxFolderId,
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
