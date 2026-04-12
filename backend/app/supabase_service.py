from collections.abc import Sequence
from supabase import Client, create_client
from .config import get_settings


def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def maybe_single_row(rows: Sequence[dict]) -> dict | None:
    if not rows:
        return None
    return rows[0]
