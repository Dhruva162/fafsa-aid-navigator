"""FastAPI entrypoint for the FAFSA Aid Navigator."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import aid_estimate
from app.routes import intake

app = FastAPI(
    title="FAFSA Aid Navigator",
    description="AI-powered FAFSA aid estimation and eligibility guidance.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(aid_estimate.router)
app.include_router(intake.router)

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}