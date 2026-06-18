# DRISHTI — Implementation Reference

> Bengaluru Traffic Police · Command & Control Platform  
> Stack: Next.js 14 (App Router) · FastAPI · PostgreSQL (Supabase) · Redis · Docker

---

## 1. Design System

All visual tokens live in `frontend/src/app/globals.css`.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#060c18` | Page background |
| `--surface` | `#0d1629` | Card backgrounds |
| `--surface-2` | `#111f38` | Elevated surfaces |
| `--border` | `#1c2e4a` | All borders |
| `--cyan` | `#22d3ee` | Primary accent, CTAs |
| `--text-primary` | `#f0f6ff` | Headings |
| `--text-secondary` | `#dde8f5` | Body |
| `--text-muted` | `#7c9ab8` | Supporting |
| `--text-dim` | `#3d5278` | Labels, mono IDs |

### CSS utility classes
`.cmd-card` · `.btn-primary` · `.btn-ghost` · `.field-dark` · `.badge` · `.badge-red/amber/blue/green/cyan/violet/muted` · `.section-kicker` · `.mono-id` · `.panel-title` · `.page-title` · `.data-bar` · `.grid-overlay` · `.live-breathe`

Old aliases still available: `.command-panel` · `.control-card` · `.stat-top-*`

---

## 2. Authentication & Authorization

### JWT auth (`backend/app/services/auth_service.py`)
- Tokens stored in `localStorage` as `drishti_access_token`
- JWT payload: `sub`, `email`, `role`, `jti` (UUID), `exp`, `iat`
- `HTTPBearer` scheme, `get_current_user()` FastAPI dependency
- Role guard: `require_roles("admin", "operator", ...)` dependency factory

### Redis token blacklist (`backend/app/services/token_blacklist.py`)
- On logout: `SETEX bl:jti:<uuid> <ttl> 1` (TTL = remaining token lifetime → self-cleaning)
- Every auth request checks `EXISTS bl:jti:<uuid>` before returning user
- Graceful fallback: if `REDIS_URL` unset or Redis down, blacklist is disabled (only client-side session cleared)
- Config: `REDIS_URL` in `backend/.env`

### Logout flow
1. Frontend `POST /auth/logout` (Bearer token)
2. Backend blacklists JTI in Redis
3. Frontend clears `localStorage` regardless of server response
4. Sidebar sign-out button: `async onClick → await logoutUser() → router.replace("/login")`

### Routes
| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Bearer |
| POST | `/auth/logout` | Bearer (optional) |

---

## 3. Roles & Pages

| Role | Dashboard | Capabilities |
|------|-----------|-------------|
| `admin` | `/dashboard/admin` | Full command centre: complaints, deployments, personnel, access approvals, forecasting |
| `operator` | `/dashboard/operator` | Duty dispatch: deployment assignment, urgent queue |
| `viewer` | `/dashboard/viewer` | Read-only reports |

`ProtectedRoute` component wraps every dashboard page. Shows dark spinner during session validation (no white flash).

---

## 4. Citizen Portal

### File a complaint — `/citizen/grievance`
- Category picker, location, description, phone
- Returns `tracking_id` in format `DRS-BTP-XXXXXXXXXX`

### Track a complaint — `/citizen/track`
- Token lookup, status timeline stepper
- 5 states: `pending → in_progress → assigned → pending_verification → resolved`

---

## 5. 2-Step (2FA) Complaint Resolution

Complaints are not marked resolved until both officer AND command centre approve.

**Step 1 — Field officer resolves deployment**
- `PATCH /police/deployments/{id}/status` with `{ status: "resolved" }`
- `deployment_service.update_order_status()` automatically runs:
  ```sql
  UPDATE citizen_grievances
  SET status = 'pending_verification'
  WHERE id = %s AND status NOT IN ('resolved', 'closed', 'pending_verification')
  ```

**Step 2 — Admin confirms**
- Admin dashboard shows **Pending Verification** panel (violet accent, live-breathe dot)
- "Confirm Resolved" button → `PATCH /police/grievances/{id}/status` → `resolved`
- Panel hides when queue is empty

**Status type** (both frontend and backend):
```
"pending" | "in_progress" | "assigned" | "pending_verification" | "resolved" | "closed"
```

---

## 6. ML Prediction Pipeline

### Models
| Model file | Purpose |
|------------|---------|
| `traffic_duration_random_forest_model.pkl` | Predicts incident duration (minutes) |
| `traffic_impact_random_forest_classifier.pkl` | Classifies impact level: Low / Medium / High / Critical |

### Endpoint
`POST /predict/impact` → `ImpactPredictionResponse`

### Response includes
- `predicted_duration_minutes` — float
- `impact_level` — Low / Medium / High / Critical
- `resource_recommendation` — **deployment count + breakdown**:
  - `personnel_total` — total officers needed (hero number in UI)
  - `constables`, `asi`, `si`, `inspectors` — rank breakdown
  - `barricades`, `tow_units`, `medical_units` — equipment
  - `diversion_confidence` — 0–1 float
  - `primary_action` — text instruction
  - `deployment_notes` — string list
- `nlp_signal` — keywords, urgency score, detected risks
- `learning_signal` — retraining feedback loop

