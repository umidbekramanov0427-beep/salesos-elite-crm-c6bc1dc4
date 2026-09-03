"""Port of the two remaining standalone routes that don't fit any other
subsystem: notifications.send-push.ts and sitemap[.]xml.ts.

src/routes/mcp.ts is NOT ported here (or anywhere in this backend) --
see PORT_STATUS.md's "Misc" section for why: it's a thin, auto-generated
wrapper around Lovable's own `@lovable.dev/mcp-js` framework (protocol
transport, OAuth-protected-resource metadata, tool-call auth context),
not hand-written business logic to translate. The 4 read-only tools it
exposes (list_leads, get_lead, pipeline_summary, leaderboard_ranking) are
each just a scoped Supabase query; whoever continues this port can wire
those directly into whatever Python MCP SDK they choose once that
framework decision is made -- see PORT_STATUS.md for the reasoning.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel

from app.auth import get_request_user_id
from app.config import get_settings
from app.db import get_supabase_admin

router = APIRouter()


class SendPushBody(BaseModel):
    assigneeId: str | None = None
    title: str | None = None
    body: str | None = None
    link: str | None = None


@router.post("/notifications/send-push")
async def send_push(body: SendPushBody, authorization: str | None = Header(default=None)):
    """Fires the actual browser push (delivered even when the tab isn't
    open) for an event that already wrote its row into the `notifications`
    table client-side -- the two are separate on purpose: the in-app bell
    keeps working through the client's own RLS-backed insert, this route
    only adds the push send on top, which needs the VAPID private key."""
    try:
        caller_id = await get_request_user_id(authorization)
        if not caller_id:
            raise HTTPException(status_code=401, detail="Not signed in.")

        admin = get_supabase_admin()
        caller = (
            admin.table("profiles")
            .select("organization_id")
            .eq("id", caller_id)
            .maybe_single()
            .execute()
            .data
        )
        if not caller or not caller.get("organization_id"):
            raise HTTPException(status_code=401, detail="Not signed in.")

        if not body.assigneeId or not body.title:
            raise HTTPException(status_code=400, detail="assigneeId and title are required.")

        assignee = (
            admin.table("profiles")
            .select("id, organization_id")
            .eq("id", body.assigneeId)
            .maybe_single()
            .execute()
            .data
        )
        if not assignee or assignee["organization_id"] != caller["organization_id"]:
            raise HTTPException(status_code=404, detail="Unknown recipient.")

        subs = (
            admin.table("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("profile_id", body.assigneeId)
            .execute()
            .data
            or []
        )
        if not subs:
            return {"sent": 0}

        settings = get_settings()
        if not settings.vapid_subject or not settings.vapid_public_key or not settings.vapid_private_key:
            raise RuntimeError(
                "Missing environment variable: VAPID_SUBJECT/VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY. "
                "Add it in Settings -> Secrets."
            )

        import json as _json

        from pywebpush import WebPushException, webpush

        payload = _json.dumps({"title": body.title, "body": body.body or "", "url": body.link or "/"})

        sent = 0
        stale_ids: list[str] = []
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                    },
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": settings.vapid_subject},
                )
                sent += 1
            except WebPushException as err:
                status_code = getattr(err.response, "status_code", None) if err.response else None
                # 404/410 = the browser dropped this subscription (uninstalled,
                # cleared data, expired) -- prune it so future sends don't
                # keep paying for a dead endpoint.
                if status_code in (404, 410):
                    stale_ids.append(sub["id"])

        if stale_ids:
            admin.table("push_subscriptions").delete().in_("id", stale_ids).execute()

        return {"sent": sent}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err) or "Unknown error") from err


_SITEMAP_BASE_URL = "https://salesos-elite-crm.lovable.app"
_SITEMAP_ENTRIES = [
    {"path": "/", "changefreq": "daily", "priority": "1.0"},
    {"path": "/login", "changefreq": "monthly", "priority": "0.5"},
]


@router.get("/sitemap.xml")
async def sitemap() -> Response:
    urls = "\n".join(
        "\n".join(
            filter(
                None,
                [
                    "  <url>",
                    f"    <loc>{_SITEMAP_BASE_URL}{e['path']}</loc>",
                    f"    <changefreq>{e['changefreq']}</changefreq>" if e.get("changefreq") else None,
                    f"    <priority>{e['priority']}</priority>" if e.get("priority") else None,
                    "  </url>",
                ],
            )
        )
        for e in _SITEMAP_ENTRIES
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n"
        "</urlset>"
    )
    return Response(content=xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})
