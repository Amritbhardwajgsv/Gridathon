# GRIDATHON (DRISHTI) — Full System Documentation

**DRISHTI** — Dynamic Resource Intelligence for Smart Highway and Traffic Intervention  
**Built for**: Bengaluru Police Traffic Operations  
**Stack**: Next.js 15 · FastAPI 2.0 · PostgreSQL · Redis · scikit-learn · Docker

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [End-to-End Data Flows](#6-end-to-end-data-flows)
7. [Machine Learning Architecture](#7-machine-learning-architecture)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Backend Services](#9-backend-services)
10. [Configuration & Environment Variables](#10-configuration--environment-variables)
11. [Deployment & Docker](#11-deployment--docker)
12. [Middleware & Security](#12-middleware--security)
13. [Resilience & Observability](#13-resilience--observability)
14. [Development & Testing](#14-development--testing)
15. [Running the System](#15-running-the-system)

---

## 1. Executive Summary

GRIDATHON is a comprehensive traffic operations platform that takes a citizen's plain-text complaint about a road incident and drives the entire response lifecycle:

1. A citizen types a free-form description of a traffic event.
2. The backend validates it, geocodes the location, scores severity, and extracts structured NLP fields.
3. An admin or operator sees the complaint in a triage queue, runs an ML-powered impact prediction, and reviews resource recommendations.
4. The operator creates a deployment order; the nearest available officers are auto-assigned.
5. Field officers receive their assignment on their dashboard, share live GPS, and communicate via real-time chat.
6. After resolution, ground-truth data feeds back into weekly model retraining.

The system is role-gated (admin / operator / viewer / field), fully audited, and designed to degrade gracefully when external services are unavailable.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Frontend Layer (Next.js 15)                   │
│                                                                      │
│  Public             │  Protected Dashboards                          │
│  /citizen/grievance │  /dashboard/admin        (KPIs, live map)     │
│  /citizen/track     │  /dashboard/complaints   (triage + predict)   │
│  /login, /register  │  /dashboard/operator     (dispatch desk)      │
│                     │  /dashboard/field        (GPS, chat, map)     │
│                     │  /dashboard/viewer       (read-only reports)  │
│                     │  /dashboard/personnel    (registry)           │
│                     │  /dashboard/access       (user approval)      │
└───────────┬──────────────────────────────────────────────────────────┘
            │  HTTPS + JSON REST  +  WebSocket (ws://)
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Backend API Layer (FastAPI 2.0 / Uvicorn)          │
│                                                                      │
│  Auth (JWT/bcrypt)  │  Grievance Intake   │  Prediction Pipeline    │
│  Deployment Orders  │  WebSocket Chat     │  GPS Tracking           │
│  Admin Approval     │  Email Notifications│  Mappls Proxy           │
└──────┬────────────────────────┬────────────────────────┬────────────┘
       │                        │                        │
       ▼                        ▼                        ▼
  PostgreSQL               Redis 7                 External APIs
  (Supabase)          (JWT blacklist /         Mappls  · Gemini
  All tables          logout revocation)       Ollama  · SMTP
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| HTTP Client | Axios (browser) |
| Mapping | React Leaflet + Mappls SDK |
| Backend | FastAPI 2.0, Uvicorn, Python 3.12 |
| Database driver | psycopg (sync) |
| ML Inference | scikit-learn + joblib, XGBoost (fallback) |
| Embeddings | SentenceTransformers (`paraphrase-multilingual-MiniLM-L12-v2`) |
| Auth | PyJWT (HS256) + bcrypt |
| Data validation | Pydantic v2 |
| State store | Redis 7 |
| LLM (optional) | Google Gemini 2.0 Flash Lite, Ollama |
| Container | Docker + Docker Compose |

---

## 3. Directory Structure

```
GRIDATHON/
├── backend/
│   ├── app/
│   │   ├── main.py                          # FastAPI app, middleware, all routes, WS manager
│   │   ├── schemas.py                       # All Pydantic request/response models
│   │   ├── core/
│   │   │   └── config.py                   # .env loader, configuration accessors
│   │   ├── services/
│   │   │   ├── auth_service.py             # Register, login, JWT, approval, rejection
│   │   │   ├── token_blacklist.py          # Redis JTI revocation
│   │   │   ├── prediction_service.py       # Duration & impact model inference
│   │   │   ├── nlp_agent_service.py        # Rule-based NLP extraction & urgency scoring
│   │   │   ├── resource_recommendation_service.py  # Resource deployment prediction
│   │   │   ├── operational_policy.py       # Feature engineering + policy fallback rules
│   │   │   ├── grievance_repository.py     # Complaint creation, geocoding, triage
│   │   │   ├── grievance_agent.py          # Priority scoring + severity triage
│   │   │   ├── deployment_service.py       # Personnel, orders, GPS, assignment
│   │   │   ├── chat_service.py             # Deployment chat persistence
│   │   │   ├── llm_service.py              # Ollama recommendation text
│   │   │   ├── email_service.py            # SMTP approval/rejection email
│   │   │   ├── incident_predictor.py       # XGBoost pipeline + LLM firewall
│   │   │   └── mapmyindia_client.py        # Geocoding & routing proxy
│   │   └── models/                          # Active ML artifacts (~384 MB total)
│   │       ├── duration_model.pkl           # RF regression (log-duration)
│   │       ├── impact_model.pkl             # RF classifier (4-class)
│   │       ├── resource_deployment_model.pkl
│   │       ├── learning_priority_model.pkl
│   │       ├── label_encoders.pkl           # Category encoders for XGBoost
│   │       └── *_feature_columns.json       # Feature order manifests
│   ├── ml/
│   │   ├── weekly_retraining_pipeline.py   # 300-tree RF training script
│   │   ├── train_operational_models.py     # Resource & learning model training
│   │   └── weekly_retraining_scheduler.py  # Scheduled retraining orchestrator
│   ├── migrations/                          # 11 ordered PostgreSQL migrations
│   │   ├── 001_create_prediction_events.sql
│   │   ├── 002_create_app_users.sql
│   │   ├── 003_create_citizen_grievances.sql
│   │   ├── 004_operational_intelligence.sql
│   │   ├── 005_prediction_intelligence_payload.sql
│   │   ├── 006_police_personnel_and_deployments.sql
│   │   ├── 007_location_based_personnel_dispatch.sql
│   │   ├── 008_soft_remove_police_personnel.sql
│   │   ├── 009_personnel_location_polling.sql
│   │   ├── 010_access_request_rejection_reason.sql
│   │   └── 011_grievance_nlp_retraining.sql
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   ├── .env
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                    # Landing (hero, capabilities, roles)
│   │   │   ├── login/page.tsx              # Police login (3 demo accounts)
│   │   │   ├── register/page.tsx           # Officer access request
│   │   │   ├── register/viewer/page.tsx    # Viewer access request
│   │   │   ├── citizen/
│   │   │   │   ├── grievance/page.tsx      # Public complaint form
│   │   │   │   ├── track/page.tsx          # Tracking token lookup
│   │   │   │   └── predict/page.tsx        # Public prediction demo
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx              # Shared sidebar + header
│   │   │   │   ├── admin/page.tsx          # KPIs, live map, overview
│   │   │   │   ├── complaints/page.tsx     # Complaint queue + predict
│   │   │   │   ├── operator/page.tsx       # Dispatch desk & assignment
│   │   │   │   ├── field/page.tsx          # Field officer view
│   │   │   │   ├── viewer/page.tsx         # Read-only reports
│   │   │   │   ├── personnel/page.tsx      # Personnel registry
│   │   │   │   └── access/page.tsx         # User approval/rejection
│   │   │   └── field/location/page.tsx     # Badge GPS polling utility
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── PredictionForm.tsx
│   │   │   ├── PredictionResultCard.tsx
│   │   │   ├── DeploymentAssignmentPanel.tsx
│   │   │   ├── EnrouteMapPanel.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── CommandRoomPersonnelPanel.tsx
│   │   │   ├── PersonnelMap.tsx
│   │   │   ├── MapplsRouteMap.tsx
│   │   │   ├── RouteMapLeaflet.tsx
│   │   │   ├── DashboardTopbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── AccessRequestsPanel.tsx
│   │   │   ├── DescriptionPipelinePreview.tsx
│   │   │   └── ui/                          # Badge, Field, MetricCard, PageHeader, etc.
│   │   ├── lib/
│   │   │   ├── api.ts                       # Axios instance + typed API operations
│   │   │   ├── auth.ts                      # Session, login, logout, token management
│   │   │   ├── roles.ts                     # Role config & dashboard routing
│   │   │   ├── bengaluru.ts                 # Corridor & zone enums
│   │   │   └── format.ts                    # Date/time formatting utilities
│   │   ├── types/
│   │   │   └── prediction.ts                # TypeScript interfaces for API contracts
│   │   ├── hooks/
│   │   │   └── useDeploymentChat.ts         # WebSocket chat hook
│   │   └── globals.css
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.ts
│
├── docs/
│   ├── TECHNICAL_ARCHITECTURE.md
│   └── FULL_SYSTEM_DOCUMENTATION.md         ← this file
│
├── notebooks/                                # Jupyter ML exploration
└── Astram event data_anonymized*.csv         # Training dataset (~4.5 MB)
```

---

## 4. Database Schema

### Migration order

Run migrations `001` → `011` in sequence before starting the backend.

---

### `app_users` — Police accounts

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | text | |
| `email` | text UNIQUE | Lowercased, indexed |
| `role` | text | `admin`, `operator`, `viewer` |
| `password_hash` | text | bcrypt |
| `is_active` | bool | Deactivation flag |
| `approval_status` | text | `pending`, `approved`, `rejected` |
| `badge_id` | text | Optional police identifier |
| `rank` | text | Constable / ASI / SI / Inspector / ACP / DCP |
| `unit_name` | text | Police unit/station |
| `rejection_reason` | text | Populated on rejection |
| `approved_at` | timestamptz | When approved |
| `last_login_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger |

---

### `police_personnel` — Dispatchable field officers

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `badge_id` | text UNIQUE | |
| `name` | text | |
| `rank` | text | |
| `unit_name` | text | |
| `zone` | text | Geographic zone |
| `phone` | text | |
| `whatsapp_phone` | text | |
| `current_latitude` | float | Live GPS |
| `current_longitude` | float | Live GPS |
| `last_location_at` | timestamptz | Latest GPS update |
| `is_available` | bool | Set `false` on assignment |
| `is_active` | bool | Soft-delete flag |
| `created_by_user_id` | UUID FK → app_users | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `citizen_grievances` — Public complaint submissions

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `tracking_id` | text UNIQUE | `DRS-BTP-XXXXXXXXXX` |
| `reporter_name`, `reporter_phone`, `reporter_email` | text | Citizen contact |
| `complaint_type` | text | `event_congestion`, `illegal_parking`, `road_closure`, `accident_or_breakdown`, `signal_failure`, `other` |
| `severity` | text | `Low`, `Medium`, `High`, `Critical` — assigned by triage |
| `location_text` | text | Free-form location string |
| `zone`, `corridor` | text | Structured location |
| `latitude`, `longitude` | float | Geocoded coordinates |
| `description` | text | Full complaint text |
| `status` | text | `submitted` → `triaged` → `linked_to_prediction` → `dispatched` → `resolved` / `rejected` |
| `agent_priority_score` | int | 0–100 |
| `agent_recommendation` | text | Triage recommendation text |
| `nlp_event_cause`, `nlp_vehicle_type`, `nlp_event_type` | text | NLP-extracted |
| `nlp_priority`, `nlp_requires_road_closure` | text/bool | NLP signals |
| `geocoding_provider`, `geocoding_confidence`, `geocoding_raw` | text/float/jsonb | Geocoding metadata |
| `created_at`, `updated_at` | timestamptz | |

---

### `prediction_events` — ML predictions & feedback

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `idempotency_key` | text UNIQUE | SHA256 of stable input payload |
| `pipeline_mode` | text | `planned`, `unplanned` |
| `event_cause_grouped`, `event_type`, `priority` | text | Classification inputs |
| `requires_road_closure` | bool | |
| `corridor`, `zone` | text | |
| `latitude`, `longitude` | float | |
| `hour`, `day_of_week`, `month` | int | Time features |
| `predicted_duration_minutes` | numeric | Output: float minutes |
| `impact_level` | text | `Low`, `Medium`, `High`, `Critical` |
| `model_version` | text | `v1`, `v2`, … |
| `request_payload` | jsonb | Full input |
| `response_payload` | jsonb | Full model response |
| `operator_override_notes` | text | Feedback (non-blocking) |
| `actual_duration_minutes`, `actual_impact_level` | numeric/text | Ground truth post-event |
| `feedback_diversion_worked`, `feedback_personnel_adequate` | bool | Post-event survey |
| `eligible_for_retraining` | bool GENERATED | Any ground truth present → `true` |
| `used_for_retraining` | bool | Marked after training run |
| `created_at`, `updated_at` | timestamptz | |

---

### `deployment_orders` — Field dispatch orders

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `order_number` | text UNIQUE | `DRS-DEP-XXXXXXXXXX` |
| `grievance_id` | UUID FK | Linked complaint |
| `prediction_event_id` | UUID FK | Linked prediction |
| `commander_user_id` | UUID FK | Issuing admin/operator |
| `corridor`, `zone` | text | |
| `priority` | text | |
| `status` | text | `draft`, `issued`, `in_progress`, `completed`, `cancelled`; also `enroute`, `onscene`, `resolved`, `escalated` |
| `resource_recommendation` | jsonb | Cached resource plan |
| `field_brief` | text | Operational instructions |
| `created_at`, `updated_at` | timestamptz | |

---

### `deployment_order_personnel` — Assignment junction (many-to-many)

| Column | Type |
|--------|------|
| `deployment_order_id` | UUID FK |
| `personnel_id` | UUID FK |
| `assignment_role` | text (`field deployment`, `command`) |
| PK | `(deployment_order_id, personnel_id)` |

---

### `deployment_chat_messages` — WebSocket chat persistence

| Column | Type |
|--------|------|
| `id` | text PK (UUID) |
| `deployment_id` | text |
| `sender_id` | text (user UUID) |
| `sender_name` | text |
| `sender_role` | text |
| `message` | text |
| `sent_at` | timestamptz |

---

### Audit & ML tables (supplementary)

| Table | Purpose |
|-------|---------|
| `drishti_event_log` | Append-only event history (trigger on grievance/prediction changes) |
| `agent_actions` | Triage recommendation audit |
| `event_stream_outbox` | Transactional outbox pattern (schema present; not wired) |
| `event_conflict_escalations` | Overlapping corridor review (schema only) |
| `event_pii_vault` | Sensitive model-excluded data (schema only) |
| `retraining_runs` | Retraining batch metadata |
| `model_registry` | Model artifact metadata (schema only) |
| `retraining_prediction_dataset` | View: training-eligible predictions |

---

## 5. API Reference

### Authentication flow

```
JWT stored in: Redis blacklist (logout revocation)
Token format:  HS256 · 720-minute TTL
Header:        Authorization: Bearer <token>
```

JWT payload:
```json
{
  "sub": "<user_id>",
  "email": "<email>",
  "role": "admin|operator|viewer",
  "jti": "<unique_token_id>",
  "iat": 0,
  "exp": 0
}
```

---

### Auth routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Create pending account |
| POST | `/auth/login` | Public | Issue JWT on valid credentials |
| GET | `/auth/me` | Bearer | Validate token + return user |
| POST | `/auth/logout` | Optional | Blacklist JTI in Redis |

---

### Public routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Model readiness check |
| POST | `/citizen/grievances` | Submit complaint |
| GET | `/citizen/grievances/{tracking_id}` | Lookup by tracking ID |
| GET | `/docs` | Swagger UI |
| GET | `/redoc` | ReDoc |

---

### Admin routes (role: `admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List users / access requests |
| POST | `/admin/users/{id}/approve` | Approve account (optional personnel upsert) |
| POST | `/admin/users/{id}/reject` | Reject with reason + email |
| POST | `/admin/personnel` | Register new personnel |
| DELETE | `/admin/personnel/{id}` | Soft-delete personnel |

---

### Police operations routes (role: `admin`, `operator`, `viewer`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/police/personnel` | all | List active personnel |
| POST | `/police/deployments` | admin, operator | Create deployment order |
| GET | `/police/deployments` | all | List 50 recent orders |
| PATCH | `/police/deployments/{id}/status` | admin, operator | Advance order status |
| GET | `/police/grievances` | all | List 50 recent complaints |
| PATCH | `/police/grievances/{id}/status` | admin, operator | Update complaint status |

---

### Prediction & intelligence routes

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/predict-impact` | admin, operator | Full ML prediction pipeline |
| GET | `/operations/summary` | all | KPI snapshot |
| GET | `/police/deployments/{id}/messages` | authenticated | Chat history (100 msg) |

---

### Field operations routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/field/personnel/{badge}/location` | **None** | Badge GPS update (unauthenticated — see Security section) |
| POST | `/field/me/location` | Bearer | Update own GPS |
| GET | `/field/me/assignments` | Bearer | My deployment orders |
| POST | `/field/me/report` | Bearer | Lodge field grievance |
| GET | `/field/route` | Bearer | Proxy Mappls route (fallback: straight line) |

---

### WebSocket route

```
WS  /ws/chat/{deployment_id}?token=<jwt>
```

- Authenticates JWT from query string
- Sends last 100 messages as initial `{ "history": [...] }` frame
- Broadcasts all new messages to room in real time
- Persists each message to `deployment_chat_messages`
- On disconnect, connection is removed; client auto-reconnects

**Limitation**: In-process manager only. Multi-worker deployments need Redis pub/sub.

---

## 6. End-to-End Data Flows

### 6.1 Citizen Complaint Submission

```
Citizen browser
     │
     │  POST /citizen/grievances
     │  { complaint_type, location_text, description, [lat/lng] }
     ▼
Backend: grievance_repository.create()
     │
     ├─ 1. LLM Firewall
     │     IncidentPredictor.llm_firewall(description)
     │     → embedding cosine similarity to traffic anchors
     │     → if uncertain zone: call Gemini 2.0 Flash Lite
     │     → reject if not traffic-related
     │
     ├─ 2. Geocoding (if no lat/lng provided)
     │     MapMyIndia geocode API → lat, lng, confidence
     │
     ├─ 3. Triage
     │     grievance_agent.triage_grievance()
     │     → priority_score (0–100)
     │     → recommendation (text)
     │     → severity (Low/Medium/High/Critical)
     │
     ├─ 4. NLP Extraction
     │     incident_predictor.run_ml_only()
     │     → nlp_event_cause, nlp_vehicle_type, nlp_priority,
     │       nlp_requires_road_closure, nlp_event_type
     │
     ├─ 5. DB Insert
     │     citizen_grievances table, tracking_id = DRS-BTP-XXXXXXXXXX
     │
     └─ 6. Audit
           drishti_event_log trigger fires
     │
     ▼
Response: { tracking_id, severity, agent_recommendation, … }

Citizen sees tracking ID → can check status at /citizen/track
```

### 6.2 Complaint Review & Impact Prediction

```
Admin: /dashboard/complaints
     │
     │  30-second poll: GET /police/grievances
     │
     ├─ Select complaint → click "Forecast"
     │
     │  POST /predict-impact
     │  { event_cause_grouped, priority, corridor, zone,
     │    requires_road_closure, hour, lat, lng, description, … }
     ▼
Backend: prediction_service.predict()
     │
     ├─ 1. Pydantic validation of ImpactPredictionRequest
     │
     ├─ 2. Feature frame construction
     │     operational_policy.model_input_dict()
     │     → 11-column DataFrame in exact sklearn feature order
     │
     ├─ 3. Duration model inference
     │     Random Forest (300 trees) on log-duration features
     │     → expm1(log_prediction) → duration_minutes
     │
     ├─ 4. Impact model inference
     │     Random Forest (300 trees) → Low/Medium/High/Critical
     │
     ├─ 5. NLP signals
     │     nlp_agent_service.analyze()
     │     → urgency_score, risk keywords, crowd size, summary
     │
     ├─ 6. Resource recommendation
     │     resource_recommendation_service.build()
     │     → If model loaded: ML inference
     │       personnel_total, constables, asi, si, inspectors,
     │       barricades, tow_units, medical_units, diversion_confidence
     │     → Else: operational_policy fallback rules
     │
     ├─ 7. Learning signal
     │     learning_priority (high/medium/low)
     │     expected_ground_truth_fields
     │
     └─ 8. Non-blocking DB write
           prediction_events table (logging failure never blocks response)
     │
     ▼
Response: { predicted_duration_minutes, impact_level,
            nlp_summary, keywords, risks,
            resource_recommendation, learning_signal }

Admin sees: duration chip, impact badge, resource table,
            diversion confidence, learning feedback form
```

### 6.3 Deployment & Assignment

```
Admin/Operator: /dashboard/operator
     │
     │  POST /police/deployments
     │  { grievance_id, field_brief,
     │    auto_assign_nearest: true,
     │    required_personnel_count: 4 }
     ▼
Backend: deployment_service.create_order()
     │
     ├─ 1. Load grievance (coordinates, severity, recommendation)
     │
     ├─ 2. Generate order_number: DRS-DEP-XXXXXXXXXX
     │
     ├─ 3. Auto-assignment
     │     → Filter: is_active=true, is_available=true
     │     → Sort by Haversine distance from complaint coordinates
     │     → Personnel without GPS ranked last
     │     → Take top N
     │
     ├─ 4. DB writes
     │     INSERT deployment_orders
     │     INSERT deployment_order_personnel (junction)
     │     UPDATE police_personnel SET is_available=false
     │
     └─ 5. WhatsApp notification (payload prepared; not sent)
     │
     ▼
Response: { order_number, assigned_personnel, status: "issued" }

Field officers see assignment at /dashboard/field (30s poll)
```

### 6.4 Field Officer Operations

```
Field Officer: /dashboard/field
     │
     ├─ Page load → GET /field/me/assignments
     │   → List of deployment orders assigned to me
     │
     ├─ Browser: navigator.geolocation.watchPosition()
     │   Every 30s → POST /field/me/location
     │               { latitude, longitude }
     │               → UPDATE police_personnel.current_lat/lng
     │
     ├─ Status progression (officer-initiated):
     │   issued → in_progress (en route)
     │   in_progress → resolved (on scene + done)
     │   PATCH /police/deployments/{id}/status { status: "in_progress" }
     │   On resolve: assigned personnel.is_available = true
     │               linked grievance → pending_verification
     │
     ├─ Route view
     │   GET /field/route?from_lat&from_lng&to_lat&to_lng
     │   → Proxy to Mappls route API → EnrouteMapPanel
     │   → Fallback: straight-line geometry
     │
     └─ Chat
         WS /ws/chat/{order_id}?token=<jwt>
         → 100 prior messages sent on connect
         → Live broadcast to all room members
         → Messages saved to deployment_chat_messages
```

### 6.5 Admin Approval Workflow

```
New user registers → approval_status = "pending"
     │
     │  Admin: /dashboard/access
     │  GET /admin/users → list pending accounts
     │
     ├─ Approve
     │   POST /admin/users/{id}/approve
     │   { badge_id, rank, unit_name } (optional)
     │   → approval_status = "approved", is_active = true
     │   → Optional: upsert police_personnel row
     │   → SMTP email: "Access approved"
     │
     └─ Reject
         POST /admin/users/{id}/reject
         { rejection_reason: "..." }
         → approval_status = "rejected"
         → SMTP email: reason included
```

---

## 7. Machine Learning Architecture

### 7.1 Active models (loaded at startup — required)

| Model file | Size | Type | Target |
|-----------|------|------|--------|
| `duration_model.pkl` | 1.5 MB | sklearn RF Pipeline | `log_duration_minutes` (regression) |
| `impact_model.pkl` | 56 MB | sklearn RF Pipeline | impact_level (4-class) |

**Duration model** — Random Forest, 300 trees:
- Input: event_cause_grouped, event_type, priority, requires_road_closure, corridor, zone, lat, lng, hour, day_of_week, month
- Inference: `predicted_minutes = expm1(model.predict(X))`

**Impact model** — Random Forest, 300 trees:
- Input: same 11 features
- Labels from duration thresholds:
  - Low: ≤ 72 min
  - Medium: ≤ 793 min
  - High: ≤ 17,146 min
  - Critical: > 17,146 min

### 7.2 Operational models (fallback available if missing)

| Model file | Size | Targets |
|-----------|------|---------|
| `resource_deployment_model.pkl` | 15 MB | personnel_total, constables, asi, si, inspectors, barricades, tow_units, medical_units, diversion_confidence |
| `learning_priority_model.pkl` | 2.0 MB | retraining_priority (high/medium/low) |

If either model is missing, `operational_policy.py` applies rule-based fallback:
- Low impact → 4–6 personnel, no tow, no medical
- Medium → 8–10 personnel, 2 barricades
- High + road closure → 12–16 personnel, tow units, medical
- Critical → 20+ personnel, full resource table

### 7.3 XGBoost description pipeline (`incident_predictor.py`)

`incident_predictor.py` is the backbone of free-text complaint understanding. It provides three entry points:

| Function | Used by | Does |
|----------|---------|------|
| `llm_firewall(description, emb)` | `grievance_repository.create()` | Validates description is traffic-related |
| `run_ml_only(description, ...)` | `grievance_agent.triage_grievance()` | Pure ML inference, no firewall |
| `predict_incident(description, ...)` | `/predict/incident` endpoint | Full pipeline: firewall → ML |

**Feature vector** (397 total dimensions):

```
Structural features (13):
  hour, day_of_week, month, is_night, reporting_delay_min,
  latitude, longitude, requires_road_closure,
  event_cause_enc, veh_type_enc, corridor_enc,
  police_station_enc, zone_enc

Embedding features (384):
  emb_0 … emb_383   ← SentenceTransformer output
```

**Models loaded (singleton, thread-safe with `threading.Lock`)**:
- `duration_model.pkl` — XGBoost duration regression
- `resource_model.pkl` — XGBoost priority classifier (binary: 0 Low / 1 High)
- `label_encoders.pkl` — sklearn LabelEncoders for each categorical field
- SentenceTransformer (`paraphrase-multilingual-MiniLM-L12-v2`) + pre-computed anchor embeddings

**NLP keyword extraction** (runs inside `run_ml_only` before encoding):

Event cause keywords:

| Cause | Example keywords |
|-------|----------------|
| `vehicle_breakdown` | breakdown, stalled, flat tyre, battery dead |
| `tree_fall` | tree, fallen tree, tree branch |
| `accident` | accident, collision, crash, hit and run |
| `road_work` | road work, construction, digging, repair |
| `signal_failure` | signal, traffic light, signal failure |
| `flooding` | flood, waterlogging, rain, submerged |
| `protest` | protest, rally, bandh, strike |
| `vip_movement` | vip, convoy, motorcade |
| `event_congestion` | concert, match, festival, procession |

Vehicle type keywords:

| Type | Example keywords |
|------|----------------|
| `heavy_vehicle` | truck, lorry, tanker, trailer |
| `lcv` | mini truck, pickup, lcv |
| `bmtc_bus` | bmtc, government bus, kstrc |
| `bus` | bus, coach, volvo |
| `two_wheeler` | bike, motorcycle, scooter |
| `car` | car, sedan, suv, taxi, cab, auto |

**Output from `run_ml_only`**:
```python
{
  "estimated_duration_min": 142.5,
  "estimated_duration_hrs": 2.37,
  "priority": "High",          # from priority_pred (binary XGBoost)
  "personnel_to_deploy": 4,    # from _get_personnel() rules
  "urgency": "HIGH",           # from _get_urgency() rules
  "detected_cause": "accident",
  "detected_veh_type": "heavy_vehicle",
}
```

**Personnel / urgency rules (post-model)**:
```python
# personnel = base(1) + priority_bonus + closure_bonus + duration_bonuses
if priority_pred == 1: base += 1
if road_closure:        base += 1
if duration_min > 240:  base += 1
if duration_min > 480:  base += 1

# urgency
if priority_pred == 1 and duration_min > 240:                   → CRITICAL
if priority_pred == 1 or (road_closure and duration_min > 120): → HIGH
if duration_min > 120:                                          → MEDIUM
else:                                                           → LOW
```

---

### 7.4 Gemini Semantic Firewall (LLM Firewall)

Every citizen complaint description must pass this gate before it is saved to the database. It is a **two-layer validation system**: a fast local semantic filter, then a Gemini LLM call only when the local layer is uncertain.

#### Layer 1 — Semantic similarity (local, zero-latency)

The description is embedded with SentenceTransformer and compared against **13 pre-computed anchor embeddings** (10 English + 3 Kannada) using cosine similarity. The highest similarity across all anchors is the score.

**Traffic anchor sentences:**

```
English:
  "heavy truck stalled on highway blocking traffic"
  "vehicle breakdown on national highway requiring tow truck"
  "tree fallen across road causing traffic blockage"
  "accident between vehicles creating traffic jam"
  "road construction causing traffic diversion"
  "traffic signal malfunction causing heavy congestion"
  "bus breakdown blocking main road"
  "waterlogging on road due to rain causing traffic jam"
  "VIP convoy movement causing road closure"
  "large event causing severe traffic congestion near junction"

Kannada:
  "ಮರ ಬಿದ್ದಿದೆ ರಸ್ತೆ ಬ್ಲಾಕ್ ಆಗಿದೆ"          (Tree fell, road blocked)
  "ವಾಹನ ತಾಂತ್ರಿಕ ದೋಷ ರಸ್ತೆ ಮೇಲೆ ನಿಂತಿದೆ"   (Vehicle breakdown on road)
  "ಅಪಘಾತ ಆಗಿದೆ ರಸ್ತೆ ಮುಚ್ಚಿದೆ"             (Accident, road closed)
```

**Thresholds:**

```
sim = max(cosine(description_emb, anchor_i))  for all 13 anchors

sim ≥ 0.50  →  Accept immediately   (clear traffic incident)
sim < 0.15  →  Reject immediately   (clearly unrelated)
0.15 ≤ sim < 0.50  →  Uncertain zone → call Gemini
```

#### Layer 2 — Gemini 2.0 Flash Lite (uncertain zone only)

Only triggered when `0.15 ≤ sim < 0.50`. Keeps API cost near zero for the majority of submissions.

```
Model:  gemini-2.0-flash-lite
Prompt (truncated to first 500 chars of description):

  "Is the following description about a road traffic incident
   (breakdown, accident, congestion, tree fall, signal failure,
   flooding, etc.)?
   Reply with exactly one word: YES or NO.

   Description: <description[:500]>"
```

**Decision table:**

| Condition | Result |
|-----------|--------|
| sim ≥ 0.50 | Accept — semantic pass |
| sim < 0.15 | Reject — clearly not traffic |
| 0.15–0.50, Gemini replies `YES` | Accept — Gemini validated |
| 0.15–0.50, Gemini replies `NO` | Reject — Gemini determined not traffic |
| 0.15–0.50, Gemini key not configured | Accept — borderline, key absent |
| 0.15–0.50, Gemini API error / timeout | **Reject** — fail-safe (clear incidents already passed at ≥0.50) |

The fail-safe reject on API error is intentional: if a description genuinely describes a traffic incident, it will almost certainly have `sim ≥ 0.50` and never need Gemini in the first place.

#### How it plugs into the complaint flow

```
grievance_repository.create(payload)
     │
     ├─ _ensure_loaded()             # lazy singleton init (thread-safe Lock)
     │   → load duration_model.pkl
     │   → load resource_model.pkl
     │   → load label_encoders.pkl
     │   → init SentenceTransformer
     │   → pre-compute _anchor_embs
     │
     ├─ emb = _embedder.encode([description])[0]
     │
     ├─ is_valid, reason = llm_firewall(description, emb)
     │
     ├─ if not is_valid → HTTP 422 with reason message
     │
     └─ continue → geocode → triage → run_ml_only → DB insert
```

`run_ml_only` reuses the same embedding computed for the firewall — no double encode.

### 7.5 Weekly Retraining Pipeline

`backend/ml/weekly_retraining_pipeline.py`:

1. Load anonymized Astram CSV + DB retraining view (`retraining_prediction_dataset`)
2. Derive `duration_minutes`, `log_duration = log1p(duration_minutes)`, impact labels
3. Extract time features (hour, day_of_week, month)
4. 80/20 train/test split
5. Train 4 Random Forest models (300 trees each)
6. Compute MAE / R² / accuracy metrics
7. Save timestamped candidates to `backend/app/models/candidates/{timestamp}/`

**Promotion is manual**: copy candidate files to `backend/app/models/`, restart backend.

---

## 8. Frontend Architecture

### 8.1 Session management (`lib/auth.ts`)

```
localStorage keys:
  drishti_access_token  ← JWT
  drishti_user          ← User snapshot (JSON)

validateSession()
  → GET /auth/me with stored token
  → On 401: clear storage, redirect to /login

login(email, password)
  → POST /auth/login
  → Store token + user snapshot
  → Redirect to role-based dashboard

logout()
  → POST /auth/logout (blacklist token server-side)
  → Clear localStorage
  → Redirect to /login
```

### 8.2 API client (`lib/api.ts`)

- Axios instance with `baseURL = NEXT_PUBLIC_API_URL`
- Request interceptor: auto-attaches `Authorization: Bearer <token>`
- Fully typed operation wrappers for every endpoint

### 8.3 Role-based routing (`lib/roles.ts`)

| Role | Default dashboard |
|------|------------------|
| `admin` | `/dashboard/admin` |
| `operator` | `/dashboard/operator` |
| `viewer` | `/dashboard/viewer` |
| Field officer | `/dashboard/field` |

`ProtectedRoute` component validates token and role on every protected page, redirecting unauthorized users. Note: **backend authorization is the real security boundary** — frontend guards are UX only.

### 8.4 Data fetching pattern

- No global state library (no Redux, Zustand, etc.)
- Per-page `useState` + `useEffect` with `setInterval` polling (mostly 30s)
- Optimistic UI updates with rollback on error

### 8.5 Key components

| Component | What it does |
|-----------|-------------|
| `PredictionForm` | Event prediction input + validation |
| `PredictionResultCard` | Shows duration, impact, resources, learning signals |
| `DeploymentAssignmentPanel` | Auto/manual officer selection & order creation |
| `EnrouteMapPanel` | Mappls route display for field officers |
| `ChatPanel` + `useDeploymentChat` | WebSocket real-time deployment chat |
| `PersonnelMap` / `MapplsRouteMap` | Mappls-based maps |
| `RouteMapLeaflet` | OpenStreetMap/Leaflet fallback |
| `AccessRequestsPanel` | Admin approval/rejection list |
| `CommandRoomPersonnelPanel` | Live personnel status on map |
| `DescriptionPipelinePreview` | Landing page NLP pipeline visualization |

### 8.6 Styling

- Tailwind CSS v3.4 · dark-mode only
- Colors: background `#08080F` · accent `#FFE600` · text `#F0F0F8` · border `#252535`
- Lucide React icons
- Custom animations: typing effect, live-breathe pulse (`globals.css`)

---

## 9. Backend Services

### `auth_service.py`

```
register(payload)      → pending account, bcrypt hash
login(payload)         → verify approval+active, issue JWT
get_user_from_token()  → validate signature + expiry + Redis blacklist + DB state
logout(token)          → blacklist JTI in Redis
approve_user(id, data) → set approved, email, optional personnel upsert
reject_user(id, reason)→ set rejected, email with reason
```

### `prediction_service.py`

```
load_models()          → joblib.load duration_model.pkl + impact_model.pkl at startup
predict(payload)       → build DataFrame → run both models → return PredictionResponse
_build_feature_frame() → exact feature order from *_feature_columns.json
```

### `grievance_repository.py`

```
create(payload)              → llm_firewall → geocode → triage → nlp → DB insert
get_by_tracking_id(tid)      → SELECT by DRS-BTP-... tracking ID
update_status(id, status)    → PATCH complaint status
list_recent(limit=50)        → most recent complaints
```

### `deployment_service.py`

```
create_personnel(payload)           → INSERT police_personnel
list_personnel()                    → all active personnel
create_order(payload)               → generate order number, Haversine rank, insert order + junction, set unavailable
update_location(badge_id, payload)  → UPDATE lat/lng/timestamp
get_my_assignments(user)            → SELECT orders for current user's badge_id
update_order_status(id, status)     → PATCH order, re-enable availability on resolve
_nearest_personnel_ids(lat,lng,n)   → Haversine sort, return top N UUIDs
```

### `chat_service.py`

```
_ensure_schema()             → CREATE TABLE IF NOT EXISTS deployment_chat_messages
get_messages(deployment_id)  → SELECT last 100 messages
save_message(...)            → INSERT to deployment_chat_messages
```

### `resource_recommendation_service.py`

```
load_models()            → joblib.load resource + learning models
build(payload, base, nlp)→ model inference or policy fallback
_bounded_int(val, min, max) → clamp output to operational range
```

### `nlp_agent_service.py`

```
analyze(payload) → rule-based keyword scan
               → urgency_score (base + keyword bonuses + crowd size)
               → risk list, summary text, keyword list
```

### `incident_predictor.py`

```
llm_firewall(desc, emb) → cosine similarity → accept/reject/Gemini
run_ml_only(...)        → XGBoost inference + label encoding
predict_incident(...)   → firewall + ML full pipeline
```

### `mapmyindia_client.py`

```
geocode(location_text)             → lat, lng, confidence via Mappls REST
get_route(from_lat, from_lng, to_lat, to_lng) → GeoJSON route via Mappls
```

---

## 10. Configuration & Environment Variables

### Backend `.env`

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | Must be kept secret |
| `JWT_ALGORITHM` | No | Default: `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No | Default: `720` |
| `REDIS_URL` | No | Logout revocation disabled if absent |
| `ALLOWED_ORIGINS` | No | CORS origins (default: localhost:3000,3001) |
| `MAPMYINDIA_API_KEY` | No | Mappls REST key for geocoding & routing |
| `MAPMYINDIA_GEOCODE_URL` | No | Mappls geocode endpoint |
| `SMTP_HOST`, `SMTP_PORT` | No | SMTP server for approval emails |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | No | SMTP credentials |
| `SMTP_USE_TLS` | No | Default: `true` |
| `OLLAMA_URL` | No | Default: `http://localhost:11434` |
| `OLLAMA_MODEL` | No | Default: `llama3.2` |
| `OLLAMA_TIMEOUT_S` | No | Default: `6` |
| `GEMINI_API_KEY` | No | LLM firewall fallback validation |
| `SENTENCE_TRANSFORMER_MODEL` | No | Default: `paraphrase-multilingual-MiniLM-L12-v2` |

### Frontend `.env.local`

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g., `http://localhost:8000`) |
| `NEXT_PUBLIC_MAPPLS_KEY` | Mappls SDK key for browser map components |

---

## 11. Deployment & Docker

### Docker Compose services

```yaml
services:

  redis:                          # Redis 7 Alpine
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]
    healthcheck: redis-cli ping

  backend:                        # FastAPI / Uvicorn
    build: ./backend
    ports: ["8000:8000"]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
    env_file: backend/.env
    depends_on: { redis: { condition: service_healthy } }
    healthcheck: GET /health

  frontend:                       # Next.js Standalone
    build: ./frontend
    ports: ["3000:3000"]
    build_args: { NEXT_PUBLIC_API_URL: http://localhost:8000 }
    command: node server.js
    depends_on: { backend: { condition: service_healthy } }
```

### Backend Dockerfile (Python 3.12-slim)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "from sentence_transformers import SentenceTransformer; ..."   # pre-cache embedder
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
```

### Frontend Dockerfile (Node 20 Alpine, 3-stage)

```dockerfile
# Stage 1 — install deps
FROM node:20-alpine AS deps
WORKDIR /app; COPY package*.json ./; RUN npm ci --prefer-offline

# Stage 2 — build
FROM node:20-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules; COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# Stage 3 — run (standalone output)
FROM node:20-alpine AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["sh", "-c", "PORT=${PORT:-3000} node server.js"]
```

---

## 12. Middleware & Security

### 12.1 Middleware stack (applied in order)

1. **RequestIDMiddleware** — generates `X-Request-ID` header; logs request/response time
2. **SecurityHeadersMiddleware** — adds `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
3. **RateLimitMiddleware** — 120 requests / 60 seconds per IP (per-process; not distributed)
4. **CORS** — `ALLOWED_ORIGINS` from config (default: localhost:3000,3001)

### 12.2 Known security issues

| Severity | Issue | Fix |
|----------|-------|-----|
| Critical | `POST /field/personnel/{badge}/location` is **unauthenticated** | Require device credential or remove endpoint |
| High | WebSocket chat has no deployment-membership check — any authenticated user can read any chat room | Add membership check in WS handler |
| High | JWT stored in `localStorage` → XSS exposure | Use `HttpOnly` secure cookies + CSP |
| Medium | WebSocket JWT in URL query string → captured by server logs | Move to header or cookie |
| Low | `/field/location` page has no `ProtectedRoute` wrapper | Add frontend auth guard |

---

## 13. Resilience & Observability

### 13.1 Graceful degradation

| Component down | Impact |
|----------------|--------|
| PostgreSQL | Core workflows fail (auth, complaints, deployment) |
| Redis | Logout revocation skipped; JWTs remain valid until expiry |
| Duration / Impact models | `/predict-impact` fails (startup-critical) |
| Resource model | Operational policy rules applied as fallback |
| Learning model | Policy defaults; learning signals absent |
| MapMyIndia | Geocoding skipped; complaint saved without coordinates |
| Ollama | Recommendation text not rewritten; policy text returned |
| SMTP | Email failures logged; approval not reversed |
| Gemini | LLM firewall uncertain-zone defaults to reject |

### 13.2 Logging

- Python `logging` module, stdout output
- Level: INFO (configurable)
- Format: `%(asctime)s %(levelname)s %(name)s %(message)s`
- Named loggers: `drishti`, `drishti.chat`
- No structured JSON, no distributed tracing, no error monitoring (Sentry/DataDog/Prometheus not configured)

---

## 14. Development & Testing

### 14.1 Apply migrations

```bash
# Run all 11 migrations in order against your PostgreSQL instance
psql "$DATABASE_URL" -f backend/migrations/001_create_prediction_events.sql
psql "$DATABASE_URL" -f backend/migrations/002_create_app_users.sql
# ... through 011
```

### 14.2 Code quality

- **Frontend**: ESLint (`.eslintrc.json`), TypeScript strict
- **Backend**: Pydantic validation, Python type hints
- No Prettier / Black / pre-commit hooks configured

### 14.3 Testing status

No automated test suite exists. Manual verification checklist:

- [ ] `GET /health` returns all models loaded
- [ ] Register → pending → admin approve → login
- [ ] Citizen complaint → tracking ID returned
- [ ] `POST /predict-impact` → duration + impact + resources
- [ ] Deployment order → personnel marked unavailable
- [ ] Field GPS update → coordinates persisted
- [ ] Chat history persistence + live broadcast
- [ ] Mappls route fallback (when key missing)
- [ ] Role-based redirect on login
- [ ] Graceful behavior when DB unavailable

---

## 15. Running the System

### Prerequisites

- Python 3.12
- Node.js 20+
- PostgreSQL 13+ (or Supabase)
- Docker & Docker Compose (optional)

---

### Option A — Docker Compose (recommended)

```bash
# From project root
docker compose up --build
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Frontend |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/redoc | ReDoc |

---

### Option B — Native

**Terminal 1 — Backend**

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Copy and fill in your .env
cp .env.example .env

uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_MAPPLS_KEY=<your-key>" >> .env.local

npm run dev
```

---

### Demo credentials (must be seeded in DB first)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@gridathon.local` | `Drishti@123` |
| Operator | `operator@gridathon.local` | `Drishti@123` |
| Viewer | `viewer@gridathon.local` | `Drishti@123` |

No seed script is included — create these accounts via `POST /auth/register` then manually set `approval_status = 'approved'` and `is_active = true` in the database, or approve via the admin dashboard once the first admin account exists.

---

### Retraining (optional)

```bash
# From backend/
python ml/weekly_retraining_pipeline.py

# Artifacts saved to:
# backend/app/models/candidates/<timestamp>/

# To activate: copy to backend/app/models/ and restart backend
cp backend/app/models/candidates/<timestamp>/* backend/app/models/
```

---

*End of documentation.*
