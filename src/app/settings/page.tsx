import { createSupabaseServer } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = createSupabaseServer();
  const { data: sources } = await supabase.from("sources").select("*").order("path");
  const { data: dropboxRow } = await supabase.from("dropbox_credentials").select("id").limit(1).maybeSingle();
  const dropboxConnected = !!dropboxRow?.id;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-medium mb-4">Dropbox</h2>
        {dropboxConnected ? (
          <p className="text-zinc-400 text-sm mb-4">Conectado. Puedes añadir carpetas y ejecutar el scan.</p>
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
