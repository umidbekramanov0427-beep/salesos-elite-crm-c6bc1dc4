"""FastAPI entry point -- Python port of src/server.ts / the TanStack Start
server routes. Run with: uvicorn app.main:app --reload

Each router file under app/routers/ is a 1:1 port of one src/routes/*.ts
file. See PORT_STATUS.md at the repo root of this folder for exactly which
of the original ~39 backend routes (and the frontend it serves) are ported
here versus still only existing in the original TypeScript app.
"""

from fastapi import FastAPI

from app.routers import errors, telegram

app = FastAPI(title="SalesOS Elite CRM API (Python port)")

app.include_router(errors.router)
app.include_router(telegram.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
