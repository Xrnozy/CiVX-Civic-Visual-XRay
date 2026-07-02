"""Helper for run-ai-status.bat — fetch pipeline-status JSON and print it."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: _fetch_pipeline_status.py <url>", file=sys.stderr)
        return 1
    url = sys.argv[1]
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            body = resp.read().decode("utf-8")
            data = json.loads(body)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            print(f"  404 Not Found — restart the API (old server still running?)", file=sys.stderr)
        else:
            print(f"  HTTP {exc.code}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"  unreachable ({exc})", file=sys.stderr)
        return 1

    print(json.dumps(data, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
