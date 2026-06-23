import time
from datetime import datetime

import requests


URLS = [
    "https://gridathon-production.up.railway.app/health",
    "https://drishti-ex4s.onrender.com/api/health",
]

PING_INTERVAL_SECONDS = 180


def ping() -> None:
    for url in URLS:
        try:
            response = requests.get(url, timeout=10)
            print(f"[{datetime.now().isoformat()}] {url} -> {response.status_code}")
        except Exception as exc:
            print(f"[{datetime.now().isoformat()}] {url} -> ERROR: {exc}")


def main() -> None:
    while True:
        ping()
        time.sleep(PING_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
