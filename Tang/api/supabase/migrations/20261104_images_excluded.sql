-- SPDS migration v2: photos the operator removed in step 2 stay in the DB but do not count.
-- Written for Supabase Postgres. Apply only after Tang approves. Never edit after applied.
alter table public.images add column excluded boolean not null default false;
