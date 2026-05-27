# 實作計畫 (Implementation Plan)

> 基於 DESIGN.md，按 TDD 流程與依賴順序規劃。
> 每個任務狀態：`[ ]` 待開始 / `[~]` 進行中 / `[x]` 已完成 / `[-]` 跳過

---

## Phase 0：專案基礎建設

### 0.1 測試環境設定
- [x] 安裝 pytest、pytest-django、factory-boy
- [x] 建立 `pytest.ini` / `conftest.py`
- [x] 確認 `uv run pytest` 可正常執行

### 0.2 Django Apps 建立
- [x] 建立 `apps/accounts`
- [x] 建立 `apps/experiments`
- [x] 建立 `apps/equipment`
- [x] 建立 `apps/commissions`
- [x] 建立 `apps/wip`
- [x] 建立 `apps/reports`
- [x] 在 `settings.py` 註冊所有 apps
- [x] 確認 `uv run python manage.py check` 通過

### 0.3 API Router 骨架
- [x] 重構 `api/router.py`，預註冊所有 sub-routers
- [-] 各 app 建立空的 `api.py` + `router`（隨各 Phase 逐步建立）
- [x] 確認 `/api/docs` 可正常開啟

**依賴：無**

---

## Phase 1：accounts（使用者與角色）

> 依賴：無

### 1.1 Model
- [x] 定義 `UserProfile` model（role, department）
- [x] 定義 `Role` enum（fab_user, lab_staff, lab_manager）
- [x] 執行 migration

### 1.2 Model Tests
- [x] 測試 UserProfile 建立與 OneToOne 關聯
- [x] 測試 Role choices 正確性

### 1.3 Schema
- [x] `UserOut` schema
- [x] `LoginIn` schema

### 1.4 API Tests
- [x] `POST /api/auth/login` — 登入成功/失敗
- [x] `POST /api/auth/logout` — 登出
- [x] `GET /api/auth/me` — 取得當前使用者與角色

### 1.5 API 實作
- [x] 實作 auth router endpoints
- [x] 所有測試 green

### 1.6 測試輔助工具
- [x] 建立 `UserFactory`（含各角色的 factory）
- [-] 建立認證用的 test helper（模擬各角色登入）（各 Phase 用 `client.force_login()` 即可）

---

## Phase 2：experiments（實驗項目）

> 依賴：Phase 1（需要角色權限驗證）

### 2.1 Model
- [x] 定義 `ExperimentType` model
- [x] 定義 `LabCategory` enum（RA, MA, FA, TM）
- [x] 執行 migration

### 2.2 Model Tests
- [x] 測試建立 ExperimentType
- [x] 測試 name unique 約束
- [x] 測試軟刪除（is_active = False）

### 2.3 Schema
- [x] `ExperimentTypeIn` schema（POST/PATCH input）
- [x] `ExperimentTypeOut` schema（response）

### 2.4 API Tests
- [x] `GET /api/experiment-types/` — 列表、搜尋、篩選
- [x] `POST /api/experiment-types/` — 新增（Lab Staff 可，Fab User 不可）
- [x] `GET /api/experiment-types/{id}` — 詳情
- [x] `PATCH /api/experiment-types/{id}` — 修改
- [x] `DELETE /api/experiment-types/{id}` — 軟刪除
- [x] 權限驗證：Fab User 只能 GET，不能 CUD

### 2.5 API 實作
- [x] 實作 experiment-types router
- [x] 所有測試 green

### 2.6 Factory
- [x] 建立 `ExperimentTypeFactory`

### 2.7 Admin（django-unfold UI）
- [x] 設定 `ExperimentTypeAdmin`（支援搜尋、篩選、列表顯示）
- [x] 修正 `UserAdmin` 與 Unfold 的相容性（新增 User 按鈕）

---

## Phase 3：equipment（機台與 Recipe）

> 依賴：Phase 2（Recipe 關聯 ExperimentType；EquipmentCapability 關聯 ExperimentType）

