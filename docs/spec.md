# Full Specification: Cloud-Native Laboratory Information Management System

## 1. Project Overview

This project is a **Cloud-Native Laboratory Information Management System (LIMS)** designed for semiconductor laboratory operations. The system supports the full workflow from **fab user experiment request submission**, **lab approval**, **sample receiving**, **recipe and equipment assignment**, **WIP batch dispatching**, **equipment execution**, **real-time machine monitoring**, and **final report/result management**.

The system should simulate a production-style laboratory environment similar to semiconductor manufacturing labs, where multiple samples from different request forms can be grouped into optimized **WIP batches** and dispatched to available equipment workers through **Redis + Celery**.

The main goals are:

1. Allow fab users to submit experiment requests and track progress.
2. Allow lab members to receive samples, create WIP batches, dispatch jobs, and manage equipment.
3. Allow lab managers to approve requests, manage recipes, monitor reports, and track system-wide performance.
4. Provide a dispatcher system that groups compatible samples into efficient WIP batches.
5. Simulate real equipment execution using Celery worker nodes.
6. Provide real-time status updates to the frontend.
7. Deploy the full system using Docker Compose.

---

# 2. High-Level Architecture

```text
+--------------------+
|  Next.js Frontend  |
|  Role-based UI     |
+---------+----------+
          |
          | REST API / WebSocket / SSE
          v
+--------------------+
| Django Backend     |
| Django Ninja API   |
| Business Logic     |
+---------+----------+
          |
          | ORM
          v
+--------------------+
| PostgreSQL         |
| Main Persistent DB |
+--------------------+

+--------------------+
| Redis              |
| Celery Broker      |
| Dispatch State     |
| Realtime Cache     |
+---------+----------+
          |
          | Celery Queue
          v
+--------------------+
| Celery Workers     |
| Equipment Simulator|
| Worker 1..N        |
+--------------------+
```

---

# 3. User Roles and Permissions

## 3.1 `fab_user`

Fab users are factory-side users who submit experiment requests.

### Pages

```text
fab_user
├── Dashboard
├── My Requests
├── Drafts
└── New Request
```

### Capabilities

| Feature                        | Permission             |
| ------------------------------ | ---------------------- |
| Create request draft           | Yes                    |
| Submit request form            | Yes                    |
| View own requests              | Yes                    |
| Edit draft before submission   | Yes                    |
| Cancel request before approval | Yes                    |
| Track request status           | Yes                    |
| View experiment results        | Yes, only own requests |
| Manage recipes                 | No                     |
| Dispatch WIP                   | No                     |
| Manage equipment               | No                     |

---

## 3.2 `lab_member`

Lab members handle sample receiving, WIP creation, dispatch, equipment monitoring, and result input.

### Pages

```text
lab_member
├── Dashboard
├── Samples
├── WIP
├── Dispatches
└── Equipment
```

### Capabilities

| Feature                         | Permission          |
| ------------------------------- | ------------------- |
| View approved incoming requests | Yes                 |
| Receive samples                 | Yes                 |
| Update sample status            | Yes                 |
| Create WIP batches              | Yes                 |
| Dispatch WIP to equipment       | Yes                 |
| Monitor equipment status        | Yes                 |
| Upload experiment result        | Yes                 |
| Manage recipe library           | Limited / Read-only |
| Approve requests                | No                  |
| View system reports             | Limited             |

---

## 3.3 `lab_manager`

Lab managers have all lab member permissions plus management features.

### Pages

```text
lab_manager
├── Dashboard
├── Samples
├── WIP
├── Dispatches
├── Equipment
└── Management
    ├── Incoming Requests
    ├── Recipe Management
    ├── Reports
    ├── User Activity
    └── System Logs
```

### Capabilities

| Feature                    | Permission |
| -------------------------- | ---------- |
| Approve / reject requests  | Yes        |
| Manage all requests        | Yes        |
| Manage recipes             | Yes        |
| View reports               | Yes        |
| View all equipment history | Yes        |
| View all user operations   | Yes        |
| Override dispatch priority | Yes        |
| Cancel WIP                 | Yes        |
| Retry failed dispatch      | Yes        |

---

# 4. Frontend Specification

Frontend uses the existing **Next.js project base**.

Recommended stack:

```text
Next.js App Router
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod validation
TanStack Query
WebSocket or Server-Sent Events for real-time status
Role-based route protection
```

---

# 5. Frontend Page Specification

## 5.1 Common Layout

All roles should share a common authenticated layout.

