"""S3-compatible object storage client and presigning helpers.

Written against the S3 API rather than any vendor's own SDK, so the same code works with
Cloudflare R2, Supabase Storage, Backblaze B2, MinIO or AWS S3 — the provider is a matter
of environment variables, not code.

Presigning (generate_presigned_url) is pure local HMAC-SHA256 signing per AWS Signature V4:
it makes no network call and never validates the account id, keys or bucket against the
provider. That is what makes this module fully testable with dummy env vars and no storage
account at all (see tests/test_uploads.py).

Endpoint resolution, in order:
  1. S3_ENDPOINT_URL  — set this for any non-R2 provider, e.g.
                        https://<project>.supabase.co/storage/v1/s3
  2. R2_ACCOUNT_ID    — convenience for Cloudflare R2, whose endpoint is derived from it

The R2_* variable names are kept for the credentials because they are already wired through
the admin panel and Vercel; they mean "object storage", not "Cloudflare" specifically.
"""

import os

import boto3
from botocore.config import Config

_client = None


def _endpoint_url() -> str:
    explicit = os.environ.get("S3_ENDPOINT_URL")
    if explicit:
        return explicit.rstrip("/")
    account_id = os.environ.get("R2_ACCOUNT_ID")
    if account_id:
        return f"https://{account_id}.r2.cloudflarestorage.com"
    raise KeyError(
        "Object storage is not configured: set S3_ENDPOINT_URL "
        "(any S3-compatible provider) or R2_ACCOUNT_ID (Cloudflare R2)."
    )


def client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=_endpoint_url(),
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name=os.environ.get("S3_REGION", "auto"),
            config=Config(signature_version="s3v4"),
        )
    return _client


def presign_put(key: str, content_type: str, expires: int = 300) -> str:
    return client().generate_presigned_url(
        "put_object",
        Params={"Bucket": os.environ["R2_BUCKET"], "Key": key, "ContentType": content_type},
        ExpiresIn=expires,
    )


def public_url(key: str) -> str:
    return f"{os.environ['R2_PUBLIC_BASE'].rstrip('/')}/{key}"