### 3.1 Equipment Model
- [x] 定義 `Equipment` model（name, model_name, capacity, status）
- [x] 定義 `EquipmentStatus` enum
- [x] 定義 `EquipmentCapability` through model
- [x] 執行 migration

### 3.2 Equipment Model Tests
- [x] 測試建立 Equipment
- [x] 測試 capacity 正整數約束
- [x] 測試 EquipmentCapability 多對多關聯
- [x] 測試 EquipmentCapability unique_together 約束

### 3.3 Recipe Model
- [x] 定義 `Recipe` model（name, parameters JSONField, equipment FK, experiment_type FK）
- [x] 執行 migration

### 3.4 Recipe Model Tests
- [x] 測試建立 Recipe
- [x] 測試 Recipe 與 Equipment、ExperimentType 的 FK 關聯
- [x] 測試軟刪除（is_active = False）
- [x] 測試 parameters JSONField 讀寫

### 3.5 Schema
- [x] `EquipmentIn` / `EquipmentOut` schema
- [x] `RecipeIn` / `RecipeOut` schema

### 3.6 Equipment API Tests
- [x] `GET /api/equipment/` — 列表
- [x] `POST /api/equipment/` — 新增（含 capability_ids）
- [x] `GET /api/equipment/{id}` — 詳情（含 capabilities, recipes）
- [x] `PATCH /api/equipment/{id}` — 修改
- [x] `POST /api/equipment/{id}/capabilities` — 設定機台能力
- [x] 權限驗證：Fab User 無存取權

### 3.7 Recipe API Tests
- [x] `GET /api/recipes/` — 列表（按 equipment_id, experiment_type_id 篩選）
- [x] `POST /api/recipes/` — 新增（驗證 equipment + experiment_type 有效組合）
- [x] `GET /api/recipes/{id}` — 詳情
- [x] `PATCH /api/recipes/{id}` — 修改
- [x] `DELETE /api/recipes/{id}` — 軟刪除
- [x] 權限驗證：Fab User 無存取權

### 3.8 API 實作
- [x] 實作 equipment router
- [x] 實作 recipe router
- [x] 所有測試 green

### 3.9 Factory
- [x] 建立 `EquipmentFactory`（含 capability 設定）
- [x] 建立 `RecipeFactory`

### 3.10 Admin（django-unfold UI）
- [x] 設定 `EquipmentAdmin`（含 `EquipmentCapabilityInline`、支援搜尋與篩選）
- [x] 設定 `RecipeAdmin`（支援搜尋、is_active 篩選）

---

## Phase 4：commissions（委託單與樣品）

> 依賴：Phase 1（requester FK）、Phase 2（experiment_types M2M）

### 4.1 Request Model
- [x] 定義 `RequestStatus` enum（11 個狀態）
- [x] 定義 `Request` model
- [x] 定義 `RequestExperiment` through model
- [x] 執行 migration

### 4.2 Request Model Tests
- [x] 測試建立 Request（草稿）
- [x] 測試 RequestExperiment M2M with parameters
- [x] 測試 status 預設為 draft

### 4.3 Sample Model
- [x] 定義 `SampleStatus` enum（10 個狀態，含 `lost`）
- [x] 定義 `WaferSize` enum
- [x] 定義 `Sample` model
- [x] 定義 `ApprovalLog` model
- [x] 執行 migration

### 4.4 Sample Model Tests
- [x] 測試建立 Sample
- [x] 測試 wafer_id + request unique_together 約束
- [x] 測試 WaferSize choices
- [x] 測試 ApprovalLog 建立與排序

### 4.5 狀態機邏輯
- [x] 實作 Request 狀態轉移驗證方法
- [x] 實作 Sample 狀態轉移驗證方法

### 4.6 狀態機 Tests
- [x] 測試 Request 合法狀態轉移（draft → pending_approval → approved → ...）
- [x] 測試 Request 非法狀態轉移（e.g. draft → in_progress 應拒絕）
- [x] 測試 Sample 合法狀態轉移
- [x] 測試 Sample 非法狀態轉移
- [-] 測試 submit 時自動建立 Sample entity（設計調整：Sample 在建立委託單時即建立，非送出時）
- [x] 測試所有樣品接收後 Request 自動轉 in_progress（在 tests_api.py 的 TestSampleReceive 中覆蓋）

