"""Mailchimp Marketing API v3 integration for contact sync."""

from dataclasses import dataclass
import hashlib
import logging

import httpx

logger = logging.getLogger(__name__)

MAILCHIMP_API_BASE = "https://{dc}.api.mailchimp.com/3.0"

STATUS_MAP: dict[str, str] = {
    "subscribed": "subscribed",
    "unsubscribed": "unsubscribed",
    "bounced": "cleaned",
}


@dataclass
class MailchimpConfig:
    api_key: str
    list_id: str
    server_prefix: str = ""


def _parse_server_prefix(api_key: str) -> str:
    """Extract the data center server prefix from a Mailchimp API key.
    Keys are formatted as: <key>-<dc>, e.g. 'abc123-us1'."""
    parts = api_key.split("-")
    return parts[-1] if len(parts) > 1 else "us1"


def _subscriber_hash(email: str) -> str:
    return hashlib.md5(email.lower().encode()).hexdigest()


async def sync_contact(
    config: MailchimpConfig,
    email: str,
    status: str,
    first_name: str | None = None,
    last_name: str | None = None,
) -> bool:
    """Push a contact's subscription status to Mailchimp.
    Returns True on success, False on API error."""
    dc = config.server_prefix or _parse_server_prefix(config.api_key)
    url = f"{MAILCHIMP_API_BASE.format(dc=dc)}/lists/{config.list_id}/members/{_subscriber_hash(email)}"
    mailchimp_status = STATUS_MAP.get(status, "unsubscribed")

    body: dict = {
        "email_address": email,
        "status": mailchimp_status,
        "status_if_new": mailchimp_status,
    }
    if first_name or last_name:
        body["merge_fields"] = {}
        if first_name:
            body["merge_fields"]["FNAME"] = first_name
        if last_name:
            body["merge_fields"]["LNAME"] = last_name

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.put(
            url,
            auth=("anystring", config.api_key),
            json=body,
        )

    if response.status_code >= 400:
        logger.error(
            "Mailchimp API error %d for %s: %s",
            response.status_code,
            email,
            response.text,
        )
        return False

    return True


async def get_contact_status(
    config: MailchimpConfig,
    email: str,
) -> str | None:
    """Fetch a contact's current status from Mailchimp.
    Returns None if the contact doesn't exist."""
    dc = config.server_prefix or _parse_server_prefix(config.api_key)
    url = f"{MAILCHIMP_API_BASE.format(dc=dc)}/lists/{config.list_id}/members/{_subscriber_hash(email)}"

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            url,
            auth=("anystring", config.api_key),
        )

    if response.status_code == 404:
        return None
    if response.status_code >= 400:
        logger.error("Mailchimp GET error %d for %s", response.status_code, email)
        return None

    data = response.json()
    return data.get("status")
