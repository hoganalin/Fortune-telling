# Aura AI Studio · 命盤品牌產生器

一個以**八字日主**為起點、用 **Claude API** 做深度命理解讀的單頁 Web 應用。使用者輸入姓名、生辰、時辰、出生地，系統先以 Julian Day Number 推算日干並對應五行主元素，再把 profile 送到 Vercel serverless function，由 Claude（Opus 4.7 或 Sonnet 4.6）依照命理師框架生成完整 reading。也支援雙人合盤（synastry）分析。

**Live**：https://fortune-telling.vercel.app

## 設計主軸

不是品牌產生器，是**命理師 × 生成式 AI** 的氛圍體驗。張力來自：

- **玄學厚度**來自排版秩序與材質——襯線標題（Fraunces × Noto Serif TC）、宣紙噪點、毛玻璃卡片
- **科技感**來自光學行為——Canvas 2D 流場粒子（水墨遊絲而非星空）、毛玻璃折射、局部光暈
- 兩者在**儀式 timing** 會合：送出表單後是一場 3-phase ceremony（凝神 → 感應 → 顯化），把 loading 變成敘事；100% 會 hold 到 AI 回來才 reveal

## 核心功能

| 區塊 | 內容 |
|---|---|
| **日干推算** | Gregorian 日期 → JDN → 60-甲子循環，錨定 2000-01-07 甲子日。客戶端純函式，不需要 API |
| **五行主元素** | 金／木／水／火／土，整頁 accent color 透過 `--accent-glow` CSS 變數 runtime 切換；粒子、邊框、descender 全部響應 |
| **AI Reading**（`/api/reading`） | Claude 回傳結構化 JSON：Brand name + Slogan（雙語）+ 3 項本命功課 + 3 帖五行藥方 + Fortune（今年/當月/當日 × 總評 + 事業/情感/健康）+ Analysis（體質綜述 / 當前課題 / 破局路徑） |
| **AI 合盤**（`/api/synastry`） | 兩人五行命盤資料 → Claude 回傳 500–700 字的關係氣象、互動結構、張力與互補、相處節奏 |
| **解讀框架** | 蒸餾自 `fortune-master-pro-dao-v2` 技能：**人格底色 + 當前課題 + 阻力來源 + 破局路徑** |
| **繁英雙語** | Top bar 切換，Hero / Ritual / Archive / Analysis 全部對應翻譯。AI 也同時回傳 zh / en 兩套文案 |
| **封存 Archive** | localStorage 保留最近 24 筆 reading，右側抽屜可回看、刪除、或點「開啟」還原該次命盤 |
| **Graceful fallback** | API key 缺失或呼叫失敗，前端會 fallback 到 deterministic pools，UI 不會斷流 |
| **Referer 白名單** | `/api/*` 透過 `ALLOWED_REFERERS` 限制呼叫來源，避免 API key 被外站盜用 |

## Tech Stack

- **Frontend**：Vite 8 + React 19 + Tailwind v4（`@tailwindcss/vite` plugin）
- **Motion**：全部自寫 — Canvas 2D flow-field、IntersectionObserver Reveal、CSS keyframes、perspective 3D tilt cards。**沒有** framer-motion 或 three.js
- **Fonts**：Fraunces（opsz 144, soft）× Noto Serif TC + Inter + Noto Sans TC + JetBrains Mono
- **Backend**：Vercel Node.js serverless functions（`api/reading.js`、`api/synastry.js`）+ `@anthropic-ai/sdk`
- **Model**：預設 `claude-opus-4-7` with adaptive thinking；可設 `ANTHROPIC_MODEL=claude-sonnet-4-6` 切更快/更便宜的模式
- **Structured output**：`output_config.format` with JSON Schema，系統提示以 `cache_control` 走 prompt cache
- **Deploy**：Vercel，GitHub `main` 自動部署

## 本地開發

```bash
# 1. Dependencies
npm install

# 2. Env — 從 .env.example 複製
cp .env.example .env.local
# 編輯 .env.local，填入 ANTHROPIC_API_KEY=sk-ant-...

# 3a. 純前端（API 會 404，UI 走 fallback 內容）
npm run dev

# 3b. 完整（Vite + serverless 一起跑）
npm i -g vercel
vercel link                 # 連到 Vercel 專案（第一次）
vercel env pull .env.local  # 把雲端 env 同步下來
vercel dev                  # 預設 http://localhost:3000
```

## 環境變數

| 變數 | 必要 | 說明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API 金鑰，取得：<https://console.anthropic.com/settings/keys> |
| `ANTHROPIC_MODEL` | ⛔ | 覆寫預設模型；預設 `claude-opus-4-7`，可改 `claude-sonnet-4-6` |
| `ALLOWED_REFERERS` | 部署必要 | 逗號分隔的允許來源清單；本機未設時預設放行 localhost |

## 部署

```bash
# 第一次：連 Vercel 專案
vercel link

# 設 production env var（會問 Environments → 勾 Production + Preview）
vercel env add ANTHROPIC_API_KEY
vercel env add ALLOWED_REFERERS
vercel env add ANTHROPIC_MODEL   # optional

# 之後每次 git push 到 main 自動部署
```

## 檔案結構

```
ai-brand-generator/
├── api/
│   ├── reading.js          # Vercel serverless — 個人命理解讀
│   └── synastry.js         # Vercel serverless — 雙人合盤
├── src/
│   ├── App.jsx             # 單檔 React 應用（所有 components + 邏輯）
│   ├── main.jsx            # React 19 root mount
│   ├── index.css           # Tailwind v4 + 設計 token + 五組 keyframes
│   └── assets/
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
