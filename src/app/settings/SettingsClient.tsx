"use client";

import { useState, useEffect } from "react";

type Source = { id: string; path: string };

export default function SettingsClient({
  dropboxConnected,
  sources: initialSources,
}: {
  dropboxConnected: boolean;
  sources: Source[];
}) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [newPath, setNewPath] = useState("");
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSources(initialSources);
  }, [initialSources]);

  async function connectDropbox() {
    window.location.href = "/api/dropbox/auth";
  }

  async function addFolder() {
    if (!newPath.trim()) return;
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dropbox/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newPath.trim().startsWith("/") ? newPath.trim() : `/${newPath.trim()}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || res.statusText);
        return;
      }
      setSources((prev) => [...prev, { id: data.id, path: data.path }]);
      setNewPath("");
      setMessage("Carpeta añadida.");
    } finally {
      setAdding(false);
    }
  }

  async function removeFolder(id: string) {
    const res = await fetch(`/api/dropbox/sources?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
    setMessage("Carpeta eliminada.");
  }

  async function runScan() {
    setScanning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dropbox/scan", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Error al escanear");
        return;
      }
      setMessage(`Scan completado. ${data.added ?? 0} videos nuevos añadidos a la cola.`);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dropbox = params.get("dropbox");
    const msg = params.get("message");
    if (dropbox === "connected") setMessage("Dropbox conectado correctamente.");
    if (dropbox === "error" && msg) setMessage(`Error Dropbox: ${decodeURIComponent(msg)}`);
    if (dropbox === "config_error") setMessage("Faltan DROPBOX_APP_KEY o DROPBOX_APP_SECRET en .env.");
  }, []);

  return (
    <div className="space-y-6">
      {!dropboxConnected && (
        <button
          onClick={connectDropbox}
          className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-500"
        >
          Conectar Dropbox
        </button>
      )}

      {dropboxConnected && (
        <>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Añadir carpeta (ruta en Dropbox, ej. /Videos)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/Mi Carpeta"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
              />
              <button
                onClick={addFolder}
                disabled={adding}
                className="px-4 py-2 rounded bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50"
              >
                {adding ? "Añadiendo…" : "Añadir"}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Carpetas incluidas</h3>
            <ul className="rounded border border-zinc-800 divide-y divide-zinc-800">
              {sources.length === 0 ? (
                <li className="px-4 py-3 text-zinc-500 text-sm">Ninguna. Añade una ruta arriba.</li>
              ) : (
                sources.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-white font-mono text-sm">{s.path}</span>
                    <button
                      onClick={() => removeFolder(s.id)}
                      className="text-red-400 hover:underline text-sm"
                    >
                      Quitar
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <button
              onClick={runScan}
              disabled={scanning || sources.length === 0}
              className="px-4 py-2 rounded bg-green-700 text-white font-medium hover:bg-green-600 disabled:opacity-50"
            >
              {scanning ? "Escaneando…" : "Ejecutar scan incremental"}
            </button>
            <p className="text-xs text-zinc-500 mt-2">
              Detecta archivos nuevos o modificados en las carpetas y crea jobs de ingest. El worker procesará cada video (metadata, keyframes, transcripción, LLM, duplicados).
            </p>
          </div>
        </>
      )}

      {message && (
        <p className="text-sm text-zinc-400 p-3 rounded bg-zinc-800 border border-zinc-700">
          {message}
        </p>
      )}
    </div>
  );
}