### 4.7 Schema
- [x] `RequestIn` / `RequestOut` schema（含巢狀 samples, experiment_types）
- [x] `RequestUpdateIn` schema（草稿/退回狀態修改用）
- [x] `SampleOut` schema
- [x] `ApprovalIn` / `ApprovalOut` schema

### 4.8 Request API Tests
- [x] `GET /api/requests/` — 列表（Fab User 只看自己的）
- [x] `POST /api/requests/` — 建立草稿
- [x] `GET /api/requests/{id}` — 詳情（含 samples, approval_logs）
- [x] `PATCH /api/requests/{id}` — 修改（僅 draft/returned）
- [x] `POST /api/requests/{id}/submit` — 送出
- [x] `POST /api/requests/{id}/approve` — 核准
- [x] `POST /api/requests/{id}/return` — 退回（需 comment）
- [x] `POST /api/requests/{id}/reject` — 拒絕（需 comment）
- [x] `POST /api/requests/{id}/ship` — 送樣
- [x] `POST /api/requests/{id}/cancel` — 取消（需 reason）
- [x] `POST /api/requests/{id}/close` — 結單
- [x] 權限驗證：各操作的角色限制

### 4.9 Sample API Tests
- [x] `GET /api/samples/` — 列表（按 request_id, status 篩選）
- [x] `GET /api/samples/{id}` — 詳情（含所屬委託單資訊）
- [x] `POST /api/samples/{id}/receive` — 確認接樣
- [x] `POST /api/samples/{id}/reject-receiving` — 料不符
- [x] `POST /api/samples/{id}/report-lost` — 送樣遺失
- [x] `POST /api/samples/{id}/void` — 作廢
- [x] `POST /api/samples/{id}/return` — 退回

### 4.10 API 實作
- [x] 實作 requests router（含所有 action endpoints）
- [x] 實作 samples router
- [x] 所有測試 green

### 4.11 Factory
- [x] 建立 `RequestFactory`
- [x] 建立 `SampleFactory`
- [x] 建立 `ApprovalLogFactory`（含 `RequestExperimentFactory`）

### 4.12 Admin（django-unfold UI）
- [x] 設定 `RequestAdmin`（含 `RequestExperimentInline`、`SampleInline`、`ApprovalLogInline`）
- [x] 設定 `SampleAdmin`（支援搜尋、status/wafer_size 篩選）
- [x] 設定 `ApprovalLogAdmin`（唯讀，禁止新增/修改）

---

## Phase 5：wip（WIP、派貨與實驗結果）

> 依賴：Phase 3（equipment, recipe FK）、Phase 4（sample OneToOne）

### 5.1 WIP Model
- [x] 定義 `WIPStatus` enum（4 個狀態：created, in_progress, completed, aborted）
- [x] 定義 `WIP` model（sample OneToOneField）
- [x] 執行 migration

### 5.2 WIP Model Tests
- [x] 測試建立 WIP
- [x] 測試 WIP 與 Sample 的 OneToOne 關聯
- [x] 測試同一 Sample 不可建立多個 WIP（unique 約束）

### 5.3 Dispatch Model
- [x] 定義 `DispatchStatus` enum（9 個狀態）
- [x] 定義 `Dispatch` model（wip FK, experiment_type FK, equipment FK, recipe FK）
- [x] 執行 migration

### 5.4 Dispatch Model Tests
- [x] 測試建立 Dispatch
- [x] 測試 Dispatch 與 WIP、ExperimentType、Equipment、Recipe 的 FK 關聯
- [x] 測試同一 WIP 可建立多個 Dispatch（不同實驗項目）

### 5.5 ExperimentResult Model
- [x] 定義 `ExperimentResult` model
- [x] 定義 `DataSource` / `Verdict` enum
- [x] 執行 migration

