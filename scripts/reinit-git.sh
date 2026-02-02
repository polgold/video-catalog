#!/bin/bash
# Recrear .git en este directorio (mantiene origin). Usar solo si safe.directory no funciona.
set -e
cd "/Users/polgold/Library/Mobile Documents/com~apple~CloudDocs/Dev/video-catalog"
ORIGIN_URL="https://github.com/polgold/video-catalog.git"
echo "Eliminando .git antiguo..."
rm -rf .git
echo "Inicializando nuevo repo..."
git init
git remote add origin "$ORIGIN_URL"
git branch -M main
git add -A
git status
git commit -m "Video Catalog: Next.js, Supabase schema, Dropbox ingest, worker, Inbox/Detail/Settings UI"
git push -u origin main
echo "Listo."
