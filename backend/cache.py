from typing import Optional
import time
import json
import os
import hashlib

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
os.makedirs(CACHE_DIR, exist_ok=True)


def _cache_path(key: str) -> str:
    hashed = hashlib.md5(key.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{hashed}.json")


def get_cache(key: str) -> Optional[str]:
    path = _cache_path(key)
    try:
        with open(path, "r") as f:
            entry = json.load(f)
        if time.time() < entry["expires_at"]:
            return entry["value"]
        os.remove(path)
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        pass
    return None


def set_cache(key: str, value: str, ttl: int = 3600):
    path = _cache_path(key)
    entry = {"value": value, "expires_at": time.time() + ttl}
    with open(path, "w") as f:
        json.dump(entry, f)
