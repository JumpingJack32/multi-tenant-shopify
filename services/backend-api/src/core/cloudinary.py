"""Cloudinary configuration and signed upload signature generation."""

import time

import cloudinary
from cloudinary.utils import api_sign_request
from pydantic_settings import BaseSettings, SettingsConfigDict


class CloudinarySettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CLOUDINARY_", env_file=None, extra="ignore")

    cloud_name: str = ""
    api_key: str = ""
    api_secret: str = ""


settings = CloudinarySettings()

cloudinary.config(
    cloud_name=settings.cloud_name,
    api_key=settings.api_key,
    api_secret=settings.api_secret,
    secure=True,
)


def generate_upload_signature(
    timestamp: int | None = None,
    public_id: str | None = None,
    folder: str = "storefront",
) -> dict[str, str | int]:
    """Generate signed upload parameters for direct browser upload.

    The frontend uses these params to upload directly to Cloudinary
    without exposing the API secret.
    """
    ts = timestamp or int(time.time())
    params: dict[str, str | int] = {
        "timestamp": ts,
        "folder": folder,
    }

    if public_id:
        params["public_id"] = public_id

    signature = api_sign_request(params, settings.api_secret)

    return {
        "signature": signature,
        "timestamp": ts,
        "api_key": settings.api_key,
        "cloud_name": settings.cloud_name,
        "folder": folder,
    }