```text
/app
├── login
├── dashboard
├── requests
├── drafts
├── samples
├── wip
├── dispatches
├── equipment
└── management
```

### Common UI Components

```text
components/
├── layout/
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   └── RoleGuard.tsx
├── forms/
│   ├── RequestForm.tsx
│   ├── SampleReceiveForm.tsx
│   ├── WipCreateForm.tsx
│   ├── DispatchForm.tsx
│   └── RecipeForm.tsx
├── tables/
│   ├── RequestTable.tsx
│   ├── SampleTable.tsx
│   ├── WipTable.tsx
│   ├── DispatchTable.tsx
│   └── EquipmentTable.tsx
├── realtime/
│   ├── EquipmentStatusCard.tsx
│   ├── WorkerProgressBar.tsx
│   └── DispatchTimeline.tsx
└── charts/
    ├── EquipmentUtilizationChart.tsx
    ├── RequestStatusChart.tsx
    └── ThroughputChart.tsx
```

---

# 6. Fab User Pages

## 6.1 Fab User Dashboard

### Purpose

Give fab users a quick overview of their submitted requests and experiment progress.

### Display Cards

```text
Total Requests
Pending Approval
In Progress
Completed
Rejected
Drafts
```

### Main Sections

1. Recent request status
2. Pending lab approval
3. Active experiment progress
4. Completed result download
5. Notifications from lab

### API Needed

```http
GET /api/fab/dashboard
GET /api/requests/my
GET /api/notifications
```

---

## 6.2 My Requests Page

### Purpose

Allow fab users to track all submitted requests.

### Table Columns

```text
Request ID
Title
Experiment Type
Priority
Status
Submitted At
Approved By
Current Stage
Action
```

### Status Flow

```text
DRAFT
SUBMITTED
PENDING_APPROVAL
APPROVED
SAMPLE_RECEIVED
WIP_CREATED
DISPATCHED
RUNNING
COMPLETED
REJECTED
CANCELLED
```

### Actions

```text
View Detail
Cancel Request
View Result
Duplicate Request
```

---

## 6.3 Drafts Page

### Purpose

Allow fab users to continue editing unsubmitted request forms.

### Actions

```text
Edit Draft
Submit Draft
Delete Draft
Duplicate Draft
```

---

## 6.4 New Request Page

### Purpose

Submit a new experiment request form.

### Form Structure

```text
Section 1: Basic Information
- Request title
- Request description
- Department
- Project code
- Priority
- Required completion date

Section 2: Sample Information
- Sample name
- Lot ID
- Wafer ID
- Material type
- Quantity
- Sample description
- Handling notes

Section 3: Experiment Requirement
- Experiment type
- Preferred recipe
- Target measurement
- Expected output format
- Special instruction

Section 4: Attachment
- Design file
- Process document
- Sample image
- Other supporting document

Section 5: Confirmation
- Confirm sample information
- Confirm safety rules
- Submit
```

### Submit Behavior

```text
Save as Draft -> POST /api/requests/drafts
Submit Request -> POST /api/requests
Upload Attachment -> POST /api/attachments
```

---

# 7. Lab Member Pages

## 7.1 Lab Member Dashboard

### Purpose

Show operational status of the laboratory.

### Cards

```text
Incoming Approved Requests
Samples Waiting Receive
Active WIP
Running Dispatches
Idle Equipment
Failed Jobs
Completed Today
```

### Charts

```text
Equipment utilization
WIP queue length
Experiment throughput
Sample completion trend
```

---

## 7.2 Samples Page

### Purpose

Manage physical or logical sample receiving.

### Table Columns

```text
Sample ID
Request ID
Fab User
Sample Name
Lot ID
Wafer ID
Experiment Type
Current Status
Received At
Action
```

### Actions

```text
Receive Sample
Reject Sample
Update Condition
Assign Holding Area
View Request Detail
```

### Sample Status

```text
PENDING_RECEIVE
RECEIVED
WAITING_WIP
IN_WIP
DISPATCHED
RUNNING
COMPLETED
FAILED
RETURNED
SCRAPPED
```

---

## 7.3 WIP Page

### Purpose

Create and manage WIP batches.

A **WIP batch** groups compatible samples from one or more requests into the same experiment batch.

### WIP Compatibility Rules

Samples can be grouped into the same WIP when they share:

```text
Same experiment type
Same recipe requirement
Same equipment capability
Same material compatibility
Same process temperature range
Same safety constraint
Same priority class or compatible deadline
```

### WIP Table Columns