### 5.6 ExperimentResult Model Tests
- [x] 測試建立 ExperimentResult
- [x] 測試 OneToOne with Dispatch
- [x] 測試 data JSONField 讀寫

### 5.7 狀態機邏輯
- [x] 實作 WIP 狀態轉移驗證方法
- [x] 實作 Dispatch 狀態轉移驗證方法
- [x] 實作派貨驗證（機台能力、recipe 歸屬檢查）
- [x] 實作狀態聯動邏輯（WIP 完成 → Sample 完成 → Request 完成；WIP 中止 → Sample 異常）

### 5.8 狀態機 Tests
- [x] 測試 WIP 合法狀態轉移（created → in_progress → completed）
- [x] 測試 WIP 非法狀態轉移
- [x] 測試 Dispatch 合法狀態轉移（pending → dispatched → running → unloaded → result_recorded → completed）
- [x] 測試 Dispatch 非法狀態轉移
- [x] 測試派貨驗證：機台不支援該實驗項目 → 拒絕
- [x] 測試派貨驗證：recipe 不屬於指定機台 → 拒絕
- [x] 測試狀態聯動：WIP 所有 Dispatch 完成 → WIP 可標記完成
- [x] 測試狀態聯動：WIP 完成 → Sample 自動完成
- [x] 測試狀態聯動：所有 Sample 完成 → Request 自動完成
- [x] 測試狀態聯動：WIP 中止 → Sample 標記處理異常
- [x] 測試異常 → 重派流程
- [x] 測試異常 → 中止流程

### 5.9 Schema
- [x] `WIPIn` / `WIPOut` schema（含巢狀 dispatches）
- [x] `DispatchIn` / `DispatchOut` schema
- [x] `ExperimentResultIn` / `ExperimentResultOut` schema
- [x] `ExceptionReportIn` schema
- [x] `AutomationResultIn` schema

### 5.10 WIP API Tests
- [x] `GET /api/wips/` — 列表（按 status 篩選）
- [x] `POST /api/wips/` — 建立 WIP（分貨，sample_id）
- [x] `GET /api/wips/{id}` — 詳情（含 dispatches 列表）
- [x] `POST /api/wips/{id}/dispatches` — 建立派貨
- [x] `POST /api/wips/{id}/complete` — 完成
- [x] `POST /api/wips/{id}/abort` — 中止
- [x] 權限驗證：Fab User 無存取權

### 5.11 Dispatch API Tests
- [x] `GET /api/dispatches/` — 列表（按 status, equipment_id, wip_id 篩選）
- [x] `GET /api/dispatches/{id}` — 詳情
- [x] `POST /api/dispatches/{id}/start` — 開始執行
- [x] `POST /api/dispatches/{id}/unload` — 下貨
- [x] `POST /api/dispatches/{id}/record-result` — 手動登錄結果
- [x] `POST /api/dispatches/{id}/complete` — 完成
- [x] `POST /api/dispatches/{id}/report-exception` — 回報異常
- [x] `POST /api/dispatches/{id}/redispatch` — 重派
- [x] `POST /api/dispatches/{id}/abort` — 中止
- [x] 權限驗證：Fab User 無存取權

### 5.12 Automation API Tests
- [x] `POST /api/automation/equipment-result` — 自動結單（以 dispatch_id 為單位）
- [x] 測試自動化狀態聯動（Dispatch 完成）
- [x] 測試 data_source 記錄為 automated

### 5.13 API 實作
- [x] 實作 wips router
- [x] 實作 dispatches router
- [x] 實作 automation router
- [x] 所有測試 green

### 5.14 Factory
- [x] 建立 `WIPFactory`
- [x] 建立 `DispatchFactory`
- [x] 建立 `ExperimentResultFactory`

### 5.15 Admin（django-unfold UI）
- [x] 設定 `WIPAdmin`（含 `DispatchInline`、支援搜尋與篩選）
- [x] 設定 `DispatchAdmin`（含 `ExperimentResultInline`、支援多欄位搜尋）
- [x] 設定 `ExperimentResultAdmin`（唯讀，禁止新增/修改）

