# Variables de entorno

Lista de variables que usa la app y qué valor debe tener cada una.

---

## Supabase (obligatorias para la app y el callback de Dropbox)

| Variable | Qué es | Dónde obtener el valor |
|----------|--------|------------------------|
| **NEXT_PUBLIC_SUPABASE_URL** | URL del proyecto Supabase | En [Supabase](https://supabase.com/dashboard) → tu proyecto → **Settings** → **API** → **Project URL**. Ej: `https://abcdefgh.supabase.co` |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Clave pública (anon) de Supabase | Mismo lugar → **Project API keys** → **anon** **public**. Empieza por `eyJ...` |
| **SUPABASE_SERVICE_ROLE_KEY** | Clave de servicio (admin) de Supabase | Mismo lugar → **service_role** **secret**. Empieza por `eyJ...`. **No la expongas en el front.** |

Sin estas tres, la app no puede leer/escribir la base (incluido guardar el token de Dropbox en `dropbox_credentials`).

---

## Dropbox (obligatorias para conectar Dropbox y listar carpetas)

| Variable | Qué es | Dónde obtener el valor |
|----------|--------|------------------------|
| **DROPBOX_CLIENT_ID** | App key / Client ID de tu app Dropbox | [Dropbox Developers](https://www.dropbox.com/developers/apps) → tu app → **App key** |
| **DROPBOX_CLIENT_SECRET** | App secret / Client secret | Mismo lugar → **App secret** → **Show** → copiar |
| **DROPBOX_REDIRECT_URI** | URL de callback OAuth (opcional) | Si no la ponés, la app usa `{NEXT_PUBLIC_APP_URL}/api/dropbox/callback`. En producción poné algo como: `https://tu-sitio.netlify.app/api/dropbox/callback` |

Alternativas que también acepta la app (por si ya las tenés):  
`NEXT_PUBLIC_DROPBOX_APP_KEY` / `DROPBOX_APP_KEY` (mismo valor que **DROPBOX_CLIENT_ID**), y `DROPBOX_APP_SECRET` (mismo valor que **DROPBOX_CLIENT_SECRET**).

---

## URL de la app (recomendada en producción)

| Variable | Qué es | Dónde obtener el valor |
|----------|--------|------------------------|
| **NEXT_PUBLIC_APP_URL** | URL pública de tu app | En local: `http://localhost:3000`. En Netlify: `https://tu-dominio.netlify.app` (o tu dominio custom). |

Se usa para armar los redirects de OAuth (Dropbox, etc.) y enlaces. Si no está, en muchas rutas se usa el `origin` de la request.

---

## Worker (procesar videos: ingest, transcripción, etc.)

El worker (`worker/index.mjs`) usa estas variables cuando corre (por ejemplo en un cron o servicio aparte):

| Variable | Qué es | Dónde obtener el valor |
|----------|--------|------------------------|
| **SUPABASE_SERVICE_ROLE_KEY** o **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Misma que arriba | Igual que en la app |
| **OPENAI_API_KEY** | API key de OpenAI (Whisper, etc.) | [OpenAI API keys](https://platform.openai.com/api-keys). Formato: `sk-proj-...` |

Otras que puede usar el worker según features (YouTube/Vimeo, Whisper model, etc.): **GOOGLE_CLIENT_ID**, **GOOGLE_CLIENT_SECRET**, **VIMEO_CLIENT_ID**, **VIMEO_CLIENT_SECRET**, **WHISPER_MODEL**, etc. No son necesarias solo para “conectar Dropbox y listar carpetas”.

---

## Resumen mínimo para Netlify (Dropbox + Supabase)

En **Netlify** → **Site settings** → **Environment variables** conviene tener al menos:

1. **NEXT_PUBLIC_SUPABASE_URL** = `https://xxx.supabase.co`
2. **NEXT_PUBLIC_SUPABASE_ANON_KEY** = `eyJ...`
3. **SUPABASE_SERVICE_ROLE_KEY** = `eyJ...` (recomendado para que el callback pueda escribir en `dropbox_credentials`)
4. **DROPBOX_CLIENT_ID** = App key de tu app en Dropbox
5. **DROPBOX_CLIENT_SECRET** = App secret de tu app en Dropbox
6. **NEXT_PUBLIC_APP_URL** = `https://tu-sitio.netlify.app`
7. **DROPBOX_REDIRECT_URI** (opcional) = `https://tu-sitio.netlify.app/api/dropbox/callback`

Con eso, “Conectar Dropbox” y “listar carpetas en la raíz” deberían funcionar.
