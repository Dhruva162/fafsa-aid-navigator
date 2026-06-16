"""Ensures pytest adds the backend root to sys.path.

The presence of this file at the backend root makes pytest insert this
directory into sys.path, so `from app.main import app` resolves when tests
are run from within `backend/`.
"""
