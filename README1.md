# DRISHTI Frontend Revamp Write-Up

## What Was Changed

The frontend was rebuilt around a practical Bengaluru Police duty flow instead of a generic dashboard or one-page presentation. The system now separates police-facing work by role, keeps the sidebar dynamic, and avoids exposing pages that do not belong to the logged-in user.

## Canonical Roles

The backend currently stores these internal role keys:

| Internal role key | Police-facing label | Default dashboard |
| --- | --- | --- |
| `admin` | Command Centre | `/dashboard/admin` |
| `operator` | Field Officer | `/dashboard/field` |
| `viewer` | Police Review | `/dashboard/viewer` |

The UI now uses a single frontend role registry in `frontend/src/lib/roles.ts` to map internal keys to police-facing labels. This avoids scattering labels across sidebar, login, registration, and route logic.

## Role-Based Dashboard Views

Each user now gets a respective dashboard view only:

- **Field Officer**
  - Lands on `Field Orders` after login.
  - Sees assigned duty tasks, task brief, complaint location, and live location status.
  - Does not see Command Centre, Duty Dispatch, Complaint Queue, Personnel Registry, or Reports in the sidebar.

- **Command Centre**
  - Sees Command Centre tools only.
  - Can approve or reject access requests, manage personnel, inspect complaint intake, and issue duty tasks.
  - Has access to Command Centre, Access Requests, Duty Dispatch, Complaint Queue, and Personnel Registry.

- **Police Review**
  - Sees Reports only.
  - Can review operational visibility without changing active duty records.

The dashboard routes are protected at page level as well, so users cannot simply type another dashboard URL and access it.

## Police Access And Login Flow

The new personnel flow is:

1. A new police personnel submits an access request with name, email, badge ID, rank, and unit.
2. Command Centre reviews the request.
3. Command Centre can approve the request or reject it with a reason.
4. Rejected requests remain visible and can be recovered by Command Centre if needed.
5. The badge/personnel record is linked in the Personnel Registry.
6. The officer logs in after approval.
7. Field officers are routed directly to the Field Orders screen.
8. The Field Orders screen requests browser GPS permission and starts badge-based location sharing after login.
9. Any assigned duty task appears on the officer screen with location, priority, and field brief.

## Access Requests vs Personnel Registry

Access approval and personnel management are now split:

- **Access Requests**
  - Handles pending, approved, and rejected login requests.
  - Lets Command Centre approve requests.
  - Lets Command Centre reject requests with a reason.
  - Shows recent rejected requests and allows recovery by approving a rejected request.

- **Personnel Registry**
  - Handles active personnel records.
  - Registers badge-linked field personnel.
  - Tracks unit, rank, WhatsApp number, availability, and last known duty location.

## Sidebar Behaviour

The sidebar is now role-aware:

- Field officers see only their field task screen.
- Review users see only reports.
- Command Centre users see only command/admin tools.

This keeps the interface safer and more realistic for actual police usage.

## Citizen Route Isolation

Citizen complaint and tracking pages live under the `/citizen` route group with their own layout. They do not use the police dashboard shell or police sidebar. Police dashboard routes remain protected by login and role checks.

## Landing Page

The home page was changed from a single horizontal hero-style layout into stacked sections:

- Bengaluru Police duty system overview
- Duty flow for a new officer joining
- Separate dashboard views by role
- Bengaluru corridor watch
- Operational coverage

This makes the first page easier to scale and avoids cramming the whole product explanation into one horizontal block.

## Language Cleanup

Developer-facing terms were removed from visible UI copy. The frontend now uses police-facing terms such as:

- Command Centre
- Field Officer
- Duty Task
- Duty Dispatch
- Complaint Queue
- Personnel Registry
- Police Review

Technical language such as backend, JWT, prototype, model, retraining, and payload was removed from user-facing text.

## Main Files Updated

- `frontend/src/app/page.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`
- `frontend/src/app/police/register/page.tsx`
- `frontend/src/app/dashboard/layout.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/app/dashboard/admin/page.tsx`
- `frontend/src/app/dashboard/access/page.tsx`
- `frontend/src/app/dashboard/operator/page.tsx`
- `frontend/src/app/dashboard/field/page.tsx`
- `frontend/src/app/dashboard/complaints/page.tsx`
- `frontend/src/app/dashboard/viewer/page.tsx`
- `frontend/src/app/dashboard/personnel/page.tsx`
- `frontend/src/app/field/location/page.tsx`
- `frontend/src/app/citizen/track/page.tsx`
- `frontend/src/app/citizen/grievance/page.tsx`
- `frontend/src/lib/roles.ts`
- `backend/app/main.py`
- `backend/app/services/auth_service.py`
- `backend/app/schemas.py`
- `backend/migrations/010_access_request_rejection_reason.sql`

## Verification

The frontend production build was run successfully after the changes:

```powershell
npm.cmd run build
```
