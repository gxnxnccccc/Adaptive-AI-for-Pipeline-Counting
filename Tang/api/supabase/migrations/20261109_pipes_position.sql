-- SPDS migration v3: stable pipe index for per-box corrections. NOT APPLIED YET.
-- position = index of the pipe in images[i].pipes[] of the upload response (0-based).
-- Model pipes always have one; user_added pipes have null (Postgres unique allows many nulls).
-- Written for Supabase Postgres. Apply only after Tang approves. Never edit after applied.
alter table public.pipes add column position integer check (position >= 0);
alter table public.pipes add constraint pipes_image_position_key unique (image_id, position);
