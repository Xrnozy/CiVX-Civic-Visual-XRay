# Export ai_corrections from Supabase for future YOLO fine-tuning.
# Usage: python export_corrections.py --output ./dataset/labels

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.config import settings
from app.db import get_supabase


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="./dataset/export")
    args = parser.parse_args()
    os.makedirs(args.output, exist_ok=True)

    if not settings.supabase_url:
        print("Configure Supabase in .env first")
        return

    sb = get_supabase()
    rows = sb.table("ai_corrections").select("*").execute().data or []
    out_path = os.path.join(args.output, "corrections.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, default=str)
    print(f"Exported {len(rows)} corrections to {out_path}")


if __name__ == "__main__":
    main()
