# JWT 認證模組 — 設計亮點

## 1. 複合索引 `(user, expires_at)` — 加速過期 Token 清理

### 為什麼需要這個索引

`create_refresh_token()` 每次被呼叫時都會執行：

```sql
DELETE FROM refresh_token WHERE user_id = ? AND expires_at < ?
```

在沒有索引的情況下，資料庫只能依賴 `token` 欄位上的 unique constraint 索引，而該索引對 `(user, expires_at)` 的查詢毫無幫助，會導致全表掃描（Full Table Scan）。

隨著使用者數量和登入頻率增長，`refresh_token` 表的資料量會持續膨脹。若每次清理都需要掃描整張表，延遲會隨資料量線性增長，最終成為登入流程的效能瓶頸。

加上 `(user, expires_at)` 複合索引後，資料庫可以：
1. 先透過 `user_id` 快速定位到該使用者的所有 token（等值查詢）
2. 再透過 `expires_at` 範圍掃描找出過期的 token

查詢複雜度從 O(N)（N = 全表行數）降為 O(log N + K)（K = 該使用者的過期 token 數），即使表中有百萬筆記錄，清理操作也能在毫秒級完成。

### 索引定義

```python
class Meta:
    indexes = [
        models.Index(fields=["user", "expires_at"], name="idx_refresh_user_expires"),
    ]
```

---

## 2. 原子性 Token 輪替 — `transaction.atomic()`

### 問題

原始的 `create_refresh_token()` 中，清理過期 token（DELETE）和建立新 token（CREATE）是兩個獨立的資料庫操作。如果 CREATE 在 DELETE 之後失敗（例如唯一約束衝突或資料庫連線中斷），已刪除的 token 無法復原，使用者可能失去所有有效的 refresh token。

### 修正

使用 `transaction.atomic()` 將兩個操作包裹在同一個交易中，確保要麼全部成功，要麼全部回滾：

```python
with transaction.atomic():
    RefreshToken.objects.filter(user=user, expires_at__lt=now).delete()
    RefreshToken.objects.create(user=user, token=token, expires_at=expires_at)
```

---

## 3. 快取 `timezone.now()` — 時間一致性

### 問題

原始程式碼中 `timezone.now()` 被呼叫了兩次：一次計算 `expires_at`，一次作為 DELETE 的過濾條件。兩次呼叫之間存在微小的時間差，理論上可能導致剛好在兩次呼叫之間過期的 token 被遺漏清理。

### 修正

將 `timezone.now()` 的結果快取到局部變數 `now` 中，所有時間相關的計算都使用同一個時間點，確保邏輯一致性：

```python
now = timezone.now()
expires_at = now + timedelta(days=settings.JWT["REFRESH_TOKEN_LIFETIME_DAYS"])
# DELETE 也使用同一個 now
RefreshToken.objects.filter(user=user, expires_at__lt=now).delete()
```
