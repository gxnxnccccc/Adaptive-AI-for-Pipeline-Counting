"""SPDS live launcher: update the code, start API + web (live reload), open the browser.

Open it with the "SPDS" Desktop shortcut (made once by make-shortcut.bat), which runs SPDS-live.bat.
Steps every start:
  1. git pull --ff-only (current branch). Local edits or a diverged branch: warn, keep current code.
  2. npm install when web/package-lock.json changed; pip install when api/requirements.txt changed.
  3. API (DEMO_MEMORY, uvicorn --reload) + Vite dev server, each on the first free port.
  4. Wait until the page answers, then open it. Close the window (or Ctrl+C) to stop both.
Standard library only: any Python 3.12+ can run it, no venv needed.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

WIN = os.name == "nt"
ROOT = Path(__file__).resolve().parents[2]
TANG = ROOT / "Tang"
WEB = TANG / "web"
API = TANG / "api"
STAMPS = TANG / "demo" / ".live-stamps.json"  # gitignored: last installed lock hashes


def say(msg: str) -> None:
    print(f"[SPDS] {msg}", flush=True)


def run(cmd: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, check=check, text=True, capture_output=not check)


def find(*names: str) -> str | None:
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


def update_code() -> None:
    git = find("git")
    if not git:
        say("git not found: skipping update, using the code already on disk.")
        return
    branch = run([git, "rev-parse", "--abbrev-ref", "HEAD"], ROOT, check=False).stdout.strip()
    say(f"Updating code from GitHub (branch {branch})...")
    r = run([git, "pull", "--ff-only"], ROOT, check=False)
    if r.returncode == 0:
        say((r.stdout.strip().splitlines() or ["Up to date."])[-1])
    else:
        say("Could not update automatically (local edits or the branch moved). Using the code on disk.")
        say((r.stderr or r.stdout).strip().splitlines()[-1] if (r.stderr or r.stdout).strip() else "")
    sha = run([git, "log", "-1", "--format=%h %s"], ROOT, check=False).stdout.strip()
    say(f"Running: {sha}")


def file_hash(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else ""


def install_deps() -> str:
    stamps = json.loads(STAMPS.read_text()) if STAMPS.exists() else {}

    npm = find("npm.cmd", "npm") if WIN else find("npm")
    if not npm:
        sys.exit("[SPDS] Node.js (npm) not found. Install Node 20+ from nodejs.org, then try again.")
    lock = file_hash(WEB / "package-lock.json")
    if stamps.get("web") != lock or not (WEB / "node_modules").exists():
        say("Web packages changed: npm install (1-2 min the first time)...")
        run([npm, "install", "--no-audit", "--no-fund"], WEB)
        stamps["web"] = lock

    py = venv_python()
    if not py.exists():
        base = find("py", "python", "python3") if WIN else find("python3", "python")
        if not base:
            sys.exit("[SPDS] Python not found. Install Python 3.12+ (tick 'Add to PATH'), then try again.")
        say("First run: creating the API environment...")
        run([base, "-m", "venv", str(API / ".venv")], API)
    req = file_hash(API / "requirements.txt")
    if stamps.get("api") != req:
        say("API packages changed: pip install...")
        run([str(py), "-m", "pip", "install", "-q", "-r", "requirements.txt"], API)
        stamps["api"] = req

    STAMPS.write_text(json.dumps(stamps))
    return npm


def venv_python() -> Path:
    return API / ".venv" / ("Scripts/python.exe" if WIN else "bin/python")


def free_port(start: int) -> int:
    for port in range(start, start + 30):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    sys.exit(f"[SPDS] No free port near {start}.")


def wait_for(url: str, seconds: int = 90) -> bool:
    end = time.time() + seconds
    while time.time() < end:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except Exception:
            time.sleep(0.5)
    return False


def main() -> None:
    say(f"Project folder: {ROOT}")
    if not WEB.exists():
        sys.exit(f"[SPDS] Can't find {WEB}. Run make-shortcut.bat again from your repo folder.")
    update_code()
    npm = install_deps()

    api_port = free_port(8000)
    web_port = free_port(5173)
    web_url = f"http://localhost:{web_port}"

    api_env = {**os.environ, "DEMO_MEMORY": "true", "CORS_ORIGINS": json.dumps([web_url])}
    web_env = {**os.environ, "VITE_API_URL": f"http://localhost:{api_port}"}  # beats web/.env
    procs = [
        subprocess.Popen(
            [str(venv_python()), "-m", "uvicorn", "app.main:app", "--port", str(api_port), "--reload"],
            cwd=API,
            env=api_env,
        ),
        subprocess.Popen([npm, "run", "dev", "--", "--port", str(web_port), "--strictPort"], cwd=WEB, env=web_env),
    ]
    try:
        say("Starting API and web...")
        if wait_for(f"http://127.0.0.1:{api_port}/health") and wait_for(web_url):
            say(f"OPEN: {web_url}   (login: any ID + password spds)")
            say("Live mode: edit code and the page updates by itself. Close this window to stop.")
            webbrowser.open(web_url)
        else:
            say("The app did not start in time. Read the errors above.")
        while all(p.poll() is None for p in procs):
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()


if __name__ == "__main__":
    main()
