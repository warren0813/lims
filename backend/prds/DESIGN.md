# 技術設計文件：Database Schema & API Design

> 基於 PRD.md，使用 Django 6 + django-ninja 1.6 + SQLite（開發）/ PostgreSQL（生產）

---

## 1. Django App 規劃

按領域拆分為以下 Django apps，每個 app 職責單一：

```
apps/
├── accounts/        # 使用者與角色管理
├── experiments/     # 實驗項目管理
├── equipment/       # 機台與 Recipe 管理
├── commissions/     # 委託單與樣品管理（核心業務流程）
├── wip/             # WIP、派貨與實驗結果
└── reports/         # 統計報表（無 model，純查詢）
```

---

## 2. Database Schema

### 2.1 ER Diagram（文字版）

```
User (Django Auth)
  │
  ├──1:N──→ Request (委託單)
  │            ├──1:N──→ Sample (樣品)
  │            │            └──1:1──→ WIP
  │            │                       └──1:N──→ Dispatch (派貨)
  │            │                                   └──1:1──→ ExperimentResult
  │            ├──M:N──→ ExperimentType (透過 RequestExperiment)
  │            └──1:N──→ ApprovalLog (簽核紀錄)
  │
  ExperimentType (實驗項目)
  │  ├──M:N──→ Equipment (透過 EquipmentCapability)
  │  └──1:N──→ Recipe
  │
  Equipment (機台)
  │  └──1:N──→ Recipe
  │
  Recipe ──→ (Equipment + ExperimentType)
  │
  Dispatch ──→ (WIP + ExperimentType + Equipment + Recipe)
```

### 2.2 Model 定義

#### accounts app

```python
# apps/accounts/models.py

class Role(models.TextChoices):
    FAB_USER = "fab_user", "廠區使用者"
    LAB_STAFF = "lab_staff", "實驗室人員"
    LAB_MANAGER = "lab_manager", "實驗室主管"

class UserProfile(models.Model):
    """擴展 Django User，加入角色與部門"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=Role.choices)
    department = models.CharField(max_length=100, blank=True)  # 所屬部門/廠區
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profile"
```

#### experiments app

```python
# apps/experiments/models.py

class LabCategory(models.TextChoices):
    RA = "RA", "可靠度分析 (Reliability Analysis)"
    MA = "MA", "材料分析 (Material Analysis)"
    FA = "FA", "失效分析 (Failure Analysis)"
    TM = "TM", "電性測試 (Test & Measurement)"

class ExperimentType(models.Model):
    """實驗項目：由實驗室人員維護，廠區使用者選擇"""
    name = models.CharField(max_length=200, unique=True)       # e.g. "高溫烘烤測試"
    description = models.TextField(blank=True)
    lab_category = models.CharField(max_length=10, choices=LabCategory.choices)
    is_active = models.BooleanField(default=True)              # 軟刪除
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "experiment_type"
```

#### equipment app

```python
# apps/equipment/models.py

class EquipmentStatus(models.TextChoices):
    AVAILABLE = "available", "可用"
    MAINTENANCE = "maintenance", "維修中"
    DISABLED = "disabled", "停用"

class Equipment(models.Model):
    """機台"""
    name = models.CharField(max_length=200)
    model_name = models.CharField(max_length=200)               # 型號
    capacity = models.PositiveIntegerField()                    # 最大處理片數
    status = models.CharField(max_length=20, choices=EquipmentStatus.choices, default=EquipmentStatus.AVAILABLE)
    capabilities = models.ManyToManyField(                      # 可執行的實驗項目
        "experiments.ExperimentType",
        through="EquipmentCapability",
        related_name="equipments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "equipment"

class EquipmentCapability(models.Model):
    """機台能力：機台與實驗項目的對應關係"""
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE)
    experiment_type = models.ForeignKey("experiments.ExperimentType", on_delete=models.CASCADE)

    class Meta:
        db_table = "equipment_capability"
        unique_together = ("equipment", "experiment_type")

class Recipe(models.Model):
    """實驗方法與參數模板：對應特定機台 + 實驗項目"""
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    parameters = models.JSONField(default=dict)                 # 彈性參數存儲
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="recipes")
    experiment_type = models.ForeignKey("experiments.ExperimentType", on_delete=models.CASCADE, related_name="recipes")
    is_active = models.BooleanField(default=True)               # 軟刪除
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "recipe"
```

