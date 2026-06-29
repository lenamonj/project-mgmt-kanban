import os
from pathlib import Path

SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-secret-change-me")

# Set HTTPS_ONLY=true behind TLS so the session cookie gets the Secure flag.
HTTPS_ONLY = os.environ.get("HTTPS_ONLY", "").lower() == "true"

# Static dir is overridable so local e2e can point at frontend/out directly.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent / "static"))

# MVP credentials; overridable via env for any non-default deployment.
USERNAME = os.environ.get("APP_USERNAME", "user")
PASSWORD = os.environ.get("APP_PASSWORD", "password")
