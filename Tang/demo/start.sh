#!/bin/sh
# SPDS demo: ./start.sh   Needs Python 3.12+ only. First run installs packages.
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/pip install -q -r ../api/requirements.txt; } || exit 1
export DEMO_MEMORY=true
(sleep 2; (xdg-open http://localhost:8000 || open http://localhost:8000) >/dev/null 2>&1) &
cd ../api && exec ../demo/.venv/bin/python -m uvicorn app.main:app --port 8000
