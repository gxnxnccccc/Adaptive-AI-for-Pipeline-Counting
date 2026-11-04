# api/
FastAPI backend. Run: see [../README.md](../README.md).

| Path | What |
|---|---|
| `app/main.py` | App, CORS, error handlers |
| `app/detector.py` | Detector adapter. Mock (OpenCV circles) now, real model later |
| `app/repo.py` | The only file that imports supabase-py. `InMemoryRepo` is used in tests |
| `app/routes/` | `counts.py` (upload, confirm, records), `stats.py` |
| `supabase/migrations/` | SQL files. Written, **not applied yet**. Never edit an applied file, add a new one |
| `tests/` | pytest |

Config in `api/.env` (gitignored, copy `.env.example`). Without Supabase keys the API still starts; storage endpoints return 503 "database not configured". Never commit `.env`; the secret key stays server-side only.
