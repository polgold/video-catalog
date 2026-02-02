"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Source = { id: string; path: string };
type FolderEntry = { path: string; name: string };

const fetchApi: typeof fetch =
  typeof window !== "undefined" ? window.fetch.bind(window) : fetch;

// Misma normalización que el servidor (scan y sources)
function normPath(p: string): string {
  const s = (p ?? "").trim().replace(/\/+/g, "/");
  const withLead = s.startsWith("/") ? s : `/${s}`;
  return withLead.endsWith("/") && withLead.length > 1 ? withLead.slice(0, -1) : withLead;
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
  const [col1, setCol1] = useState<FolderEntry[]>([]);
  const [col2, setCol2] = useState<FolderEntry[]>([]);
  const [col3, setCol3] = useState<FolderEntry[]>([]);
  const [selectedPathCol1, setSelectedPathCol1] = useState<string | null>(null);
  const [selectedPathCol2, setSelectedPathCol2] = useState<string | null>(null);
  const [loadingCol1, setLoadingCol1] = useState(false);
  const [loadingCol2, setLoadingCol2] = useState(false);
  const [loadingCol3, setLoadingCol3] = useState(false);
  const [togglingPath, setTogglingPath] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ folder: string; index: number; total: number; added: number; totalAdded: number } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [connectionInvalidated, setConnectionInvalidated] = useState(false);

  const justConnected = searchParams.get("dropbox") === "connected";
  const showConnectedUI = (dropboxConnected || justConnected) && !connectionInvalidated;

  useEffect(() => {
    setSources(initialSources);
  }, [initialSources]);

  useEffect(() => {
    if (justConnected) router.refresh();
  }, [justConnected, router]);

  const loadRootFolders = useCallback(() => {
    if (!showConnectedUI) return;
    setLoadingCol1(true);
    setMessage(null);
    fetchApi("/api/dropbox/root-folders")
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error ?? res.statusText)));
        return res.json();
      })
      .then((data: { folders?: FolderEntry[] } | FolderEntry[]) => {
        const list = Array.isArray(data) ? data : (data?.folders ?? []);
        const sorted = (Array.isArray(list) ? list : [])
          .slice()
          .sort((a, b) => (a.name || a.path).localeCompare(b.name || b.path, undefined, { sensitivity: "base" }));
        setCol1(sorted);
        setCol2([]);
        setCol3([]);
        setSelectedPathCol1(null);
        setSelectedPathCol2(null);
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : "Error al cargar carpetas"))
      .finally(() => setLoadingCol1(false));
  }, [showConnectedUI]);

  useEffect(() => {
    if (!showConnectedUI) return;
    loadRootFolders();
  }, [showConnectedUI, loadRootFolders]);

  const loadChildren = useCallback((path: string, setLoading: (v: boolean) => void, setEntries: (e: FolderEntry[]) => void) => {
    setLoading(true);
    const encoded = encodeURIComponent(path);
    fetchApi(`/api/dropbox/folder-children?path=${encoded}`)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error ?? res.statusText)));
        return res.json();
      })
      .then((data: { folders?: FolderEntry[] } | FolderEntry[]) => {
        const list = Array.isArray(data) ? data : (data?.folders ?? []);
        const sorted = (Array.isArray(list) ? list : [])
          .slice()
          .sort((a, b) => (a.name || a.path).localeCompare(b.name || b.path, undefined, { sensitivity: "base" }));
        setEntries(sorted);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedPathCol1 == null) {
      setCol2([]);
      setCol3([]);
      setSelectedPathCol2(null);
      return;
    }
    loadChildren(selectedPathCol1, setLoadingCol2, setCol2);
    setCol3([]);
    setSelectedPathCol2(null);
  }, [selectedPathCol1, loadChildren]);

  useEffect(() => {
    if (selectedPathCol2 == null) {
      setCol3([]);
      return;
    }
    loadChildren(selectedPathCol2, setLoadingCol3, setCol3);
  }, [selectedPathCol2, loadChildren]);

  function isSelected(path: string): boolean {
    const n = normPath(path);
    return sources.some((s) => normPath(s.path) === n);
  }

  function getSourceId(path: string): string | undefined {
    const n = normPath(path);
    return sources.find((s) => normPath(s.path) === n)?.id;
  }

  async function toggleFolder(path: string) {
    const n = normPath(path);
    setTogglingPath(n);
    setMessage(null);
    try {
      if (isSelected(n)) {
        const id = getSourceId(n);
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
          body: JSON.stringify({ path: n }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(data.error ?? "Error al añadir carpeta");
          return;
        }
        setSources((prev) => [...prev, { id: data.id, path: data.path ?? n }]);
      }
    } finally {
      setTogglingPath(null);
    }
  }

  async function selectAllRoots() {
    if (!col1.length) return;
    setMessage(null);
    const toAdd = col1.filter((f) => !isSelected(normPath(f.path)));
    for (const f of toAdd) {
      const n = normPath(f.path);
      const res = await fetchApi("/api/dropbox/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        setSources((prev) => [...prev, { id: data.id, path: data.path ?? n }]);
      }
    }
    if (toAdd.length > 0) setMessage(`${toAdd.length} carpeta(s) añadida(s).`);
  }

  async function deselectAll() {
    if (sources.length === 0) return;
    setMessage(null);
    for (const s of sources) {
      await fetchApi(`/api/dropbox/sources?id=${encodeURIComponent(s.id)}`, { method: "DELETE" });
    }
    setSources([]);
    setMessage("Todas las carpetas deseleccionadas.");
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
    if (!sources.length) {
      setMessage("Seleccioná al menos una carpeta para ejecutar el scan.");
      return;
    }
    setScanning(true);
    setScanProgress(null);
    setMessage(null);
    try {
      const res = await fetchApi("/api/dropbox/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds: sources.map((s) => s.id), stream: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const hint = (data as { hint?: string }).hint;
        setMessage(hint ? `${data.error ?? "Error al escanear"}. ${hint}` : (data.error ?? "Error al escanear"));
        return;
      }
      if (res.body == null) {
        setMessage("Error al escanear: respuesta sin cuerpo");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const dataStr = line.replace(/^data: /, "").trim();
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr) as { type?: string; error?: string; folder?: string; index?: number; total?: number; added?: number; totalAdded?: number };
            if (data.type === "progress" && data.folder != null && data.index != null && data.total != null) {
              setScanProgress({
                folder: data.folder,
                index: data.index,
                total: data.total,
                added: data.added ?? 0,
                totalAdded: data.totalAdded ?? 0,
              });
            } else if (data.type === "done") {
              setScanProgress(null);
              setMessage(`Scan completado. ${data.totalAdded ?? 0} videos nuevos añadidos a la cola.`);
            } else if (data.type === "error" && data.error) {
              setScanProgress(null);
              setMessage(`Error al escanear: ${data.error}`);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.replace(/^data: /, "").trim()) as { type?: string; error?: string; totalAdded?: number };
          if (data.type === "done") setMessage(`Scan completado. ${data.totalAdded ?? 0} videos nuevos añadidos a la cola.`);
          else if (data.type === "error" && data.error) setMessage(`Error al escanear: ${data.error}`);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(`Error de red o timeout. El scan puede tardar mucho en carpetas grandes. Detalle: ${msg}`);
    } finally {
      setScanning(false);
      setScanProgress(null);
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

  function renderColumn(
    title: string,
    entries: FolderEntry[],
    loading: boolean,
    selectedPath: string | null,
    onSelect: (path: string) => void
  ) {
    return (
      <div className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-800/30 min-w-0 flex-1">
        <div className="px-3 py-2 border-b border-zinc-700 text-xs font-medium text-zinc-400">{title}</div>
        <div className="overflow-auto min-h-[200px] max-h-[320px]">
          {loading ? (
            <div className="p-4 text-center text-zinc-500 text-sm">Cargando…</div>
          ) : entries.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">
              {selectedPath == null && title !== "Raíz" ? "Elegí una carpeta a la izquierda" : "Sin carpetas"}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {entries.map((folder) => {
                const pathNorm = normPath(folder.path);
                const selected = isSelected(pathNorm);
                const busy = togglingPath === pathNorm;
                const isRowSelected = selectedPath === pathNorm;
                return (
                  <li
                    key={folder.path}
                    className={`flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 transition-colors cursor-pointer ${
                      isRowSelected ? "bg-zinc-700/70" : ""
                    }`}
                    onClick={() => onSelect(pathNorm)}
                  >
                    <label
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName === "INPUT") e.stopPropagation();
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={busy}
                        onChange={() => toggleFolder(pathNorm)}
                        className="rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-white truncate" title={folder.path}>
                        {folder.name || folder.path || "/"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

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
            <p className="text-xs text-zinc-500 mb-3">
              Explorá la raíz y subcarpetas. <strong>Hacé clic en el nombre de la carpeta</strong> (no en la casilla) para ver subcarpetas en la columna siguiente. Marcá las casillas para incluir carpetas en el scan.
            </p>
            <p className="text-xs text-amber-400/90 mb-3">
              En deploy (Netlify) el scan puede hacer timeout en carpetas muy grandes; para muchas carpetas ejecutá el scan en local (<code className="bg-zinc-800 px-1 rounded">npm run dev</code>).
            </p>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={selectAllRoots}
                disabled={loadingCol1 || col1.length === 0}
                className="px-3 py-1.5 rounded border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Seleccionar todo (raíz)
              </button>
              <button
                type="button"
                onClick={deselectAll}
                disabled={sources.length === 0}
                className="px-3 py-1.5 rounded border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Deseleccionar todo
              </button>
              <button
                type="button"
                onClick={loadRootFolders}
                disabled={loadingCol1}
                className="px-3 py-1.5 rounded border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Actualizar lista
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {renderColumn("Raíz", col1, loadingCol1, selectedPathCol1, setSelectedPathCol1)}
              {renderColumn("Subcarpetas", col2, loadingCol2, selectedPathCol2, setSelectedPathCol2)}
              {renderColumn("Subcarpetas", col3, loadingCol3, null, () => {})}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              {sources.length} carpeta(s) seleccionada(s) para el scan.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={runScan}
              disabled={scanning || sources.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {scanning ? "Escaneando…" : "Ejecutar scan incremental"}
            </button>
            {scanProgress && (
              <p className="text-sm text-emerald-300/90 mt-2">
                Carpeta {scanProgress.index} de {scanProgress.total}: {scanProgress.folder} — {scanProgress.totalAdded} videos añadidos hasta ahora.
              </p>
            )}
            {scanning && !scanProgress && (
              <p className="text-xs text-zinc-400 mt-2">
                Conectando con Dropbox… (puede tardar varios minutos en carpetas grandes)
              </p>
            )}
            {sources.length === 0 && (
              <p className="text-xs text-amber-400/90 mt-2">
                Seleccioná al menos una carpeta para ejecutar el scan.
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-2">
              Detecta archivos nuevos o modificados en las carpetas seleccionadas y crea jobs de ingest. El worker
              procesará cada video (metadata, keyframes, transcripción, LLM, duplicados). El scan incluye todas las subcarpetas (recursivo).
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
