# DRISHTI Frontend Design

## Purpose

DRISHTI is designed as a practical Bengaluru Police operations frontend. The interface is not a generic admin dashboard or a static landing page. It is structured around real police workflows:

- New police personnel request access.
- Command Centre approves or rejects access.
- Approved field officers log in and see only their assigned duty view.
- Field officer location is polled after login with browser permission.
- Command Centre assigns duty tasks based on complaints and personnel availability.
- Review users see reports only.
- Citizens can submit and track complaints outside the police dashboard shell.

## Design Principles

The frontend follows these principles:

- **Role-specific visibility:** Users only see pages relevant to their role.
- **Police-first language:** UI labels use terms like Command Centre, Field Officer, Duty Task, Complaint Queue, and Personnel Registry.
- **No developer-facing copy:** User-facing screens avoid terms such as backend, JWT, payload, prototype, model, and retraining.
- **Operational density:** Police dashboards are built for scanning and action, not marketing.
- **Clear separation:** Citizen pages and police dashboards have separate layouts.
- **Controlled motion:** Animation is used to show live state and system activity without distracting field users.

## Canonical Roles

The backend stores role keys as:

| Internal role key | Police-facing label | Default route |
| --- | --- | --- |
| `admin` | Command Centre | `/dashboard/admin` |
| `operator` | Field Officer | `/dashboard/field` |
| `viewer` | Police Review | `/dashboard/viewer` |

The frontend maps these keys through:

```text
frontend/src/lib/roles.ts
```

This keeps display labels consistent across login, sidebar, registration, and route redirects.

## Navigation And Access

The dashboard sidebar is dynamic. It only renders navigation items for the logged-in role.

### Command Centre

Command Centre users can access:

- `/dashboard/admin`
- `/dashboard/access`
- `/dashboard/operator`
- `/dashboard/complaints`
- `/dashboard/personnel`

### Field Officer

Field officers can access:

- `/dashboard/field`

They do not see Command Centre, Duty Dispatch, Complaint Queue, Personnel Registry, or Reports.

### Police Review

Review users can access:

- `/dashboard/viewer`

They do not see active duty tools.

Route protection is implemented at page level using `ProtectedRoute`, so users cannot access another role’s page by typing the URL.

## Main Frontend Areas

## Landing Page

File:

```text
frontend/src/app/page.tsx
```

The landing page is a stacked, scalable explanation of the system. It includes:

- DRISHTI overview
- Duty flow for new police personnel
- Separate views by role
- Bengaluru corridor watch
- Operational coverage

The landing page intentionally avoids a single horizontal one-page layout. It uses stacked sections so the system can scale as more features are added.

## Login Page

File:

```text
frontend/src/app/login/page.tsx
```

The login page supports three role views:

- Field
- Centre
- Review

After login, the user is routed according to their backend role:

- `admin` goes to Command Centre.
- `operator` goes to Field Orders.
- `viewer` goes to Reports.

If an account is pending or rejected, the login screen shows a clear reason returned from the backend.

## Police Access Request

Files:

```text
frontend/src/app/police/register/page.tsx
frontend/src/app/register/page.tsx
```

New police personnel submit:

- Full name
- Email
- Badge or staff ID
- Rank
- Unit or station
- Temporary password

The request is submitted as pending. Command Centre must approve before login is enabled.

## Command Centre Overview

File:

```text
frontend/src/app/dashboard/admin/page.tsx
```

The Command Centre overview shows:

- Complaint counts
- Critical and high-severity counts
- Mapped location count
- Forecast count
- Review queue count
- Latest operational signals
- Forecasted impact mix
- Duty access policy summary

This page is for command-level awareness.

## Access Requests

Files:

```text
frontend/src/app/dashboard/access/page.tsx
frontend/src/components/AccessRequestsPanel.tsx
```

This page is separate from Personnel Registry.

Command Centre can:

- See pending requests.
- Approve access.
- Reject access with a reason.
- See rejected requests.
- Recover a rejected request by approving it later.
- See recently approved users.

Rejected officers see the rejection reason during login instead of a generic login failure.

## Personnel Registry

Files:

```text
frontend/src/app/dashboard/personnel/page.tsx
frontend/src/components/CommandRoomPersonnelPanel.tsx
```

This is for active personnel management, not access approval.

Command Centre can:

- Register badge-linked personnel.
- Store rank, unit, zone, phone, WhatsApp number, and duty location.
- View personnel availability.
- View last known location.
- Remove personnel from the active registry.

## Duty Dispatch

Files:

