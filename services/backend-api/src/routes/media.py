"""Media endpoints — Cloudinary upload signatures and asset management."""

from fastapi import APIRouter, Depends

from src.core.cloudinary import generate_upload_signature
from src.dependencies import require_admin

router = APIRouter(dependencies=[Depends(require_admin)])


@router.post("/upload-signature")
async def upload_signature():
    """Generate a signed upload signature for direct browser-to-Cloudinary uploads.

    Requires admin authentication. The frontend requests this before uploading,
    so Cloudinary can verify the upload is authorized without exposing the
    API secret to the client.
    """
    return generate_upload_signature()
