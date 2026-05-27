# LIMS 專案進度 + 本地測試指南

_最後更新：2026-05-20 — **SPA wiring 100% 完成**_

---

## 一、目前進度速覽

| 倉庫 | 分支 | 狀態 |
|---|---|---|
| `lims-backend` | `feat/frontend-integration-v2` | 領先 main 約 20 commits；500+ 測試全綠；ruff clean |
| `lims-frontend` | `feat/frontend-integration` | 18 個 commits；**所有頁面與 modal 都已串接真實 API** |

**後端：** 完整還原 chat-design model
- `WIP` 綁定 experiment_type（多 samples）
- `Dispatch` 綁定 equipment + estimated_duration_seconds
- `Recipe` 只跟 experiment_type 綁定
- 新 endpoint: `/samples/:id/experiments`、`/reports/trends`
- `django-cors-headers` gate 在 `DEBUG=True`（DEV 不需要 `--disable-web-security` Chrome flag）

**前端：** 所有頁面與 modal 已串接，每頁有 smoke test 紀錄。

---

## 二、每個頁面狀態 — 全部 ✅

### Fab role

| 頁面 | 操作 |
|---|---|
| Login | JWT login，role-based 路由 |
| Dashboard | tiles + recent + waiting approval |
| My Requests / Drafts | list + urgency / status pills |
| New Request | Save Draft / Submit，picks experiment_types from API |
| Request Detail | 含 approval log，可以 cancel |

### Lab role

| 頁面 | 操作 |
|---|---|
| Dashboard | 4 tile counts 用真實資料 |
| Samples | Receive / Reject / Lost / Void / Return actions |
| WIP list | live list + status filter |
| WIP detail | dispatches table 含 equipment 名稱；Complete / Abort lifecycle |
| **WIP creation modal** | 選 experiment + 多 wafer（已 filter + 容量上限提示） |
| Dispatches list | live + experiment / equipment / operator |
| Dispatch detail | 7 個 lifecycle actions（start / unload / record / complete / exception / redispatch / abort），含 countdown bar |
| **Add Dispatch modal** | 鎖定 header、equipment + recipe filter、recipe params preview、estimated duration + `[20s — demo]` button |
| Equipment | live list + status filter + capability chips（manager 多看到 Add Equipment 按鈕） |

### Manager role（含 lab role 全部）

| 頁面 | 操作 |
|---|---|
| All Requests + detail | Approve / Return (with comment) / Reject (with comment) / Mark Complete |
| Recipes | list + **new / edit / delete modal** |
| Equipment | 共用 Lab Equipment 頁，多 `canManage` flag |
| **Equipment new / edit modal** | name / model / capacity / status / capabilities / parameters（JSON） |
| Reports | Equipment Utilization + Request Statistics，跑日期區間 |
| Dashboard | tiles + trend chart（last 30 days，from /reports/trends） |

**所有 placeholder toast 都已移除。** 整條 dev 路徑沒有「Modal redesign pending」字串了。

---

## 三、本地測試步驟

### 前置作業（只做一次）

```bash
cd ~/Documents/GitHub/lims-backend
git checkout feat/frontend-integration-v2
uv sync
cp .env.example .env
echo "DJANGO_SECRET_KEY=$(uv run python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')" >> .env
uv run python manage.py migrate
```

### 建立帳號 + 種子資料

帳號：
```bash
uv run python manage.py shell -c "
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile, Role
for username, role, dept in [
    ('fab_user', Role.FAB_USER, 'Fab QA'),
    ('lab_staff', Role.LAB_STAFF, 'Lab Operations'),
    ('lab_manager', Role.LAB_MANAGER, 'Lab Operations'),
]:
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('demo1234'); u.save()
    UserProfile.objects.update_or_create(user=u, defaults={'role': role, 'department': dept})
"
```

種子資料同前次（4 samples + 2 requests + experiment_types）— 略，見前版本。

### 每次測試啟動

Terminal A — 後端：
```bash
cd ~/Documents/GitHub/lims-backend
uv run python manage.py runserver
```

Terminal B — 前端：
```bash
cd ~/Documents/GitHub/lims-frontend
python3 -m http.server 8080
```

Terminal C — 瀏覽器（**一般 Chrome 就好，不需要 disable-web-security**，因為 CORS 已 gate 在 DEBUG）：
```bash
open "http://localhost:8080/LIMS_0-8-1.dev.html"
```

