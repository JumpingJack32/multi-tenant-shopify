"""Create notify.amoagou.com domain in Resend and print DNS records for Namecheap.

Run: doppler run -- uv run python scripts/setup_resend_domain.py
"""

import asyncio
import json
import logging
import sys

import httpx

sys.path.insert(0, ".")

from src.config import settings

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

DOMAIN = "notify.amoagou.com"


async def main():
    if not settings.resend_api_key:
        logger.error("ERROR: RESEND_API_KEY is not set. Run with `doppler run`.")
        sys.exit(1)

    async with httpx.AsyncClient(timeout=30) as client:
        # Check existing domains first
        logger.info(f"Checking existing domains in Resend...")
        resp = await client.get(
            "https://api.resend.com/domains",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        )
        if resp.status_code != 200:
            logger.error(f"Failed to list domains: {resp.status_code} {resp.text}")
            sys.exit(1)

        domains = resp.json().get("data", [])
        existing = [d for d in domains if d["name"] == DOMAIN]
        if existing:
            domain = existing[0]
            logger.info(f"Domain '{DOMAIN}' already exists (id={domain['id']}, status={domain['status']})")
            records = domain.get("records", [])
        else:
            logger.info(f"Creating domain '{DOMAIN}' in Resend (eu-west-1)...")
            resp = await client.post(
                "https://api.resend.com/domains",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "name": DOMAIN,
                    "region": "eu-west-1",
                },
            )
            if resp.status_code not in (200, 201):
                logger.error(f"Failed to create domain: {resp.status_code} {resp.text}")
                sys.exit(1)

            domain = resp.json()
            records = domain.get("records", [])
            logger.info(f"Domain created! id={domain['id']}")

    logger.info(f"\n{'='*60}")
    logger.info(f"DNS RECORDS FOR: {DOMAIN}")
    logger.info(f"Add these in Namecheap → Advanced DNS")
    logger.info(f"{'='*60}\n")

    for r in records:
        record_type = r.get("type", "")
        name = r.get("name", "")
        value = r.get("value", "")
        priority = r.get("priority")
        record_label = r.get("record", "")

        if record_type == "MX":
            namecheap_host = name.replace(f".{DOMAIN}", "")
            logger.info(f"--- MX Record (Mail Settings → Custom MX) ---")
            logger.info(f"  Host:     {namecheap_host or DOMAIN}")
            logger.info(f"  Value:    {value}")
            if priority:
                logger.info(f"  Priority: {priority}")
            logger.info(f"  TTL:      Automatic")
            logger.info()
        elif record_type == "TXT":
            namecheap_host = name.replace(f".{DOMAIN}", "")
            if record_label == "DKIM":
                logger.info(f"--- TXT Record (DKIM) ---")
                logger.info(f"  Type:     TXT Record")
                logger.info(f"  Host:     {namecheap_host or DOMAIN}")
                logger.info(f"  Value:    {value}")
                logger.info(f"  TTL:      Automatic")
                logger.info()
            else:
                logger.info(f"--- TXT Record (SPF) ---")
                logger.info(f"  Type:     TXT Record")
                logger.info(f"  Host:     {namecheap_host or DOMAIN}")
                logger.info(f"  Value:    {value}")
                logger.info(f"  TTL:      Automatic")
                logger.info()
        elif record_type == "CNAME" and record_label == "DKIM":
            namecheap_host = name.replace(f".{DOMAIN}", "")
            logger.info(f"--- CNAME Record (DKIM) ---")
            logger.info(f"  Type:     CNAME Record")
            logger.info(f"  Host:     {namecheap_host or DOMAIN}")
            logger.info(f"  Value:    {value}")
            logger.info(f"  TTL:      Automatic")
            logger.info()
        elif record_type == "CNAME" and record_label == "Tracking":
            logger.info(f"--- CNAME Record (Open/Click Tracking) ---")
            logger.info(f"  (Optional — for tracking opens & clicks)")
            logger.info(f"  Type:     CNAME Record")
            logger.info(f"  Host:     {name}")
            logger.info(f"  Value:    {value}")
            logger.info(f"  TTL:      Automatic")
            logger.info()
        else:
            logger.info(f"--- {record_label or record_type} Record ---")
            logger.info(f"  Type:     {record_type}")
            logger.info(f"  Name:     {name}")
            logger.info(f"  Value:    {value}")
            if priority:
                logger.info(f"  Priority: {priority}")
            logger.info(f"  TTL:      Automatic")
            logger.info()

    logger.info(f"{'='*60}")
    logger.info(f"AFTER ADDING RECORDS:") 
    logger.info(f"  1. Wait up to 15 min for DNS propagation")
    logger.info(f"  2. Click 'Verify DNS Records' in Resend dashboard")
    logger.info(f"  3. Then update RESEND_FROM_EMAIL in Doppler to noreply@{DOMAIN}")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
