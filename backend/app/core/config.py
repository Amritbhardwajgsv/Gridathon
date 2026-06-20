import os
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]


def load_env_file(env_path: Path | None = None) -> None:
    path = env_path or BACKEND_ROOT / ".env"
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


def get_database_url() -> str | None:
    load_env_file()
    return os.getenv("DATABASE_URL")


def get_jwt_secret_key() -> str:
    load_env_file()
    secret_key = os.getenv("JWT_SECRET_KEY")
    if not secret_key:
        raise RuntimeError("JWT_SECRET_KEY is not configured")
    return secret_key


def get_jwt_algorithm() -> str:
    load_env_file()
    return os.getenv("JWT_ALGORITHM", "HS256")


def get_jwt_access_token_expire_minutes() -> int:
    load_env_file()
    raw_value = os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "720")
    return int(raw_value)


def get_redis_url() -> str | None:
    load_env_file()
    return os.getenv("REDIS_URL")


def get_gemini_api_key() -> str | None:
    load_env_file()
    return os.getenv("GEMINI_API_KEY")


def get_mapmyindia_api_key() -> str | None:
    load_env_file()
    return os.getenv("MAPMYINDIA_API_KEY")


def get_mapmyindia_geocode_url() -> str:
    load_env_file()
    return os.getenv(
        "MAPMYINDIA_GEOCODE_URL",
        "https://atlas.mapmyindia.com/api/places/geocode",
    )


def get_kafka_bootstrap_servers() -> list[str] | None:
    load_env_file()
    raw = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "").strip()
    return [s.strip() for s in raw.split(",") if s.strip()] if raw else None


def get_cookie_secure() -> bool:
    load_env_file()
    return os.getenv("COOKIE_SECURE", "true").lower() != "false"


def get_smtp_config() -> dict:
    load_env_file()
    user = os.getenv("SMTP_USER")
    return {
        "host": os.getenv("SMTP_HOST"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": user,
        "password": os.getenv("SMTP_PASSWORD"),
        "from": os.getenv("SMTP_FROM") or user or "noreply@drishti.btp",
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() != "false",
    }
