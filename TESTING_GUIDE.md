# LIMS 完整測試流程

_用來做 PR 前的全功能 sanity check。每個 checkbox 都走一遍就能涵蓋 SPA 全部功能。_

---

## 〇、環境準備

### 1. 後端、前端、admin 三個視窗

**Terminal A — 後端:**
```bash
cd ~/Documents/GitHub/lims-backend
uv run python manage.py runserver
```

**Terminal B — 前端:**
```bash
cd ~/Documents/GitHub/lims-frontend
python3 -m http.server 8080
```

**Terminal C — 瀏覽器（直接用一般 Chrome）:**

打開兩個 tab：
- `http://localhost:8080/LIMS_0-8-1.dev.html` — SPA
- `http://localhost:8000/admin/` — Django admin（用來檢查資料）

### 2. 建 superuser（一次性，看 admin 用）

```bash
cd ~/Documents/GitHub/lims-backend
uv run python manage.py createsuperuser
# Username: admin / Password: 隨意
```

### 3. 跑一次豐沛的 seed script（重置測試環境用）

```bash
uv run python manage.py shell <<'EOF'
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile, Role
from apps.experiments.models import ExperimentType, LabCategory
from apps.equipment.models import Equipment, EquipmentCapability, Recipe
from apps.commissions.models import Request, Sample, RequestExperiment

# === 帳號 ===
for username, role, dept in [
    ('fab_user',    Role.FAB_USER,    'Fab QA'),
    ('lab_staff',   Role.LAB_STAFF,   'Lab Operations'),
    ('lab_manager', Role.LAB_MANAGER, 'Lab Operations'),
]:
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('demo1234'); u.save()
    UserProfile.objects.update_or_create(user=u, defaults={'role': role, 'department': dept})

# === Experiment Types ===
tct,  _ = ExperimentType.objects.get_or_create(name='Temperature Cycling Test', defaults={'lab_category': LabCategory.RA})
hast, _ = ExperimentType.objects.get_or_create(name='HAST',                     defaults={'lab_category': LabCategory.RA})
btc,  _ = ExperimentType.objects.get_or_create(name='Bias Temperature Cycling', defaults={'lab_category': LabCategory.RA})
cp,   _ = ExperimentType.objects.get_or_create(name='Circuit Probe',            defaults={'lab_category': LabCategory.TM})
ft,   _ = ExperimentType.objects.get_or_create(name='Final Test',               defaults={'lab_category': LabCategory.TM})

# === Equipment ===
e1, _ = Equipment.objects.get_or_create(name='QA-TCT-01', defaults={'model_name': 'ESPEC ARS-1100', 'capacity': 6})
e2, _ = Equipment.objects.get_or_create(name='QA-TCT-02', defaults={'model_name': 'ESPEC ARS-1100', 'capacity': 6})
e3, _ = Equipment.objects.get_or_create(name='QA-HAST-01', defaults={'model_name': 'Hirayama PC-422', 'capacity': 12})
e4, _ = Equipment.objects.get_or_create(name='QA-CP-A',    defaults={'model_name': 'Accretech UF3000', 'capacity': 1, 'status': 'maintenance'})
e5, _ = Equipment.objects.get_or_create(name='QA-FT-01',   defaults={'model_name': 'Advantest V93000', 'capacity': 4})

# === Capabilities ===
caps = [(e1, tct), (e2, tct), (e2, btc), (e3, hast), (e3, btc), (e4, cp), (e5, ft)]
for eq, et in caps:
    EquipmentCapability.objects.get_or_create(equipment=eq, experiment_type=et)

# === Recipes ===
recipes = [
    ('TCT_Standard_500_v1',  tct,  {'cycles': 500, 't_min': '-55°C', 't_max': '125°C', 'dwell': '15 min', 'ramp': '15°C/min'}),
    ('TCT_Extended_1000_v2', tct,  {'cycles': 1000, 't_min': '-65°C', 't_max': '150°C', 'dwell': '10 min', 'ramp': '20°C/min'}),
    ('HAST_85_85_168h',      hast, {'temperature': '85°C', 'humidity': '85% RH', 'duration': '168 h', 'bias': '5V'}),
    ('CP_Full_Sweep_v3',     cp,   {'sites': 1024, 'touchdowns': 24, 'vdd': '1.0V', 'clock': '100MHz'}),
    ('FT_Basic_Functional',  ft,   {'tests': 240, 'voltage': '1.2V', 'temp': '25°C'}),
]
for name, et, params in recipes:
    Recipe.objects.get_or_create(name=name, defaults={'experiment_type': et, 'parameters': params, 'description': f'Standard {et.name} recipe'})

# === Requests（各種狀態） ===
fab = User.objects.get(username='fab_user')

# Draft（fab_user 自己編輯中）
r0 = Request.objects.create(title='TCT Draft 0520', requester=fab, urgency='1w', status='draft', note='Still drafting...')
RequestExperiment.objects.create(request=r0, experiment_type=tct)
Sample.objects.create(request=r0, wafer_id='W0520D1', wafer_size='200mm', status='created')

# Submitted（等 manager 審核）
r1 = Request.objects.create(title='HAST 0520001', requester=fab, urgency='3d', status='pending_approval', submitted_at='2026-05-20T08:00:00Z')
RequestExperiment.objects.create(request=r1, experiment_type=hast)
Sample.objects.create(request=r1, wafer_id='W0520A1', wafer_size='200mm', status='created')
Sample.objects.create(request=r1, wafer_id='W0520A2', wafer_size='200mm', status='created')

r2 = Request.objects.create(title='TCT 0519001', requester=fab, urgency='1w', status='pending_approval', submitted_at='2026-05-19T14:00:00Z')
RequestExperiment.objects.create(request=r2, experiment_type=tct)
Sample.objects.create(request=r2, wafer_id='W0519A', wafer_size='200mm', status='created')

# Approved + shipped + 部分 received（in_progress 流程）
r3 = Request.objects.create(title='TCT 0518002', requester=fab, urgency='3d', status='in_progress', submitted_at='2026-05-18T09:00:00Z')
RequestExperiment.objects.create(request=r3, experiment_type=tct)
Sample.objects.create(request=r3, wafer_id='W0518A', wafer_size='200mm', status='received', received_at='2026-05-19T10:00:00Z')

# Returned（需要 fab 重新編輯）
r4 = Request.objects.create(title='TCT 0517003', requester=fab, urgency='1w', status='returned', submitted_at='2026-05-17T11:00:00Z', note='Recipe spec missing')
RequestExperiment.objects.create(request=r4, experiment_type=tct)
Sample.objects.create(request=r4, wafer_id='W0517A', wafer_size='200mm', status='created')

# Rejected
r5 = Request.objects.create(title='HAST 0516004', requester=fab, urgency='2w', status='rejected', submitted_at='2026-05-16T13:00:00Z')
RequestExperiment.objects.create(request=r5, experiment_type=hast)
Sample.objects.create(request=r5, wafer_id='W0516A', wafer_size='300mm', status='created')

# Cancelled
r6 = Request.objects.create(title='TCT 0515005', requester=fab, urgency='1w', status='cancelled', submitted_at='2026-05-15T15:00:00Z')
RequestExperiment.objects.create(request=r6, experiment_type=tct)
Sample.objects.create(request=r6, wafer_id='W0515A', wafer_size='200mm', status='cancelled')

# Completed
r7 = Request.objects.create(title='CP 0514006', requester=fab, urgency='1w', status='completed', submitted_at='2026-05-14T09:00:00Z', completed_at='2026-05-19T17:00:00Z')
RequestExperiment.objects.create(request=r7, experiment_type=cp)
Sample.objects.create(request=r7, wafer_id='W0514A', wafer_size='300mm', status='completed', received_at='2026-05-15T10:00:00Z')

print('=== Seed done ===')
print(f'Users:        {User.objects.count()}')
print(f'Experiments:  {ExperimentType.objects.count()}')
print(f'Equipment:    {Equipment.objects.count()}')
print(f'Recipes:      {Recipe.objects.count()}')
print(f'Requests:     {Request.objects.count()}')
print(f'Samples:      {Sample.objects.count()}')
EOF
```

