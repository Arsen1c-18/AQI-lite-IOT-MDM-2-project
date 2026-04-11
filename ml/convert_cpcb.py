"""
convert_cpcb.py
───────────────
Converts a manually downloaded CPCB wide-format AQI file into the
format expected by ml/build_features.py (cpcb_reference.csv).

Supports both .xlsx and .csv input. Handles IST → UTC conversion.

Usage:
    python convert_cpcb.py --input path/to/file.xlsx --month 2026-04
    python convert_cpcb.py --input path/to/file.csv  --month 2026-04 --out data/cpcb_reference.csv
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np


# ── AQI breakpoints for inverse PM2.5 calculation ────────────────────────────
# (aqi_lo, aqi_hi, pm25_lo, pm25_hi)
INVERSE_BREAKPOINTS = [
    (0,   50,  0.0,   30.0),
    (51,  100, 30.0,  60.0),
    (101, 200, 60.0,  90.0),
    (201, 300, 90.0,  120.0),
    (301, 400, 120.0, 250.0),
    (401, 500, 250.0, 500.0),
]


def aqi_to_pm25(aqi: int | float) -> float | None:
    """Inverse linear interpolation: AQI → PM2.5 µg/m³."""
    try:
        aqi = float(aqi)
    except (TypeError, ValueError):
        return None
    for (i_lo, i_hi, c_lo, c_hi) in INVERSE_BREAKPOINTS:
        if i_lo <= aqi <= i_hi:
            return round(((c_hi - c_lo) / (i_hi - i_lo)) * (aqi - i_lo) + c_lo, 2)
    return None


def aqi_to_category(aqi: int | float) -> str:
    """Map AQI integer to CPCB category string."""
    try:
        aqi = float(aqi)
    except (TypeError, ValueError):
        return "Unknown"
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Satisfactory"
    if aqi <= 200:
        return "Moderate"
    if aqi <= 300:
        return "Poor"
    if aqi <= 400:
        return "Very Poor"
    return "Severe"


def parse_month(month_str: str) -> tuple[int, int]:
    """
    Parse month string in any reasonable format.
    Returns (year, month_num) as ints.
    Accepted: "2026-04", "2026-4", "04-2026", "April 2026", "april 2026"
    """
    s = month_str.strip()

    # Try standard YYYY-MM or YYYY-M
    for fmt in ("%Y-%m", "%Y-%-m", "%m-%Y", "%-m-%Y"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.year, dt.month
        except ValueError:
            pass

    # Try "April 2026" / "2026 April"
    for fmt in ("%B %Y", "%Y %B", "%b %Y", "%Y %b"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.year, dt.month
        except ValueError:
            pass

    # Last attempt: split on common separators and brute-force
    for sep in ["-", "/", " "]:
        parts = s.split(sep)
        if len(parts) == 2:
            try:
                a, b = int(parts[0]), int(parts[1])
                if a > 12:          # YYYY-MM
                    return a, b
                elif b > 12:        # MM-YYYY
                    return b, a
            except ValueError:
                pass

    print(
        f"[convert_cpcb] ERROR: Could not parse --month '{month_str}'.\n"
        "  Accepted formats: '2026-04', '2026-4', '04-2026', 'April 2026', 'april 2026'"
    )
    sys.exit(1)


def load_file(input_path: Path) -> pd.DataFrame:
    """Load .xlsx or .csv based on extension."""
    ext = input_path.suffix.lower()
    if ext in (".xlsx", ".xls"):
        try:
            df = pd.read_excel(input_path, header=0)
        except Exception as e:
            print(f"[convert_cpcb] ERROR: Could not read Excel file: {e}")
            print("  Make sure openpyxl is installed: pip install openpyxl")
            sys.exit(1)
    elif ext == ".csv":
        try:
            df = pd.read_csv(input_path, header=0, sep=None, engine="python")
        except Exception as e:
            print(f"[convert_cpcb] ERROR: Could not read CSV file: {e}")
            sys.exit(1)
    else:
        print(
            f"[convert_cpcb] ERROR: Unsupported file extension '{ext}'.\n"
            "  Only .csv, .xls, and .xlsx are supported."
        )
        sys.exit(1)

    # Strip whitespace from all column names
    df.columns = [str(c).strip() for c in df.columns]
    return df


def validate_and_melt(df: pd.DataFrame) -> pd.DataFrame:
    """
    Rename first column to 'day', validate 24 hour columns,
    and melt wide → long.
    """
    if df.shape[1] < 2:
        print(
            f"[convert_cpcb] ERROR: Expected at least 25 columns (1 day + 24 hours).\n"
            f"  Got {df.shape[1]} column(s): {list(df.columns)}"
        )
        sys.exit(1)

    cols = list(df.columns)
    day_col = cols[0]
    hour_cols = cols[1:]

    # Validate hour columns — should look like "00:00:00" .. "23:00:00"
    # Be flexible: accept "0", "00", "00:00", "0:00:00", "00:00:00"
    hour_count = len(hour_cols)
    if hour_count != 24:
        print(
            f"[convert_cpcb] ERROR: Expected exactly 24 hour columns, found {hour_count}.\n"
            f"  Columns found: {hour_cols}"
        )
        sys.exit(1)

    df = df.rename(columns={day_col: "day"})

    # Normalise hour column names → "HH" strings we can parse
    hour_map = {}
    for h in hour_cols:
        raw = str(h).strip()
        # Extract just the first two digit characters (the hour)
        digits = raw.replace(":", "").replace(" ", "")
        try:
            hour_int = int(digits[:2])
            hour_map[h] = f"{hour_int:02d}:00:00"
        except ValueError:
            print(
                f"[convert_cpcb] WARNING: Could not parse hour column '{h}'. "
                "It will be used as-is."
            )
            hour_map[h] = raw
    df = df.rename(columns=hour_map)

    # Melt
    df = pd.melt(
        df,
        id_vars=["day"],
        var_name="hour",
        value_name="aqi_reference",
    )
    return df


def build_timestamps(df: pd.DataFrame, year: int, month_num: int, tz_offset_hours: float) -> pd.DataFrame:
    """Build ISO UTC timestamp column from day + hour."""
    # Parse hour to integer
    df = df.copy()
    df["_hour_int"] = df["hour"].str[:2].astype(int)

    # Clamp day values to valid range (handle trailing month garbage rows)
    import calendar
    max_day = calendar.monthrange(year, month_num)[1]
    invalid_days = df["day"].astype(str).str.strip()
    df["_day_int"] = pd.to_numeric(invalid_days, errors="coerce")

    over_month = df["_day_int"] > max_day
    if over_month.any():
        bad_days = df.loc[over_month, "_day_int"].unique().tolist()
        print(
            f"  WARNING: Day numbers {bad_days} exceed the maximum for "
            f"{year}-{month_num:02d} ({max_day} days). These rows will be dropped."
        )
    df = df.dropna(subset=["_day_int"])
    df = df[df["_day_int"] <= max_day]
    df["_day_int"] = df["_day_int"].astype(int)

    # Build IST datetime
    try:
        df["timestamp_ist"] = pd.to_datetime(
            {
                "year": year,
                "month": month_num,
                "day": df["_day_int"],
                "hour": df["_hour_int"],
            }
        )
    except Exception as e:
        print(f"[convert_cpcb] ERROR: Could not build timestamps: {e}")
        sys.exit(1)

    # Convert IST → UTC
    hours_offset = int(tz_offset_hours)
    minutes_offset = int(round((tz_offset_hours - hours_offset) * 60))
    df["timestamp"] = (
        df["timestamp_ist"]
        - pd.Timedelta(hours=hours_offset, minutes=minutes_offset)
    )
    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df


def clean_aqi(df: pd.DataFrame) -> pd.DataFrame:
    """Replace NA strings, coerce to numeric, drop missing."""
    df = df.copy()
    na_strings = {"NA", "na", "N/A", "n/a", "---", "--", "", " ", "nan", "NaN"}
    df["aqi_reference"] = df["aqi_reference"].replace(list(na_strings), np.nan)
    before = len(df)
    df["aqi_reference"] = pd.to_numeric(df["aqi_reference"], errors="coerce")
    df = df.dropna(subset=["aqi_reference"])
    df["aqi_reference"] = df["aqi_reference"].round().astype(int)
    dropped = before - len(df)
    return df, dropped


def flag_anomalies(df: pd.DataFrame) -> None:
    """Print warnings for suspicious data patterns."""
    aqi = df["aqi_reference"]

    if len(df) < 100:
        print(
            f"  WARNING: Only {len(df)} valid rows after cleaning (< 100). "
            "This may not be enough for good model training. "
            "Download more months of data."
        )

    if aqi.nunique() < 5:
        print(
            f"  WARNING: Only {aqi.nunique()} distinct AQI values "
            f"({sorted(aqi.unique())}). "
            "Data appears unusually uniform — verify the downloaded file is correct."
        )

    if (aqi > 300).mean() > 0.5:
        print(
            "  WARNING: More than 50% of AQI values are > 300. "
            "This may be raw PM2.5 concentration data (µg/m³) instead of AQI. "
            "Verify the downloaded file is AQI, not raw pollutant."
        )

    if (aqi == aqi.iloc[0]).all():
        print(
            f"  WARNING: All AQI values are identical ({aqi.iloc[0]}). "
            "This file appears to be corrupt or incorrectly formatted."
        )


def run_validation_checks(out_path: Path) -> None:
    """Load the saved file and run validation checks."""
    print("\n[convert_cpcb] Running validation checks...")
    df = pd.read_csv(out_path)
    now_utc = pd.Timestamp.now(tz="UTC")

    ts_parsed = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)

    checks = {
        "rows > 100": len(df) > 100,
        "timestamp parseable": ts_parsed.notna().all(),
        "aqi range valid (0–500)": df["aqi_reference"].between(0, 500).all(),
        "pm25 present (no nulls)": df["pm25"].notna().all(),
        "no future dates": ts_parsed.max() <= now_utc,
    }

    all_passed = True
    for check, passed in checks.items():
        mark = "✓" if passed else "✗"
        print(f"  {mark} {check}")
        if not passed:
            all_passed = False
            # Specific guidance per check
            if check == "rows > 100":
                print(f"    -> Only {len(df)} rows found. Download more data.")
            elif check == "timestamp parseable":
                bad = ts_parsed[ts_parsed.isna()]
                print(f"    -> {len(bad)} unparseable timestamps. Check --month argument.")
            elif check == "aqi range valid (0–500)":
                bad = df[~df["aqi_reference"].between(0, 500)]
                print(f"    -> {len(bad)} out-of-range values: {bad['aqi_reference'].unique()}")
            elif check == "pm25 present (no nulls)":
                print("    -> pm25 column has nulls. AQI values may be outside supported range.")
            elif check == "no future dates":
                future = ts_parsed[ts_parsed > now_utc]
                print(f"    -> {len(future)} future timestamps. Check --month argument.")

    if all_passed:
        print("\n  ✓ Data ready for build_features.py")
    else:
        print("\n  Some checks failed. Review warnings above before retraining.")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Convert CPCB wide-format AQI file to cpcb_reference.csv"
    )
    parser.add_argument("--input",      required=True,
                        help="Path to downloaded CPCB file (.csv or .xlsx)")
    parser.add_argument("--out",        default="data/cpcb_reference.csv",
                        help="Output CSV path (default: data/cpcb_reference.csv)")
    parser.add_argument("--month",      default=None,
                        help="Year-month of the data, e.g. '2026-04' (default: current month)")
    parser.add_argument("--tz-offset",  type=float, default=5.5,
                        help="IST offset in hours (default: 5.5 for UTC+5:30)")
    args = parser.parse_args()

    input_path = Path(args.input)
    out_path   = Path(args.out)

    # Validate input file
    if not input_path.exists():
        print(
            f"[convert_cpcb] ERROR: Input file not found: {input_path}\n"
            "  Check the --input path and try again."
        )
        sys.exit(1)

    # Parse month
    if args.month is None:
        now = datetime.now()
        year, month_num = now.year, now.month
        month_str = f"{year}-{month_num:02d}"
        print(f"[convert_cpcb] --month not specified, defaulting to current month: {month_str}")
    else:
        year, month_num = parse_month(args.month)
        month_str = f"{year}-{month_num:02d}"

    print(f"[convert_cpcb] Input file:  {input_path}")
    print(f"[convert_cpcb] Month:       {month_str}")

    # Load
    df_raw = load_file(input_path)
    input_rows = len(df_raw)
    print(f"[convert_cpcb] Input rows:  {input_rows} (wide format days)")

    # Validate & melt
    df = validate_and_melt(df_raw)

    # Build timestamps
    df = build_timestamps(df, year, month_num, args.tz_offset)

    # Clean AQI
    df, dropped = clean_aqi(df)
    print(f"[convert_cpcb] NA dropped:  {dropped} rows")
    print(f"[convert_cpcb] Output rows: {len(df)} (hourly, after dropping NA)")

    if df.empty:
        print(
            "[convert_cpcb] ERROR: No valid rows remain after cleaning.\n"
            "  Check the file structure and --month argument."
        )
        sys.exit(1)

    # Add pm25 and category
    df["pm25"] = df["aqi_reference"].apply(aqi_to_pm25)
    df["category_reference"] = df["aqi_reference"].apply(aqi_to_category)

    # Select and sort output columns
    df_out = df[["timestamp", "aqi_reference", "pm25", "category_reference"]].copy()
    df_out = df_out.sort_values("timestamp").reset_index(drop=True)

    # Flag anomalies before saving
    flag_anomalies(df_out)

    # Print date range and AQI range
    print(f"[convert_cpcb] Date range:  {df_out['timestamp'].iloc[0]} -> {df_out['timestamp'].iloc[-1]} (UTC)")
    print(f"[convert_cpcb] AQI range:   {df_out['aqi_reference'].min()} - {df_out['aqi_reference'].max()}")

    # Save
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df_out.to_csv(out_path, index=False)
    print(f"[convert_cpcb] Saved ->     {out_path}")

    # Validate
    run_validation_checks(out_path)


if __name__ == "__main__":
    main()
