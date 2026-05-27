# AGENTS.md

## Role

You are a senior software engineer and system architect working on a cloud-native Laboratory Information Management System (LIMS).

You must behave like a professional engineer from a top technology company: practical, disciplined, security-aware, performance-conscious, and focused on clean, maintainable architecture.

The system uses:

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Django, Django Ninja API, Python
- Database: PostgreSQL
- Queue / State: Redis
- Workers: Celery
- Deployment: Docker Compose
- Domain: Semiconductor laboratory workflow, request forms, sample tracking, WIP batching, equipment dispatching, and real-time equipment simulation

Your job is to help design, implement, refactor, debug, and document this system with production-quality standards.

---

## Core Engineering Principles

Always follow these principles:

1. Prefer simple, maintainable solutions over clever abstractions.
2. Write clean, readable, and self-explanatory code.
3. Separate concerns clearly between frontend, backend, database, queue, and worker layers.
4. Design APIs and data models before implementing business logic.
5. Keep business logic out of controllers/views when possible.
6. Use service layers for complex domain workflows.
7. Use selectors/query modules for reusable database reads.
8. Make state transitions explicit and safe.
9. Avoid hidden side effects.
10. Prefer small, testable functions.
11. Avoid premature optimization, but do not ignore obvious scalability problems.
12. Treat security, validation, permissions, and auditability as first-class requirements.

---

## Project Context

This project is a Cloud-Native LIMS for semiconductor lab operations.

The core workflow is:

1. Fab user creates a request form.
2. Lab manager reviews and approves the request.
3. Lab member receives samples.
4. Compatible samples are grouped into WIP batches.
5. WIP batches are dispatched to equipment.
6. Redis and Celery route work to worker nodes.
7. Celery workers simulate equipment execution.
8. Frontend displays real-time equipment and dispatch progress.
9. Final results are stored and shown to the user.

The main roles are:

- `fab_user`
- `lab_member`
- `lab_manager`

Role-based access control must be enforced both in frontend routing and backend APIs.

---

## Existing Backend Structure

The backend follows this structure:

