# LIMS Backend — 雲原生實驗室資訊管理系統

實驗室資訊管理系統（LIMS）的後端服務，用於管理委託單全生命週期、樣品追蹤、機台資源及實驗結果。

## 技術棧

- **Python** 3.12+
- **Django** 6.0.3
- **Django Ninja** 1.6.2（REST API 框架）
- **SQLite**（開發） / **PostgreSQL**（生產）
- **pytest + pytest-django + factory-boy**（測試）
- **Ruff**（Lint 與格式化）
- **uv**（套件管理）

## 快速開始

```bash
# 安裝依賴
uv sync

# 複製環境變數
cp .env.example .env

# 執行資料庫遷移
uv run python manage.py migrate

# 啟動開發伺服器
uv run python manage.py runserver
```

API 互動文件（OpenAPI）：`http://localhost:8000/api/docs`

## 專案結構

```
lims-backend/
├── apps/
│   ├── accounts/       # 使用者與角色管理
│   ├── experiments/    # 實驗項目管理
│   ├── equipment/      # 機台與 Recipe 管理
│   ├── commissions/    # 委託單與樣品（核心業務流程）
│   ├── wip/            # WIP、派貨與實驗結果
│   └── reports/        # 統計報表（純查詢，無 Model）
├── api/
│   └── router.py       # NinjaAPI 實例與路由註冊
├── config/
│   └── settings.py     # Django 設定
├── prds/               # 需求文件（PRD、設計文件、實作計畫）
├── pyproject.toml
└── manage.py
```

## 業務流程概覽

系統涵蓋以下完整的實驗室業務流程：

```
開立委託單 → 送出簽核 → 主管核准 → 送樣 → 接樣 → 分貨 → WIP 派貨 → 實驗執行 → 登錄結果 → 結單
```

### 使用者角色

| 角色 | 說明 |
|------|------|
| **廠區使用者 (Fab User)** | 開立委託單、送樣、追蹤結果 |
| **實驗室人員 (Lab Staff)** | 接樣、分貨、派貨、登錄實驗結果 |
| **實驗室主管 (Lab Manager)** | 簽核委託單、監控機台、查看統計報表 |

## API 端點

| 功能 | 路由 |
|------|------|
| 認證 | `/api/auth/` |
| 實驗項目 | `/api/experiment-types/` |
| 機台管理 | `/api/equipment/` |
| Recipe | `/api/recipes/` |
| 委託單 | `/api/requests/` |
| 樣品 | `/api/samples/` |
| WIP | `/api/wips/` |
| 自動化（機台回傳） | `/api/automation/` |
| 統計報表 | `/api/reports/` |

## 開發

### 執行測試

```bash
uv run pytest
```

### 執行 Lint 與格式化

```bash
uv run ruff check .
uv run ruff format .
```

### 安裝 pre-commit hooks

```bash
uv run pre-commit install
```

## 文件

| 文件 | 位置 | 說明 |
|------|------|------|
| 產品需求文件 | [`prds/PRD.md`](prds/PRD.md) | 業務需求、User Stories、驗收條件 |
| 技術設計文件 | [`prds/DESIGN.md`](prds/DESIGN.md) | DB Schema、API 設計、狀態機 |
| 實作計畫 | [`prds/IMPLEMENTATION_PLAN.md`](prds/IMPLEMENTATION_PLAN.md) | 7 Phase 開發計畫與依賴關係 |
| 貢獻指南 | [`CONTRIBUTING.md`](CONTRIBUTING.md) | TDD 流程、代碼風格、Git 工作流 |

## 開發進度

| Phase | 內容 | 狀態 |
|-------|------|------|
| Phase 0 | 基礎建設（Django 設定、CI、Lint） | 完成 ✓ |
| Phase 1 | accounts — 使用者與角色 | 完成 ✓ |
| Phase 2 | experiments — 實驗項目 | 完成 ✓ |
| Phase 3 | equipment — 機台與 Recipe | 完成 ✓ |
| Phase 4 | commissions — 委託單與樣品 | 完成 ✓ |
| Phase 5 | wip — WIP 派貨與結單 | 完成 ✓ |
| Phase 6 | reports — 統計報表 | 完成 ✓ |
| Phase 7 | 整合測試與收尾 | 完成 ✓ |

## 貢獻

請參閱 [CONTRIBUTING.md](CONTRIBUTING.md) 了解 TDD 工作流、分支命名規範及 PR 流程。
