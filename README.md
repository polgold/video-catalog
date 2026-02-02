# Video Catalog

Web app para catalogar, revisar y publicar videos desde Dropbox.

## Stack

- **Next.js (App Router)** – UI + API routes
- **Supabase Postgres** – base de datos
- **Supabase Storage** – keyframes
- **Worker (Node)** – cola de jobs: ingest (ffmpeg, Whisper, LLM, duplicados)

## Requisitos previos

- Node 18+
- ffmpeg en PATH (para el worker)
- Cuenta Supabase, Dropbox (app OAuth), OpenAI (Whisper + GPT)

## Configuración

1. Copia `.env.example` a `.env.local` y rellena:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `NEXT_PUBLIC_DROPBOX_APP_KEY`
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (ej. `http://localhost:3000`)

2. **Supabase**
   - Crea el proyecto y ejecuta las migraciones en `supabase/migrations/`.
   - Crea un bucket en Storage llamado `keyframes` (público para lectura).

3. **Dropbox**
   - Crea una app en https://www.dropbox.com/developers/apps (Full Dropbox o App folder).
   - En Redirect URI pon: `{NEXT_PUBLIC_APP_URL}/api/dropbox/callback`.

## Desarrollo

```bash
npm install
npm run dev
```

- **Inbox**: `http://localhost:3000/inbox` – lista de videos `pending_review` con filtros.
- **Settings**: `http://localhost:3000/settings` – conectar Dropbox, añadir carpetas, ejecutar scan.
- **Detalle**: `/videos/[id]` – preview, keyframes, transcript, campos editables, Approve/Reject/Needs Fix, Publicar YouTube/Vimeo.

## Worker

Procesa jobs de tipo `ingest` y `process`: descarga desde Dropbox, extrae metadata/audio/keyframes (ffmpeg), sube keyframes a Supabase Storage, transcribe (Whisper), genera metadata con LLM, detecta duplicados (sha256) y actualiza el video a `pending_review`.

```bash
cd worker
npm install
# Variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
# El token de Dropbox se lee de la tabla dropbox_credentials.
node index.mjs
```

El worker hace polling cada 10 s a la tabla `jobs`. Asegúrate de que el bucket `keyframes` exista en Supabase Storage.

## API

- `GET /api/dropbox/auth` – redirige a OAuth Dropbox.
- `GET /api/dropbox/callback` – callback OAuth, guarda token en DB.
- `GET/POST/DELETE /api/dropbox/sources` – listar/añadir/eliminar carpetas.
- `POST /api/dropbox/scan` – scan incremental (delta) y creación de jobs ingest.
- `GET /api/videos?status=&source_id=&genre=&from=&to=&min_duration=&max_duration=` – listar videos.
- `GET /PATCH /api/videos/[id]` – detalle y actualización.
- `GET /api/videos/[id]/duplicates` – posibles duplicados.
- `GET /api/videos/[id]/preview` – redirige a enlace temporal Dropbox del video.
- `POST /api/videos/[id]/approve` | `reject` | `needs-fix` – cambiar estado.
- `POST /api/videos/[id]/publish/youtube` | `publish/vimeo` – encolar publicación (el worker o un job externo puede subir a las plataformas).

## Publicación YouTube/Vimeo

Las rutas de publish crean un job `publish_youtube` o `publish_vimeo`. La subida real requiere implementar OAuth y upload en el worker o en un servicio aparte (Google APIs, Vimeo API), usando las credenciales guardadas en `platform_credentials`.
