"""Entry point for SPDS.exe (PyInstaller). Starts the API (which also serves the built web app) and opens the browser."""
import os
import sys
import threading
import time
import webbrowser

# Frozen: data files live under sys._MEIPASS. Run from source: this file sits in Tang/demo.
BASE = getattr(sys, "_MEIPASS", None) or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.environ.setdefault("DEMO_MEMORY", "true")
os.environ.setdefault("SPDS_SITE", os.path.join(BASE, "demo", "site"))
sys.path.insert(0, os.path.join(BASE, "api"))

import socket  # noqa: E402


def _free_port(start: int) -> int:
    # An old SPDS.exe still running in the background keeps port 8000, and the browser would open THAT old copy.
    for port in range(start, start + 20):
        with socket.socket() as sk:
            if sk.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start


WANT = int(os.environ.get("SPDS_PORT", "8000"))
PORT = _free_port(WANT)

import uvicorn  # noqa: E402
from app.main import app  # noqa: E402


def _open() -> None:
    time.sleep(2)
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    if PORT != WANT:
        print(f"Port {WANT} is busy (an old SPDS.exe is probably still running). Using {PORT} instead.")
    print(f"SPDS is starting at http://localhost:{PORT}  (close this window to stop)")
    threading.Thread(target=_open, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
