-- Solo tabla dropbox_credentials (por si el esquema se aplicó a medias)
create table if not exists public.dropbox_credentials (
  id uuid primary key default gen_random_uuid(),
  access_token text,
  refresh_token text,
  cursor text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.dropbox_credentials enable row level security;

drop policy if exists "Allow all for service role" on public.dropbox_credentials;
create policy "Allow all for service role" on public.dropbox_credentials for all using (true);
