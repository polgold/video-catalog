# Subcarpetas, timeout y scan por paths

## Archivos tocados

- **`src/app/api/dropbox/list-folders/route.ts`** (nuevo) – GET list-folders con `path` (root `""`, subcarpetas `path_lower`).
- **`src/app/api/scan/start/route.ts`** (nuevo) – POST crea job tipo `scan` y devuelve `{ jobId }`.
- **`src/app/api/jobs/[id]/route.ts`** (nuevo) – GET estado del job (para polling).
- **`src/app/settings/SettingsClient.tsx`** – UI usa `list-folders`, 3 columnas con click para subcarpetas; scan vía `/api/scan/start` + polling a `/api/jobs/[id]`.
- **`worker/index.mjs`** – Procesa jobs tipo `scan` (usa EXACTAMENTE `payload.paths`), get/create source por path, list_folder recursivo, crea videos e ingest jobs.
- **`supabase/migrations/20250202000007_jobs_scan_type.sql`** – Añade tipo `scan` al check de `jobs.type`.

Opcional: se pueden dejar de usar `root-folders` y `folder-children`; la UI ya usa solo `list-folders`.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dropbox/list-folders?path=` | Lista carpetas. `path=` → raíz (Dropbox `path: ""`). `path=/2024` → subcarpetas de `/2024` (usa `path_lower`). Respuesta: `{ folders: [{ name, path_lower, path_display }] }`, solo `.tag === "folder"`. |
| POST | `/api/scan/start` | Body: `{ selectedFolders: string[] }` (paths). Valida y loguea paths, crea job `type: "scan"`, `payload: { paths }`. Respuesta rápida: `{ jobId }`. |
| GET | `/api/jobs/[id]` | Devuelve el job (id, type, status, payload, result, error, created_at, started_at, completed_at) para mostrar estado y errores. |

## Cómo probar

1. **Migración**  
   Ejecutar en Supabase SQL Editor (o `supabase db push`):
   ```sql
   ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_type_check;
   ALTER TABLE public.jobs ADD CONSTRAINT jobs_type_check
     CHECK (type IN ('ingest', 'process', 'publish_youtube', 'publish_vimeo', 'scan'));
   ```
   Si falla el DROP por nombre de constraint, buscar el nombre con:
   ```sql
   SELECT conname FROM pg_constraint
   WHERE conrelid = 'public.jobs'::regclass AND contype = 'c';
   ```
   y usar ese nombre en `DROP CONSTRAINT ...`.

2. **Listado de carpetas (subcarpetas)**  
   - Conectar Dropbox en Settings.  
   - Columna 1 (Raíz): carga `GET /api/dropbox/list-folders?path=`.  
   - Clic en el **nombre** de una carpeta (ej. "2024"): columna 2 carga `GET /api/dropbox/list-folders?path=/2024` (path_lower).  
   - Clic en una carpeta de la columna 2: columna 3 carga sus subcarpetas.  
   - Las casillas añaden/quitan sources; el path usado es el normalizado (path_lower/path_display).

3. **Scan sin timeout (background)**  
   - Seleccionar al menos una carpeta (checkbox).  
   - Pulsar "Ejecutar scan incremental".  
   - Debe aparecer algo como: "Scan iniciado (job xxx…). El worker procesará en background."  
   - La UI hace polling a `GET /api/jobs/[jobId]` cada 3 s y muestra estado (pending/running/done/failed) y, si hay, error o `result.added`.  
   - Con el worker corriendo (`node worker/index.mjs`), el job `scan` se procesa usando EXACTAMENTE los paths de `selectedFolders` (validados y logueados en `/api/scan/start`).

4. **Validar paths en el scan**  
   - En el backend: `/api/scan/start` recibe `selectedFolders`, los normaliza, rechaza array vacío y loguea en dev: `[scan/start] paths recibidos: N [ ... ]`.  
   - En el worker: al procesar un job `scan`, usa `payload.paths` tal cual (ya normalizados) y loguea: `[scan] paths recibidos: N [ ... ]`.  
   - Garantía: el scan usa solo esos paths (get/create source por path, luego list_folder recursivo por cada uno).
