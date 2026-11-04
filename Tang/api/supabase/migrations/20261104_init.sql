-- SPDS migration v1: batches -> images -> pipes.
-- Written for Supabase Postgres. Apply only after Tang approves (plan app-flow, task 1).
-- Never edit this file after it is applied: add a new migration instead.

-- One detection = one batch (one DO number, many photos).
create table public.batches (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  operator_id   text not null check (length(operator_id) between 1 and 64),
  do_number     text check (length(do_number) between 1 and 64),
  status        text not null default 'draft' check (status in ('draft', 'confirmed')),
  model_total   integer not null default 0 check (model_total >= 0),
  actual_amount integer check (actual_amount >= 0),
  notes         text check (length(notes) between 1 and 2000),
  confirmed_at  timestamptz,
  -- confirmed and the operator's count differs from the model: lets the API filter
  -- "Flagged" with a plain column filter (PostgREST cannot compare two columns).
  flagged       boolean generated always as (
                  status = 'confirmed' and actual_amount is distinct from model_total
                ) stored,
  constraint batches_confirmed_complete check (
    status = 'draft'
    or (do_number is not null and actual_amount is not null
        and notes is not null and confirmed_at is not null)
  )
);

-- One uploaded photo. Failed photos are kept too (error set, model_count 0).
create table public.images (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.batches (id) on delete cascade,
  created_at      timestamptz not null default now(),
  position        integer not null check (position >= 1),  -- upload order: 1 = img_1 in the API response
  filename        text not null,
  original_bytes  integer not null check (original_bytes >= 0),
  model_count     integer not null default 0 check (model_count >= 0),
  mean_confidence real check (mean_confidence between 0 and 1),
  -- jsonb, not int[]: box format is still OPEN with the ML team (pixels vs 0-1, box vs circle).
  crop_box        jsonb,
  brightness      text check (brightness in ('dark', 'ok', 'bright')),
  error           text,
  unique (batch_id, position)
);

-- One detected (or user-added) pipe. Corrections are kept, never overwritten (training data later).
create table public.pipes (
  id         uuid primary key default gen_random_uuid(),
  image_id   uuid not null references public.images (id) on delete cascade,
  box        jsonb not null,  -- OPEN format, see images.crop_box
  confidence real check (confidence between 0 and 1),  -- null for user_added
  source     text not null default 'model' check (source in ('model', 'user_added')),
  removed    boolean not null default false
);

create index batches_created_at_idx on public.batches (created_at desc);
create index batches_do_number_idx on public.batches (do_number);
create index images_batch_id_idx on public.images (batch_id);
create index pipes_image_id_idx on public.pipes (image_id);

-- RLS on, no policies: anon/authenticated keys can read or write nothing.
-- Only the FastAPI server writes, with the secret key, which bypasses RLS.
-- If a publishable key leaks, the tables stay closed.
alter table public.batches enable row level security;
alter table public.images enable row level security;
alter table public.pipes enable row level security;