#### commissions app

```python
# apps/commissions/models.py

class WaferSize(models.TextChoices):
    SIZE_200MM = "200mm", "200mm"
    SIZE_300MM = "300mm", "300mm"

class RequestStatus(models.TextChoices):
    DRAFT = "draft", "草稿"
    PENDING_APPROVAL = "pending_approval", "待簽核"
    APPROVED = "approved", "已核准"
    RETURNED = "returned", "已退回"
    REJECTED = "rejected", "已拒絕"
    SAMPLE_SHIPPED = "sample_shipped", "已送樣"
    IN_PROGRESS = "in_progress", "處理中"
    EXCEPTION = "exception", "異常處理中"
    COMPLETED = "completed", "已完成"
    CLOSED = "closed", "已結單"
    CANCELLED = "cancelled", "已取消"

class SampleStatus(models.TextChoices):
    CREATED = "created", "已建立"
    SHIPPED = "shipped", "已送樣"
    RECEIVED = "received", "已接樣"
    RECEIVING_EXCEPTION = "receiving_exception", "接樣異常"
    SPLIT = "split", "已分貨"
    PROCESSING_EXCEPTION = "processing_exception", "處理異常"
    COMPLETED = "completed", "已完成"
    LOST = "lost", "送樣遺失"
    RETURNED = "returned", "已退回"
    VOIDED = "voided", "已作廢"

class Request(models.Model):
    """委託單"""
    title = models.CharField(max_length=300)
    requester = models.ForeignKey(                              # 開單者（廠區使用者）
        User, on_delete=models.PROTECT, related_name="requests"
    )
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.DRAFT)
    experiment_types = models.ManyToManyField(                  # 委託的實驗項目
        "experiments.ExperimentType",
        through="RequestExperiment",
        related_name="requests",
    )
    note = models.TextField(blank=True)                         # 備註
    submitted_at = models.DateTimeField(null=True, blank=True)  # 送出時間
    completed_at = models.DateTimeField(null=True, blank=True)  # 完成時間
    closed_at = models.DateTimeField(null=True, blank=True)     # 結單時間
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "request"

class RequestExperiment(models.Model):
    """委託單與實驗項目的關聯（含委託參數）"""
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="request_experiments")
    experiment_type = models.ForeignKey("experiments.ExperimentType", on_delete=models.PROTECT)
    parameters = models.JSONField(default=dict, blank=True)     # 委託參數 e.g. {"duration_hours": 300}

    class Meta:
        db_table = "request_experiment"
        unique_together = ("request", "experiment_type")

class Sample(models.Model):
    """樣品（實體 wafer）"""
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="samples")
    wafer_id = models.CharField(max_length=100)                 # Wafer ID（同一委託單內唯一）
    wafer_size = models.CharField(max_length=10, choices=WaferSize.choices)
    status = models.CharField(max_length=30, choices=SampleStatus.choices, default=SampleStatus.CREATED)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sample"
        unique_together = ("request", "wafer_id")               # 同委託單內 wafer_id 唯一

class ApprovalLog(models.Model):
    """簽核紀錄"""
    class Action(models.TextChoices):
        APPROVE = "approve", "核准"
        RETURN = "return", "退回"
        REJECT = "reject", "拒絕"

    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="approval_logs")
    reviewer = models.ForeignKey(User, on_delete=models.PROTECT)
    action = models.CharField(max_length=10, choices=Action.choices)
    comment = models.TextField(blank=True)                      # 退回/拒絕原因（必填）
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "approval_log"
        ordering = ["-created_at"]
```

#### wip app

