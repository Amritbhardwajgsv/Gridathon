# DRISHTI

Dynamic Resource Intelligence for Smart Highway and Traffic Intervention.

DRISHTI predicts localized event impact for political rallies, festivals, sports events, construction activities, sudden gatherings, and other disruptions. The current build has two clean services:

- `backend/` - FastAPI inference API using the saved ML models
- `frontend/` - Next.js dashboard wired to the real backend API

## Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Health check:

```text
GET http://localhost:8000/health
```

Prediction endpoint:

```text
POST http://localhost:8000/predict-impact
```

The backend loads the saved duration and impact models at startup. It does not train models during API runtime.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Public citizen grievance portal:

```text
http://localhost:3000/citizen/grievance
```

Police command login:

```text
http://localhost:3000/login
```

Seeded prototype users:

```text
admin@gridathon.local / Drishti@123
operator@gridathon.local / Drishti@123
viewer@gridathon.local / Drishti@123
```

The frontend stores the JWT access token in browser storage and sends it as a bearer token to protected backend routes.

Police grievance queue:

```text
http://localhost:3000/dashboard/complaints
```

Viewer role:

```text
viewer@gridathon.local / Drishti@123
```

Viewer is a Bengaluru Traffic Police visibility role. It can see complaint inflow and severity intelligence, but cannot create prediction orders.

## Operational Intelligence Add-ons

MapMyIndia / Mappls geocoding is wired through:

```bash
MAPMYINDIA_API_KEY=
MAPMYINDIA_GEOCODE_URL=https://atlas.mapmyindia.com/api/places/geocode
```

If the key is missing or the provider is down, citizen complaints still submit with location text. When enabled, missing latitude/longitude is geocoded before storage.

The complaint intake also runs a lightweight triage agent. It assigns:

- `agent_priority_score`
- `agent_recommendation`

Kafka/Redis production hooks are represented by:

- `event_stream_outbox` for reliable event publishing to Kafka workers
- `REDIS_URL` env placeholder for cache/queue acceleration
- immutable `drishti_event_log` for reconstruction after failures

## Weekly Retraining

Notebook:

```text
notebooks/drishti_weekly_training_pipeline.ipynb
```

Script:

```bash
cd backend
python ml/weekly_retraining_pipeline.py --csv "../Astram event data_anonymized - Astram event data_anonymizedb40ac87 (2).csv" --output-dir app/models/candidates
```

This rebuilds:

- duration regression model on `log_duration`
- impact classifier on Low / Medium / High / Critical

It combines Astram historical data with Supabase `retraining_prediction_dataset` rows.

The frontend calls:

```text
${NEXT_PUBLIC_API_URL}/predict-impact
```

`frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## CORS

The FastAPI backend currently allows:

```text
http://localhost:3000
```

## Supabase Database

Run this migration in Supabase SQL editor:

```text
backend/migrations/001_create_prediction_events.sql
```

It creates `prediction_events`, which stores:

- original event input
- predicted duration
- predicted impact level
- model version
- actual post-event outcomes
- IVR/field feedback fields
- retraining queue flags

When Supabase is ready, set this in `backend/.env`:

```bash
DATABASE_URL=postgresql://postgres:<password>@<supabase-host>:5432/postgres
```

If `DATABASE_URL` is present and `psycopg` is installed, the backend will log successful predictions to the database. If the database is unavailable, prediction still returns normally.

## DRISHTI Deployment Principles

These rules are implementation constraints, not presentation copy.

### P1 + P2: Infrastructure Resilience

External services must never block field output. The backend performs model inference locally and treats Supabase logging as best-effort. If the database is unavailable, `/predict-impact` still returns a prediction.

Every meaningful database change is logged to `drishti_event_log` as an immutable event. This lets the system reconstruct what happened after a failure or disputed field order.

### P3 + P4: Recommendation Integrity

Future diversion recommendations must be compliance-weighted. A route with poor historical crowd-following behavior should not be treated as a valid recommendation just because it is geometrically available.

Idempotency is mandatory. Repeated requests for the same operational prediction use `idempotency_key`, so deployment sheets, WhatsApp messages, and prediction records remain consistent across retries.

### P5 + P6: Operational Safety

Overlapping events that touch the same corridor or junction must be escalated instead of silently producing conflicting barricade instructions. The migration includes `event_conflict_escalations` for this workflow.

Planned and unplanned events are separate operational lanes. Planned events are batch/document-first. Unplanned events are SLA-first. The API and database store `pipeline_mode` explicitly.

### P7 + P8: Institutional Trust

Operator overrides are never blocked, challenged, or framed as warnings. They are recorded silently as training signals through `operator_override_notes` and future feedback fields.

PII must stay outside the model layer. Vehicle numbers, citizen IDs, phone numbers, and officer identifiers belong only in `event_pii_vault`. The retraining view excludes that table entirely.

## Retraining Loop

Successful predictions are saved first. Later, actual duration, actual impact, compliance delta, resolution drift, and field feedback can be filled into the same rows. The `retraining_prediction_dataset` view exposes only rows that have post-event ground truth and have not yet been used for retraining.
