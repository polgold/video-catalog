"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Source = { id: string; path: string };

export default function InboxFilters({
  status,
  sourceId,
  genre,
  from,
  to,
  minDuration,
  maxDuration,
  sources,
}: {
  status: string;
  sourceId?: string;
  genre?: string;
  from?: string;
  to?: string;
  minDuration?: string;
  maxDuration?: string;
  sources: Source[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/inbox?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-4 items-end p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Estado</span>
        <select
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
        >
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_fix">Needs fix</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Carpeta</span>
        <select
          value={sourceId ?? ""}
          onChange={(e) => setFilter("source_id", e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white min-w-[180px]"
        >
          <option value="">Todas</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.path}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Género</span>
        <input
          type="text"
          value={genre ?? ""}
          onChange={(e) => setFilter("genre", e.target.value)}
          placeholder="Filtrar por género"
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white w-40"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Desde</span>
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => setFilter("from", e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Hasta</span>
        <input
          type="date"
          value={to ?? ""}
          onChange={(e) => setFilter("to", e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Duración min (s)</span>
        <input
          type="number"
          value={minDuration ?? ""}
          onChange={(e) => setFilter("min_duration", e.target.value)}
          placeholder="0"
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white w-24"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Duración max (s)</span>
        <input
          type="number"
          value={maxDuration ?? ""}
          onChange={(e) => setFilter("max_duration", e.target.value)}
          placeholder="—"
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white w-24"
        />
      </label>
    </div>
  );
}
