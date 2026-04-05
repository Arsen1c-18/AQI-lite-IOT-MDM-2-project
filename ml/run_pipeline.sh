#!/usr/bin/env bash
# Orchestrates CPCB fetch → feature build → train → optional Supabase backfill.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${SUPABASE_URL:?Set SUPABASE_URL (e.g. in .env)}"
: "${SUPABASE_SERVICE_KEY:?Set SUPABASE_SERVICE_KEY (e.g. in .env)}"
: "${DEVICE_ID:?Set DEVICE_ID (e.g. in .env)}"

CPCB_CSV="data/cpcb_reference.csv"
FEATURES_CSV="data/features.csv"
MODEL_PATH="models/calibration_ridge-v1.joblib"
META_JSON="models/calibration_ridge-v1_meta.json"

ROWS_FETCHED=0
ROWS_MATCHED=0
ROWS_BACKFILLED=0
MAE=""
RMSE=""
R2=""

die_step() {
  echo ""
  echo "FAILED: $1"
  exit 1
}

echo "=== Step 1: fetch_cpcb (Nagpur, 30 days) ==="
python fetch_cpcb.py --city Nagpur --days 30 --out "$CPCB_CSV" || die_step "fetch_cpcb.py"

if [[ ! -f "$CPCB_CSV" ]]; then
  die_step "fetch_cpcb.py (no output CSV — no data returned?)"
fi
ROWS_FETCHED=$(( $(wc -l < "$CPCB_CSV") - 1 ))
if [[ "$ROWS_FETCHED" -lt 1 ]]; then
  die_step "fetch_cpcb.py (CPCB CSV has no data rows)"
fi

echo ""
echo "=== Step 2: build_features (Supabase + CPCB join) ==="
python build_features.py \
  --supabase-url "$SUPABASE_URL" \
  --supabase-key "$SUPABASE_SERVICE_KEY" \
  --device-id "$DEVICE_ID" \
  --cpcb-csv "$CPCB_CSV" \
  --out "$FEATURES_CSV" || die_step "build_features.py"

ROWS_MATCHED=$(( $(wc -l < "$FEATURES_CSV") - 1 ))

echo ""
echo "=== Step 3: row count gate (need >= 20 matched hourly rows) ==="
if [[ "$ROWS_MATCHED" -lt 20 ]]; then
  echo ""
  echo "Not enough training data: features.csv has $ROWS_MATCHED row(s) (minimum 20)."
  echo "Leave the device running longer and ensure its clock overlaps CPCB hourly data"
  echo "for the same city (co-located time range). Then re-run this pipeline."
  exit 1
fi

echo ""
echo "=== Step 4: train_calibration train ==="
python train_calibration.py train --features "$FEATURES_CSV" || die_step "train_calibration.py train"

if [[ ! -f "$META_JSON" ]]; then
  die_step "train_calibration.py (metadata JSON missing at $META_JSON)"
fi

echo ""
echo "=== Metrics (from saved metadata) ==="
read -r MAE RMSE R2 <<< "$(python -c "import json; m=json.load(open('$META_JSON', encoding='utf-8')); print(m['mae'], m['rmse'], m['r2'])")"
echo "  MAE  = $MAE"
echo "  RMSE = $RMSE"
echo "  R²   = $R2"

echo ""
read -r -p "Run backfill to Supabase (updates calibrated_aqi)? [y/N]: " CONFIRM
if [[ "${CONFIRM:-}" =~ ^[Yy]$ ]]; then
  echo ""
  echo "=== Step 5: train_calibration backfill ==="
  BACKFILL_LOG="$(mktemp)"
  if python train_calibration.py backfill \
    --supabase-url "$SUPABASE_URL" \
    --supabase-key "$SUPABASE_SERVICE_KEY" \
    --device-id "$DEVICE_ID" \
    2>&1 | tee "$BACKFILL_LOG"; then
    ROWS_BACKFILLED="$(python -c "import re; t=open('$BACKFILL_LOG',encoding='utf-8').read(); m=re.search(r'(\d+)\s+rows updated', t); print(m.group(1) if m else '0')")"
  else
    rm -f "$BACKFILL_LOG"
    die_step "train_calibration.py backfill"
  fi
  rm -f "$BACKFILL_LOG"
else
  echo "Backfill skipped."
  ROWS_BACKFILLED=0
fi

echo ""
echo "========== PIPELINE SUMMARY =========="
echo "  CPCB rows fetched:     $ROWS_FETCHED"
echo "  Feature rows matched: $ROWS_MATCHED"
echo "  MAE:                   $MAE"
echo "  RMSE:                  $RMSE"
echo "  R²:                    $R2"
echo "  Model path:            $SCRIPT_DIR/$MODEL_PATH"
echo "  Rows backfilled:       $ROWS_BACKFILLED"
echo "======================================"
