"use client";

import { useState } from "react";
import Link from "next/link";
import type { Video } from "@/lib/db/types";
import type { Duplicate } from "@/lib/db/types";

type VideoRow = Video & { sources?: { path?: string } | null };
type DupRow = Duplicate & { duplicate_video?: { id: string; filename: string | null; title: string | null; duration_sec: number | null; keyframe_urls: string[] } | null };

export default function VideoDetailClient({
  video,
  previewUrl,
  duplicates,
}: {
  video: VideoRow;
  previewUrl: string;
  duplicates: DupRow[];
}) {
  const [title, setTitle] = useState(video.title ?? "");
  const [description, setDescription] = useState(video.description ?? "");
  const [genre, setGenre] = useState(video.genre ?? "");
  const [styles, setStyles] = useState(Array.isArray(video.styles) ? video.styles.join(", ") : "");
  const [tags, setTags] = useState(Array.isArray(video.tags) ? video.tags.join(", ") : "");
  const [thumbnailKeyframe, setThumbnailKeyframe] = useState(String(video.thumbnail_keyframe ?? ""));
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const keyframeUrls = Array.isArray(video.keyframe_urls) ? video.keyframe_urls : [];
  const segments = Array.isArray(video.transcript_segments) ? video.transcript_segments : [];

  async function saveFields() {
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          genre: genre || null,
          styles: styles ? styles.split(",").map((s) => s.trim()).filter(Boolean) : [],
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          thumbnail_keyframe: thumbnailKeyframe ? parseInt(thumbnailKeyframe, 10) : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setGenre(data.genre ?? "");
      setStyles(Array.isArray(data.styles) ? data.styles.join(", ") : "");
      setTags(Array.isArray(data.tags) ? data.tags.join(", ") : "");
      setThumbnailKeyframe(String(data.thumbnail_keyframe ?? ""));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: "approve" | "reject" | "needs-fix" | "publish-youtube" | "publish-vimeo") {
    setActionLoading(action);
    try {
      const path =
        action === "approve"
          ? `/api/videos/${video.id}/approve`
          : action === "reject"
            ? `/api/videos/${video.id}/reject`
            : action === "needs-fix"
              ? `/api/videos/${video.id}/needs-fix`
              : action === "publish-youtube"
                ? `/api/videos/${video.id}/publish/youtube`
                : `/api/videos/${video.id}/publish/vimeo`;
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || res.statusText);
        return;
      }
      if (action === "approve" || action === "reject" || action === "needs-fix") {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.message || "Job encolado.");
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-zinc-400 mb-2">Preview</h2>
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
            <video
              src={previewUrl}
              controls
              className="w-full h-full"
              crossOrigin="anonymous"
              preload="metadata"
            />
            <p className="p-2 text-xs text-zinc-500">
              Si el reproductor no carga, abre el enlace temporal:{" "}
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                Abrir en nueva pestaña
              </a>
            </p>
          </div>
        </section>

        {keyframeUrls.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-400 mb-2">Keyframes</h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {keyframeUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded border border-zinc-700 overflow-hidden aspect-video bg-zinc-900"
                >
                  <img src={url} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </section>
        )}

        {segments.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-400 mb-2">Transcript</h2>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 max-h-64 overflow-y-auto text-sm text-zinc-300">
              {segments.map((s, i) => (
                <p key={i} className="mb-1">
                  <span className="text-zinc-500 text-xs mr-2">
                    [{Number(s.start).toFixed(1)}s – {Number(s.end).toFixed(1)}s]
                  </span>
                  {(s as { text?: string }).text}
                </p>
              ))}
            </div>
          </section>
        )}

        {duplicates.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-400 mb-2">Posibles duplicados</h2>
            <ul className="rounded-lg border border-zinc-800 divide-y divide-zinc-800">
              {duplicates.map((d) => (
                <li key={d.id} className="flex items-center gap-4 p-3">
                  <span className="text-zinc-500 text-xs w-16">{(Number(d.score) * 100).toFixed(0)}%</span>
                  <span className="text-zinc-500 text-xs w-24">{d.reason}</span>
                  {d.duplicate_video ? (
                    <>
                      <span className="flex-1 truncate text-white">
                        {d.duplicate_video.title || d.duplicate_video.filename || d.duplicate_video.id}
                      </span>
                      <Link
                        href={`/videos/${d.duplicate_video.id}`}
                        className="text-blue-400 hover:underline text-sm"
                      >
                        Ver
                      </Link>
                    </>
                  ) : (
                    <span className="text-zinc-500">Video {d.duplicate_video_id}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Campos editables</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-zinc-500 block mb-1">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500 block mb-1">Descripción</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white resize-y"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500 block mb-1">Género</span>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500 block mb-1">Styles (separados por coma)</span>
              <input
                value={styles}
                onChange={(e) => setStyles(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500 block mb-1">Tags (separados por coma)</span>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500 block mb-1">Thumbnail keyframe (índice 0-based)</span>
              <input
                type="number"
                min={0}
                value={thumbnailKeyframe}
                onChange={(e) => setThumbnailKeyframe(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              onClick={saveFields}
              disabled={saving}
              className="w-full py-2 rounded bg-zinc-700 text-white text-sm font-medium hover:bg-zinc-600 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Acciones</h2>
          <div className="flex flex-wrap gap-2">
            {video.status === "pending_review" && (
              <>
                <button
                  onClick={() => runAction("approve")}
                  disabled={!!actionLoading}
                  className="px-3 py-1.5 rounded bg-green-700 text-white text-sm hover:bg-green-600 disabled:opacity-50"
                >
                  {actionLoading === "approve" ? "…" : "Approve"}
                </button>
                <button
                  onClick={() => runAction("reject")}
                  disabled={!!actionLoading}
                  className="px-3 py-1.5 rounded bg-red-800 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading === "reject" ? "…" : "Reject"}
                </button>
                <button
                  onClick={() => runAction("needs-fix")}
                  disabled={!!actionLoading}
                  className="px-3 py-1.5 rounded bg-amber-700 text-white text-sm hover:bg-amber-600 disabled:opacity-50"
                >
                  {actionLoading === "needs-fix" ? "…" : "Needs Fix"}
                </button>
              </>
            )}
            {video.status === "approved" && (
              <>
                <button
                  onClick={() => runAction("publish-youtube")}
                  disabled={!!actionLoading}
                  className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-50"
                >
                  {actionLoading === "publish-youtube" ? "…" : "Publicar a YouTube"}
                </button>
                <button
                  onClick={() => runAction("publish-vimeo")}
                  disabled={!!actionLoading}
                  className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  {actionLoading === "publish-vimeo" ? "…" : "Publicar a Vimeo"}
                </button>
              </>
            )}
          </div>
        </section>

        <section className="text-xs text-zinc-500">
          <p>Carpeta: {(video.sources as { path?: string } | null)?.path ?? "—"}</p>
          <p>Duración: {video.duration_sec != null ? `${Math.round(Number(video.duration_sec) / 60)} min` : "—"}</p>
          <p>Resolución: {video.resolution ?? "—"}</p>
          <p>Codec: {video.codec ?? "—"}</p>
        </section>
      </div>
    </div>
  );
}