跑完應該看到：
```
=== Seed done ===
Users:        4 (admin + 3 lims accounts)
Experiments:  5
Equipment:    5
Recipes:      5
Requests:     8 (含各種狀態)
Samples:      9
```

如果要重置（重跑 seed 不會自動清舊資料）：

```bash
uv run python manage.py flush --no-input
uv run python manage.py migrate
# 然後重跑 seed
```

---

## 一、Fab User 流程

登入 `fab_user` / `demo1234`。

### A1. Dashboard 看自己的 request 狀態

- [ ] 4 個 tile counts 顯示正確（Waiting Approval / In Progress / Drafts / 預期還沒 Cancelled）
- [ ] In Progress section 列出有 in_progress 的 request
- [ ] Drafts section 列出 draft request
- [ ] 點任一筆 → 進到 Request Detail 頁

對照 admin: `http://localhost:8000/admin/commissions/request/` 看 status 分佈。

### A2. My Requests 看完整列表

- [ ] 切到 My Requests
- [ ] 看到 8 筆 request（除了 admin user）
- [ ] urgency pill 顏色：3d 紅 / 1w 藍 / 2w 灰
- [ ] status pill 顏色：draft 灰 / submitted 黃 / in_progress 藍 / returned 粉 / rejected 紅 / cancelled 灰 / completed 藍
- [ ] sampleCount 顯示正確（之前是「0 wafers」 bug，現在應該對）