如果 dev HTML 還沒有指向 localhost，編輯 `LIMS_0-8-1.dev.html` 約 737 行：
```html
<script>window.LIMS_API_BASE = 'http://localhost:8000/api';</script>
```

---

## 四、Demo 路徑

### 20-second 倒數演示（這條 PR 最大賣點）

1. 登入 `lab_staff` / `demo1234`
2. **Samples** → 選一筆 status `shipped` → Receive
3. **WIP** → `+ New WIP` → 選 TCT、勾兩片 wafer → Create
4. 跳到 WIP detail → `+ Add Dispatch`
5. 選 equipment、選 recipe（看 parameters preview 展開）
6. 點 `[20s — demo]` chip → estimated duration 自動 20
7. Create → 跳到 Dispatch 列表
8. 點開新 dispatch → **Start Running**
9. **看 countdown bar 在 20 秒內走完整條**（11% → 35% → 100%）
10. → Unload → Record Result（填 verdict=pass） → Complete

### Manager 簽核流程

1. 登入 `lab_manager` / `demo1234`
2. **All Requests** → Pending Approval tab
3. 點一筆 → Approve（直接 confirm）/ Return（要 comment）/ Reject（要 comment）
4. 看 approval log 即時更新

### Recipe + Equipment 管理流程

1. 登入 `lab_manager`
2. **Recipes** → `+ New Recipe` → 選 TCT → 填 cycles=500, t_min=-55°C 等 → Create
3. **Equipment** → `+ Add Equipment` → 填 capacity + capabilities + parameters JSON → Create

---

## 五、PR 準備清單

### 後端 (`feat/frontend-integration-v2`)

✅ 跑完 ruff + pytest 全綠
✅ 所有 commit messages 符合 conventional commit
✅ migrations 完整、data-preserving
✅ chat-design model 完整重建
✅ 新 endpoints 都有測試
✅ CORS DEBUG-gated（生產不影響）

**準備事項：**
- [ ] 確認分支推到 `c-cf/lims-backend` remote
- [ ] 寫 PR description（總結 20 個 commits 的故事）
- [ ] 決定要不要 squash merge（看團隊習慣）

### 前端 (`feat/frontend-integration`)

✅ 所有頁面 + modal 都串接 live API
✅ smoke-tested per commit
✅ `src/api.js` adapter 完整、命名一致（camelCase out）
✅ formatDuration helper 集中在 `window.UI`
✅ CLAUDE.md + CLAUDE.local.md 完備

**準備事項：**
- [ ] 決定 frontend repo 要不要推 remote（之前只有本地 init）
- [ ] 寫 PR description（如果有 remote 的話）
- [ ] 決定生產 deploy 策略：要 serve 在後端同 origin（不需 CORS）還是獨立 host（需要把 production origin 加進 CORS_ALLOWED_ORIGINS）

---

## 六、目前已知小限制（不阻擋 merge）

1. **WIP creation modal 需要 N+1 fetch**（gap §3.7） — RequestListOut 沒帶 experiment_type_ids，前端要 per-request 多打 detail。未來可在 RequestListOut 加 `experiment_type_ids: list[int]`，省掉這些 round trip。
2. **Manager Dashboard utilization line 是 smoothed multiplier placeholder** — 不是真實 per-day utilization。需要新後端 endpoint 才能換真資料。
3. **Manager Reports 沒有 export 按鈕** — chat history 沒提；前端 UI 也沒做。如果需要 CSV export 屬於 nice-to-have。
4. **沒有 activity feed** — Dashboard 的 Recent Activity 還是空。需要 `/activity/?limit=20` endpoint，現在沒做。

這四條都記在 `INTEGRATION_GAPS.md` 對應 section，下個 PR 再處理。

---

## 七、Demo 用 standalone 版（不開後端）

```bash
open ~/Documents/GitHub/lims-frontend/LIMS_0-8-1.html
```

單檔 standalone，offline demo accounts。沒有真實 backend、所有資料是 mock，純看設計。

獨立帳號（這個版本用）：
- `fab_user` / `mcv8uPKSvqz8Yru`
- `lab_member` / `t26fnPyedon6aFz`
- `lab_manager` / `q4gXk7vEt2RNw9p`
