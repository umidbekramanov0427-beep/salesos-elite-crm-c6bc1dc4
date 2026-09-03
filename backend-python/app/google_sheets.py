"""Port of src/lib/google-sheets.server.ts.

The original hand-rolls JWT signing with Web Crypto because it targets
Cloudflare Workers (no Node crypto/JWT library available at runtime). Python
has no such constraint, so this uses `pyjwt` directly instead of
reimplementing PEM parsing + RS256 signing by hand -- same algorithm (RS256),
same claims, same behavior, less code.
"""

from __future__ import annotations

import os
import re
import time

import httpx
import jwt as pyjwt


def _extract_spreadsheet_id(sheet_url: str) -> str | None:
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", sheet_url)
    return match.group(1) if match else None


async def _get_service_account_access_token() -> str | None:
    email = os.environ.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")
    raw_key = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")
    if not email or not raw_key:
        return None
    private_key_pem = raw_key.replace("\\n", "\n")

    now = int(time.time())
    claims = {
        "iss": email,
        "scope": "https://www.googleapis.com/auth/spreadsheets",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    assertion = pyjwt.encode(claims, private_key_pem, algorithm="RS256")

    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Google token exchange failed ({res.status_code}): {res.text}")
    access_token = res.json().get("access_token")
    if not access_token:
        raise RuntimeError("Google token exchange returned no access_token")
    return access_token


async def append_row_to_google_sheet(sheet_url: str, values: list[str | float]) -> dict[str, bool]:
    """Appends one row to the given Google Sheet (Sheet1, columns starting at
    A). A no-op when the service account isn't configured yet -- callers
    should treat that as "Sheets sync not set up", not an error, since it's
    an optional, opt-in per-org integration."""
    access_token = await _get_service_account_access_token()
    if not access_token:
        return {"skipped": True}

    spreadsheet_id = _extract_spreadsheet_id(sheet_url)
    if not spreadsheet_id:
        raise ValueError("Google Sheets havolasi noto'g'ri ko'rinishda.")

    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(
            f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
            "/values/A1:append",
            params={
                "valueInputOption": "USER_ENTERED",
                "insertDataOption": "INSERT_ROWS",
            },
            headers={"authorization": f"Bearer {access_token}"},
            json={"values": [values]},
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Google Sheets append failed ({res.status_code}): {res.text}")
    return {"skipped": False}
