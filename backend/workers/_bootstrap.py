"""Import path setup for standalone worker processes."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
_REPO = _BACKEND.parent

for p in (str(_BACKEND), str(_REPO / "ai-worker")):
    if p not in sys.path:
        sys.path.insert(0, p)