```text
WIP ID
Experiment Type
Recipe
Sample Count
Priority
Status
Created By
Created At
Assigned Equipment Type
Action
```

### WIP Status

```text
CREATED
READY_FOR_DISPATCH
QUEUED
DISPATCHED
RUNNING
PARTIALLY_COMPLETED
COMPLETED
FAILED
CANCELLED
```

### Actions

```text
Create WIP
Auto-group WIP
Add Sample
Remove Sample
Lock WIP
Dispatch WIP
Cancel WIP
View WIP Timeline
```

---

## 7.4 Dispatches Page

### Purpose

Track WIP dispatches sent to the Redis queue and Celery workers.

### Table Columns

```text
Dispatch ID
WIP ID
Equipment
Worker Node
Status
Queue Position
Progress
Started At
Finished At
Action
```

### Dispatch Status

```text
PENDING
QUEUED
ASSIGNED
RUNNING
PAUSED
COMPLETED
FAILED
RETRYING
CANCELLED
```

### Actions

```text
View Progress
Retry Dispatch
Cancel Dispatch
View Worker Logs
View Result
```

---

## 7.5 Equipment Page

### Purpose

Monitor equipment and Celery worker node status in real time.

Each equipment is simulated by one or more Celery workers.

### Equipment Status

```text
IDLE
RESERVED
QUEUED
RUNNING
MAINTENANCE
OFFLINE
ERROR
```

### Real-Time Data Display

Each equipment card should show:

```text
Equipment name
Equipment type
Worker node name
Current status
Current WIP ID
Current dispatch ID
Current recipe
Current operation step
Progress percentage
Estimated remaining time
Last heartbeat
CPU / memory usage if available
Completed count today
Failed count today
Error message if any
```

### Example Equipment Card

```text
Equipment: SEM-01
Type: Scanning Electron Microscope
Worker: worker-1
Status: RUNNING
Current WIP: WIP-2026-00021
Recipe: SEM_DEFECT_SCAN_V1
Step: Image Acquisition
Progress: 63%
ETA: 8 min
Last Heartbeat: 2 seconds ago
```

### Real-Time API

Recommended:

```http
GET /api/equipment
GET /api/equipment/{id}
GET /api/equipment/{id}/history
GET /api/dispatches/{id}/progress
```

For live updates:

```text
WebSocket: /ws/equipment
or
SSE: /api/realtime/equipment/events
```

---

# 8. Lab Manager Management Section

## 8.1 Incoming Requests

### Purpose

Approve or reject fab user requests.

### Actions

```text
View Request Detail
Approve Request
Reject Request
Request More Information
Set Priority
Assign Suggested Recipe
```

### Approval Form

```text
Approval decision
Manager comment
Suggested experiment type
Suggested recipe
Priority override
Expected completion date
```

---

## 8.2 Recipe Management

### Purpose

Manage available experiment recipes.

### Recipe Fields

```text
Recipe ID
Recipe name
Experiment type
Compatible equipment type
Required parameters
Estimated runtime
Safety constraints
Material compatibility
Version
Active status
Created by
Updated by
```

### Example Recipe Parameters

```json
{
  "voltage_kv": 5,
  "scan_area_um": 100,
  "magnification": 50000,
  "temperature_c": 25,
  "duration_min": 15
}
```

---

## 8.3 Reports

### Purpose

Provide lab operation analytics.

### Report Types

```text
Request volume by status
Average approval time
Average sample waiting time
Average WIP queue time
Equipment utilization
Experiment success rate
Failed dispatch analysis
User activity log
Recipe usage frequency
```

---

# 9. Backend Specification