```python
# apps/wip/models.py

class WIPStatus(models.TextChoices):
    CREATED = "created", "已建立"
    IN_PROGRESS = "in_progress", "處理中"          # 有進行中的派貨
    COMPLETED = "completed", "已完成"               # 所有派貨皆完成
    ABORTED = "aborted", "已中止"

class DispatchStatus(models.TextChoices):
    PENDING = "pending", "待派貨"
    DISPATCHED = "dispatched", "已派貨"
    RUNNING = "running", "執行中"
    EXECUTION_EXCEPTION = "execution_exception", "執行異常"
    UNLOADED = "unloaded", "已下貨"
    RESULT_RECORDED = "result_recorded", "結果已登錄"
    COMPLETED = "completed", "已完成"
    PENDING_REDISPATCH = "pending_redispatch", "待重派"
    ABORTED = "aborted", "已中止"

class WIP(models.Model):
    """Work In Progress：每個樣品在實驗室內的追蹤單位（1 Sample = 1 WIP）"""
    sample = models.OneToOneField(                              # 對應的樣品（1:1）
        "commissions.Sample", on_delete=models.CASCADE, related_name="wip"
    )
    status = models.CharField(max_length=30, choices=WIPStatus.choices, default=WIPStatus.CREATED)
    note = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)  # 完成時間
    created_by = models.ForeignKey(                             # 建立者（實驗室人員）
        User, on_delete=models.PROTECT, related_name="created_wips"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wip"

class Dispatch(models.Model):
    """派貨紀錄：將 WIP 指派到特定機台執行特定實驗"""
    wip = models.ForeignKey(WIP, on_delete=models.CASCADE, related_name="dispatches")
    experiment_type = models.ForeignKey(                         # 本次派貨的實驗項目
        "experiments.ExperimentType", on_delete=models.PROTECT, related_name="dispatches"
    )
    equipment = models.ForeignKey(                               # 指定機台
        "equipment.Equipment", on_delete=models.PROTECT, related_name="dispatches"
    )
    recipe = models.ForeignKey(                                  # 指定 recipe
        "equipment.Recipe", on_delete=models.PROTECT, related_name="dispatches"
    )
    status = models.CharField(max_length=30, choices=DispatchStatus.choices, default=DispatchStatus.PENDING)
    note = models.TextField(blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)  # 實際派貨時間
    completed_at = models.DateTimeField(null=True, blank=True)   # 完成時間
    created_by = models.ForeignKey(                              # 建立者（實驗室人員）
        User, on_delete=models.PROTECT, related_name="created_dispatches"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dispatch"

class ExperimentResult(models.Model):
    """實驗結果：對應一次派貨"""
    class DataSource(models.TextChoices):
        MANUAL = "manual", "手動登錄"
        AUTOMATED = "automated", "自動化"

    class Verdict(models.TextChoices):
        PASS = "pass", "合格"
        FAIL = "fail", "不合格"

    dispatch = models.OneToOneField(Dispatch, on_delete=models.CASCADE, related_name="result")
    summary = models.TextField()                                # 結果摘要
    verdict = models.CharField(max_length=10, choices=Verdict.choices)
    data = models.JSONField(default=dict, blank=True)           # 實驗數據（彈性結構）
    data_source = models.CharField(max_length=20, choices=DataSource.choices, default=DataSource.MANUAL)
    note = models.TextField(blank=True)
    recorded_by = models.ForeignKey(                            # 登錄者（手動時為人員，自動時為 null）
        User, on_delete=models.PROTECT,
        null=True, blank=True, related_name="recorded_results",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "experiment_result"
```

### 2.3 索引策略

```python
# 需加在各 model 的 Meta.indexes 中
# 以下列出關鍵查詢場景對應的索引

# Request: 按 requester 和 status 篩選
indexes = [
    models.Index(fields=["requester", "status"]),
    models.Index(fields=["status"]),
    models.Index(fields=["created_at"]),
]

# Sample: 按 request 和 status 篩選
indexes = [
    models.Index(fields=["request", "status"]),
    models.Index(fields=["status"]),
]

# WIP: 按 status 篩選
indexes = [
    models.Index(fields=["status"]),
]

# Dispatch: 按 status 篩選、按 equipment 查詢
indexes = [
    models.Index(fields=["status"]),
    models.Index(fields=["equipment", "status"]),
    models.Index(fields=["dispatched_at"]),
]
```

---

## 3. API Design

### 3.1 總覽

- Base URL: `/api/`
- 格式: JSON
- 認證: Session / Token（django-ninja 內建支援）
- 版本: v1（透過 router prefix）

### 3.2 API 端點清單

#### 3.2.1 Auth & User — `/api/auth/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| POST | `/auth/login` | 登入 | All |
| POST | `/auth/logout` | 登出 | All |
| GET | `/auth/me` | 取得當前使用者資訊與角色 | All |

