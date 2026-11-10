# Tang/: Fullstack (web app + FastAPI backend)

Owner: Tang (Phutiphum Thongin). Teammates: read freely, please don't edit, open an issue or ping Tang instead.

**Status (10 Nov 2026):** the UI follows the light capture-upload design, the detector is still a **mock** (real model not plugged in), and a Docker demo runs the whole app with no keys. Supabase storage is written but only used when keys are set; otherwise the Docker demo keeps data in memory. See [docs/history.md](docs/history.md).

| Folder | What |
|---|---|
| `web/` | Web app (Vite + React + TS + Tailwind): login, New Detection (upload, result, confirm), Records, Dashboard |
| `api/` | FastAPI backend, API docs at `http://localhost:8000/docs` when running |
| `docs/api-contract.md` | **ML team: please read.** The result format the app expects, with open questions for you |
| `docs/requirements.md` | Professor's requests + 30 Nov demo scope |
| `docs/plans/` | Feature plans (task lists with done-criteria) |
| `docs/design/` | Screen specs. Figma is a visual reference only; `preview/capture-upload.html` opens in any browser (phone and PC toggle, fake counts) |
| `docs/history.md` | What was done and what is next |
| `docs/problem-log.md` | Problems for the final report |

## Run the bundle (no Docker, no Node)
Install Python 3.12+, then double-click `demo/start.bat` (Mac/Linux: `demo/start.sh`). Opens http://localhost:8000 with the whole app. Details: [demo/README.md](demo/README.md).

## Run with Docker
1. Install Docker Desktop and start it.
2. ```bash
   git clone https://github.com/gxnxnccccc/Adaptive-AI-for-Pipeline-Counting
   cd Adaptive-AI-for-Pipeline-Counting/Tang
   docker compose up --build
   ```
3. Open http://localhost:8080 and log in with any ID and password.

Demo data is kept in memory only: it is lost when the containers restart. Stop with Ctrl+C or `docker compose down`. To use real Supabase instead, put the keys in `api/.env` and uncomment the `env_file` lines in `docker-compose.yml`.

## Run it manually (no Docker)
Needs Python 3.12 and Node 20+.

API (terminal 1):
```bash
cd Tang/api
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # macOS/Linux: .venv/bin/pip
cp .env.example .env                              # fill in Supabase keys later; the API starts without them
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```
Web (terminal 2):
```bash
cd Tang/web
npm install
cp .env.example .env                              # VITE_API_URL=http://localhost:8000
npm run dev                                       # http://localhost:5173
```
Demo login: any Operator ID and password (mock, not real security).

Checks: `cd api && .venv/Scripts/python -m pytest` and `cd web && npx vitest run`.

## For the ML team
The detector is one function: `api/app/detector.py` (`detect(image_bytes)`, currently an OpenCV circle finder used as a stand-in). Replace it with the real model; box format, confidence scale and crop-box source are still **OPEN** in [docs/api-contract.md](docs/api-contract.md).

## For Guy (RN)
Use the same API. Types are generated from `/openapi.json`. Endpoints: `POST /api/counts`, `POST /api/counts/{batch_id}/confirm`, `GET /api/counts`, `GET /api/stats`.

AI setup: `CLAUDE.md`, `AGENTS.md`, `.claude/` are Tang's Claude Code config. They only affect Claude when it's opened in this folder.
