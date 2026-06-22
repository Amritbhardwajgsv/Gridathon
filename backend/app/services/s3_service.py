"""S3 photo upload service — bucket: drishti-gridathon (ap-south-2)."""
from __future__ import annotations

import logging
import os
import uuid

_log = logging.getLogger("drishti.s3")

_BUCKET  = os.getenv("AWS_S3_BUCKET",  "drishti-gridathon")
_REGION  = os.getenv("AWS_S3_REGION",  "ap-south-2")
_KEY_ID  = os.getenv("AWS_ACCESS_KEY_ID")
_SECRET  = os.getenv("AWS_SECRET_ACCESS_KEY")

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_BYTES      = 10 * 1024 * 1024  # 10 MB


def is_configured() -> bool:
    return bool(_KEY_ID and _SECRET and _BUCKET)


def upload_incident_photo(
    file_bytes: bytes,
    content_type: str,
    tracking_id: str,
) -> str:
    """Upload photo to S3 and return the public HTTPS URL."""
    if not is_configured():
        raise RuntimeError("S3 not configured — set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY")

    if content_type not in _ALLOWED_TYPES:
        raise ValueError(f"Unsupported file type: {content_type}. Allowed: jpeg, png, webp")

    if len(file_bytes) > _MAX_BYTES:
        raise ValueError("File too large — maximum 10 MB")

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[content_type]
    key = f"incidents/{tracking_id}/{uuid.uuid4().hex}.{ext}"

    import boto3
    s3 = boto3.client(
        "s3",
        region_name=_REGION,
        aws_access_key_id=_KEY_ID,
        aws_secret_access_key=_SECRET,
    )
    s3.put_object(
        Bucket=_BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
        CacheControl="max-age=31536000",
    )

    url = f"https://{_BUCKET}.s3.{_REGION}.amazonaws.com/{key}"
    _log.info("Uploaded photo for %s → %s", tracking_id, url)
    return url