#### 3.2.2 實驗項目 — `/api/experiment-types/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| GET | `/experiment-types/` | 列出實驗項目（支援搜尋、篩選） | All |
| POST | `/experiment-types/` | 新增實驗項目 | Lab Staff, Lab Manager |
| GET | `/experiment-types/{id}` | 取得實驗項目詳情 | All |
| PATCH | `/experiment-types/{id}` | 修改實驗項目 | Lab Staff, Lab Manager |
| DELETE | `/experiment-types/{id}` | 停用實驗項目（軟刪除） | Lab Staff, Lab Manager |

**Query Parameters (GET list):**
- `search`: 模糊搜尋名稱
- `lab_category`: 篩選實驗室類別 (RA/MA/FA/TM)
- `is_active`: 篩選啟用狀態（廠區使用者預設 true）

**Request Body (POST/PATCH):**
```json
{
  "name": "高溫烘烤測試",
  "description": "在高溫環境下測試晶圓可靠度",
  "lab_category": "RA"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "高溫烘烤測試",
  "description": "在高溫環境下測試晶圓可靠度",
  "lab_category": "RA",
  "is_active": true,
  "created_at": "2026-03-24T10:00:00Z"
}
```

#### 3.2.3 機台 — `/api/equipment/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| GET | `/equipment/` | 列出機台 | Lab Staff, Lab Manager |
| POST | `/equipment/` | 新增機台 | Lab Staff, Lab Manager |
| GET | `/equipment/{id}` | 取得機台詳情（含能力、recipes） | Lab Staff, Lab Manager |
| PATCH | `/equipment/{id}` | 修改機台資訊 | Lab Staff, Lab Manager |
| POST | `/equipment/{id}/capabilities` | 設定機台可執行的實驗項目 | Lab Staff, Lab Manager |

**Request Body (POST):**
```json
{
  "name": "烤箱 A-01",
  "model_name": "OV-3000",
  "capacity": 25,
  "capability_ids": [1, 3]
}
```

**Response:**
```json
{
  "id": 1,
  "name": "烤箱 A-01",
  "model_name": "OV-3000",
  "capacity": 25,
  "status": "available",
  "capabilities": [
    {"id": 1, "name": "高溫烘烤測試"},
    {"id": 3, "name": "熱衝擊測試"}
  ],
  "created_at": "2026-03-24T10:00:00Z"
}
```

#### 3.2.4 Recipe — `/api/recipes/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| GET | `/recipes/` | 列出 Recipe（支援按機台/實驗項目篩選） | Lab Staff, Lab Manager |
| POST | `/recipes/` | 新增 Recipe | Lab Staff, Lab Manager |
| GET | `/recipes/{id}` | 取得 Recipe 詳情 | Lab Staff, Lab Manager |
| PATCH | `/recipes/{id}` | 修改 Recipe | Lab Staff, Lab Manager |
| DELETE | `/recipes/{id}` | 停用 Recipe（軟刪除） | Lab Staff, Lab Manager |

**Query Parameters (GET list):**
- `equipment_id`: 按機台篩選
- `experiment_type_id`: 按實驗項目篩選
- `is_active`: 篩選啟用狀態

**Request Body (POST):**
```json
{
  "name": "RA-OV3000-HTSL-300H",
  "description": "高溫儲存壽命測試 300hr",
  "equipment_id": 1,
  "experiment_type_id": 1,
  "parameters": {
    "temperature_celsius": 150,
    "duration_hours": 300,
    "humidity_percent": null
  }
}
```

**Response:**
```json
{
  "id": 1,
  "name": "RA-OV3000-HTSL-300H",
  "description": "高溫儲存壽命測試 300hr",
  "equipment": {"id": 1, "name": "烤箱 A-01"},
  "experiment_type": {"id": 1, "name": "高溫烘烤測試"},
  "parameters": {
    "temperature_celsius": 150,
    "duration_hours": 300,
    "humidity_percent": null
  },
  "is_active": true,
  "created_at": "2026-03-24T10:00:00Z"
}
```

#### 3.2.5 委託單 — `/api/requests/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| GET | `/requests/` | 列出委託單（Fab User 只看自己的） | All |
| POST | `/requests/` | 建立委託單（草稿） | Fab User |
| GET | `/requests/{id}` | 取得委託單詳情（含樣品、簽核紀錄） | All |
| PATCH | `/requests/{id}` | 修改委託單（僅草稿/已退回狀態） | Fab User |
| POST | `/requests/{id}/submit` | 送出委託單 | Fab User |
| POST | `/requests/{id}/approve` | 簽核：核准 | Lab Manager |
| POST | `/requests/{id}/return` | 簽核：退回 | Lab Manager |
| POST | `/requests/{id}/reject` | 簽核：拒絕 | Lab Manager |
| POST | `/requests/{id}/ship` | 標記已送樣 | Fab User |
| POST | `/requests/{id}/cancel` | 取消委託單 | Fab User, Lab Manager |
| POST | `/requests/{id}/close` | 結單 | Lab Manager |

