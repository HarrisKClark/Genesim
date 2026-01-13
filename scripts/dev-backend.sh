#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/backend"

PY_BIN="${PY_BIN:-python}"

echo "Using python: $PY_BIN"

# Ensure deps are installed (idempotent-ish)
$PY_BIN -m pip install -r requirements.txt

exec $PY_BIN -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000



