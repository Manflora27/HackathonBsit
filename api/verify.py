"""Server-side re-check of lesson answer keys with the same SymPy engine the browser runs (engine/gapfinder.py)."""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "engine"))
import gapfinder  # noqa: E402


def verify_items(items: list) -> list:
    """One boolean per item: does the engine accept `expected` as the answer to `given`?"""
    out = []
    for it in items:
        try:
            out.append(bool(gapfinder.check_answer(it["given"], it["expected"], it.get("form", "any")).get("correct")))
        except Exception:  # noqa: BLE001 - an item that crashes the engine is not verified
            out.append(False)
    return out


def verify_examples(examples: list) -> list:
    """One boolean per worked example: does every step follow from the one before?"""
    out = []
    for ex in examples:
        try:
            a = gapfinder.analyze(ex["problem"], ex["steps"], ex.get("kind", "solve"))
            out.append(not a.get("error") and len(a["steps"]) == len(ex["steps"]) and all(s["status"] == "ok" for s in a["steps"]))
        except Exception:  # noqa: BLE001
            out.append(False)
    return out


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        secret = os.environ.get("LESSON_SIGNING_KEY")
        if not secret or self.headers.get("x-verify-key") != secret:
            return self._send(401, {"error": "unauthorized"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            items = body["items"]
            if not isinstance(items, list) or len(items) > 20:
                raise ValueError("bad items")
            self._send(200, {"results": verify_items(items)})
        except Exception:  # noqa: BLE001
            self._send(400, {"error": "bad request"})

    def _send(self, status: int, data: dict):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
