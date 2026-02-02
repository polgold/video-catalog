import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import InboxFilters from "./InboxFilters";

const DEFAULT_STATUS = "pending_review";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source_id?: string; genre?: string; from?: string; to?: string; min_duration?: string; max_duration?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? DEFAULT_STATUS;
  const supabase = createSupabaseServer();

  const urlParams = new URLSearchParams();
  if (status) urlParams.set("status", status);
  if (params.source_id) urlParams.set("source_id", params.source_id);
  if (params.genre) urlParams.set("genre", params.genre);
  if (params.from) urlParams.set("from", params.from);
  if (params.to) urlParams.set("to", params.to);
  if (params.min_duration) urlParams.set("min_duration", params.min_duration);
  if (params.max_duration) urlParams.set("max_duration", params.max_duration);

  let q = supabase
    .from("videos")
    .select("id, filename, title, status, duration_sec, genre, created_at, sources(path)", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(0, 49);

  if (params.source_id) q = q.eq("source_id", params.source_id);
  if (params.genre) q = q.eq("genre", params.genre);
  if (params.from) q = q.gte("created_at", params.from);
  if (params.to) q = q.lte("created_at", params.to);
  if (params.min_duration != null && params.min_duration !== "") q = q.gte("duration_sec", Number(params.min_duration));
  if (params.max_duration != null && params.max_duration !== "") q = q.lte("duration_sec", Number(params.max_duration));

  const { data: videos, count } = await q;

  const { data: sources } = await supabase.from("sources").select("id, path").order("path");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <InboxFilters
        status={status}
        sourceId={params.source_id}
        genre={params.genre}
        from={params.from}
        to={params.to}
        minDuration={params.min_duration}
        maxDuration={params.max_duration}
        sources={sources ?? []}
      />
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-900 text-zinc-400 text-sm">
            <tr>
              <th className="px-4 py-3 font-medium">Video</th>
              <th className="px-4 py-3 font-medium">Carpeta</th>
              <th className="px-4 py-3 font-medium">Duración</th>
              <th className="px-4 py-3 font-medium">Género</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {(videos ?? []).map((v) => (
              <tr key={v.id} className="hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <span className="font-medium text-white">{v.title || v.filename || v.id.slice(0, 8)}</span>
                  {!v.title && v.filename && <span className="text-zinc-500 text-sm block">{v.filename}</span>}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {(v.sources as { path?: string } | null)?.path ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {v.duration_sec != null ? `${Math.round(Number(v.duration_sec) / 60)} min` : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-400">{v.genre ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {v.created_at ? new Date(v.created_at).toLocaleDateString("es") : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/videos/${v.id}`}
                    className="text-blue-400 hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!videos || videos.length === 0) && (
          <div className="px-4 py-12 text-center text-zinc-500">
            No hay videos con estado &quot;{status}&quot;. Ajusta filtros o ejecuta un scan en Settings.
          </div>
        )}
      </div>
      {count != null && count > 0 && (
        <p className="text-sm text-zinc-500">Mostrando hasta 50 de {count} resultados.</p>
      )}
    </div>
  );
}
