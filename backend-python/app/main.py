"""FastAPI entry point -- Python port of src/server.ts / the TanStack Start
server routes. Run with: uvicorn app.main:app --reload

Each router file under app/routers/ is a 1:1 port of one src/routes/*.ts
file. See PORT_STATUS.md at the repo root of this folder for exactly which
of the original ~39 backend routes (and the frontend it serves) are ported
here versus still only existing in the original TypeScript app.
"""

from fastapi import FastAPI

from app.routers import (
    admin,
    ai_assistant,
    audio_analytics,
    daily_report_settings,
    errors,
    fines,
    hr,
    platform,
    telegram,
    telegram_hr,
)

app = FastAPI(title="SalesOS Elite CRM API (Python port)")

app.include_router(errors.router)
app.include_router(telegram.router)
app.include_router(telegram_hr.router)
app.include_router(hr.router)
app.include_router(admin.router)
app.include_router(platform.router)
app.include_router(fines.router)
app.include_router(daily_report_settings.router)
app.include_router(audio_analytics.router)
app.include_router(ai_assistant.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
