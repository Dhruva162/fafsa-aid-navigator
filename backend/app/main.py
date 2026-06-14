"""FastAPI entrypoint for the community-support triage agent."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import triage

app = FastAPI(
    title="Community Support Triage Agent",
    description="Conversational triage that matches people in crisis to local support services.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(triage.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