Existing backend structure:

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
```

Recommended additions:

```text
backend/
├── apps/
│   ├── dispatch/
│   │   ├── models.py
│   │   ├── services.py
│   │   ├── selectors.py
│   │   ├── tasks.py
│   │   └── schemas.py
│   └── realtime/
│       ├── consumers.py
│       ├── events.py
│       └── serializers.py
├── celery_app.py
└── docker/
```

---

# 10. Backend Apps Responsibility

## 10.1 `accounts`

Responsible for authentication, role management, and user profile.

### Models

```text
User
Role
UserProfile
```

### Roles

```text
FAB_USER
LAB_MEMBER
LAB_MANAGER
ADMIN
```

---

## 10.2 `commissions`

Core request form and sample management.

### Models

```text
CommissionRequest
Sample
RequestAttachment
ApprovalRecord
```

### Purpose

Handles:

```text
Request draft
Request submission
Request approval
Sample registration
Sample receiving
Sample status lifecycle
```

---

## 10.3 `experiments`

Defines experiment categories and metadata.

### Models

```text
ExperimentType
ExperimentParameterTemplate
ExperimentResult
```

---

## 10.4 `equipment`

Manages equipment, recipes, and worker mapping.

### Models

```text
Equipment
EquipmentType
Recipe
RecipeVersion
EquipmentCapability
EquipmentHeartbeat
EquipmentEventLog
```

---

## 10.5 `wip`

Manages WIP batch creation and lifecycle.

### Models

```text
WipBatch
WipItem
WipStatusHistory
```

---

## 10.6 `dispatch`

New recommended app.

Responsible for:

```text
Dispatch planning
Queue submission
Redis state update
Celery task triggering
Dispatch retry/cancel logic
Worker assignment
```

### Models

```text
DispatchJob
DispatchStep
DispatchLog
```

---

## 10.7 `reports`

Pure query app.

Responsible for:

```text
Dashboard metrics
Statistics
Aggregated reports
CSV export
```

No major models required.

---

# 11. Database Design

Database: **PostgreSQL**

## 11.1 Main Entities

```text
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
```

---

## 11.2 Request Model

```python
class CommissionRequest(models.Model):
    id = models.UUIDField(primary_key=True)
    request_no = models.CharField(max_length=32, unique=True)

    requester = models.ForeignKey(User, on_delete=models.PROTECT)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    department = models.CharField(max_length=100)
    project_code = models.CharField(max_length=100, blank=True)

    priority = models.CharField(max_length=20)
    status = models.CharField(max_length=40)

    experiment_type = models.ForeignKey("experiments.ExperimentType", on_delete=models.PROTECT)
    preferred_recipe = models.ForeignKey("equipment.Recipe", null=True, blank=True, on_delete=models.SET_NULL)

    required_completion_date = models.DateField(null=True, blank=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, null=True, blank=True, related_name="approved_requests", on_delete=models.SET_NULL)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

---

## 11.3 Sample Model

```python
class Sample(models.Model):
    id = models.UUIDField(primary_key=True)
    sample_no = models.CharField(max_length=32, unique=True)

    request = models.ForeignKey("commissions.CommissionRequest", related_name="samples", on_delete=models.CASCADE)

    sample_name = models.CharField(max_length=255)
    lot_id = models.CharField(max_length=100)
    wafer_id = models.CharField(max_length=100, blank=True)

    material_type = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField(default=1)

    status = models.CharField(max_length=40)

    received_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    received_at = models.DateTimeField(null=True, blank=True)

    current_wip = models.ForeignKey("wip.WipBatch", null=True, blank=True, on_delete=models.SET_NULL)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

---

## 11.4 Recipe Model

```python
class Recipe(models.Model):
    id = models.UUIDField(primary_key=True)
    recipe_code = models.CharField(max_length=64, unique=True)

    name = models.CharField(max_length=255)
    experiment_type = models.ForeignKey("experiments.ExperimentType", on_delete=models.PROTECT)
    equipment_type = models.ForeignKey("equipment.EquipmentType", on_delete=models.PROTECT)

    parameters = models.JSONField(default=dict)
    estimated_runtime_sec = models.PositiveIntegerField()

    material_constraints = models.JSONField(default=dict)
    safety_constraints = models.JSONField(default=dict)

    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 11.5 Equipment Model

```python
class Equipment(models.Model):
    id = models.UUIDField(primary_key=True)
    equipment_code = models.CharField(max_length=64, unique=True)

    name = models.CharField(max_length=255)
    equipment_type = models.ForeignKey("equipment.EquipmentType", on_delete=models.PROTECT)

    worker_queue_name = models.CharField(max_length=100)
    status = models.CharField(max_length=40)

    current_dispatch = models.ForeignKey("dispatch.DispatchJob", null=True, blank=True, on_delete=models.SET_NULL)

    location = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    last_heartbeat_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

---

## 11.6 WIP Batch Model

```python
class WipBatch(models.Model):
    id = models.UUIDField(primary_key=True)
    wip_no = models.CharField(max_length=32, unique=True)

    experiment_type = models.ForeignKey("experiments.ExperimentType", on_delete=models.PROTECT)
    recipe = models.ForeignKey("equipment.Recipe", on_delete=models.PROTECT)

    status = models.CharField(max_length=40)
    priority = models.CharField(max_length=20)

    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    locked_at = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 11.7 WIP Item Model