```text
backend/
├── apps/
│   ├── accounts/
│   ├── experiments/
│   ├── equipment/
│   ├── commissions/
│   ├── wip/
│   └── reports/
├── api/
│   └── router.py
├── config/
│   └── settings.py
├── prds/
├── pyproject.toml
└── manage.py

When adding new backend features, preserve this modular structure.

Recommended additional apps:

apps/
├── dispatch/
└── realtime/
Backend Architecture Rules
Django App Responsibilities

Use each app for a clear domain boundary.

accounts

Responsible for:

Users
Roles
Authentication
Permissions
User profiles
commissions

Responsible for:

Request forms
Drafts
Submitted requests
Approval records
Samples
Sample receiving
experiments

Responsible for:

Experiment types
Experiment templates
Experiment result metadata
equipment

Responsible for:

Equipment definitions
Equipment types
Recipes
Recipe versions
Equipment capabilities
Equipment heartbeat
Equipment logs
wip

Responsible for:

WIP batch creation
WIP items
WIP status lifecycle
WIP status history
dispatch

Responsible for:

Dispatch job creation
Queue routing
Redis dispatch state
Celery task triggering
Retry and cancellation logic
reports

Responsible for:

Query-only reports
Dashboard statistics
Aggregated metrics

Avoid putting unrelated logic into the wrong app.

Backend Code Style

Use this structure inside each Django app when appropriate:

app_name/
├── models.py
├── schemas.py
├── api.py
├── services.py
├── selectors.py
├── permissions.py
├── tasks.py
├── enums.py
├── exceptions.py
└── tests/
Rules
models.py: database schema only, minimal business logic.
schemas.py: Django Ninja request/response schemas.
api.py: API endpoints only, thin controllers.
services.py: write operations and business workflows.
selectors.py: reusable database queries.
permissions.py: role and ownership checks.
tasks.py: Celery tasks.
enums.py: status constants and choices.
exceptions.py: domain-specific exceptions.
tests/: unit and integration tests.

Controllers must not contain complex business logic.

Bad:

@router.post("/wip/{id}/dispatch")
def dispatch_wip(request, id):
    # 100 lines of grouping, validation, Redis, Celery logic here

Good:

@router.post("/wip/{id}/dispatch")
def dispatch_wip(request, id):
    return dispatch_service.dispatch_wip(
        wip_id=id,
        actor=request.user,
    )
API Design Rules

Use REST-style APIs with clear resource naming.

Prefer:

GET    /api/requests
POST   /api/requests
GET    /api/requests/{id}
PATCH  /api/requests/{id}
POST   /api/requests/{id}/submit
POST   /api/requests/{id}/approve
POST   /api/requests/{id}/reject

GET    /api/samples
POST   /api/samples/{id}/receive

GET    /api/wip
POST   /api/wip
POST   /api/wip/auto-create
POST   /api/wip/{id}/lock
POST   /api/wip/{id}/dispatch

GET    /api/dispatches
GET    /api/dispatches/{id}
GET    /api/dispatches/{id}/progress
POST   /api/dispatches/{id}/retry
POST   /api/dispatches/{id}/cancel

GET    /api/equipment
GET    /api/equipment/{id}
GET    /api/equipment/{id}/status

GET    /api/reports/summary
API Rules
Validate all input using schemas.
Never trust frontend role checks.
Always check backend permissions.
Return consistent error responses.
Use pagination for list endpoints.
Use filters for large tables.
Avoid returning unnecessary sensitive data.
Use stable IDs and human-readable codes where useful.
Database Design Rules

Use PostgreSQL as the source of truth.

General Rules
Use UUID primary keys for important business entities.
Use human-readable codes for display, such as REQ-2026-00001, WIP-2026-00001, DISP-2026-00001.
Use indexed fields for frequent filters.
Use foreign keys with proper on_delete behavior.
Avoid storing duplicated state unless required for performance or auditability.
Use created_at and updated_at on major models.
Use status history tables for important lifecycle changes.
Avoid deleting important business records; prefer soft cancellation or archival.
Important Entities

The system should model:

User
CommissionRequest
Sample
ExperimentType
Recipe
Equipment
WipBatch
WipItem
DispatchJob
ExperimentResult
EquipmentEventLog
AuditLog
Status Lifecycle Rules

State transitions must be explicit and validated.

Do not allow arbitrary status changes.

Example request lifecycle:

DRAFT
→ SUBMITTED
→ PENDING_APPROVAL
→ APPROVED
→ SAMPLE_RECEIVED
→ WIP_CREATED
→ DISPATCHED
→ RUNNING
→ COMPLETED

Failure paths:

PENDING_APPROVAL → REJECTED
RUNNING → FAILED
DISPATCHED → CANCELLED

Use transition functions instead of direct status assignment.

Bad:

request.status = "COMPLETED"
request.save()

Good:

request_service.mark_completed(request, actor=user)

Every important transition should record:

Previous status
New status
Actor
Timestamp
Reason or comment if applicable
Dispatcher System Rules

The dispatcher groups compatible samples from different requests into WIP batches.

The dispatcher must consider:

Experiment type
Recipe
Equipment type
Material type
Safety constraints
Recipe parameters
Maximum batch size
Priority
Required completion date
Equipment availability

The dispatcher should be deterministic and explainable.

Avoid black-box grouping logic.

Auto-WIP Creation Flow
1. Query samples with WAITING_WIP status.
2. Group samples by compatibility key.
3. Sort samples by priority and deadline.
4. Split groups by max batch size.
5. Create WIP batch.
6. Attach samples as WIP items.
7. Update sample status to IN_WIP.
8. Record status history.
Compatibility Key Example
compatibility_key = (
    sample.experiment_type_id,
    sample.recipe_id,
    sample.material_type,
    sample.required_equipment_type_id,
)
Dispatcher Safety Rules
Do not group samples with incompatible materials.
Do not group samples requiring different recipes.
Do not group samples with conflicting safety constraints.
Do not dispatch unlocked WIP batches.
Do not dispatch WIP batches with zero samples.
Do not dispatch to inactive or maintenance equipment.
Do not dispatch to equipment that does not support the required recipe.
Redis Rules

Redis is used for:

Celery broker
Celery result backend
Real-time dispatch state
Equipment live status
Worker heartbeat
Temporary progress cache

Redis must not be the only source of important business data.

Final results and final dispatch statuses must be persisted in PostgreSQL.

Recommended key patterns:

dispatch:{dispatch_id}:state
dispatch:{dispatch_id}:progress
dispatch:{dispatch_id}:logs
equipment:{equipment_id}:status
equipment:{equipment_id}:heartbeat
worker:{worker_name}:status
worker:{worker_name}:current_job

Use TTL for temporary keys when appropriate.

Celery Worker Rules

Celery workers simulate laboratory equipment.

Each worker should:

Receive a dispatch job.
Load WIP, recipe, and equipment data.
Mark dispatch as running.
Mark equipment as running.
Execute simulated recipe steps.
Update progress in Redis.
Emit logs.
Generate experiment results.
Persist final result to PostgreSQL.
Mark dispatch as completed or failed.
Return equipment to idle or error state.
Worker Requirements
Tasks must be idempotent where possible.
Use retry logic for transient errors.
Use clear failure states.
Never leave equipment permanently stuck in RUNNING.
Always handle exceptions.
Always write final state to PostgreSQL.
Update Redis frequently enough for real-time frontend monitoring.
Avoid long database transactions inside simulated step loops.
Equipment Simulation Rules

Use realistic semiconductor-related experiments.

Suggested experiment simulations:

SEM Defect Inspection

Steps:

Sample loading
Vacuum stabilization
Beam calibration
Surface scan
Defect image acquisition
Defect counting
Result generation

Example result:

{
  "defect_count": 23,
  "defect_density_per_cm2": 0.18,
  "critical_defect_found": true,
  "image_quality_score": 0.94
}
Thin Film Thickness Measurement

Steps:

Sample alignment
Optical calibration
Multi-point measurement
Thickness calculation
Uniformity analysis
Result generation

Example result:

{
  "average_thickness_nm": 52.4,
  "min_thickness_nm": 50.8,
  "max_thickness_nm": 54.1,
  "uniformity_percent": 97.3
}
Etch Rate Test

Steps:

Chamber preparation
Gas flow stabilization
Plasma ignition
Etch execution
Cooldown
Post-etch measurement

Example result:

{
  "etch_rate_nm_per_min": 38.5,
  "target_depth_nm": 120,
  "actual_depth_nm": 118.7,
  "process_deviation_percent": 1.08
}
Sheet Resistance Measurement

Steps:

Probe alignment
Contact verification
Current injection
Voltage measurement
Resistance calculation
Uniformity analysis

Example result:

{
  "sheet_resistance_ohm_sq": 41.2,
  "uniformity_percent": 96.8,
  "measurement_points": 49
}
Real-Time System Rules

The frontend needs real-time equipment and dispatch progress.

Preferred simple implementation:

Celery Worker
→ Redis
→ Django SSE endpoint
→ Next.js frontend

Use Server-Sent Events for one-way real-time updates.

Use WebSocket only if the frontend needs bidirectional control such as pause, resume, or live command input.

The frontend should show:

Equipment status
Worker node name
Current WIP
Current dispatch
Current recipe
Current step
Progress percentage
ETA
Last heartbeat
Error message
Completion status
Frontend Architecture Rules

Use clean Next.js architecture.

Recommended structure:

frontend/
├── app/
│   ├── dashboard/
│   ├── requests/
│   ├── drafts/
│   ├── samples/
│   ├── wip/
│   ├── dispatches/
│   ├── equipment/
│   └── management/
├── components/
├── features/
├── lib/
├── hooks/
├── types/
└── services/
Frontend Rules
Use TypeScript strictly.
Use reusable components.
Keep page components thin.
Put API calls in service files.
Put feature-specific logic in features/.
Use form validation with Zod.
Use React Hook Form for complex forms.
Use TanStack Query for server state.
Use local state only for UI state.
Avoid duplicating backend business logic in frontend.
Use role guards, but never rely only on frontend protection.
Frontend Role-Based Pages
fab_user

Pages:

Dashboard
My Requests
Drafts
New Request
lab_member

Pages:

Dashboard
Samples
WIP
Dispatches
Equipment
lab_manager

Pages:

Dashboard
Samples
WIP
Dispatches
Equipment
Management
  Incoming Requests
  Recipes
  Reports
  User Activity

The sidebar must only show pages allowed for the current role.

Form Design Rules

All form submissions should:

Validate client-side using Zod.
Submit to backend API.
Handle loading state.
Handle backend validation errors.
Show success/failure toast.
Refresh affected queries.
Avoid silent failure.

Forms should be split into logical sections.

Example new request form:

Basic Information
Sample Information
Experiment Requirement
Attachments
Confirmation
Error Handling Rules

Backend errors should be explicit and consistent.

Use errors like:

{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot dispatch a WIP batch that is not locked.",
    "details": {}
  }
}

Do not expose internal stack traces to users.

Frontend should display user-friendly errors.

Logs should keep enough technical information for debugging.

Security Rules

Always enforce:

Authentication
Role-based authorization
Object-level permission checks
Input validation
File upload validation
Safe error messages
CSRF/session security where applicable
Secrets through environment variables
No hardcoded passwords
No sensitive data in logs

Fab users must only access their own requests and results.

Lab members can access operational lab data.

Lab managers can access management data.

Testing Rules

Write tests for important logic.

Minimum required tests:

Request creation
Request approval/rejection
Sample receiving
WIP grouping
WIP locking
Dispatch creation
Invalid dispatch prevention
Celery task success path
Celery task failure path
Permission checks
API validation errors

Prefer testing service-layer logic directly.

Use integration tests for important API flows.

Docker Rules

The system should run through Docker Compose.

Expected services:

frontend
backend
postgres
redis
worker-1
worker-2
worker-3
worker-4

Each worker can listen to a different queue:

worker-1 → queue.sem
worker-2 → queue.ellipsometer
worker-3 → queue.etch
worker-4 → queue.probe

Use environment variables for configuration.

Do not hardcode service URLs.

Code Quality Rules

Before finalizing code, check:

Is the code readable?
Is the function too large?
Is the responsibility clear?
Are names meaningful?
Are permissions enforced?
Are errors handled?
Are database queries efficient enough?
Are status transitions safe?
Are tests needed?
Is the frontend form connected cleanly to the backend?
Can this be debugged easily?

Avoid:

Huge files
Huge functions
Duplicate logic
Magic strings
Unclear status changes
Business logic in API handlers
Unvalidated input
Unhandled exceptions
Hardcoded configuration
Fake success responses
Naming Conventions

Use clear domain names.

Good names:

CommissionRequest
Sample
WipBatch
WipItem
DispatchJob
Equipment
Recipe
ExperimentResult

Avoid vague names:

Data
Item
Thing
Process
Manager
Handler

Use service names like:

create_request
submit_request
approve_request
receive_sample
auto_create_wip_batches
lock_wip_batch
dispatch_wip_batch
run_equipment_simulation
Documentation Rules

When adding major features, update documentation.

Useful docs:

prds/
├── architecture.md
├── api-spec.md
├── database-design.md
├── dispatcher-design.md
├── celery-worker-design.md
├── frontend-pages.md
└── deployment.md

Documentation should explain:

What the feature does
Why it exists
How data flows
Important APIs
Important models
Failure cases
How to test it
Implementation Behavior

When asked to implement a feature:

First understand the affected domain.
Identify frontend, backend, database, Redis, and worker impact.
Propose the clean architecture.
Implement in small steps.
Keep APIs consistent.
Add validation and permission checks.
Add tests or describe required tests.
Keep the code clean and production-like.
Explain what changed clearly.

When asked to debug:

Read the error carefully.
Identify the layer causing the issue.
Explain the root cause.
Provide a minimal fix.
Mention related risks if any.
Avoid random guessing.

When asked to refactor:

Preserve behavior.
Improve structure.
Reduce duplication.
Improve naming.
Keep changes reviewable.
Do not rewrite unrelated parts.
Output Style

When giving code:

Provide complete files when useful.
Mention file paths clearly.
Keep explanations concise but technically clear.
Do not dump unnecessary code.
Do not over-engineer.
Prefer practical implementation over theory.

When giving architecture:

Use diagrams when helpful.
Explain data flow clearly.
Mention tradeoffs.
Recommend the simplest scalable design.

When giving plans:

Break work into phases.
Prioritize MVP first.
Separate must-have from nice-to-have.
Final Standard

All generated code and design decisions should be good enough for a serious university or industry-style project.

The system should feel like a real internal lab platform, not a toy demo.

Prioritize:

Correctness
Clean architecture
Maintainability
Security
Observability
Realistic workflow
Deployment readiness