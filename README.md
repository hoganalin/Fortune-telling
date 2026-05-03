# Aura · AI 五行

一個以**八字日主**為起點、用 **Claude API** 做深度命理解讀的單頁 Web 應用。使用者輸入姓名、生辰、時辰、出生地，系統先以 Julian Day Number 推算日干並對應五行主元素，再把 profile 送到 Vercel serverless function，由 Claude（Opus 4.7 或 Sonnet 4.6）依照命理師框架生成個人 reading。完成後可以**邀請另一人合盤**（synastry-by-invite token flow），也能**多輪追問**自己的命盤。

**Live**：https://fortune-telling-weld.vercel.app

## 設計主軸

**命理師 × 生成式 AI** 的氛圍體驗——個人 reading 是 onboarding hook，雙人合盤是 viral loop。張力來自：

- **玄學厚度**來自排版秩序與材質——襯線標題（Fraunces × Noto Serif TC）、宣紙噪點、毛玻璃卡片
- **科技感**來自光學行為——Canvas 2D 流場粒子（水墨遊絲而非星空）、毛玻璃折射、局部光暈
- 兩者在**儀式 timing** 會合：送出表單後是一場 3-phase ceremony（凝神 → 感應 → 顯化），把 loading 變成敘事；100% 會 hold 到 AI 回來才 reveal

## 核心功能

| 區塊 | 內容 |
|---|---|
| **日干推算** | Gregorian 日期 → JDN → 60-甲子循環，錨定 2000-01-07 甲子日。客戶端純函式，不需要 API |
| **五行主元素** | 金／木／水／火／土，整頁 accent color 透過 `--accent-glow` CSS 變數 runtime 切換；粒子、邊框、descender 全部響應 |
| **AI Reading**（`/api/reading`） | Claude 結構化 JSON：3 項本命功課 + 3 帖五行藥方 + Fortune（今年/當月/當日 × 總評 + 事業/情感/健康）+ Analysis（體質綜述 / 當前課題 / 破局路徑）；使用者有提問時額外輸出 `qa: { question, answer.{zh,en} }` |
| **AI 合盤**（`/api/synastry`） | 兩人五行命盤資料 → Claude 回傳關係氣象、互動結構、張力與互補、相處節奏 |
| **AI 對談**（`/api/inquiry`） | 多輪追問 endpoint，以當前 reading 為背景延伸；前端 `InquiryPanel` 元件有完整 thread + 重試 + 持久化 |
| **Synastry-by-Invite** | A 從自己 reading 點 CTA → `POST /api/invites` 拿到 7 天有效 token → 分享連結。B 開啟 `?invite=<token>` → `GET /api/invites/[token]` 看 inviter 元素 → 填生辰 → 同時生成 B 的 reading + 雙人合盤 → `POST /api/invites/[token]` 寫回 server，標記 invite 完成、寫入 `synastry_results` |
| **匿名 Auth** | Supabase `signInAnonymously()`，零摩擦 onboarding；前端永遠拿得到 `auth.uid()`，可選擇之後升級成 email |
| **Reading 持久化** | Supabase Postgres + RLS own-only。`saveReading()` 在 AI 回來後 fire-and-forget 寫入；localStorage Archive 仍保留作 offline 鏡像 + UI 回放 |
| **解讀框架** | 蒸餾自 `fortune-master-pro-dao-v2` 技能：**人格底色 + 當前課題 + 阻力來源 + 破局路徑** |
| **繁英雙語** | Top bar 切換，Hero / Ritual / Archive / Analysis / InquiryPanel 全部對應翻譯。AI 也同時回傳 zh / en 兩套文案 |
| **封存 Archive** | localStorage 保留最近 24 筆 reading，右側抽屜可回看、刪除、或點「開啟」還原該次命盤 |
| **Graceful fallback** | API key 缺失或呼叫失敗，前端會 fallback 到 deterministic POOLS；Supabase env 缺失整套自動降級為 localStorage-only |
| **Referer 白名單** | `/api/*` 透過 `ALLOWED_REFERERS` 限制呼叫來源；`/api/invites` 額外開放 `localhost:*` 給 dev |

## Tech Stack

- **Frontend**：Vite 8 + React 19 + Tailwind v4（`@tailwindcss/vite` plugin）
- **Auth + DB**：Supabase（Postgres + Anonymous auth + Row-Level Security）
- **Motion**：全部自寫 — Canvas 2D flow-field、IntersectionObserver Reveal、CSS keyframes、perspective 3D tilt cards。**沒有** framer-motion 或 three.js
- **Fonts**：Fraunces（opsz 144, soft）× Noto Serif TC + Inter + Noto Sans TC + JetBrains Mono
- **Backend**：Vercel Node.js serverless functions + `@anthropic-ai/sdk` + `@supabase/supabase-js`
- **Model**：預設 `claude-opus-4-7` with adaptive thinking；可設 `ANTHROPIC_MODEL=claude-sonnet-4-6` 切更快/更便宜的模式
- **Structured output**：`output_config.format` with JSON Schema，系統提示以 `cache_control` 走 prompt cache
- **Deploy**：Vercel，GitHub `main` 自動部署

## 本地開發

