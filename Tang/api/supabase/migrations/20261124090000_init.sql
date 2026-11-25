-- 20261124090000_init.sql
-- Demo tables for mock API (demo items 1 and 2). Mock fields only.
-- Run once by hand in the Supabase SQL editor (safe to re-run: if not exists).
--
-- NOT in this file (later demo items / OPEN, add as new migrations):
--   pipe size, confirm fields (final count, added, removed), DO number,
--   note, order amount, pipe-level table, storage bucket, ML-only fields.
--
-- Notes:
--   * images.filename is display data only. Never use it as a file path.
--   * RLS is on with NO policies: anon/publishable key can read nothing.
--     The FastAPI server uses the service-role key, which bypasses RLS.
--   * quality / stored_bytes / original_bytes are placeholders until the
--     quality check and compression are built.

create table if not exists public.batches (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  confirmed  boolean not null default false
);

create table if not exists public.images (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references public.batches(id) on delete cascade,
  filename       text,
  count          integer not null,
  crop_box       jsonb,
  pipes          jsonb not null default '[]',
  quality        jsonb,
  original_bytes bigint,
  stored_bytes   bigint
);

create index if not exists images_batch_id_idx on public.images (batch_id);

alter table public.batches enable row level security;
alter table public.images  enable row level security;