```python
class WipItem(models.Model):
    id = models.UUIDField(primary_key=True)

    wip = models.ForeignKey("wip.WipBatch", related_name="items", on_delete=models.CASCADE)
    sample = models.ForeignKey("commissions.Sample", on_delete=models.PROTECT)
    request = models.ForeignKey("commissions.CommissionRequest", on_delete=models.PROTECT)

    sequence = models.PositiveIntegerField(default=0)

    status = models.CharField(max_length=40)

    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 11.8 Dispatch Job Model

```python
class DispatchJob(models.Model):
    id = models.UUIDField(primary_key=True)
    dispatch_no = models.CharField(max_length=32, unique=True)

    wip = models.ForeignKey("wip.WipBatch", on_delete=models.PROTECT)
    equipment = models.ForeignKey("equipment.Equipment", null=True, blank=True, on_delete=models.SET_NULL)

    celery_task_id = models.CharField(max_length=255, blank=True)

    status = models.CharField(max_length=40)
    progress = models.FloatField(default=0)

    current_step = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)

    queued_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

# 12. Dispatcher System Design

## 12.1 Purpose

The dispatcher system groups samples from different requests into efficient WIP batches and sends them to equipment workers.

Instead of running each request individually, the dispatcher should batch compatible samples together.

Example:

```text
Request A -> Sample A1 -> SEM measurement
Request B -> Sample B1 -> SEM measurement
Request C -> Sample C1 -> SEM measurement

Dispatcher groups them into:

WIP-001
├── Sample A1
├── Sample B1
└── Sample C1

Then dispatches WIP-001 to SEM-01 worker.
```

---

## 12.2 Dispatcher Workflow

```text
1. Lab manager approves request
2. Lab member receives sample
3. Sample becomes WAITING_WIP
4. Dispatcher scans compatible samples
5. Compatible samples are grouped into WIP batch
6. WIP is locked
7. WIP is dispatched
8. Dispatch job is created
9. Dispatch job is pushed to Redis/Celery
10. Celery worker executes equipment simulation
11. Worker updates Redis progress
12. Backend syncs final result to PostgreSQL
13. Frontend receives real-time updates
```

---

## 12.3 WIP Grouping Criteria

The dispatcher should group samples by:

```text
experiment_type
recipe
equipment_type
material_type
priority
deadline
parameter compatibility
sample safety constraint
maximum batch size
```

---

## 12.4 Auto-WIP Algorithm

Simple version:

```text
1. Query all samples with status WAITING_WIP.
2. Group samples by experiment_type + recipe + material_type.
3. Sort each group by priority and required completion date.
4. Split each group by recipe maximum batch size.
5. Create WIP batch.
6. Attach samples as WIP items.
7. Update sample status to IN_WIP.
```

### Pseudocode

```python
def auto_create_wip_batches():
    samples = get_waiting_samples()

    grouped = group_by(
        samples,
        keys=[
            "experiment_type_id",
            "recipe_id",
            "material_type",
        ],
    )

    for group_key, group_samples in grouped.items():
        sorted_samples = sort_by_priority_and_deadline(group_samples)

        recipe = get_recipe(group_key.recipe_id)
        max_batch_size = recipe.parameters.get("max_batch_size", 10)

        chunks = chunk(sorted_samples, max_batch_size)

        for chunk_samples in chunks:
            create_wip_batch(
                experiment_type=group_key.experiment_type,
                recipe=recipe,
                samples=chunk_samples,
            )
```

---

## 12.5 Priority Rules

Priority score can be calculated using:

```text
priority_score =
    request_priority_weight
    + deadline_urgency_weight
    + waiting_time_weight
    + manager_override_weight
```

Example:

```text
URGENT = 100
HIGH = 70
NORMAL = 40
LOW = 10
```

Deadline urgency:

```text
Due within 1 day: +50
Due within 3 days: +30
Due within 7 days: +10
```

---

# 13. Dispatch Queue Design

## 13.1 Redis Usage

Redis is used for:

```text
Celery broker
Celery result backend
Dispatch runtime state
Equipment live status
Progress cache
Worker heartbeat
```

Recommended Redis keys:

```text
dispatch:{dispatch_id}:state
dispatch:{dispatch_id}:progress
dispatch:{dispatch_id}:logs
equipment:{equipment_id}:status
equipment:{equipment_id}:heartbeat
worker:{worker_name}:status
worker:{worker_name}:current_job
```

Example Redis state:

```json
{
  "dispatch_id": "DISP-2026-0001",
  "wip_id": "WIP-2026-0001",
  "equipment_id": "SEM-01",
  "status": "RUNNING",
  "progress": 64,
  "current_step": "Image Acquisition",
  "worker": "worker-1",
  "updated_at": "2026-05-23T15:30:00Z"
}
```

