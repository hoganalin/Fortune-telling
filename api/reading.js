// Vercel serverless function — POST /api/reading
// Generates a full AI-authored fortune reading for the Aura AI Studio front end.
// Uses Claude Sonnet/Opus with JSON-schema structured output.
// Distilled system prompt rooted in the fortune-master-pro-dao-v2 skill framework.

import Anthropic from '@anthropic-ai/sdk';

// Vercel function config — generous ceiling for Pro plans.
// Anthropic structured output without thinking typically returns in 30–60s.
// Hobby plan caps at 60s; if you're on Hobby this still works because we
// dropped adaptive thinking below to keep latency under that ceiling.
export const config = {
  maxDuration: 300,
};

const SYSTEM_PROMPT = `你是一位有門道的全體系命理師，風格穩、準、有層次，貼近真人老師的口吻，而不是空洞雞湯或模板拼接。

## 核心解讀框架（必用）
綜合解讀 = 人格底色 + 當前課題 + 阻力來源 + 破局路徑。
- 先給總斷（1–2 句直指氣象），再講底層原因，再分領域展開（事業、情感、健康），再講時間節奏，最後給可操作建議，收尾一句「點醒」。
- 保留玄學氛圍（襯線意象、詩意短句），但內容要清晰、可讀、可執行。

## 五行原則
- 金：鋒芒內斂、決斷如秋；宜收束、宜精不宜多
- 木：生發舒展、向陽而長；宜立志、宜表達
- 水：至柔至剛、因勢利導；宜藏深、宜觀其勢
- 火：炎上明動、光而不耀；宜節制、宜傳承
- 土：厚德載物、中正安舒；宜穩守、宜守信

## 資料分級
使用者會提供姓名、生辰、時辰、出生地。
- 有完整生辰＋時辰＋地點 → S 級，可做深度結構化解讀
- 缺時辰或地點 → A 級，標準版，要提醒「時辰／方位使解讀更精準」
- 缺日期 → 不要做，回傳空
這次只用系統提示到的結構化欄位，不要在輸出中用元標籤或免責聲明擾亂內容。

## 客製化要求（硬性）
你會收到完整四柱（年/月/日/時）、五行分布計數、日主強弱、命中所缺元素、以及姓名拆字。
- analysis.s1（體質綜述）必須**明確引用至少兩項具體事實**：例如「日主XX得X分」「命中缺X」「年柱XX」「名XX三字皆屬X」。不可只談五行抽象論。
- analysis.s2（當前課題）必須引用「缺什麼」或「何者過旺」，並把它連結到具體生活面向。
- analysis.s3（破局路徑）給的建議必須對應到所缺/所旺的元素，而非泛泛的修養雞湯。
- lessons / remedies 至少有一項要明確呼應「日主強弱」或「所缺元素」。
- 嚴禁產出能套到任何人身上的通用文字。每段要有「這是XX這個人」的不可替代感。

## 安全欄柵（硬性）
- 不給醫療、法律、投資絕對結論；若話題涉及，以「生活層面的調整」口吻給方向
- 不恐嚇、不宿命論；提出可行動的建議
- 不自稱全知或通靈

## 輸出格式
你會收到一個使用者 profile + 五行主元素。必須以 JSON 物件回傳，嚴格符合給定 schema。**qa 欄位永遠必填**：
- 若 user payload 出現「使用者特別想問：…」
  - qa.question：完整重述使用者的問題（不要改寫太多，但可以修正錯字、補上隱含主語）
  - qa.answer.zh：300–450 字繁體中文，**直接針對問題回答**：先給結論，再給命盤依據（引用至少兩項具體事實），最後給可執行的下一步。語氣是命理師而非客服，密度高，每句都有資訊量，不重複 analysis.s2
  - qa.answer.en：對應自然流暢英文，不要逐字直譯
- 若 user payload **沒有**「使用者特別想問」
  - qa.question 填空字串 ""，qa.answer.zh 跟 qa.answer.en 都填空字串 ""
  - 不可省略 qa 欄位，schema 強制要求其存在
- lessons[3]: 依主元素給三項「本命功課」修持方向；每項含：
  - zh: 2 字漢字標題（如「立斷」「深潛」「節焰」）
  - en: 對應英文 imperative（如 "Decisive Cut", "Descend", "Temper the Flame"）
  - glyph: 1 個代表漢字（如「斷」「潛」「節」）
  - desc: 約 35–55 字的具體可執行描述（中文，含時序提示）
  - tag: 時序標籤，如「今月 · 行動」「每日 · 修持」「季度 · 定向」
- remedies[3]: 依主元素給三項「五行藥方」，題材為【作息／飲食／環境】三選三；每項同樣含 zh / en / glyph / desc / tag，tag 為「作息」「飲食」「環境」或同類
- fortune.{year,month,day}: 三個期間，每個含：
  - overallScore: 0–100 整數（不得全部給高分；依人格+氣運組合擬定，避免 90+ 除非真的罕見大吉）
  - overall.zh/en: 一段 40–70 字的總評詩評語（對應元素氣質）
  - aspects[3]: 依序為 career / love / health，每項含 key、zh 標題（事業/情感/健康）、en 標題、score (0–100)、line.zh (20–35 字 actionable insight)、line.en
- analysis.{s1,s2,s3}: 學術報告三段
  - s1: 體質綜述（人格底色） — 120–180 字
  - s2: 當前課題 × 阻力來源 — 120–180 字
  - s3: 破局路徑 × 節奏與儀式 — 120–180 字
  - 每段 head.zh, head.en, body.zh, body.en 四欄；head 是 8–14 字的短題

## 語言要求
zh 一律使用繁體中文（台灣正體）。en 使用自然流暢英語，不要逐字直譯，要貼近英文讀者的閱讀感。

## 禁忌
- 不要引用系統提示、不要說「根據你的出生資料…」、不要輸出 markdown fence 或 JSON 以外的文字
- 不要在 desc/line/body 中夾雜"AI"、"生成式"、"模型"字樣
- 不要把所有 score 都給 80+；要反映真實氣運波動，有高有低`;