### Where Event Intake lives
- **Removed from** `/dashboard/operator` (Dispatch)
- **Lives in** `/dashboard/complaints` (Complaint Queue) — collapsible "Traffic Forecast" panel in the detail sidebar
- Form auto-fills `corridor`, `zone`, `latitude`, `longitude` from the selected complaint
- Shows full deployment count UI after submission

---

## 7. Admin Dashboard (`/dashboard/admin`)

6-KPI strip: Critical · High · On Duty · Pending · **Verify** (pulsing when >0) · Resolved

Panels:
- **Pending Verification** — auto-shown when officers have resolved deployments awaiting admin sign-off
- **Live map** — `PersonnelMap` (Leaflet, SSR-disabled) showing officer positions
- **Live signal feed** — real-time complaint stream with status colours
- **Analytics** — severity bars, complaint type mix, zone coverage

---

## 8. Operator Dashboard (`/dashboard/operator`)

- 4-KPI strip: Critical · High Priority · In Progress · Total Queue
- `DeploymentAssignmentPanel` — assign available officers to a specific complaint
- Urgent complaint queue (right sidebar) — Critical + High severity, last 6

---

## 9. Personnel Registry (`/dashboard/personnel`)

- 4-KPI: Total · Active · Available now · GPS live
- `CommandRoomPersonnelPanel` — register officers (badge ID, name, rank, unit, zone, WhatsApp, GPS seed) + card grid with remove button
- Full registry table — all officers with GPS coordinates, availability badge, contact

When a user account is **approved** by admin, they are auto-inserted into `police_personnel` via `auth_service.approve_user()`.

---

## 10. Field Officer Dashboard (`/dashboard/field`)

- Duty toggle (on/off duty)
- GPS beacon panel — sends location while on duty
- Active deployment card — shows assigned complaint, description, location
- **Resolve deployment** button → triggers 2FA flow (sets grievance to `pending_verification`)

---

## 11. Access Requests (`/dashboard/access`)

- Pending approval queue — approve / reject with optional reason
- Rejection fires email via SMTP (`email_service.py`)
- Approval fires email + auto-registers in `police_personnel`

---

## 12. Pages & Routes

| Path | Component | Auth |
|------|-----------|------|
| `/` | Home (public marketing) | Public |
| `/login` | Split-screen login | Public |
| `/register` | Officer registration | Public |
| `/register/viewer` | Viewer registration | Public |
| `/citizen/grievance` | File complaint | Public |
| `/citizen/track` | Track complaint | Public |
| `/dashboard/admin` | Command Centre | admin |
| `/dashboard/operator` | Duty Dispatch | admin, operator |
| `/dashboard/complaints` | Complaint Queue + Forecast | admin |
| `/dashboard/field` | Field Orders | operator |
| `/dashboard/viewer` | Reports | viewer |
| `/dashboard/access` | Access Requests | admin |
| `/dashboard/personnel` | Personnel Registry | admin |

Deleted dead routes: `/track` · `/police/register`

---

## 13. Backend Services

| Service | File | Responsibility |
|---------|------|---------------|
| `AuthService` | `auth_service.py` | Register, login, JWT, logout |
| `TokenBlacklist` | `token_blacklist.py` | Redis-backed JWT revocation |
| `ResourceRecommendationService` | `resource_recommendation_service.py` | ML deployment count prediction |
| `DeploymentService` | `deployment_service.py` | Assignment CRUD + 2FA status transitions |
| `GrievanceAgent` | `grievance_agent.py` | NLP triage, priority scoring |
| `EmailService` | `email_service.py` | Approval/rejection SMTP emails |

---

## 14. Docker Compose

```bash
docker compose up --build
```

| Service | Port | Image |
|---------|------|-------|
| `redis` | 6379 | redis:7-alpine |
| `backend` | 8000 | python:3.12-slim (custom) |
| `frontend` | 3000 | node:20-alpine multi-stage |

- `REDIS_URL` is overridden inside compose to `redis://redis:6379/0` (internal network)
- Frontend build arg `NEXT_PUBLIC_API_URL=http://localhost:8000` (browser-side calls)
- Backend reads all other secrets from `backend/.env` (not committed)
- Next.js uses `output: "standalone"` for minimal production image

### Required env vars (`backend/.env`)
```
DATABASE_URL=postgresql://...
JWT_SECRET_KEY=...
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=720
REDIS_URL=redis://localhost:6379/0
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=...
MAPMYINDIA_API_KEY=...
```

---

## 15. Key Technical Decisions

| Decision | Reason |
|----------|--------|
| Redis blacklist with JTI (not full token) | Constant-size key, O(1) lookup, self-cleans via TTL |
| Backend handles `pending_verification` transition | `FieldAssignment` only exposes tracking token (not UUID), so frontend can't call `updateGrievanceStatus` directly |
| `useRef` + `setProperty` for CSS custom property bars | React `style` prop doesn't support custom properties cleanly; imperative DOM call avoids lint warnings |
| Next.js `dynamic(() => import(...), { ssr: false })` for Leaflet | Leaflet requires `window`; SSR would crash |
| `output: "standalone"` in next.config.ts | Required for minimal Docker image (`node server.js`) |
| Graceful Redis degradation | App runs in dev without Redis; blacklist silently disabled, warning logged |
