# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用指令

```bash
# 安裝依賴
uv sync

# 執行所有測試
uv run pytest

# 執行單一測試檔案
uv run pytest apps/accounts/tests.py

# 執行單一測試函式
uv run pytest apps/accounts/tests.py::TestUserProfile::test_create_user_profile

# Lint 檢查
uv run ruff check .

# 自動修正 Lint 問題
uv run ruff check --fix .

# 格式化代碼
uv run ruff format .

# 執行資料庫遷移
uv run python manage.py migrate

# 建立新的 migration
uv run python manage.py makemigrations

# 啟動開發伺服器
uv run python manage.py runserver

# 生成 SECRET_KEY
uv run python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

## 架構概覽

### 技術棧

- Django 6.0.3 + Django Ninja 1.6.2（REST API）
- Python 3.12+，使用 `uv` 管理套件
- 測試：pytest-django + factory-boy
- Lint/格式化：Ruff（line-length=88，target Python 3.12）

### 專案佈局

```
config/settings.py      # Django 設定（從環境變數讀取 SECRET_KEY）
api/router.py           # NinjaAPI 實例，目前只有 /health 端點
apps/
  accounts/             # UserProfile + Role enum（fab_user / lab_staff / lab_manager）
  experiments/          # ExperimentType + LabCategory enum（RA / MA / FA / TM）
  equipment/            # Equipment、EquipmentCapability（M2M through）、Recipe
  commissions/          # Request、Sample、RequestExperiment（through）、ApprovalLog — 核心業務
  wip/                  # WIP、Dispatch、ExperimentResult
  reports/              # 純查詢，無 Model
prds/                   # 需求與設計文件
```

### 核心業務流程

委託單生命週期（Request.status）：
`draft → pending_approval → approved → sample_shipped → in_progress → completed → closed`（另有 `returned`、`rejected`、`exception`、`cancelled`）

樣品狀態（Sample.status）：
`created → shipped → received → split → completed / voided`（另有 `receiving_exception`、`lost`、`processing_exception`、`returned`）

WIP 狀態（WIP.status）：
`created → in_progress → completed / aborted`

Dispatch 狀態（Dispatch.status）：
`pending → dispatched → running → unloaded → result_recorded → completed`（另有 `execution_exception → pending_redispatch / aborted`）

### Django Ninja API 約定

新增 API 端點時：
1. 在對應 app 建立 `schemas.py`（定義 Schema）和 `api.py`（定義 endpoint 函式）
2. 在 `api/router.py` 的 `NinjaAPI` 實例上用 `api.add_router()` 掛載
3. Schema 命名：輸入用 `XxxIn`，輸出用 `XxxOut`，更新用 `XxxUpdate`

**禁止使用 `ninja.responses.Status` 作為回傳值。** `Status()` 會跳過 Django Ninja 的 Schema（Pydantic）驗證，等於繞過了型別安全保障。正確做法是回傳 `(status_code, dict)` tuple，讓 Ninja 自動通過 response schema 驗證資料。

### Commit 前必須執行的檢查（強制）

每次 commit 前 **必須** 依序通過以下檢查，任一失敗不得 commit：
```bash
uv run ruff check .          # lint 檢查
uv run ruff format --check . # 格式檢查
uv run pytest                # 測試
```

### TDD 工作流（強制）

1. 先寫失敗測試（RED）
2. 寫最少代碼通過測試（GREEN）
3. 重構（IMPROVE）
4. 測試覆蓋率需達 80%+

測試檔案放在各 app 的 `tests.py`（或拆分為 `tests/` 目錄）。

### 模型設計慣例

- 狀態欄位使用 `TextChoices` enum（參考 `RequestStatus`、`SampleStatus`、`WIPStatus`）
- 多對多需要額外欄位時使用 through model（`RequestExperiment`、`EquipmentCapability`）
- 一對一關聯：`WIP ↔ Sample`（1 樣品 = 1 WIP）、`ExperimentResult ↔ Dispatch`
- 彈性參數使用 `JSONField`（`Recipe.parameters`、`RequestExperiment.parameters`、`ExperimentResult.data`）
- 軟刪除使用 `is_active = BooleanField(default=True)`
- `Meta.db_table` 使用 snake_case 明確命名資料表

### 環境設定

複製 `.env.example` 為 `.env`，填入：
```
DJANGO_SECRET_KEY=<generated key>
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```
