# AI Agency (FastAPI + Streamlit)

This folder (`ai-agency/`) is a self-contained Python app that generates a simple **brand kit + marketing copy + branded PDF**.

It runs even **without** API keys (uses safe fallbacks). If you add OpenAI/Anthropic keys, it will generate better Brand DNA + copy.

## Quickstart (Windows / PowerShell)

### Python version (important)

This project currently requires **Python 3.11 or 3.12**.

If you only have **Python 3.14**, `pip install` will likely fail because dependencies like `pydantic-core` don’t ship wheels for 3.14 yet (pip then tries to compile with Rust).

To install Python 3.12:
- Install from the official python.org installer (Windows x64) and check **“Add Python to PATH”**
- Or install via Microsoft Store / winget, then confirm `py -0p` shows `3.12`

From `c:\Users\godbe\Downloads\dating app\ai-agency`:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Start the API:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the dashboard (new terminal):

```powershell
streamlit run app/dashboard.py
```

## API

- `POST /api/v1/projects` → creates a project + starts generation (background task)
- `GET /api/v1/projects/{project_id}` → status + download URL when ready
- `GET /api/v1/projects/{project_id}/download` → PDF download

Example:

```powershell
curl -X POST "http://localhost:8000/api/v1/projects" `
  -H "Content-Type: application/json" `
  -d '{"brief":"Delhi coffee shop marketing kit focused on single-origin beans.","tier":"professional"}'
```

## Stripe (optional)

By default, generation starts immediately and Stripe is disabled.

To enable Stripe checkout creation:

- Set `STRIPE_ENABLED=true`
- Set `STRIPE_SECRET_KEY=...`
- Set `PUBLIC_BASE_URL=https://your-domain.com` (so success/cancel URLs work)

Note: in a real production billing flow, you should only start generation **after** a Stripe webhook confirms payment.

## Data / storage

Projects are stored on disk in `ai-agency/data/projects/`:

- `{id}.json` status + brand kit metadata
- `{id}.pdf` generated PDF

