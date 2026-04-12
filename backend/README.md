# FastAPI Backend (Supabase Data API)

## 1) Install dependencies

```bash
pip install -r requirements.txt
```

## 2) Configure environment

Copy `.env.example` to `.env` and fill:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (comma-separated, default `http://localhost:5173`)
- `DEFAULT_HISTORY_HOURS` (default `24`)

## 3) Run API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 4) API endpoints

- `GET /health`
- `GET /api/devices/{device_id}/latest`
- `GET /api/devices/{device_id}/history?hours=24`

The frontend expects `VITE_API_BASE_URL=http://localhost:8000`.
