"""Cloudflare R2 client and presigning helpers.

R2 exposes an S3-compatible API, so boto3's S3 client works against it unmodified with a
custom endpoint_url. Presigning (generate_presigned_url) is pure local HMAC-SHA256 signing
per the AWS Signature V4 spec — it makes no network call and never validates the account id,
keys, or bucket against Cloudflare. That's what makes this module testable with dummy
R2_* env vars and no Cloudflare account (see tests/test_uploads.py).
"""

import os

import boto3
from botocore.config import Config

_client = None


def client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
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
