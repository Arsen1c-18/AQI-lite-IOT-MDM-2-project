#!/usr/bin/env python3
"""
Cross-platform orchestration for the calibration pipeline (Windows + Linux/macOS).
Loads .env without requiring python-dotenv: existing environment variables win.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path


ML_DIR = Path(__file__).resolve().parent
CPCB_CSV = ML_DIR / "data" / "cpcb_reference.csv"
FEATURES_CSV = ML_DIR / "data" / "features.csv"
MODEL_PATH = ML_DIR / "models" / "calibration_ridge-v1.joblib"
META_JSON = ML_DIR / "models" / "calibration_ridge-v1_meta.json"


def load_dotenv_if_present(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        if not key:
            continue
        val = val.strip().strip("'").strip('"')
        # Standard dotenv: do not override existing environment
        if key not in os.environ:
            os.environ[key] = val


def csv_data_rows(path: Path) -> int:
    if not path.is_file():
        return 0
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return max(0, len(lines) - 1)


def die_step(name: str, code: int | None = None) -> None:
    print(f"\nFAILED: {name}", file=sys.stderr)
    if code is not None:
        sys.exit(code)
    sys.exit(1)


def run_py(args: list[str]) -> None:
    subprocess.run([sys.executable, *args], cwd=ML_DIR, check=True)


def main() -> None:
    def check_dependencies():
        missing = []
        for pkg in ['pandas', 'numpy', 'sklearn', 'requests', 'joblib']:
            try:
                __import__(pkg)
            except ImportError:
                missing.append(pkg)
        if missing:
            print(f'[pipeline] Missing dependencies: {missing}')
            print('[pipeline] Run: pip install -r requirements.txt')
            sys.exit(1)

    check_dependencies()
    load_dotenv_if_present(ML_DIR / ".env")

    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    device_id = os.environ.get("DEVICE_ID", "").strip()

    missing = [
        n
        for n, v in (
            ("SUPABASE_URL", supabase_url),
            ("SUPABASE_SERVICE_KEY", supabase_key),
            ("DEVICE_ID", device_id),
        )
        if not v
    ]
    if missing:
        print(
            "Missing environment variables: " + ", ".join(missing),
            file=sys.stderr,
        )
        print("Set them in the environment or in ml/.env", file=sys.stderr)
        sys.exit(1)

    rows_fetched = 0
    rows_matched = 0
    rows_backfilled = 0
    mae = rmse = r2 = None

    # We expect CPCB data to have been generated manually via convert_cpcb.py
    # and placed at data/cpcb_reference.csv.
    rows_fetched = csv_data_rows(CPCB_CSV)
    if rows_fetched < 1:
        die_step("Missing CPCB Reference Data. Run 'python convert_cpcb.py' first.", 1)

    print("\n=== Step 1: build_features (Supabase + CPCB join) ===")
    try:
        run_py(
            [
                "build_features.py",
                "--supabase-url",
                supabase_url,
                "--supabase-key",
                supabase_key,
                "--device-id",
                device_id,
                "--cpcb-csv",
                str(CPCB_CSV.relative_to(ML_DIR)),
                "--out",
                str(FEATURES_CSV.relative_to(ML_DIR)),
            ]
        )
    except subprocess.CalledProcessError:
        die_step("build_features.py")

    rows_matched = csv_data_rows(FEATURES_CSV)

    print("\n=== Step 2: row count gate (need >= 20 matched hourly rows) ===")
    if rows_matched < 20:
        print()
        print(
            f"Not enough training data: features.csv has {rows_matched} row(s) (minimum 20)."
        )
        print(
            "Leave the device running longer and ensure its clock overlaps CPCB hourly data "
            "for the same city (co-located time range). Then re-run this pipeline."
        )
        sys.exit(1)

    print("\n=== Step 3: train_calibration train ===")
    try:
        run_py(["train_calibration.py", "train", "--features", str(FEATURES_CSV.relative_to(ML_DIR))])
    except subprocess.CalledProcessError:
        die_step("train_calibration.py train")

    if not META_JSON.is_file():
        die_step(f"train_calibration.py (metadata missing at {META_JSON})")

    meta = json.loads(META_JSON.read_text(encoding="utf-8"))
    mae = meta.get("mae")
    rmse = meta.get("rmse")
    r2 = meta.get("r2")

    print("\n=== Metrics (from saved metadata) ===")
    print(f"  MAE  = {mae}")
    print(f"  RMSE = {rmse}")
    print(f"  R²   = {r2}")

    print()
    try:
        confirm = input("Run backfill to Supabase (updates calibrated_aqi)? [y/N]: ").strip().lower()
    except EOFError:
        confirm = "n"

    if confirm in ("y", "yes"):
        print("\n=== Step 4: train_calibration backfill ===")
        cmd = [
            sys.executable,
            "train_calibration.py",
            "backfill",
            "--supabase-url",
            supabase_url,
            "--supabase-key",
            supabase_key,
            "--device-id",
            device_id,
        ]
        proc = subprocess.Popen(
            cmd,
            cwd=ML_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        chunks: list[str] = []
        assert proc.stdout is not None
        for line in proc.stdout:
            chunks.append(line)
            print(line, end="")
        code = proc.wait()
        out = "".join(chunks)
        if code != 0:
            die_step("train_calibration.py backfill", code)
        m = re.search(r"(\d+)\s+rows updated", out)
        if m:
            rows_backfilled = int(m.group(1))
    else:
        print("Backfill skipped.")
        rows_backfilled = 0

    print()
    print("========== PIPELINE SUMMARY ==========")
    print(f"  CPCB rows fetched:     {rows_fetched}")
    print(f"  Feature rows matched: {rows_matched}")
    print(f"  MAE:                   {mae}")
    print(f"  RMSE:                  {rmse}")
    print(f"  R²:                    {r2}")
    print(f"  Model path:            {MODEL_PATH}")
    print(f"  Rows backfilled:       {rows_backfilled}")
    print("======================================")


if __name__ == "__main__":
    main()
