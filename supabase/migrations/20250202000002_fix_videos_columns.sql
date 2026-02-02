-- Fix: add missing columns to videos if table existed from an older schema
alter table public.videos add column if not exists file_sha256 text;
alter table public.videos add column if not exists file_size bigint;
alter table public.videos add column if not exists duration_sec numeric;
alter table public.videos add column if not exists fps numeric;
alter table public.videos add column if not exists resolution text;
alter table public.videos add column if not exists codec text;
alter table public.videos add column if not exists title text;
alter table public.videos add column if not exists description text;
alter table public.videos add column if not exists summary text;
alter table public.videos add column if not exists suggested_title text;
alter table public.videos add column if not exists suggested_description text;
alter table public.videos add column if not exists genre text;
alter table public.videos add column if not exists styles jsonb default '[]';
alter table public.videos add column if not exists tags jsonb default '[]';
alter table public.videos add column if not exists thumbnail_keyframe int;
alter table public.videos add column if not exists transcript_text text;
alter table public.videos add column if not exists transcript_segments jsonb default '[]';
alter table public.videos add column if not exists keyframe_urls jsonb default '[]';
alter table public.videos add column if not exists phash_keyframes jsonb default '[]';
alter table public.videos add column if not exists audio_fingerprint text;
alter table public.videos add column if not exists youtube_id text;
alter table public.videos add column if not exists vimeo_id text;
alter table public.videos add column if not exists published_youtube_at timestamptz;
alter table public.videos add column if not exists published_vimeo_at timestamptz;

create index if not exists idx_videos_file_sha256 on public.videos(file_sha256);
