"""
FastF1 On-Demand Ingestion Server
===================================
Run:  python server.py
Listens on http://localhost:8000

Endpoints:
  POST /api/ingest   { "year": 2024, "event": "Monza", "session_type": "R" }
                     -> blocks until ingestion finishes
                     <- { "ok": true,  "sessionId": "2024-monza-r" }
                        { "ok": false, "error": "..."  }

  GET  /api/status   <- { "ok": true, "sessions": [...] }  (reads index.json)

CORS headers are set for every response so the Vite dev server on :5173 can call freely.
"""

import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer

# Make sure ingest.py (in the same directory) is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest import ingest_session  # noqa: E402


# ── Helpers ──────────────────────────────────────────────────────────────────

def _cors_headers(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def _send_json(handler, status: int, payload: dict):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    _cors_headers(handler)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_body(handler) -> dict | None:
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


# ── Request handler ───────────────────────────────────────────────────────────

class IngestHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):  # suppress default access log noise
        print(f"[server] {fmt % args}")

    # ── CORS preflight ────────────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        _cors_headers(self)
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ── GET /api/status ───────────────────────────────────────────────────────
    def do_GET(self):
        if self.path == "/api/status":
            index_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "public", "data", "index.json"
            )
            if os.path.exists(index_path):
                with open(index_path, "r") as f:
                    sessions = json.load(f)
            else:
                sessions = []
            _send_json(self, 200, {"ok": True, "sessions": sessions})
        else:
            _send_json(self, 404, {"ok": False, "error": "Not found"})

    # ── POST /api/ingest ──────────────────────────────────────────────────────
    def do_POST(self):
        if self.path != "/api/ingest":
            _send_json(self, 404, {"ok": False, "error": "Not found"})
            return

        body = _read_body(self)
        if body is None:
            _send_json(self, 400, {"ok": False, "error": "Invalid JSON body"})
            return

        year = body.get("year")
        event = body.get("event")
        session_type = body.get("session_type", "R")

        if not year or not event:
            _send_json(self, 400, {"ok": False, "error": "Missing 'year' or 'event' in request body"})
            return

        try:
            year = int(year)
        except (ValueError, TypeError):
            _send_json(self, 400, {"ok": False, "error": f"'year' must be an integer, got: {year!r}"})
            return

        session_id = f"{year}-{str(event).lower().replace(' ', '-')}-{session_type.lower()}"
        print(f"\n[server] ▶ Ingestion requested: {year} {event} {session_type}  →  {session_id}")

        try:
            ingest_session(year=year, event=event, session_type=session_type)
            print(f"[server] ✔ Ingestion complete: {session_id}")
            _send_json(self, 200, {"ok": True, "sessionId": session_id})
        except Exception:
            tb = traceback.format_exc()
            print(f"[server] ✖ Ingestion failed:\n{tb}")
            _send_json(self, 500, {"ok": False, "error": tb})


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(("", port), IngestHandler)
    print(f"[server] FastF1 ingest server listening on http://localhost:{port}")
    print("[server]   POST /api/ingest  {{year, event, session_type}}")
    print("[server]   GET  /api/status")
    print("[server] Ctrl-C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[server] Stopped.")


if __name__ == "__main__":
    main()