---

## 13.2 Celery Queue Routing

Each equipment type can have its own queue.

```text
queue.sem
queue.tem
queue.xrd
queue.etch
queue.metrology
queue.thermal
```

Example worker deployment:

```text
worker-1 -> queue.sem
worker-2 -> queue.tem
worker-3 -> queue.xrd
worker-4 -> queue.etch
```

---

# 14. Celery Worker Node Design

## 14.1 Purpose

Each worker acts as an **equipment simulator**.

It receives a WIP dispatch job, executes simulated experiment steps, updates progress in Redis, and writes final results back to PostgreSQL through Django ORM.

---

## 14.2 Worker Lifecycle

```text
1. Worker starts
2. Worker registers itself as equipment node
3. Worker sends heartbeat to Redis
4. Worker waits for dispatch job
5. Worker receives WIP job
6. Worker marks equipment as RUNNING
7. Worker executes recipe steps
8. Worker updates progress
9. Worker generates simulated result
10. Worker marks dispatch completed or failed
11. Worker returns equipment to IDLE
```

---

## 14.3 Equipment Simulator Task

Example task:

```python
@shared_task(bind=True)
def run_experiment_dispatch(self, dispatch_id: str):
    dispatch = DispatchJob.objects.get(id=dispatch_id)
    wip = dispatch.wip
    recipe = wip.recipe
    equipment = dispatch.equipment

    update_dispatch_state(dispatch, "RUNNING", progress=0)
    update_equipment_state(equipment, "RUNNING", dispatch=dispatch)

    steps = build_recipe_steps(recipe)

    for index, step in enumerate(steps):
        update_current_step(dispatch, step["name"])

        for progress in step_progress_loop(step):
            overall_progress = calculate_overall_progress(index, progress, steps)
            update_redis_progress(dispatch.id, overall_progress, step["name"])
            self.update_state(
                state="PROGRESS",
                meta={
                    "progress": overall_progress,
                    "step": step["name"],
                },
            )

        maybe_simulate_failure(step)

    result = generate_experiment_result(wip, recipe)

    save_result_to_database(wip, result)

    update_dispatch_state(dispatch, "COMPLETED", progress=100)
    update_equipment_state(equipment, "IDLE")
```

---

# 15. Semiconductor-Related Experiment Simulations

The project should include several realistic experiment types related to semiconductor lab operation.

## 15.1 SEM Defect Inspection

### Equipment

```text
Scanning Electron Microscope
```

### Purpose

Inspect wafer surface defects.

### Recipe Example

```text
SEM_DEFECT_SCAN_V1
```

### Steps

```text
1. Sample loading
2. Vacuum stabilization
3. Beam calibration
4. Surface scan
5. Defect image acquisition
6. Defect counting
7. Result generation
```

### Result Output

```json
{
  "defect_count": 23,
  "defect_density_per_cm2": 0.18,
  "critical_defect_found": true,
  "image_quality_score": 0.94
}
```

---

## 15.2 Thin Film Thickness Measurement

### Equipment

```text
Ellipsometer
```

### Purpose

Measure thin film thickness after deposition or etching.

### Steps

```text
1. Sample alignment
2. Optical calibration
3. Multi-point measurement
4. Thickness calculation
5. Uniformity analysis
6. Result generation
```

### Result Output

```json
{
  "average_thickness_nm": 52.4,
  "min_thickness_nm": 50.8,
  "max_thickness_nm": 54.1,
  "uniformity_percent": 97.3
}
```

---

## 15.3 Etch Rate Test

### Equipment

```text
Etch Chamber Simulator
```

### Purpose

Simulate etching process and calculate etch rate.

### Steps

```text
1. Chamber preparation
2. Gas flow stabilization
3. Plasma ignition
4. Etch execution
5. Cooldown
6. Post-etch measurement
```

### Result Output

```json
{
  "etch_rate_nm_per_min": 38.5,
  "target_depth_nm": 120,
  "actual_depth_nm": 118.7,
  "process_deviation_percent": 1.08
}
```

---

## 15.4 Sheet Resistance Measurement

### Equipment

```text
Four-Point Probe
```

### Purpose

Measure wafer sheet resistance.

### Steps

```text
1. Probe alignment
2. Contact verification
3. Current injection
4. Voltage measurement
5. Resistance calculation
6. Uniformity analysis
```

### Result Output

