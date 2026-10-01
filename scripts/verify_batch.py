"""Batch SymPy checks for scripts/audit-lessons.ts, with the server's own functions (api/verify.py).

Reads a JSON list of {id, items, example} from the file given as argv[1]; prints one JSON
object per lesson: {id, keys: [bool], example: bool | null}. (Arithmetic in the text is checked in TypeScript.)
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "api"))
from verify import verify_examples, verify_items  # noqa: E402

with open(sys.argv[1], encoding="utf-8") as f:
    lessons = json.load(f)

out = []
for les in lessons:
    ex = les.get("example")
    out.append({
        "id": les["id"],
        "keys": verify_items(les["items"]),
        "example": verify_examples([ex])[0] if ex else None,
    })
print(json.dumps(out))
