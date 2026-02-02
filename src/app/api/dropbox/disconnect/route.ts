import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createSupabaseServer();
  const { data: rows } = await supabase.from("dropbox_credentials").select("id");
  if (rows?.length) {
    for (const row of rows) {
      await supabase.from("dropbox_credentials").delete().eq("id", row.id);
    }
  }
  return NextResponse.json({ ok: true });
}