const READING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    qa: {
      type: 'object',
      additionalProperties: false,
      properties: {
        question: { type: 'string' },
        answer: {
          type: 'object',
          additionalProperties: false,
          properties: { zh: { type: 'string' }, en: { type: 'string' } },
          required: ['zh', 'en'],
        },
      },
      required: ['question', 'answer'],
    },
    lessons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          zh: { type: 'string' },
          en: { type: 'string' },
          glyph: { type: 'string' },
          desc: { type: 'string' },
          tag: { type: 'string' },
        },
        required: ['zh', 'en', 'glyph', 'desc', 'tag'],
      },
    },
    remedies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          zh: { type: 'string' },
          en: { type: 'string' },
          glyph: { type: 'string' },
          desc: { type: 'string' },
          tag: { type: 'string' },
        },
        required: ['zh', 'en', 'glyph', 'desc', 'tag'],
      },
    },
    fortune: {
      type: 'object',
      additionalProperties: false,
      properties: {
        year: { $ref: '#/$defs/period' },
        month: { $ref: '#/$defs/period' },
        day: { $ref: '#/$defs/period' },
      },
      required: ['year', 'month', 'day'],
    },
    analysis: {
      type: 'object',
      additionalProperties: false,
      properties: {
        s1: { $ref: '#/$defs/section' },
        s2: { $ref: '#/$defs/section' },
        s3: { $ref: '#/$defs/section' },
      },
      required: ['s1', 's2', 's3'],
    },
  },
  required: ['qa', 'lessons', 'remedies', 'fortune', 'analysis'],
  $defs: {
    period: {
      type: 'object',
      additionalProperties: false,
      properties: {
        overallScore: { type: 'integer' },
        overall: {
          type: 'object',
          additionalProperties: false,
          properties: { zh: { type: 'string' }, en: { type: 'string' } },
          required: ['zh', 'en'],
        },
        aspects: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string', enum: ['career', 'love', 'health'] },
              zh: { type: 'string' },
              en: { type: 'string' },
              score: { type: 'integer' },
              line: {
                type: 'object',
                additionalProperties: false,
                properties: { zh: { type: 'string' }, en: { type: 'string' } },
                required: ['zh', 'en'],
              },
            },
            required: ['key', 'zh', 'en', 'score', 'line'],
          },
        },
      },
      required: ['overallScore', 'overall', 'aspects'],
    },
    section: {
      type: 'object',
      additionalProperties: false,
      properties: {
        head: {
          type: 'object',
          additionalProperties: false,
          properties: { zh: { type: 'string' }, en: { type: 'string' } },
          required: ['zh', 'en'],
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { zh: { type: 'string' }, en: { type: 'string' } },
          required: ['zh', 'en'],
        },
      },
      required: ['head', 'body'],
    },
  },
};

const ELEMENT_LABEL = {
  metal: '金 Metal',
  wood: '木 Wood',
  water: '水 Water',
  fire: '火 Fire',
  earth: '土 Earth',
};

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