**Query Parameters (GET list):**
- `status`: 篩選狀態
- `page`, `page_size`: 分頁

**Request Body (POST create):**
```json
{
  "title": "RA 高溫烘烤測試委託",
  "note": "請於一週內完成",
  "experiment_type_ids": [1],
  "experiment_parameters": {
    "1": {"duration_hours": 300}
  },
  "samples": [
    {"wafer_id": "WF-2026-001", "wafer_size": "300mm"},
    {"wafer_id": "WF-2026-002", "wafer_size": "300mm"}
  ]
}
```

**Request Body (POST approve):**
```json
{}
```

**Request Body (POST return/reject):**
```json
{
  "comment": "樣品數量不符，請確認後重新送出"
}
```

**Request Body (POST cancel):**
```json
{
  "reason": "需求變更，不再需要此測試"
}
```

**Response (GET detail):**
```json
{
  "id": 1,
  "title": "RA 高溫烘烤測試委託",
  "requester": {"id": 1, "username": "fab_user_01", "department": "廠區 A"},
  "status": "in_progress",
  "note": "請於一週內完成",
  "experiment_types": [
    {
      "id": 1,
      "name": "高溫烘烤測試",
      "parameters": {"duration_hours": 300}
    }
  ],
  "samples": [
    {"id": 1, "wafer_id": "WF-2026-001", "wafer_size": "300mm", "status": "split"},
    {"id": 2, "wafer_id": "WF-2026-002", "wafer_size": "300mm", "status": "received"}
  ],
  "approval_logs": [
    {
      "reviewer": {"id": 2, "username": "lab_mgr_01"},
      "action": "approve",
      "comment": "",
      "created_at": "2026-03-24T11:00:00Z"
    }
  ],
  "submitted_at": "2026-03-24T10:30:00Z",
  "created_at": "2026-03-24T10:00:00Z"
}
```

#### 3.2.6 樣品 — `/api/samples/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| GET | `/samples/` | 列出樣品（支援按狀態、委託單篩選） | All |
| GET | `/samples/{id}` | 取得樣品詳情（含所屬 WIP） | All |
| POST | `/samples/{id}/receive` | 確認接樣 | Lab Staff |
| POST | `/samples/{id}/reject-receiving` | 接樣異常（料不符） | Lab Staff |
| POST | `/samples/{id}/report-lost` | 標記送樣遺失 | Lab Staff |
| POST | `/samples/{id}/void` | 作廢樣品 | Lab Staff, Lab Manager |
| POST | `/samples/{id}/return` | 退回樣品 | Lab Staff, Lab Manager |

**Query Parameters (GET list):**
- `request_id`: 按委託單篩選
- `status`: 按狀態篩選

**Request Body (POST reject-receiving):**
```json
{
  "reason": "wafer 外觀破損，與委託內容不符"
}
```

**Response (GET detail):**
```json
{
  "id": 1,
  "wafer_id": "WF-2026-001",
  "wafer_size": "300mm",
  "status": "split",
  "request": {"id": 1, "title": "RA 高溫烘烤測試委託"},
  "wip": {
    "id": 1,
    "status": "in_progress",
    "dispatches": [
      {"id": 1, "status": "running", "experiment_type": {"id": 1, "name": "高溫烘烤測試"}, "equipment": {"id": 1, "name": "烤箱 A-01"}}
    ]
  },
  "note": "",
  "created_at": "2026-03-24T10:30:00Z"
}
```

#### 3.2.7 WIP — `/api/wips/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| GET | `/wips/` | 列出 WIP（支援按狀態篩選） | Lab Staff, Lab Manager |
| POST | `/wips/` | 建立 WIP（分貨，1 Sample = 1 WIP） | Lab Staff |
| GET | `/wips/{id}` | 取得 WIP 詳情（含 dispatches） | Lab Staff, Lab Manager |
| POST | `/wips/{id}/dispatches` | 建立派貨（指定實驗項目 + 機台 + recipe） | Lab Staff |
| POST | `/wips/{id}/complete` | 標記 WIP 完成 | Lab Staff |
| POST | `/wips/{id}/abort` | 中止 WIP | Lab Staff, Lab Manager |

