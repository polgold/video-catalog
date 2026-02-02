-- Video Catalog: initial schema for Supabase Postgres
-- Sources: Dropbox folders to ingest from
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  dropbox_folder_id text not null unique,
  path text not null,
  cursor text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Videos: catalog entries (metadata, transcript, AI fields, status)
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  dropbox_file_id text,
  path text,
  filename text,
  status text not null default 'pending_ingest' check (status in (
    'pending_ingest', 'processing', 'pending_review', 'approved', 'rejected', 'needs_fix'
  )),
  file_sha256 text,
  file_size bigint,
  duration_sec numeric,
  fps numeric,
  resolution text,
  codec text,
  title text,
  description text,
  summary text,
  suggested_title text,
  suggested_description text,
  genre text,
  styles jsonb default '[]',
  tags jsonb default '[]',
  thumbnail_keyframe int,
  transcript_text text,
  transcript_segments jsonb default '[]',
  keyframe_urls jsonb default '[]',
  phash_keyframes jsonb default '[]',
  audio_fingerprint text,
  youtube_id text,
  vimeo_id text,
  published_youtube_at timestamptz,
  published_vimeo_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_videos_status on public.videos(status);
create index if not exists idx_videos_source on public.videos(source_id);
create index if not exists idx_videos_file_sha256 on public.videos(file_sha256);
create index if not exists idx_videos_created on public.videos(created_at desc);

-- Jobs: queue for worker (ingest, process, publish)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos(id) on delete cascade,
  type text not null check (type in ('ingest', 'process', 'publish_youtube', 'publish_vimeo')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  payload jsonb default '{}',
  result jsonb,
  error text,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_jobs_status_type on public.jobs(status, type);
create index if not exists idx_jobs_created on public.jobs(created_at);

-- Duplicates: exact or near-duplicate links between videos
create table if not exists public.duplicates (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  duplicate_video_id uuid not null references public.videos(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 1),
  reason text not null check (reason in ('exact_hash', 'visual_phash', 'audio_fp', 'semantic')),
  created_at timestamptz default now(),
  unique(video_id, duplicate_video_id)
);

create index if not exists idx_duplicates_video on public.duplicates(video_id);

-- Platform credentials: OAuth tokens for YouTube/Vimeo (single row per platform or per user if multi-tenant)
create table if not exists public.platform_credentials (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique check (platform in ('youtube', 'vimeo')),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Dropbox OAuth state / tokens (store in app or this table)
create table if not exists public.dropbox_credentials (
  id uuid primary key default gen_random_uuid(),
  access_token text,
  refresh_token text,
  cursor text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: enable and basic policies (adjust for your auth)
alter table public.sources enable row level security;
alter table public.videos enable row level security;
alter table public.jobs enable row level security;
alter table public.duplicates enable row level security;
alter table public.platform_credentials enable row level security;
alter table public.dropbox_credentials enable row level security;

create policy "Allow all for service role" on public.sources for all using (true);
create policy "Allow all for service role" on public.videos for all using (true);
create policy "Allow all for service role" on public.jobs for all using (true);
create policy "Allow all for service role" on public.duplicates for all using (true);
create policy "Allow all for service role" on public.platform_credentials for all using (true);
create policy "Allow all for service role" on public.dropbox_credentials for all using (true);