```json
{
  "sheet_resistance_ohm_sq": 41.2,
  "uniformity_percent": 96.8,
  "measurement_points": 49
}
```

---

## 15.5 Thermal Annealing Simulation

### Equipment

```text
Rapid Thermal Annealing Tool
```

### Purpose

Simulate thermal treatment process.

### Steps

```text
1. Sample loading
2. Nitrogen purge
3. Temperature ramp-up
4. Temperature hold
5. Cooldown
6. Final process log generation
```

### Result Output

```json
{
  "target_temperature_c": 950,
  "actual_peak_temperature_c": 948.6,
  "hold_time_sec": 60,
  "temperature_stability_percent": 99.2
}
```

---

# 16. Real-Time Status Design

## 16.1 Real-Time Data Flow

```text
Celery Worker
    ↓ updates progress
Redis
    ↓ backend reads/publishes
Django Realtime Layer
    ↓ WebSocket/SSE
Next.js Frontend
```

---

## 16.2 Recommended Real-Time Method

For simplicity, use **Server-Sent Events** first.

```text
GET /api/realtime/equipment/events
GET /api/realtime/dispatches/{dispatch_id}/events
```

SSE is easier than WebSocket for one-way status streaming.

Use WebSocket only if the frontend also needs to send control commands like pause/resume/cancel in real time.

---

## 16.3 Frontend Real-Time UI Behavior

The equipment page should automatically update:

```text
Equipment status
Current dispatch
Current WIP
Current recipe
Current step
Progress percentage
ETA
Error status
Worker heartbeat
```

The dispatch detail page should show:

```text
Timeline
Progress bar
Current recipe step
Worker log stream
Final result
Failure reason
Retry button
```

---

# 17. API Specification

## 17.1 Authentication APIs

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/refresh
```

---

## 17.2 Request APIs

```http
GET    /api/requests
GET    /api/requests/my
GET    /api/requests/{id}
POST   /api/requests
POST   /api/requests/drafts
PATCH  /api/requests/{id}
DELETE /api/requests/{id}
POST   /api/requests/{id}/submit
POST   /api/requests/{id}/approve
POST   /api/requests/{id}/reject
```

---

## 17.3 Sample APIs

```http
GET   /api/samples
GET   /api/samples/{id}
POST  /api/samples/{id}/receive
PATCH /api/samples/{id}/status
POST  /api/samples/bulk-receive
```

---

## 17.4 WIP APIs

```http
GET   /api/wip
GET   /api/wip/{id}
POST  /api/wip
POST  /api/wip/auto-create
POST  /api/wip/{id}/add-sample
POST  /api/wip/{id}/remove-sample
POST  /api/wip/{id}/lock
POST  /api/wip/{id}/dispatch
POST  /api/wip/{id}/cancel
```

---

## 17.5 Dispatch APIs

```http
GET  /api/dispatches
GET  /api/dispatches/{id}
POST /api/dispatches/{id}/retry
POST /api/dispatches/{id}/cancel
GET  /api/dispatches/{id}/progress
GET  /api/dispatches/{id}/logs
```

---

## 17.6 Equipment APIs

```http
GET   /api/equipment
GET   /api/equipment/{id}
POST  /api/equipment
PATCH /api/equipment/{id}
GET   /api/equipment/{id}/status
GET   /api/equipment/{id}/history
POST  /api/equipment/{id}/maintenance
POST  /api/equipment/{id}/activate
POST  /api/equipment/{id}/deactivate
```

---

## 17.7 Recipe APIs

```http
GET    /api/recipes
GET    /api/recipes/{id}
POST   /api/recipes
PATCH  /api/recipes/{id}
DELETE /api/recipes/{id}
POST   /api/recipes/{id}/activate
POST   /api/recipes/{id}/deactivate
```

---

## 17.8 Report APIs

```http
GET /api/reports/summary
GET /api/reports/equipment-utilization
GET /api/reports/request-statistics
GET /api/reports/throughput
GET /api/reports/failure-analysis
GET /api/reports/recipe-usage
```

---

# 18. Status Lifecycle

## 18.1 Request Lifecycle

```text
DRAFT
  ↓
SUBMITTED
  ↓
PENDING_APPROVAL
  ↓
APPROVED / REJECTED
  ↓
SAMPLE_PENDING_RECEIVE
  ↓
SAMPLE_RECEIVED
  ↓
IN_WIP
  ↓
DISPATCHED
  ↓
RUNNING
  ↓
COMPLETED / FAILED
```

---

## 18.2 WIP Lifecycle

```text
CREATED
  ↓
