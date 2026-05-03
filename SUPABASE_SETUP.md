# Supabase setup — 10 分鐘搞定

整個過程要做五件事：建 project → 拿 keys → 跑 migrations → 開匿名登入 → 重啟 dev。

## 1. 建立 Supabase project（3 min）

1. 註冊 / 登入 https://supabase.com
2. 「New project」 → organization 選 default → 填 project name（例如 `aura`）→ 選 region（亞洲就 `Northeast Asia (Tokyo)`）→ 設一個 database password（隨便，存好就好）→ Create project
3. 等 1-2 分鐘 provisioning 完成

## 2. 拿三把 keys（2 min）

進 project dashboard → 左下齒輪 ⚙️ **Project Settings** → **Data API**（新版）或 **API**（舊版）。三個值要抄：

| Supabase 上叫 | 寫進 `.env.local` 的變數 | 樣子 |
|---|---|---|
| `Project URL` | `VITE_SUPABASE_URL` | `https://abcd.supabase.co` |
| `anon public` | `VITE_SUPABASE_ANON_KEY` | `eyJ...`（最長那串） |
| `service_role secret`（按 Reveal） | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...`（跟 anon 長得很像但不同） |

⚠️ `service_role` 是 **bypass RLS 的萬能 key**，**絕不 commit、絕不放 `VITE_*`**（會曝光到瀏覽器 bundle）。

`.env.local` 裡長這樣（從 `.env.example` 複製來補）：

```
VITE_SUPABASE_URL="https://abcd.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

## 3. 跑 migrations（2 min）

兩個檔案要跑（**順序很重要**）：
- `supabase/migrations/0001_init.sql` — profiles / readings / synastry_invites / synastry_results + RLS + auto-profile trigger
- `supabase/migrations/0002_inquiries.sql` — 多輪追問 inquiries 表

**方法 A —— Supabase Web SQL Editor（最快）**：

1. 左側 **SQL Editor** → New query
2. 把 `0001_init.sql` 整個檔案貼進去 → 按右下 **Run** → 看到 `Success. No rows returned`
3. 另開 New query，貼 `0002_inquiries.sql` → Run

**方法 B —— Supabase CLI（要 future-proof 的話）**：

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>   # ref 在 dashboard URL 裡
supabase db push
```

## 4. 開啟匿名登入（1 min）

dashboard → **Authentication** → **Sign In / Up**（或舊版 **Providers**）→ 找 **Anonymous Sign-Ins** → 切到 **Enabled** → Save。

⚠️ 這步如果忘記，前端 console 會看到 `Anonymous sign-ins are disabled`，整個 app 會降級成 localStorage-only mode（InquiryPanel 顯示「離線模式」、Synastry CTA 不出現）。

## 5. 重啟 dev server（1 min）

```bash
# 純前端（不會跑 API）：
npm run dev          # http://localhost:5173

# 完整 stack（含 /api/* serverless）：
vercel dev           # http://localhost:3000
```

> **要驗證完整流程（含邀請、合盤、對談）一定要用 `vercel dev`**，因為 /api/reading、/api/synastry、/api/inquiry、/api/invites 都是 serverless function，純 Vite 不會跑。

## 6. 驗證（2 min）

打開 dev URL，DevTools → Application → Local Storage：

- 看到 `aura-auth-...` 開頭的 entry → ✅ Supabase 匿名 session 已建立
- **完成一次 reading**（記得在問題欄輸入問題） → 進 Supabase dashboard → **Table editor** → `readings` → 應該看到一筆新 row
- Reading 結果頁底部的 **InquiryPanel** 不應顯示「離線模式」，且應該有可追問 textarea
- Reading 結果頁的 **「邀請朋友合盤」** CTA 應該顯示

## 7. Production deploy（Vercel）

env 也要在 Vercel dashboard / CLI 加一份（VITE_* 是 build time 注入，必須 redeploy 後才生效）：

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ALLOWED_REFERERS production    # 例如 https://你的-app.vercel.app
vercel --prod                                  # 重新 build + 部署
```

## 常見坑

| 症狀 | 原因 | 修法 |
|---|---|---|
| Console 紅字 `Anonymous sign-ins are disabled` | Step 4 沒做 | 開啟 Anonymous Sign-Ins，**清掉 localStorage 重整**頁面 |
| Reading 跑得出來但 DB 沒有 row | Reading 是從 localStorage 還原的舊資料、`dbReadingId` 為 null | 點「重啟儀式」做一次新 reading |
| InquiryPanel 顯示「離線模式」 | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 沒設或拼錯 | 檢查 `.env.local` 並重啟 dev server |
| 部署上 prod 仍顯示「離線模式」 | Vercel 還沒設 env 或設完還沒 redeploy | `vercel env ls production` 確認後跑 `vercel --prod` |
| `/api/invites` 在 prod 回 403 | `ALLOWED_REFERERS` 沒包含 prod URL | `vercel env add ALLOWED_REFERERS production` 包含你的 vercel.app 域名後 redeploy |
| 跨裝置看不到 reading 歷史 | Supabase anonymous user 是綁 device 的，換裝置就是新 user | 預期行為；要解就要實作 `linkIdentity` email 升級流程 |
