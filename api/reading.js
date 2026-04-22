// Vercel serverless function — POST /api/reading
// Generates a full AI-authored fortune reading for the Aura AI Studio front end.
// Uses Claude Opus 4.7 with adaptive thinking + JSON-schema structured output.
// Distilled system prompt rooted in the fortune-master-pro-dao-v2 skill framework.

import Anthropic from '@anthropic-ai/sdk';

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

## 安全欄柵（硬性）
- 不給醫療、法律、投資絕對結論；若話題涉及，以「生活層面的調整」口吻給方向
- 不恐嚇、不宿命論；提出可行動的建議
- 不自稱全知或通靈

## 輸出格式
你會收到一個使用者 profile + 五行主元素。必須以 JSON 物件回傳，嚴格符合給定 schema：
- brand: 一組與主元素共振的意象品牌名（英文短語 2–3 字，像道號），如 Moonwell、Forge & Still、Cinnabar & Co.
- slogan: 一句核心氣象格言；zh 用 8–14 字的漢字短句（帶詩意），en 用對應的 5–9 詞英文
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
    brand: { type: 'string' },
    slogan: {
      type: 'object',
      additionalProperties: false,
      properties: { zh: { type: 'string' }, en: { type: 'string' } },
      required: ['zh', 'en'],
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
  required: ['brand', 'slogan', 'lessons', 'remedies', 'fortune', 'analysis'],
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { name, date, time, location, element } = body;

  if (!name || !date || !element || !ELEMENT_LABEL[element]) {
    return res.status(400).json({ error: 'Missing required fields: name, date, element' });
  }

  const now = new Date();
  const userPayload = [
    `姓名：${name}`,
    `生辰：${date}${time ? ` ${time}` : ''}`,
    `出生地：${location || '（未提供）'}`,
    `主元素（已由客戶端依年干推算）：${ELEMENT_LABEL[element]}`,
    `當前日期（用於 fortune.day/month/year 切片）：${now.toISOString().slice(0, 10)}`,
    `資料級別：${time && location ? 'S' : time || location ? 'A' : 'B'}`,
    '',
    '依上述資料與系統提示的五行框架，生成完整結構化 reading。',
  ].join('\n');

  try {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
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
