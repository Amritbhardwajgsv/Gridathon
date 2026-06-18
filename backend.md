# DRISHTI Backend Design

## Purpose

The DRISHTI backend is a FastAPI service for Bengaluru Police operations. It supports:

- Police authentication and role-based access.
- Command Centre approval and rejection of new police access requests.
- Personnel registry and badge-linked duty location updates.
- Citizen complaint intake and tracking.
- Complaint triage and priority scoring.
- Duty task assignment to available personnel.
- Traffic impact forecasting.
- Operational summary reporting.
- Database-backed event and prediction records.

The backend is designed so field operations can continue even when some optional integrations are unavailable.

## Backend Stack

Main technologies:

- **FastAPI** for the HTTP API.
- **Pydantic** schemas for request and response validation.
- **PostgreSQL / Supabase** for persistent operational records.
- **psycopg** for database access.
- **JWT** for police authentication.
- **bcrypt** for password hashing.
- **scikit-learn model artifacts** for duration, impact, resource, and review priority outputs.

Main entry point:

```text
backend/app/main.py
```

## Runtime Startup

On startup, the backend loads:

- Duration prediction model
- Impact prediction model
- Resource recommendation model
- Learning / review priority model

Startup lifecycle is handled in:

```text
backend/app/main.py
```

The backend does not train models during API runtime. Training is handled by scripts under `backend/ml`.

## Configuration

Configuration is read from environment variables through:

```text
backend/app/core/config.py
```

Important environment values:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- `MAPMYINDIA_API_KEY`
- `MAPMYINDIA_GEOCODE_URL`
- `REDIS_URL`
- `KAFKA_BOOTSTRAP_SERVERS`

The frontend expects the backend at:

```text
http://localhost:8000
```

## Auth And Access Control

Auth service:

```text
backend/app/services/auth_service.py
```

Auth schemas:

```text
backend/app/schemas.py
```

Auth supports:

- Register new police users.
- Login approved users.
- Validate current session.
- Store JWT role claims.
- Require role-based route access.
- Approve access requests.
- Reject access requests with a reason.

## Backend Role Keys

The backend stores these internal role keys:

| Internal key | Police-facing frontend label |
| --- | --- |
| `admin` | Command Centre |
| `operator` | Field Officer |
| `viewer` | Police Review |

These keys are part of the backend contract and are used by JWT claims and route guards.

## Access Request Flow

New police personnel register through:

```text
POST /auth/register
```

The backend stores the new account as:

- `is_active = false`
- `approval_status = pending`

Command Centre can approve:

```text
POST /admin/users/{user_id}/approve
```

Approval sets:

- `approval_status = approved`
- `is_active = true`
- `approved_by_user_id`
- `approved_at`
- `rejection_reason = null`

Command Centre can reject:

```text
POST /admin/users/{user_id}/reject
```

Rejection sets:

- `approval_status = rejected`
- `is_active = false`
- `approved_by_user_id`
- `approved_at`
- `rejection_reason`

If a rejected user attempts login, the backend returns the rejection reason instead of a generic failure.

## Login Fix Added

Login was failing because backend code queried `rejection_reason`, but the live database did not yet have that column.

Fixes added:

- Migration:

```text
backend/migrations/010_access_request_rejection_reason.sql
```

- Defensive schema check in:

```text
backend/app/services/auth_service.py
```

The auth service now ensures this column exists before auth queries run:

```sql
alter table app_users add column if not exists rejection_reason text
```

This prevents login from crashing with:

```text
psycopg.errors.UndefinedColumn: column "rejection_reason" does not exist
```

## Auth Endpoints

### Register

```text
POST /auth/register
```

Creates a pending police access request.

### Login

```text
POST /auth/login
```

Returns a bearer token for approved users.

Blocked login cases:

- Invalid email or password
- Pending Command Centre approval
- Rejected access request with reason

### Current User

```text
GET /auth/me
```

Returns the current authenticated user.

## Admin User Endpoints

### List Users

```text
GET /admin/users
```

Command Centre only.

Returns users ordered by approval status:

1. Pending
2. Approved
3. Rejected

### Approve User

```text
POST /admin/users/{user_id}/approve
```

Command Centre only.

### Reject User

```text
POST /admin/users/{user_id}/reject
```

Command Centre only.

Request body:

```json
{
  "reason": "Badge ID not found in unit records"
}
```

## Personnel Registry

Personnel and duty assignment logic is handled in:

```text
backend/app/services/deployment_service.py
```

Personnel schemas are in:

```text
backend/app/schemas.py
```

## Personnel Endpoints

### Create Personnel

```text
POST /admin/personnel
```

Command Centre only.

Stores:

- Badge ID
- Name
- Rank
- Unit
- Zone
- Phone
- WhatsApp number
- Current latitude and longitude

### List Personnel

```text
GET /police/personnel
```

Available to authenticated police roles.

### Remove Personnel

```text
DELETE /admin/personnel/{personnel_id}
```

Command Centre only.

The migration `008_soft_remove_police_personnel.sql` supports soft removal behavior.

## Location Polling

Location update endpoints support field officer tracking.

### Update Location By Badge

```text
POST /field/personnel/{badge_id}/location
```

Used by standalone field location polling.

### Update Current User Location

```text
POST /field/me/location
```

Uses the logged-in user’s linked `badge_id`.

