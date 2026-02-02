"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Source = { id: string; path: string };
type RootFolder = { path: string; name: string };

const fetchApi: typeof fetch =
  typeof window !== "undefined" ? window.fetch.bind(window) : fetch;

function normPath(p: string): string {
  const s = (p ?? "").trim();
  return s.startsWith("/") ? s : `/${s}`;
}

export default function SettingsClient({
  dropboxConnected,
  sources: initialSources,
}: {
  dropboxConnected: boolean;
  sources: Source[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [connectionInvalidated, setConnectionInvalidated] = useState(false);
  const [togglingPath, setTogglingPath] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const justConnected = searchParams.get("dropbox") === "connected";
  const showConnectedUI = (dropboxConnected || justConnected) && !connectionInvalidated;

  useEffect(() => {
    setSources(initialSources);
  }, [initialSources]);

  useEffect(() => {
    if (justConnected) router.refresh();
  }, [justConnected, router]);

  useEffect(() => {
    if (!dropboxConnected && !justConnected) return;
    setFoldersLoading(true);
    setMessage(null);
    setConnectionInvalidated(false);
    fetchApi("/api/dropbox/root-folders")
      .then((res) => {
        if (!res.ok) {
          return res.json().then((d) => {
            const msg = d.error ?? res.statusText;
            if (res.status === 401 || String(msg).toLowerCase().includes("not connected")) {
              setConnectionInvalidated(true);
              setMessage("Dropbox no está conectado. Conectá tu cuenta para listar y elegir carpetas.");
            }
            return Promise.reject(new Error(msg));
          });
        }
        return res.json();
      })
      .then((data: RootFolder[]) => setRootFolders(Array.isArray(data) ? data : []))
      .catch((err) => setMessage(err instanceof Error ? err.message : "Error al cargar carpetas"))
      .finally(() => setFoldersLoading(false));
  }, [dropboxConnected, justConnected]);

  function isSelected(path: string): boolean {
    const n = normPath(path);
    return sources.some((s) => normPath(s.path) === n);
  }

  function getSourceId(path: string): string | undefined {
    const n = normPath(path);
    return sources.find((s) => normPath(s.path) === n)?.id;
  }

  async function toggleFolder(folder: RootFolder) {
    const path = normPath(folder.path);
    setTogglingPath(path);
    setMessage(null);
    try {
      if (isSelected(path)) {
        const id = getSourceId(path);
        if (!id) return;
        const res = await fetchApi(`/api/dropbox/sources?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage(data.error ?? "Error al quitar carpeta");
          return;
        }
        setSources((prev) => prev.filter((s) => s.id !== id));
      } else {
        const res = await fetchApi("/api/dropbox/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(data.error ?? "Error al añadir carpeta");
          return;
        }
        setSources((prev) => [...prev, { id: data.id, path: data.path ?? path }]);
      }
    } finally {
      setTogglingPath(null);
    }
  }

  async function connectDropbox() {
    window.location.href = "/api/dropbox/auth";
  }

  async function disconnectDropbox() {
    setDisconnecting(true);
    setMessage(null);
    try {
      const res = await fetchApi("/api/dropbox/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Error al desconectar");
        return;
      }
      setConnectionInvalidated(true);
      setMessage("Desconectado. Conectá de nuevo para usar los nuevos permisos (files.metadata.read).");
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  async function runScan() {
    setScanning(true);
    setMessage(null);
    try {
      const res = await fetchApi("/api/dropbox/scan", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Error al escanear");
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
    if (dropbox === "save_error" && msg) {
      setMessage(`No se pudo guardar la conexión en la base de datos: ${decodeURIComponent(msg)}. Revisá SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL en Netlify.`);
      setConnectionInvalidated(true);
    }
  }, []);

  return (
    <div className="space-y-6">
      {!showConnectedUI && (
        <button
          onClick={connectDropbox}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
        >
          Conectar Dropbox
        </button>
      )}

      {showConnectedUI && (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={disconnectDropbox}
              disabled={disconnecting}
              className="px-4 py-2 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? "Desconectando…" : "Desconectar Dropbox"}
            </button>
            <span className="text-xs text-zinc-500">
              Si ves &quot;missing_scope&quot;, desconectá y conectá de nuevo (y activá files.metadata.read en la app de Dropbox).
            </span>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Carpetas a escanear</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Marcá las carpetas de la raíz de tu Dropbox que querés incluir en el scan.
            </p>
            {foldersLoading ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-6 text-center text-zinc-400 text-sm">
                Cargando carpetas…
              </div>
            ) : rootFolders.length === 0 && !foldersLoading ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-6 text-center text-zinc-500 text-sm">
                No se encontraron carpetas en la raíz o no se pudo conectar a Dropbox.
              </div>
            ) : (
              <ul className="rounded-lg border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
                {rootFolders.map((folder) => {
                  const path = normPath(folder.path);
                  const selected = isSelected(path);
                  const busy = togglingPath === path;
                  return (
                    <li
                      key={folder.path}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={busy}
                          onChange={() => toggleFolder(folder)}
                          className="rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900 w-4 h-4"
                        />
                        <span className="text-white font-medium truncate" title={folder.path}>
                          {folder.name || folder.path || "/"}
                        </span>
                        <span className="text-zinc-500 text-sm truncate shrink-0" title={folder.path}>
                          {folder.path}
                        </span>
                      </label>
                      {busy && (
                        <span className="text-xs text-zinc-500 shrink-0">Guardando…</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={runScan}
              disabled={scanning || sources.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {scanning ? "Escaneando…" : "Ejecutar scan incremental"}
            </button>
            <p className="text-xs text-zinc-500 mt-2">
              Detecta archivos nuevos o modificados en las carpetas seleccionadas y crea jobs de ingest. El worker
              procesará cada video (metadata, keyframes, transcripción, LLM, duplicados).
            </p>
          </div>
        </>
      )}

      {message && (
        <p
          className={`text-sm p-3 rounded-lg border ${
            message.startsWith("Error") || message.includes("error")
              ? "bg-red-900/20 border-red-800 text-red-200"
              : "bg-zinc-800/50 border-zinc-700 text-zinc-300"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