### A3. New Request — Save Draft

- [ ] 點 `+ New Request`
- [ ] 填 title：`Test draft 1`
- [ ] 選 urgency = 3 Days
- [ ] 勾 experiment = TCT
- [ ] 加 wafer：`W-TEST-01`, 200mm
- [ ] 點 **Save Draft**
- [ ] 看到 toast `Draft #X saved`
- [ ] 切到 Drafts，新 draft 出現

對照 admin：新 request 出現 with status='draft'。

### A4. New Request — Submit

- [ ] 再開 `+ New Request`
- [ ] 填 title：`Test submit 1`、urgency = 1 Week、experiment = HAST、wafer = `W-TEST-02` 300mm
- [ ] 點 **Submit Request**
- [ ] 看到 toast `Request #X submitted`
- [ ] 切到 My Requests，新 request 出現 with status = Submitted

對照 admin：新 request status='pending_approval'，有 submitted_at 時戳。

### A5. Request Detail — Cancel own request

- [ ] 在 My Requests 點剛剛 submit 的那筆
- [ ] Detail 頁看到：4-metric grid、approval log（目前空）、wafer phases、note
- [ ] 點 **Cancel Request** → 填理由 `No longer needed`
- [ ] 看 status 改為 Cancelled

對照 admin：status='cancelled'，note 末尾有 `[Cancelled] No longer needed`。

### A6. 看 returned request 編輯

- [ ] My Requests 切到 Returned tab
- [ ] 點 `TCT 0517003`（return 那筆）
- [ ] Detail 看 history：return reason 顯示 `Recipe spec missing`
- [ ] 點 Continue editing → 進到 New Request 編輯模式
- [ ] 改點什麼 → Submit 再送一次（如果想看 flow）

---

## 二、Lab Staff 流程

登出再登入 `lab_staff` / `demo1234`。

### B1. Dashboard 看 lab 全貌

- [ ] 4 個 tile counts 顯示真實數字（Incoming / Active WIPs / Dispatches live / To record）
- [ ] Recent activity 雖然空但不會崩

### B2. Samples 列表 + receive 流程

- [ ] 切到 Samples，All tab 看到 9 筆 sample
- [ ] Incoming tab 看到 status='shipped' 的 sample（如果 seed 有 ship 過的話 — A3/A4 後面沒 ship，所以這個 tab 可能空）

**先跑一輪 ship**（簡化作法：去 admin 把某 request 的 status 改成 `sample_shipped`）：
1. admin 開 `r3` 那筆（TCT 0518002）
2. 雖然她已經 in_progress，我們改一個別的：開 `r2`（TCT 0519001 pending）
3. 用 SPA 切回 lab_manager → All Requests → r2 → Approve
4. 再切回 fab_user → My Requests → r2 → Ship
5. 切回 lab_staff → Samples → Incoming tab 看到 r2 的兩 wafer

或者更暴力，直接 admin 把 sample status 改成 `shipped`。

- [ ] 對某個 incoming sample 點 **Receive** → POST `/api/samples/:id/receive` 200 → Incoming -1, Received +1
- [ ] 對另一個點 **Reject Receiving** → 填理由 → Rejected +1
- [ ] 對 received sample 點 **Void** → 看 status 改變
- [ ] 對 received sample 點 **Return** → 看 status 改變

### B3. WIP 創建（Modal A）

- [ ] 確保至少有 2 筆 received status 的 sample（其 request 含 TCT experiment）
- [ ] 切到 WIP 列表
- [ ] 點 `+ New WIP`
- [ ] 選 Experiment Type = TCT
- [ ] 看 caption：`Max 6 wafers — largest capable equipment is QA-TCT-01 (capacity 6)`
- [ ] 看 wafer list 只顯示有 TCT 需求 + received + 沒在 WIP 的
- [ ] 勾兩片 wafer
- [ ] 試勾第 7 片（如果有那麼多）→ checkbox disabled
- [ ] 填 note `Smoke test WIP`
- [ ] Create → 成功 toast → 自動跳到新 WIP detail

