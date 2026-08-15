import os

import httpx


async def bust_cache() -> None:
    """Fire-and-forget. A failed revalidation must never fail the admin's save —
    the hourly ISR backstop will catch it."""
    base = os.environ.get("SITE_URL")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not base or not secret:
        return
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            await c.post(f"{base}/api/revalidate", headers={"x-revalidate-secret": secret})
    except httpx.HTTPError:
        pass
