import { createSupabaseServer } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ dropbox?: string }>;
}) {
  const params = await searchParams;
  const supabase = createSupabaseServer();
  const { data: sources } = await supabase.from("sources").select("*").order("path");
  const { data: dropboxRow } = await supabase.from("dropbox_credentials").select("id").limit(1).maybeSingle();
  const dropboxConnected = !!dropboxRow?.id;
  const justConnected = params.dropbox === "connected";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-medium mb-4">Dropbox</h2>
        {dropboxConnected || justConnected ? (
          <p className="text-zinc-400 text-sm mb-4">Conectado. Elegí carpetas a escanear y ejecutá el scan.</p>
        ) : (
          <p className="text-zinc-400 text-sm mb-4">
            Conecta tu cuenta Dropbox para ingestar videos. Solo se procesarán archivos .mp4, .mov, .mxf, .mkv.
          </p>
        )}
        <SettingsClient dropboxConnected={dropboxConnected} sources={sources ?? []} />
      </section>
    </div>
  );
}