```text
frontend/src/app/dashboard/operator/page.tsx
frontend/src/components/DeploymentAssignmentPanel.tsx
frontend/src/components/PredictionForm.tsx
frontend/src/components/PredictionResultCard.tsx
```

Duty Dispatch is available to Command Centre only.

It supports:

- Viewing urgent complaint signals.
- Issuing complaint-linked duty tasks.
- Selecting nearest available personnel.
- Writing field duty briefs.
- Reviewing suggested duty strength and traffic impact.

## Complaint Queue

File:

```text
frontend/src/app/dashboard/complaints/page.tsx
```

The complaint queue shows citizen reports to Command Centre.

It includes:

- Total reports
- High and critical reports
- Mapped locations
- Filterable report list
- Selected complaint details
- Triage recommendation
- Operational action buttons

## Field Orders

File:

```text
frontend/src/app/dashboard/field/page.tsx
```

This is the only dashboard view for field officers.

It shows:

- Current assigned task
- Complaint brief
- Location and corridor
- Priority
- Status
- Badge information
- Live location sharing status
- Officer action buttons

After login, the page attempts to start badge-based location sharing. The officer sees a clear explanation of why GPS permission is needed. If GPS is denied, tasks still appear, but location status remains inactive.

## Reports

File:

```text
frontend/src/app/dashboard/viewer/page.tsx
```

Reports are available to Police Review users only.

The page shows:

- Complaint totals
- Critical counts
- Mapped locations
- Forecast counts
- Severity distribution
- Latest complaint signals
- Top complaint types
- Forecast watch

Review users cannot change duty tasks or personnel records.

## Citizen Complaint Portal

Files:

```text
frontend/src/app/citizen/layout.tsx
frontend/src/app/citizen/grievance/page.tsx
frontend/src/app/citizen/track/page.tsx
```

Citizen pages are separate from the police dashboard shell.

Citizens can:

- Submit a traffic complaint.
- Add location, zone, corridor, severity, and description.
- Use quick Bengaluru location presets.
- Capture GPS if available.
- Receive a tracking token.
- Track complaint status with the token.

Citizen routes do not show the police sidebar.

## Field Location Polling Page

File:

```text
frontend/src/app/field/location/page.tsx
```

This standalone page lets personnel share badge location without the logged-in field dashboard.

It supports:

- Badge ID entry
- Start polling
- Stop polling
- Last update status
- Clear ground instructions

## Shared UI And Styling

Global styles live in:

```text
frontend/src/app/globals.css
```

Important shared classes:

- `ops-surface`
  - Dark command-style surface with grid texture and scan animation.

- `control-card`
  - Dark operational card for command panels.

- `light-card`
  - Light card for forms, records, and readable police queues.

- `reveal-up`
  - Entry animation for sections and cards.

- `live-breathe`
  - Pulse animation for live service and location indicators.

- `route-flow`
  - Moving bar animation used for corridor flow/status.

- `active-nav`
  - Sidebar active-state highlight.

## Motion Design

The UI uses controlled animation to make the system feel alive:

- Command surfaces have a slow scan sweep.
- Live status indicators pulse.
- Landing sections reveal upward.
- Corridor cards show moving route flow.
- Field location status uses live breathing indicators.
- Access and personnel queue cards reveal as operational records.

Animations respect reduced-motion preferences through the global CSS media query.

## API Integration

Frontend API helpers live in:

```text
frontend/src/lib/api.ts
```

Major API integrations:

- Auth login and registration
- List users
- Approve user
- Reject user
- Create personnel
- List personnel
- Remove personnel
- Update personnel location
- List field assignments
- Create deployment order
- List deployment orders
- Submit citizen complaint
- Track citizen complaint
- Load operational summary

## Auth And Session

Auth helpers live in:

```text
frontend/src/lib/auth.ts
```

They handle:

- Token storage
- Current user storage
- Login
- Logout
- Session validation
- Dashboard redirect by role
- Local forecast history storage

## Backend Support Added For Frontend Flow

To support access rejection, backend changes were added:

```text
backend/migrations/010_access_request_rejection_reason.sql
backend/app/schemas.py
backend/app/services/auth_service.py
backend/app/main.py
```

The backend now supports:

- `rejection_reason`
- Rejecting an access request
- Showing rejected users why login is blocked
- Auto-ensuring the rejection column exists before auth queries

## Verification

The frontend has been verified with:

```powershell
npm.cmd run build
```

The backend Python files have been verified with:

```powershell
python -m compileall backend\app
```

Both commands passed after the latest design and login fixes.

