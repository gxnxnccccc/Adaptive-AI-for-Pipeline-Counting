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

PORT = int(os.environ.get("SPDS_PORT", "8000"))

import uvicorn  # noqa: E402
from app.main import app  # noqa: E402


def _open() -> None:
    time.sleep(2)
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    threading.Thread(target=_open, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
