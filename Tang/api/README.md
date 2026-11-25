# api/
FastAPI. Layout planned: app/main.py, app/detector.py (mock -> real model), app/repo.py (Supabase access, only file that imports supabase-py), supabase/migrations/ (SQL), tests/.

## Run
```bash
cd Tang/api
python -m venv .venv
.venv/Scripts/activate        # Windows (Git Bash: source .venv/Scripts/activate)
pip install -r requirements.txt
cp .env.example .env          # fill in values, never commit
uvicorn app.main:app --port 8000 --reload
python -m pytest -q
```
Check: `curl localhost:8000/health` returns `{"status":"ok"}`.

## POST /api/counts
Multipart, repeat the field `images`. Limits: max 10 images (more -> 413), max 15 MB each (413), 0 images -> 422, not a decodable image -> 415 (message names the file number; nothing is saved).
```powershell
curl.exe -F "images=@..\samples\1.jpg" -F "images=@..\samples\2.jpg" http://localhost:8000/api/counts
```
Needs real Supabase values in `.env` (it saves a batch). `quality` is a fixed placeholder, not a measurement (OPEN-3).
Upload limits are enforced after the request body has been received, and there is no request-size cap on the server. A proxy limit or auth is needed before any public deploy (M5). The demo is single-user, LAN only.

## Smoke test (real server + real Supabase)
Start uvicorn first with a real `.env`, put 5+ photos in `Tang/samples/`, then from `Tang/api`:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1      # options: -Base, -Dir, -Count
```
It prints PASS/FAIL per check and a `batch_id`. Paste that id into `scripts/smoke_check.sql` (Supabase SQL editor) to verify the rows; the script also prints the cleanup steps.

## CORS
Allowed origins come from `CORS_ORIGINS` in `.env` (default: `http://localhost:5173,http://127.0.0.1:5173`). Testing from a phone on the LAN: add `http://<laptop-ip>:5173` to `CORS_ORIGINS` and run uvicorn with `--host 0.0.0.0`.