READY_FOR_DISPATCH
  ↓
QUEUED
  ↓
DISPATCHED
  ↓
RUNNING
  ↓
COMPLETED / FAILED / CANCELLED
```

---

## 18.3 Equipment Lifecycle

```text
IDLE
  ↓
RESERVED
  ↓
RUNNING
  ↓
IDLE

Alternative:
IDLE
  ↓
MAINTENANCE

Alternative:
RUNNING
  ↓
ERROR
  ↓
MAINTENANCE
  ↓
IDLE
```

---

# 19. Docker Deployment Specification

Expected deployment structure:

```text
project-root/
├── frontend/
├── backend/
├── docker-compose.yml
├── .env
└── nginx/
```

---

## 19.1 Services

```text
frontend
backend
postgres
redis
worker-1
worker-2
worker-3
worker-4
```

---

## 19.2 Docker Compose Concept

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: lims
      POSTGRES_USER: lims_user
      POSTGRES_PASSWORD: lims_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  worker-1:
    build: ./backend
    command: celery -A config worker -Q queue.sem --loglevel=info -n worker1@%h
    env_file:
      - .env
    depends_on:
      - backend
      - redis
      - postgres

  worker-2:
    build: ./backend
    command: celery -A config worker -Q queue.ellipsometer --loglevel=info -n worker2@%h
    env_file:
      - .env
    depends_on:
      - backend
      - redis
      - postgres

  worker-3:
    build: ./backend
    command: celery -A config worker -Q queue.etch --loglevel=info -n worker3@%h
    env_file:
      - .env
    depends_on:
      - backend
      - redis
      - postgres

  worker-4:
    build: ./backend
    command: celery -A config worker -Q queue.probe --loglevel=info -n worker4@%h
    env_file:
      - .env
    depends_on:
      - backend
      - redis
      - postgres

volumes:
  postgres_data:
```

---

# 20. Environment Variables

```env
DATABASE_URL=postgres://lims_user:lims_password@postgres:5432/lims
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,backend,127.0.0.1

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_REALTIME_URL=http://localhost:8000/api/realtime
```

---

# 21. Suggested Implementation Phases

## Phase 1: Core Request Flow

```text
Authentication
Role-based frontend routing
Fab user request creation
Draft saving
Manager approval
Sample receiving
```

## Phase 2: WIP and Dispatcher

```text
Sample grouping
Manual WIP creation
Auto-WIP creation
WIP locking
Dispatch job creation
```

## Phase 3: Celery Equipment Simulation

```text
Redis broker setup
Celery worker setup
Equipment queues
Recipe step simulation
Progress update to Redis
Result generation
```

## Phase 4: Real-Time Monitoring

```text
Equipment status page
Dispatch progress page
SSE or WebSocket streaming
Worker heartbeat
Live progress bar
```

## Phase 5: Management and Reports

```text
Recipe management
Equipment utilization report
Request statistics
Failure analysis
User activity logs
```

---

# 22. Minimum Viable Product Scope

For MVP, implement:

```text
1. Login with three roles
2. Fab user can create and submit request
3. Lab manager can approve request
4. Lab member can receive samples
5. Lab member can create WIP batch
6. Lab member can dispatch WIP
7. Redis + Celery worker runs simulated experiment
8. Equipment page shows real-time progress
9. Result is stored and visible to fab user
10. Docker Compose runs frontend, backend, PostgreSQL, Redis, and at least 2 workers
```

---

# 23. Advanced Features

After MVP, add:

```text
Auto-dispatch based on available equipment
Priority-aware WIP scheduling
Equipment failure simulation
Retry and recovery system
Batch optimization algorithm
Manager override queue
Detailed audit log
CSV/PDF report export
Notification system
Role-based dashboard customization
```

---

# 24. Final System Outcome

The final system should behave like a realistic semiconductor LIMS platform:

```text
Fab user submits an experiment request.
Lab manager reviews and approves it.
Lab member receives the physical sample.
Dispatcher groups compatible samples into WIP.
WIP is dispatched to a simulated equipment worker.
Celery worker executes the recipe step by step.
Redis stores real-time state and progress.
Frontend displays live equipment status.
Final experiment result is saved into PostgreSQL.
Fab user and lab manager can view reports and history.
```

This design satisfies the original requirements: request management, sample tracking, WIP batching, dispatching, equipment simulation, real-time monitoring, report management, role-based pages, PostgreSQL persistence, Redis dispatch state, Celery workers, and Docker-based deployment.