對照 admin: `http://localhost:8000/admin/wip/wip/` 看新 WIP 有 experiment_type + 2 個 sample 關聯。

### B4. WIP Detail — 看細節

- [ ] header: `WIP-NNNN` + Status pill + experiment chip
- [ ] Samples table 列 2 筆 wafer
- [ ] Dispatches table 目前空
- [ ] Complete / Abort 按鈕看得到

### B5. Add Dispatch（Modal B）+ 20-second demo

- [ ] 點 `+ Add Dispatch`
- [ ] header 鎖定 `WIP-NNNN · 2 samples · Temperature Cycling Test`
- [ ] Equipment 下拉只有 capability 含 TCT 的（QA-TCT-01 / QA-TCT-02）
- [ ] 選 QA-TCT-01
- [ ] Recipe 下拉只有 experiment_type=TCT 的（兩個 TCT recipe）
- [ ] 選 `TCT_Standard_500_v1`
- [ ] Recipe parameters preview 展開：cycles=500, t_min=-55°C, ...
- [ ] 點 **`[20s — demo]`** chip → 欄位填入 20
- [ ] 填 note `Demo run`
- [ ] Create → 成功 → modal 關閉 → WIP detail dispatches table 多一筆 DP-NNNN
- [ ] 點進新 DP detail
- [ ] 點 **Start Running**
- [ ] **看 countdown bar 從 100% 開始倒退走**（每秒會跳一次）
- [ ] 20 秒內 bar 走到 0%（你可以等也可以不等）

### B6. Dispatch Lifecycle 全 7 個 action

對同一個 dispatch（或多開幾個 dispatch 個別 demo）：

- [ ] **Unload** → status 從 Running 改成 Unloaded
- [ ] **Record Result** → modal 填 summary、verdict=pass、data（可空）→ Submit → 看到 Recorded Result card
- [ ] **Complete** → 看 completed_at 時戳
- [ ] **Report Exception** → status → execution_exception
- [ ] **Redispatch** → 看新一筆 DP-NNNN 出現（estimated_duration 繼承）
- [ ] **Abort** → status → aborted

把所有 7 個都 demo 過一遍（每個 dispatch 只能走某些 transition，可能需要多開幾個 dispatch）。

### B7. Complete / Abort WIP

- [ ] 等所有 dispatch 都在 terminal state 後
- [ ] 回到 WIP detail
- [ ] **Complete** → confirm → WIP status → completed
- [ ] 或者另開一個 WIP 走 **Abort** → status → aborted

對照 admin: WIP completed_at 有時戳；對應 sample status → completed。

### B8. Equipment 列表

- [ ] 切到 Equipment
- [ ] 看到 5 台 equipment
- [ ] Status tabs：All 5 / Idle 4 / Maintenance 1
- [ ] capability chips 顯示正確
- [ ] parameters JSON 為空（seed 沒填）
- [ ] `+ Add Equipment` 按鈕**不可見**（只有 manager 才能看到）

---

## 三、Lab Manager 流程

登出再登入 `lab_manager` / `demo1234`。

### C1. Dashboard 看全局

- [ ] 4 個 tile counts 顯示
- [ ] Awaiting your Response 列出 pending_approval request
- [ ] Trend chart 顯示「Last 30 days」（30 個 daily 點）

### C2. All Requests — 簽核三種狀態

- [ ] 切到 All Requests，Pending Approval tab 看到 r1, r2（如果 r2 還沒 approve 過的話）
- [ ] 點 r1（HAST 0520001）
- [ ] **Approve** → confirm → status → in_progress → history 顯示 APPROVE
- [ ] 切回列表，All tab，點 r2（TCT 0519001）— 注意這條 seed 是 pending_approval，但你可能在 B 步驟已經 approve 過
- [ ] 找另一條 pending 的 → **Return** → 填理由 `Please add more wafers` → status → returned
- [ ] 另一條 pending → **Reject** → 填理由 `Out of scope` → status → rejected

對照 admin：`apps/commissions/approvallog/` 看 history。

### C3. Recipes — 新增 / 編輯 / 刪除（Modal C）

- [ ] 切到 Recipes，看到 5 個 recipe
- [ ] 點 `+ New Recipe`
- [ ] 填 name=`TCT_Custom_300`、experiment=TCT
- [ ] 看到 dynamic parameters：cycles / t_min / t_max / dwell / ramp（依 RECIPE_PARAM_SCHEMA）
- [ ] 填值 → Create → 成功 toast → 列表多一筆
- [ ] 對新 recipe 點 **Edit** → 改 name → Save → 列表更新
- [ ] 對新 recipe 點 **Delete** → confirm → 列表少一筆

