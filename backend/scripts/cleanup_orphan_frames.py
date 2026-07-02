"""Delete orphan clip/frame files left after worker crashes."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.services.pipeline_cleanup import cleanup_orphan_frames


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove stale passive pipeline temp files")
    parser.add_argument("--max-age-hours", type=int, default=24, help="Delete files older than N hours")
    args = parser.parse_args()
    result = cleanup_orphan_frames(max_age_hours=args.max_age_hours)
    print(f"Deleted {result['frames']} frame(s) and {result['clips']} clip(s)")


if __name__ == "__main__":
    main()
