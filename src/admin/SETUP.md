# NYX Admin System 安裝說明

## 第一步：跑 SQL
在 Supabase SQL Editor 執行 `fix_admin.sql`

## 第二步：設定你自己為 super_admin
SQL Editor 執行（換成你的 user_id）：
```sql
-- 先找你的 user_id
select id, email from auth.users where email = 'your@email.com';

-- 設定為 super_admin
insert into admin_users (user_id, role, notes)
values ('<YOUR_USER_ID>', 'super_admin', 'Founder');
```

## 第三步：複製文件
把 `src/admin/` 整個資料夾複製到你的項目 `src/admin/`

## 第四步：更新 main.tsx
把 `src/main.tsx` 換成提供的版本（加入 /admin 路由判斷）

## 第五步：訪問後台
打開 `https://你的域名/admin`

## 安全說明

### 為什麼這樣設計是安全的：
1. `admin_users` 表有 RLS，只有 admin 才能查
2. 所有敏感操作（ban/delete）都是 Supabase Functions，DB 層攔截
3. `is_admin()` 函數用 `security definer` 在 server 端執行
4. 前端拿不到 admin 判斷邏輯，即使改 localStorage 也無效
5. 每個操作都寫入 audit log

### 聊天隱私保護：
- 管理員**不能**直接在 UI 查看聊天
- 只有被檢舉的內容，且明確「授權」後才記錄
- 實際查看聊天需要去 Supabase 後台（有 postgres 權限的人才行）
- 授權行為本身被記錄在 report_review_log

### 測試 vs 正式環境：
- 測試帳號用 `is_test_account = true` 標記
- 統計數據自動排除測試帳號
- 一鍵清除測試數據（只清 test account 的）