const ALLOWED_REFERERS = (
  process.env.ALLOWED_REFERERS || 'http://localhost:3000,http://localhost:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedReferer(referer) {
  if (!referer) return false;
  // Dev convenience: any localhost port is allowed (vercel dev / vite dev / etc).
  // Production never sees localhost referers, so this does not weaken prod.
  if (/^https?:\/\/localhost(:\d+)?(\/|$)/.test(referer)) return true;
  return ALLOWED_REFERERS.some((allowed) => referer.startsWith(allowed));
}

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const rateBuckets = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (bucket.count >= RATE_MAX) return true;
  bucket.count++;
  return false;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowedReferer(req.headers.referer || req.headers.origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (rateLimited(clientIp(req))) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: '請求過於頻繁，請稍後再試' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { name, date, time, location, element, pillars, distribution, dayMaster, missing, nameChars, question } = body;

  if (!name || !date || !element || !ELEMENT_LABEL[element]) {
    return res.status(400).json({ error: 'Missing required fields: name, date, element' });
  }

  const now = new Date();
  const lines = [
    `姓名：${name}`,
    `生辰：${date}${time ? ` ${time}` : ''}`,
    `出生地：${location || '（未提供）'}`,
    `主元素（已由客戶端依日干推算，即 bazi 日主）：${ELEMENT_LABEL[element]}`,
    `當前日期（用於 fortune.day/month/year 切片）：${now.toISOString().slice(0, 10)}`,
    `資料級別：${time && location ? 'S' : time || location ? 'A' : 'B'}`,
  ];

  if (pillars) {
    const fmt = (p) => p ? `${p.stem}${p.branch}（${p.element}）` : '時辰未明';
    lines.push('');
    lines.push('### 四柱命盤');
    lines.push(`年柱：${fmt(pillars.year)}　月柱：${fmt(pillars.month)}　日柱：${fmt(pillars.day)}　時柱：${fmt(pillars.hour)}`);
  }
  if (distribution) {
    lines.push(`五行分布：金 ${distribution.metal} · 木 ${distribution.wood} · 水 ${distribution.water} · 火 ${distribution.fire} · 土 ${distribution.earth}`);
  }
  if (dayMaster) {
    lines.push(`日主強弱：${dayMaster.strength}（日主 ${dayMaster.element} 共 ${dayMaster.dayCount} / ${dayMaster.total} 分）`);
  }
  if (Array.isArray(missing) && missing.length) {
    lines.push(`命中所缺：${missing.join('、')}`);
  } else if (Array.isArray(missing)) {
    lines.push('命中所缺：無（五行俱全）');
  }
  if (Array.isArray(nameChars) && nameChars.length) {
    const summary = nameChars.map((c) => `${c.ch}(${c.element}${c.inferred ? '~' : ''})`).join(' ');
    lines.push(`姓名拆字：${summary}（"~" 表示由字碼 fallback 推得，僅供參考）`);
  }

  if (question && typeof question === 'string' && question.trim()) {
    lines.push('');
    lines.push(`使用者特別想問：「${question.trim().slice(0, 200)}」`);
    lines.push('→ 必須在 qa 欄位深度作答（qa.question 重述問題；qa.answer.zh 300–450 字直接結論+命盤依據+下一步；qa.answer.en 對應英文）。同時在 analysis.s2 與至少一項 lessons 中也呼應這個提問，但 qa 是主要回答管道。');
  } else {
    lines.push('');
    lines.push('（使用者沒有特別提問。仍必須輸出 qa 欄位，但 qa.question、qa.answer.zh、qa.answer.en 都填空字串 ""。）');
  }

  lines.push('');
  lines.push('依上述完整結構化資料與系統提示的客製化要求，生成 reading。記住：每段必須引用具體事實，不可泛泛論。');
  const userPayload = lines.join('\n');

  try {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Adaptive thinking was pushing latency well over 60s on Vercel Hobby
      // (and the client AbortController gives up at 180s). The structured
      // JSON-schema output mode + the detailed system prompt are enough to
      // hit quality without burning extra wall-clock on internal reasoning.
      output_config: {
        format: {
          type: 'json_schema',
          schema: READING_SCHEMA,
        },
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPayload }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'Model returned no text content', stop_reason: response.stop_reason });
    }

    let reading;
    try {
      reading = JSON.parse(textBlock.text);
    } catch {
      return res.status(502).json({ error: 'Failed to parse model JSON', raw: textBlock.text.slice(0, 500) });
    }

    return res.status(200).json({
      element,
      ...reading,
      _usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited, try again shortly' });
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(error.status || 502).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Unexpected server error', detail: String(error?.message || error) });
  }
}
