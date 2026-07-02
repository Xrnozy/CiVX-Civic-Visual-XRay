import re
from urllib.parse import unquote

from app.config import settings
from app.db import get_supabase

_STORAGE_OBJECT_RE = re.compile(
    r"/storage/v1/object/(?:public|sign|authenticated)/([^/]+)/(.+?)(?:\?.*)?$"
)


def parse_supabase_storage_url(url: str | None) -> tuple[str, str] | None:
    if not url:
        return None
    match = _STORAGE_OBJECT_RE.search(url)
    if not match:
        return None
    if settings.supabase_url and settings.supabase_url.rstrip("/") not in url:
        return None
    bucket = unquote(match.group(1))
    path = unquote(match.group(2))
    return bucket, path


def _extract_signed_url(result: object) -> str | None:
    if isinstance(result, dict):
        return result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
    for attr in ("signed_url", "signedURL", "signedUrl"):
        value = getattr(result, attr, None)
        if value:
            return str(value)
    return None


def resolve_photo_url(url: str | None, expires_in: int = 3600) -> str | None:
    if not url:
        return None
    parsed = parse_supabase_storage_url(url)
    if not parsed:
        return url
    bucket, path = parsed
    try:
        sb = get_supabase()
        result = sb.storage.from_(bucket).create_signed_url(path, expires_in)
        signed = _extract_signed_url(result)
        return signed or url
    except Exception:
        return url


def resolve_photo_urls(urls: list[str] | None, expires_in: int = 3600) -> list[str]:
    if not urls:
        return []
    return [resolved for url in urls if url and (resolved := resolve_photo_url(url, expires_in))]


def delete_storage_object(url: str | None) -> None:
    parsed = parse_supabase_storage_url(url)
    if not parsed:
        return
    bucket, path = parsed
    try:
        get_supabase().storage.from_(bucket).remove([path])
    except Exception:
        pass


def delete_storage_objects(urls: list[str | None]) -> None:
    paths_by_bucket: dict[str, list[str]] = {}
    for url in urls:
        parsed = parse_supabase_storage_url(url)
        if not parsed:
            continue
        bucket, path = parsed
        paths_by_bucket.setdefault(bucket, []).append(path)
    sb = get_supabase()
    for bucket, paths in paths_by_bucket.items():
        unique_paths = list(dict.fromkeys(paths))
        for index in range(0, len(unique_paths), 100):
            chunk = unique_paths[index : index + 100]
            try:
                sb.storage.from_(bucket).remove(chunk)
            except Exception:
                pass


def delete_storage_folder(bucket: str, prefix: str) -> None:
    sb = get_supabase()
    normalized = prefix.strip("/")
    try:
        entries = sb.storage.from_(bucket).list(normalized) or []
    except Exception:
        return
    file_paths: list[str] = []
    for entry in entries:
        name = entry.get("name")
        if not name:
            continue
        child_path = f"{normalized}/{name}" if normalized else name
        metadata = entry.get("metadata")
        if metadata is None and entry.get("id") is None:
            delete_storage_folder(bucket, child_path)
        else:
            file_paths.append(child_path)
    if file_paths:
        try:
            sb.storage.from_(bucket).remove(file_paths)
        except Exception:
            pass