```bash
# 1. Dependencies
npm install

# 2. Env — 從 .env.example 複製
cp .env.example .env.local
# 填入 ANTHROPIC_API_KEY 與 Supabase keys（見下面「環境變數」）

# 3. 跑 Supabase migration
#   方法 A：在 Supabase dashboard SQL Editor 貼 supabase/migrations/0001_init.sql 與 0002_inquiries.sql 執行
#   方法 B：supabase CLI → supabase db push
#   完整 setup 指引見 SUPABASE_SETUP.md

# 4a. 純前端（API 會 404，UI 走 fallback；Supabase 仍可登入但無法存 reading）
npm run dev

# 4b. 完整（Vite + serverless 一起跑）
npm i -g vercel
vercel link                 # 連到 Vercel 專案（第一次）
vercel env pull .env.local  # 把雲端 env 同步下來
vercel dev                  # 預設 http://localhost:3000
```

> **首次設定 Supabase？** 看 [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)——4 步驟、約 10 分鐘。

## 環境變數

| 變數 | 範圍 | 必要 | 說明 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | server | ✅ | Anthropic 金鑰，<https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | server | ⛔ | 覆寫預設模型；預設 `claude-opus-4-7` |
| `ANTHROPIC_INQUIRY_MODEL` | server | ⛔ | 覆寫 `/api/inquiry` 用的模型；預設 `claude-sonnet-4-6` |
| `ALLOWED_REFERERS` | server | 部署必要 | 逗號分隔的允許來源清單；本機未設時預設放行 localhost |
| `VITE_SUPABASE_URL` | both | ✅ for full | Supabase Project URL；空值時整套降級為 localStorage-only |
| `VITE_SUPABASE_ANON_KEY` | client | ✅ for full | Supabase anon public key（safe to expose） |
| `SUPABASE_SERVICE_ROLE_KEY` | server | ✅ for invites | bypass RLS 用於 token-based invite 流程；**絕不 commit、絕不 `VITE_` 前綴** |

## 部署

```bash
# 第一次：連 Vercel 專案
vercel link

# 設 production env vars（Environments 都勾 Production + Preview）
vercel env add ANTHROPIC_API_KEY
vercel env add ALLOWED_REFERERS         # e.g. https://fortune-telling-weld.vercel.app
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# 之後每次 git push 到 main 自動部署；或手動 vercel --prod
```

> **VITE_\* 變數會在 build time 被烤進 bundle**，所以新增 / 修改後**必須重新 deploy** 才會生效。

## 安全模型

- **RLS（Row Level Security）**：`profiles` / `readings` / `synastry_results` 全部 enable，policy 是 own-only（`auth.uid() = owner_id`）。`synastry_invites` 邀請者與被邀請者都能 SELECT。
- **Token-based public access**：被邀請者 B 不需要先認識 A，所以 invite 流程**不走 RLS**，由 `/api/invites/[token]` 用 `SUPABASE_SERVICE_ROLE_KEY` server-side 驗證 token、寫入。RLS 處理「身分」，token 處理「能力」。
- **Invite token**：32-byte CSPRNG → base64url；7 天硬上限；one-shot（status 改成 `completed` 後再點只能看結果不能改資料）。
- **Anonymous auth**：所有新使用者預設匿名，避免 onboarding friction；之後可以 `linkIdentity` 升級成 email user 而 session 與資料 carry over。
- **Referer 白名單**：擋住別人從外站盜用 API key 跑費用。
- **Prompt injection 面**：使用者輸入只進結構化欄位（生辰、姓名）+ 一個明確標記的 `question`；prompt 沒有自由 free-form 注入點。

## 檔案結構

```
ai-brand-generator/
├── api/
│   ├── reading.js          # Vercel serverless — 個人命理解讀（含可選 qa 欄位）
│   ├── synastry.js         # Vercel serverless — 雙人合盤 AI 文字
│   ├── inquiry.js          # Vercel serverless — 多輪追問
│   ├── invites.js          # POST → A 創 invite token
│   └── invites/
│       └── [token].js      # GET 公開查 invite info；POST B 完成 invite
├── src/
│   ├── App.jsx             # 單檔 React 應用（component / state / effect 全集中）
│   ├── main.jsx            # React 19 root mount
│   ├── index.css           # Tailwind v4 + 設計 token + 五組 keyframes
│   ├── lib/
│   │   └── supabase.js     # Supabase client + useAnonymousAuth + saveReading + invite helpers
│   └── assets/
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql        # profiles / readings / synastry_invites / synastry_results + RLS
│       └── 0002_inquiries.sql   # multi-turn inquiries 表
├── public/
├── index.html              # Fonts preconnect + Vite script
├── vite.config.js          # React + Tailwind v4 plugin
├── .env.example
└── eslint.config.js
```

## NPM Scripts

| Script | 用途 |
|---|---|
| `npm run dev` | Vite 開發伺服器（純前端） |
| `npm run build` | 產出 production bundle 到 `dist/` |
| `npm run preview` | 預覽已建置的 bundle |
| `npm run lint` | 跑 ESLint |

## 致謝

- 命理框架脫胎自本地 skill `fortune-master-pro-dao-v2`（八字／紫微／塔羅／奇門／綜合解讀）
- 設計原型來自 Claude Design handoff；移植到 Vite + React 19 並接上 Claude API 做真實算命

## 注意

這是一個**象徵性**的命理解讀工具，不提供醫療、法律、投資建議。AI 輸出會依五行框架給出可執行的生活、修持、環境調整建議，不作絕對化結論。
