import json
import re
from pathlib import Path

from app.seed import DEFAULT_BOARD

KANBAN_TS = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "kanban.ts"
)


def _extract_initial_data() -> dict:
    """Parse the `initialData` object literal out of kanban.ts as JSON.

    The literal is JSON-compatible apart from bare identifier keys and trailing
    commas, so we quote the keys and strip the commas before json.loads.
    """
    text = KANBAN_TS.read_text(encoding="utf-8")
    start = text.index("{", text.index("initialData"))
    depth = 0
    in_string = False
    quote = ""
    end = start
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if ch == quote and text[i - 1] != "\\":
                in_string = False
        elif ch in "\"'":
            in_string = True
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    literal = text[start:end]
    literal = re.sub(r"([{,]\s*)([A-Za-z_]\w*)(\s*:)", r'\1"\2"\3', literal)
    literal = re.sub(r",(\s*[}\]])", r"\1", literal)
    return json.loads(literal)


def test_seed_matches_frontend_initial_data():
    assert _extract_initial_data() == DEFAULT_BOARD
