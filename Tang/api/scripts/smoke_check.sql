-- Smoke-check queries for the batch created by scripts/smoke.ps1.
-- Run in the Supabase SQL editor. Replace BATCH_ID_HERE (3 places + the delete)
-- with the batch_id printed by the script. Keep the quotes.

-- 1. The batch row exists and is not confirmed. Expect: 1 row, confirmed = false.
select id, created_at, confirmed
from batches
where id = 'BATCH_ID_HERE';

-- 2. Number of images in the batch. Expect: 5 (or your -Count).
select count(*) as image_rows
from images
where batch_id = 'BATCH_ID_HERE';

-- 3. Each image: count must equal the number of pipes. Expect: ok = true on every row.
select id,
       filename,
       count,
       jsonb_array_length(pipes) as pipes_len,
       count = jsonb_array_length(pipes) as ok,
       original_bytes
from images
where batch_id = 'BATCH_ID_HERE';

-- 4. CLEANUP (uncomment and run when done). images rows are deleted by cascade.
-- Then also delete the folder api/data/images/BATCH_ID_HERE on disk.
-- delete from batches where id = 'BATCH_ID_HERE';
