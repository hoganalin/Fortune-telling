# Supabase setup — 10 分鐘搞定

整個過程要做四件事：建 project → 拿 keys → 跑 migration → 重啟 dev。

## 1. 建立 Supabase project（3 min）

1. 註冊 / 登入 https://supabase.com
2. 「New project」 → organization 選 default → 填 project name（例如 `aura`）→ 選 region（亞洲就 `Northeast Asia (Tokyo)`）→ 設一個 database password（隨便，存著就好）→ Create project
3. 等 1-2 分鐘 provisioning 完成

## 2. 拿三把 keys（2 min）

進 project dashboard → 左側 Settings ⚙️ → **API**。三個值要抄：

| 名字 | 用途 | 寫進 |
|---|---|---|
| `Project URL`（如 `https://abcd.supabase.co`） | 前後端共用 | `VITE_SUPABASE_URL` |
| `anon public`（`eyJ...`，最長那個） | 前端瀏覽器 | `VITE_SUPABASE_ANON_KEY` |
| `service_role secret`（按 reveal） | 只給後端用 | `SUPABASE_SERVICE_ROLE_KEY` |

⚠️ `service_role` 是 **bypass RLS 的萬能 key**，絕對不能 commit、不能放進 `VITE_*` 變數（會曝光到瀏覽器）。

把三個值寫進 `.env.local`（從 `.env.example` 複製來改）：

```
VITE_SUPABASE_URL=https://abcd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 3. 跑 migration（2 min）

方法 A —— Supabase web SQL Editor（最快）：

1. 左側 **SQL Editor** → New query
2. 把 `supabase/migrations/0001_init.sql` 整個檔案貼進去
3. 按右下 **Run**
4. 應該看到 `Success. No rows returned`

方法 B —— 用 Supabase CLI（你想要 future-proof 的話）：

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>   # ref 在 dashboard URL 裡
supabase db push
```

## 4. 開啟匿名登入（1 min）

dashboard → **Authentication** → **Providers** → 找 **Anonymous** → 切到 **Enabled** → Save。

⚠️ 這步如果忘記，前端會在 console 看到 `Anonymous sign-ins are disabled`。

## 5. 重啟 dev server（1 min）

```bash
# 停掉現在的 dev（如果還在跑）然後
npm run dev
```

## 6. 驗證

打開 http://localhost:5173/，開 DevTools 的 Application → Cookies / Local Storage：

- `aura-auth` 開頭的 entry → ✅ Supabase session 已建立
- 完成一次 reading → 進 Supabase dashboard → **Table editor** → `readings` → 應看到一筆新 row、`owner_id` 對得上 anonymous user

完成後告訴我，我進 Phase C（synastry-by-invite）。