**Request Body (POST create):**
```json
{
  "sample_id": 1
}
```

**Request Body (POST dispatches):**
```json
{
  "experiment_type_id": 1,
  "equipment_id": 1,
  "recipe_id": 1
}
```

**Response (GET detail):**
```json
{
  "id": 1,
  "sample": {"id": 1, "wafer_id": "WF-2026-001", "wafer_size": "300mm"},
  "status": "in_progress",
  "dispatches": [
    {
      "id": 1,
      "experiment_type": {"id": 1, "name": "高溫烘烤測試"},
      "equipment": {"id": 1, "name": "烤箱 A-01"},
      "recipe": {"id": 1, "name": "RA-OV3000-HTSL-300H"},
      "status": "completed",
      "result": {"verdict": "pass", "summary": "300hr 測試通過"}
    },
    {
      "id": 2,
      "experiment_type": {"id": 2, "name": "熱衝擊測試"},
      "equipment": {"id": 2, "name": "熱衝擊機 B-01"},
      "recipe": {"id": 3, "name": "RA-TS200-TC-500C"},
      "status": "running",
      "result": null
    }
  ],
  "note": "",
  "created_at": "2026-03-24T12:00:00Z"
}
```

#### 3.2.8 派貨 — `/api/dispatches/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| GET | `/dispatches/` | 列出派貨（支援按狀態、機台篩選） | Lab Staff, Lab Manager |
| GET | `/dispatches/{id}` | 取得派貨詳情 | Lab Staff, Lab Manager |
| POST | `/dispatches/{id}/start` | 開始執行 | Lab Staff |
| POST | `/dispatches/{id}/unload` | 下貨 | Lab Staff |
| POST | `/dispatches/{id}/record-result` | 手動登錄實驗結果 | Lab Staff |
| POST | `/dispatches/{id}/complete` | 標記派貨完成 | Lab Staff |
| POST | `/dispatches/{id}/report-exception` | 回報異常 | Lab Staff |
| POST | `/dispatches/{id}/redispatch` | 重派（異常後重新進入待派貨） | Lab Staff |
| POST | `/dispatches/{id}/abort` | 中止派貨 | Lab Staff, Lab Manager |

**Query Parameters (GET list):**
- `status`: 按狀態篩選
- `equipment_id`: 按機台篩選
- `wip_id`: 按 WIP 篩選

**Request Body (POST record-result):**
```json
{
  "summary": "300hr 高溫儲存測試完成，所有樣品通過",
  "verdict": "pass",
  "data": {
    "temperature_actual": 150.2,
    "duration_actual_hours": 300,
    "defect_count": 0
  },
  "note": ""
}
```

**Request Body (POST report-exception):**
```json
{
  "reason": "機台溫控異常，溫度偏差超過 ±5°C"
}
```

#### 3.2.9 自動化端點 — `/api/automation/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| POST | `/automation/equipment-result` | 機台自動回傳實驗結果 | System / API Key |

**Request Body:**
```json
{
  "dispatch_id": 1,
  "equipment_id": 1,
  "summary": "自動化測試完成",
  "verdict": "pass",
  "data": {
    "temperature_actual": 150.1,
    "duration_actual_hours": 300
  }
}
```

**行為：**
1. 驗證 Dispatch 狀態為 `dispatched` 或 `running`
2. 自動執行：下貨 → 登錄結果（data_source = automated）→ 完成該 Dispatch
3. 若 WIP 所有 Dispatch 皆完成，自動觸發 WIP → Sample → Request 狀態聯動

#### 3.2.10 統計報表 — `/api/reports/`

| Method | Path | 說明 | 角色 |
|--------|------|------|------|
| GET | `/reports/equipment-utilization` | 機台利用率（WIP 處理量） | Lab Manager |
| GET | `/reports/request-statistics` | 委託單狀態分佈與 TAT | Lab Manager |

**Query Parameters (equipment-utilization):**
- `period`: `day` / `week` / `month`
- `start_date`, `end_date`: 時間範圍
- `equipment_id`: 指定機台（可選）

