"""Encrypted API-key vault (Phase 1.1).

Keys are encrypted at rest with Fernet (AES-128-CBC + HMAC) derived from
VAULT_SECRET, and are only ever returned to clients in masked form.
"""

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

VAULT_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "vault.json"


def _fernet() -> Fernet:
    secret = get_settings().vault_secret.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def _load() -> dict[str, str]:
    if not VAULT_PATH.exists():
        return {}
    try:
        return json.loads(VAULT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save(data: dict[str, str]) -> None:
    VAULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    VAULT_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def store_key(provider: str, plaintext_key: str) -> None:
    data = _load()
    data[provider] = _fernet().encrypt(plaintext_key.encode()).decode()
    _save(data)


def get_key(provider: str) -> str:
    token = _load().get(provider)
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return ""


def delete_key(provider: str) -> None:
    data = _load()
    data.pop(provider, None)
    _save(data)


def mask_key(key: str) -> str:
    if len(key) <= 8:
        return "••••••••"
    return f"{key[:4]}{'•' * 8}{key[-4:]}"


def list_keys() -> dict[str, str]:
    """Return provider -> masked key (never plaintext)."""
    return {p: mask_key(get_key(p)) for p in _load()}
