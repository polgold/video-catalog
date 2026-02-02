#!/bin/bash
# Fix "not a git repository" en iCloud y hacer commit + push
set -e
REPO_DIR="/Users/polgold/Library/Mobile Documents/com~apple~CloudDocs/Dev/video-catalog"
git config --global --add safe.directory "$REPO_DIR"
cd "$REPO_DIR"
git add -A
git status
git commit -m "Video Catalog: Next.js, Supabase schema, Dropbox ingest, worker, Inbox/Detail/Settings UI" || true
git push origin main
