"""Run the retraining pipeline immediately and then once every seven days."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import time
from pathlib import Path


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("weekly-retrainer")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PIPELINE = BACKEND_ROOT / "ml" / "weekly_retraining_pipeline.py"


def run_pipeline() -> None:
    source_csv = Path(
        os.getenv("RETRAINING_SOURCE_CSV", BACKEND_ROOT.parent / "Astram event data_anonymized - Astram event data_anonymizedb40ac87 (2).csv")
    )
    output_dir = Path(
        os.getenv("RETRAINING_OUTPUT_DIR", BACKEND_ROOT / "app" / "models" / "candidates")
    )
    logger.info("Starting weekly retraining from %s", source_csv)
    subprocess.run(
        [
            sys.executable,
            str(PIPELINE),
            "--csv",
            str(source_csv),
            "--output-dir",
            str(output_dir),
        ],
        cwd=BACKEND_ROOT,
        check=True,
    )
    logger.info("Weekly retraining completed")


def main() -> None:
    interval_days = max(1, int(os.getenv("RETRAINING_INTERVAL_DAYS", "7")))
    interval_seconds = interval_days * 24 * 60 * 60
    while True:
        try:
            run_pipeline()
        except Exception:
            logger.exception("Weekly retraining failed; it will retry next cycle")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