If the logged-in user has no badge linked, the backend returns a clear error.

Location response includes:

- Badge ID
- Officer name
- Current latitude
- Current longitude
- Last location time
- Polling interval seconds

## Field Assignments

### My Field Assignments

```text
GET /field/me/assignments
```

Returns duty tasks assigned to the logged-in user’s badge.

If no badge is linked, it returns an empty list.

This endpoint powers the Field Officer dashboard.

## Citizen Complaint Intake

Complaint storage is handled in:

```text
backend/app/services/grievance_repository.py
```

Complaint triage is handled in:

```text
backend/app/services/grievance_agent.py
```

Optional geocoding is handled in:

```text
backend/app/services/mapmyindia_client.py
```

## Citizen Endpoints

### Submit Complaint

```text
POST /citizen/grievances
```

Public endpoint.

Stores:

- Reporter details when provided
- Complaint type
- Severity
- Location text
- Zone
- Corridor
- Latitude and longitude when available
- Description

The complaint agent assigns:

- Priority score
- Police recommendation

### Track Complaint

```text
GET /citizen/grievances/{tracking_id}
```

Public endpoint.

Returns complaint status and triage information for the citizen tracking page.

### Police Complaint Queue

```text
GET /police/grievances
```

Authenticated police endpoint.

Returns recent citizen reports for Command Centre review.

## Duty Dispatch

Duty task creation is handled by:

```text
backend/app/services/deployment_service.py
```

### Create Deployment Order

```text
POST /police/deployments
```

Creates a complaint-linked duty task.

Supports:

- Complaint ID
- Explicit personnel IDs
- Auto-assign nearest personnel
- Required personnel count
- Field brief
- Draft or issued status

When auto-assignment is enabled, the backend uses stored personnel location data to assign nearest available personnel.

### List Deployment Orders

```text
GET /police/deployments
```

Returns issued and draft duty task records.

## Traffic Impact Forecasting

Forecasting is handled by:

```text
backend/app/services/prediction_service.py
```

Prediction logging is handled by:

```text
backend/app/services/prediction_repository.py
```

Resource recommendations are handled by:

```text
backend/app/services/resource_recommendation_service.py
```

### Predict Impact

```text
POST /predict-impact
```

Authenticated police endpoint.

Inputs include:

- Event name
- Event cause group
- Event type
- Priority
- Road closure flag
- Corridor
- Zone
- Latitude
- Longitude
- Hour
- Day of week
- Month
- Crowd estimate
- Operational description
- Officer ground note

Returns:

- Predicted duration
- Impact level
- NLP / triage signal
- Resource recommendation
- Review signal

## Operations Summary

```text
GET /operations/summary
```

Returns command-level counts:

- Prediction count
- Grievance count
- Review-ready count
- Impact counts
- Severity counts
- Recent predictions

This powers Command Centre and Reports dashboards.

## Health Check

```text
GET /health
```

Returns:

- API status
- Duration model loaded
- Impact model loaded
- Resource model loaded
- Learning/review model loaded
- Prediction logging enabled

## Database Migrations

Migrations live in:

```text
backend/migrations
```

Current migrations:

| File | Purpose |
| --- | --- |
| `001_create_prediction_events.sql` | Prediction event storage |
| `002_create_app_users.sql` | Police users and auth foundation |
| `003_create_citizen_grievances.sql` | Citizen complaint intake |
| `004_operational_intelligence.sql` | Operational event logging and intelligence tables |
| `005_prediction_intelligence_payload.sql` | Prediction intelligence payload support |
| `006_police_personnel_and_deployments.sql` | Personnel registry and deployment orders |
| `007_location_based_personnel_dispatch.sql` | Location-based assignment |
| `008_soft_remove_police_personnel.sql` | Soft removal for personnel |
| `009_personnel_location_polling.sql` | Location polling support |
| `010_access_request_rejection_reason.sql` | Rejection reason for access requests |

## ML Model Files

Active model files live under:

```text
backend/app/models
```

Candidate model files live under:

```text
backend/app/models/candidates
```

Model categories:

- Duration model
- Impact model
- Resource deployment model
- Learning / review priority model

## Training And Retraining Scripts

Scripts:

```text
backend/ml/train_operational_models.py
backend/ml/weekly_retraining_pipeline.py
```

These scripts build or refresh model artifacts outside API runtime.

## Resilience Behaviour

The backend is built with operational fallback in mind:

- If prediction logging is unavailable, prediction can still return.
- Citizen complaints can submit with location text even if geocoding is unavailable.
- Field assignment endpoint returns an empty list if the user has no linked badge.
- Auth now self-checks the rejection reason column to avoid login crashes after partial migration.

## Security And Route Protection

Protected endpoints use:

```text
require_roles(...)
```

Defined in:

```text
backend/app/services/auth_service.py
```

Examples:

- Command Centre-only endpoints require `admin`.
- Field and review endpoints require authenticated police roles.
- Citizen submit and track endpoints are public.

## CORS

CORS currently allows:

```text
http://localhost:3000
```

This is configured in:

```text
backend/app/main.py
```

## How To Run Backend

```powershell
cd backend
python -m uvicorn app.main:app --reload
```

Default URL:

```text
http://127.0.0.1:8000
```

## Verification

Backend Python compile check:

```powershell
python -m compileall backend\app
```

This passed after the latest backend access rejection and login fixes.