對照 admin: `equipment/recipe/` 看 is_active=False（soft delete）。

### C4. Equipment — 新增 / 編輯（Modal D）

- [ ] 切到 Equipment（manager view）
- [ ] 點 `+ Add Equipment`
- [ ] 填 name=`QA-DEMO-01`、model=`Demo Machine X1`、capacity=8、status=Available
- [ ] 勾 capability：TCT + HAST
- [ ] 填 parameters JSON：`{"max_temp_c": 200, "allows_ramp_override": true}`
- [ ] Create → 列表多一筆
- [ ] 對新 equipment 點 Edit → 改 status = Maintenance → 看 maintenance tab 數量 +1
- [ ] Edit → 改 capabilities（去掉 HAST）→ 看 chips 更新

對照 admin: `equipment/equipment/` 看 parameters 存進去 + capabilities through-table。

### C5. Reports

- [ ] 切到 Reports
- [ ] Equipment Utilization：start=2026-05-01, end=2026-05-31 → Generate → 看到結果
- [ ] Request Statistics：相同 range → Generate → 看到 status_distribution + total + avg_tat

### C6. Manager Dashboard

- [ ] 切回 Dashboard（Manager 版）
- [ ] 4 tiles 顯示真實數
- [ ] Trend chart 顯示 30 天的 daily counts
- [ ] Awaiting your Response 列出 pending requests，點 Respond 跳到 detail

---

## 四、End-to-end happy path（最重要的 demo 串）

新開一個情境：從零跑一條完整流程。

1. 登入 `fab_user` → 新 request title=`E2E Demo TCT`, TCT, 2 wafers → Submit
2. 登入 `lab_manager` → All Requests → Approve 該 request
3. 登入 `fab_user` → My Requests → 該 request → **Ship**
4. 登入 `lab_staff` → Samples → 兩個 wafer 都 Receive
5. → WIP 列表 → `+ New WIP` → 選 TCT + 兩 wafer → Create
6. → WIP detail → `+ Add Dispatch` → 選 QA-TCT-01 + recipe + `[20s — demo]` → Create
7. → Dispatch detail → Start → 等 20 秒看 bar → Unload → Record Result (pass) → Complete
8. → 回 WIP detail → Complete WIP
9. 登入 `fab_user` → Dashboard 看 In Progress -1 / Completed +1

✅ 這條全程順走完，整個系統就驗證可用。

---

## 五、後台檢查清單（admin 端對照）

每跑完一個操作可以對 admin 確認：

| SPA 操作 | Admin 應該看到 |
|---|---|
| fab Submit | Request status='pending_approval' + submitted_at 有時戳 |
| manager Approve | Request status='approved' + ApprovalLog 多一筆 action='approve' |
| manager Return | Request status='returned' + ApprovalLog 有 comment |
| fab Ship | Request status='sample_shipped' + 所有 sample status='shipped' |
| lab Receive | Sample status='received' + received_at 有時戳 |
| lab Create WIP | WIP record + WIPSample through-table 多筆 |
| lab Create Dispatch | Dispatch record + estimated_duration_seconds（如果有填）|
| lab Start Dispatch | Dispatch status='running' + dispatched_at 有時戳 |
| lab Record Result | ExperimentResult record + Dispatch status='result_recorded' |
| lab Complete Dispatch | Dispatch status='completed' + completed_at |
| lab Complete WIP | WIP status='completed' + 對應 sample status 自動 → completed |

---

## 六、Known limitations（看到不要慌）

1. **Recent Activity 是空的** — 沒做 activity feed endpoint
2. **WIP creation modal 對 received samples 用 N+1 fetch** — 暫解，未來 RequestListOut 帶 experiment_type_ids 就可省掉
3. **Manager Dashboard utilization line 是 smoothed multiplier** — 不是真實 per-day utilization
4. **Manager Reports 沒有 CSV export** — 沒做

這些都記在 `INTEGRATION_GAPS.md`，下一輪 PR 處理。

---

## 七、Bug 回報模板

跑到任何不對的就用這個 format 給我（避免 ping-pong）：

```
頁面: [Fab Dashboard / Lab Samples / ...]
操作: 點 X 按鈕 / 填 Y 欄位 / 切到 Z tab
預期: 應該看到 ...
實際: 看到 ... / 跳 error ... / 沒反應
DevTools console: [貼 error]
runserver log: [貼最後幾行]
admin 看到: [貼相關 model 狀態]
```