---

## Phase 6：reports（統計報表）

> 依賴：Phase 4、Phase 5（查詢 Request、WIP 數據）

### 6.1 查詢邏輯
- [x] 實作機台利用率查詢（按時間區間、機台分組統計 Dispatch 數量）
- [x] 實作委託單統計查詢（狀態分佈、平均 TAT）

### 6.2 Schema
- [x] `EquipmentUtilizationOut` schema
- [x] `RequestStatisticsOut` schema

### 6.3 API Tests
- [x] `GET /api/reports/equipment-utilization` — 機台利用率
- [x] `GET /api/reports/request-statistics` — 委託單統計
- [x] 測試時間範圍篩選
- [x] 測試空數據回應
- [x] 權限驗證：僅 Lab Manager

### 6.4 API 實作
- [x] 實作 reports router
- [x] 所有測試 green

### 6.5 Admin（django-unfold UI）
- [x] 建立 `EquipmentUtilizationReport` proxy model（繼承 `Dispatch`）
- [x] 建立 `RequestStatisticsReport` proxy model（繼承 `Request`）
- [x] 設定 `EquipmentUtilizationAdmin`（自訂 changelist view，含日期範圍與機台篩選）
- [x] 設定 `RequestStatisticsAdmin`（自訂 changelist view，含日期範圍、狀態分佈、平均 TAT）
- [x] 兩個 Admin 頁面均唯讀（禁止新增/修改/刪除）

---

## Phase 7：整合測試與收尾

> 依賴：Phase 0–6 全部完成

### 7.1 E2E 流程測試
- [x] 完整流程：開單 → 簽核 → 送樣 → 接樣 → 建立 WIP → 建立 Dispatch → 派貨 → 執行 → 下貨 → 登錄結果 → 完成 Dispatch → 完成 WIP → 完成 Sample → 完成 Request → 結單
- [x] 多實驗流程：一個 WIP 建立多個 Dispatch（不同實驗項目），全部完成後 WIP 完成
- [x] 異常流程：Dispatch 執行 → 異常 → 重派 → 完成
- [x] 送樣遺失流程：送樣 → 標記遺失 → 作廢
- [x] 取消流程：開單 → 簽核 → 取消（驗證連帶中止）
- [x] 自動化流程：Dispatch 派貨 → 機台自動回傳 → 自動結單

### 7.2 覆蓋率驗收
- [x] 執行 `pytest --cov` 確認覆蓋率 ≥ 80%（實際達成 98%）
- [x] 補充不足的測試

### 7.3 文件更新
- [x] 確認 `/api/docs` OpenAPI 文件完整
- [-] 更新 README 使用說明（README 已包含足夠的使用說明，不需要額外更新）

---

## 依賴關係圖

```
Phase 0 (基礎建設)
  │
  ├──→ Phase 1 (accounts)
  │      │
  │      ├──→ Phase 2 (experiments)
  │      │      │
  │      │      ├──→ Phase 3 (equipment + recipe)
  │      │      │      │
  │      │      │      └──→ Phase 5 (wip + dispatch + 實驗結果)
  │      │      │             │
  │      │      │             └──→ Phase 6 (reports)
  │      │      │                    │
  │      ├──→ Phase 4 (commissions)──┘
  │      │      │
  │      │      └──→ Phase 5
  │      │
  └──────┴─────────────────────────→ Phase 7 (整合測試)
```

## 預估工作量

| Phase | 估計任務數 | 核心複雜度 |
|-------|-----------|-----------|
| 0 基礎建設 | 10 | 低 |
| 1 accounts | 10 | 低 |
| 2 experiments | 12 | 低 |
| 3 equipment | 18 | 中 |
| 4 commissions | 29 | 高（狀態機最複雜） |
| 5 wip | 34 | 高（WIP + Dispatch 雙層狀態聯動） |
| 6 reports | 8 | 中 |
| 7 整合測試 | 8 | 中 |
| **合計** | **~129** | |