**Response (equipment-utilization):**
```json
{
  "period": "week",
  "start_date": "2026-03-17",
  "end_date": "2026-03-24",
  "data": [
    {
      "equipment": {"id": 1, "name": "烤箱 A-01"},
      "wip_count": 12,
      "sample_count": 38
    }
  ]
}
```

**Response (request-statistics):**
```json
{
  "period": {"start_date": "2026-03-01", "end_date": "2026-03-24"},
  "status_distribution": {
    "draft": 5,
    "pending_approval": 3,
    "in_progress": 12,
    "completed": 8,
    "closed": 45
  },
  "average_tat_hours": 168.5,
  "total_requests": 73
}
```

---

## 4. 狀態轉移驗證規則

每次狀態變更時，後端需驗證前置狀態是否合法：

### 4.1 委託單 (Request)

| Action | 允許的前置狀態 | 目標狀態 | 觸發角色 |
|--------|---------------|---------|---------|
| submit | draft, returned | pending_approval | Fab User |
| approve | pending_approval | approved | Lab Manager |
| return | pending_approval | returned | Lab Manager |
| reject | pending_approval | rejected | Lab Manager |
| ship | approved | sample_shipped | Fab User |
| → (自動) 所有樣品接收 | sample_shipped | in_progress | System |
| → (自動) 所有樣品完成 | in_progress | completed | System |
| → (自動) WIP 異常 | in_progress | exception | System |
| close | completed | closed | Lab Manager |
| cancel | draft ~ in_progress | cancelled | Fab User / Lab Manager |

### 4.2 樣品 (Sample)

| Action | 允許的前置狀態 | 目標狀態 |
|--------|---------------|---------|
| → (自動) 委託單送出 | — | created |
| → (自動) 送樣 | created | shipped |
| receive | shipped | received |
| reject-receiving | shipped | receiving_exception |
| report-lost | shipped | lost |
| → (自動) 分貨建立 WIP | received | split |
| → (自動) WIP 完成 | split | completed |
| → (自動) WIP 中止 | split | processing_exception |
| void | receiving_exception, processing_exception, lost | voided |
| return | receiving_exception, processing_exception | returned |

### 4.3 WIP

| Action | 允許的前置狀態 | 目標狀態 |
|--------|---------------|---------|
| create | — | created |
| → (自動) 首次派貨建立 | created | in_progress |
| complete | in_progress | completed |
| abort | created, in_progress | aborted |

> WIP 狀態較簡化，詳細的派貨/執行追蹤由 Dispatch 負責。
> WIP 完成前提：所有關聯的 Dispatch 皆已完成或中止。

### 4.4 Dispatch（派貨）

| Action | 允許的前置狀態 | 目標狀態 |
|--------|---------------|---------|
| create | — | pending |
| dispatch（確認派出） | pending | dispatched |
| start | dispatched | running |
| unload | dispatched, running | unloaded |
| record-result | unloaded | result_recorded |
| complete | result_recorded | completed |
| report-exception | dispatched, running | execution_exception |
| redispatch | execution_exception | pending_redispatch → pending |
| abort | execution_exception, pending | aborted |

---

## 5. 分頁與錯誤格式

### 5.1 分頁（列表端點統一格式）

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

### 5.2 錯誤回應

```json
{
  "detail": "委託單狀態不允許此操作",
  "code": "invalid_status_transition"
}
```

| HTTP Status | 用途 |
|-------------|------|
| 400 | 驗證失敗、狀態轉移不合法 |
| 401 | 未認證 |
| 403 | 無權限（角色不符） |
| 404 | 資源不存在 |
| 409 | 衝突（如機台 capacity 不足） |

---

## 6. Django Router 結構

```python
# api/router.py
from ninja import NinjaAPI

api = NinjaAPI(title="LIMS API", version="1.0.0")

# 各 app 的 router
api.add_router("/auth/",              "apps.accounts.api.router")
api.add_router("/experiment-types/",  "apps.experiments.api.router")
api.add_router("/equipment/",         "apps.equipment.api.router")
api.add_router("/recipes/",           "apps.equipment.api.recipe_router")
api.add_router("/requests/",          "apps.commissions.api.router")
api.add_router("/samples/",           "apps.commissions.api.sample_router")
api.add_router("/wips/",              "apps.wip.api.router")
api.add_router("/dispatches/",        "apps.wip.api.dispatch_router")
api.add_router("/automation/",        "apps.wip.api.automation_router")
api.add_router("/reports/",           "apps.reports.api.router")
```
