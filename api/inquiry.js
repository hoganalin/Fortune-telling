// POST /api/inquiry — multi-turn follow-up questions on an existing reading.
// Auth: Bearer JWT (anon ok). Caller must own the reading.
// Body: { reading_id, question, history? }
//   history: optional array of prior turns [{ role: 'user'|'assistant', content: string }]
// Returns: { answer: { zh, en }, _usage }
//
// Initial Q&A still ships in /api/reading's response (qa field);
// this endpoint handles every follow-up after the first turn.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const SYSTEM_PROMPT = `你是一位有門道的全體系命理師，正在跟使用者進行延伸對談。前一輪你已經給過完整 reading 與初次提問的回答，現在使用者基於那份命盤再追問。

## 對談原則
- 以剛剛那份 reading 為背景（user payload 會帶上 bazi context）
- 風格穩、準、不雞湯；保留一點玄學意象但內容要清晰可執行
- 必須引用具體命盤事實（日主、缺/旺元素、四柱、姓名拆字）至少兩項
- 若 history 帶有前面對話，直接接續、不重複舊內容、可呼應前面提過的點
- 給可執行的方向，不給醫療/法律/投資絕對結論

## 字數
- answer.zh: 300–450 字繁體中文（台灣正體）。密度高、不灌廢話，每句都要有資訊量。
- answer.en: 對應自然流暢英文

## 輸出
僅輸出 JSON，符合 schema：{ answer: { zh, en } }
不要 markdown fence、不要免責聲明、不要說「根據你的命盤…」這種空話。`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: {
      type: 'object',
      additionalProperties: false,
      properties: { zh: { type: 'string' }, en: { type: 'string' } },
      required: ['zh', 'en'],
    },
  },
  required: ['answer'],
};

const MODEL = process.env.ANTHROPIC_INQUIRY_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const ALLOWED_REFERERS = (process.env.ALLOWED_REFERERS || 'http://localhost:3000,http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
function isAllowedReferer(r) {
  if (!r) return false;
  // Dev convenience: any localhost port is allowed (vercel dev / vite dev / etc).
  if (/^https?:\/\/localhost(:\d+)?(\/|$)/.test(r)) return true;
  return ALLOWED_REFERERS.some((a) => r.startsWith(a));
}

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) { buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return false; }
  if (b.count >= RATE_MAX) return true;
  b.count++;
  return false;
}
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

const ELEMENT_LABEL = {
  metal: '金 Metal', wood: '木 Wood', water: '水 Water', fire: '火 Fire', earth: '土 Earth',
};

function buildBaziContext(reading) {
  const bd = reading.birth_data || {};
  const lines = [
    `### 命盤背景（前一輪 reading 的對象）`,
    `姓名：${bd.name || '（未提供）'}`,
    `生辰：${bd.date || '（未知）'}${bd.time ? ' ' + bd.time : ''}`,
    `主元素：${ELEMENT_LABEL[reading.element] || reading.element}`,
  ];
  if (reading.pillars) {
    const fmt = (p) => p ? `${p.stem}${p.branch}（${p.element}）` : '時辰未明';
    lines.push(`四柱：年 ${fmt(reading.pillars.year)} / 月 ${fmt(reading.pillars.month)} / 日 ${fmt(reading.pillars.day)} / 時 ${fmt(reading.pillars.hour)}`);
  }
  if (reading.distribution) {
    const d = reading.distribution;
    lines.push(`五行分布：金${d.metal} 木${d.wood} 水${d.water} 火${d.fire} 土${d.earth}`);
  }
  return lines.join('\n');
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
    return res.status(429).json({ error: '請求過於頻繁' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: 'Server missing Supabase config' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });
  }

  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return res.status(401).json({ error: 'Missing bearer token' });

  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });
  const userId = userData.user.id;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { reading_id, question, history } = body;
  if (!reading_id || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'Missing reading_id or question' });
  }
  if (question.length > 500) {
    return res.status(400).json({ error: 'Question too long (max 500 chars)' });
  }

  const { data: reading, error: readingErr } = await admin
    .from('readings')
    .select('id, owner_id, birth_data, element, pillars, distribution, ai_payload')
    .eq('id', reading_id)
    .maybeSingle();
  if (readingErr) return res.status(500).json({ error: readingErr.message });
  if (!reading) return res.status(404).json({ error: 'Reading not found' });
  if (reading.owner_id !== userId) return res.status(403).json({ error: 'Not your reading' });

  const baziContext = buildBaziContext(reading);

  // Build messages array — alternating user/assistant turns from history,
  // capped to last 10 turns (5 round-trips) to keep prompt size bounded.
  const messages = [];
  const trimmedHistory = Array.isArray(history) ? history.slice(-10) : [];
  for (const turn of trimmedHistory) {
    if (!turn || typeof turn.content !== 'string') continue;
    if (turn.role !== 'user' && turn.role !== 'assistant') continue;
    messages.push({ role: turn.role, content: turn.content });
  }
  // Final user turn includes bazi context (only on the FIRST user message of the API call;
  // when history exists, history's first user message already had context — but to keep things
  // simple, we always re-stamp context on the latest user message so model has it close to its turn).
  messages.push({
    role: 'user',
    content: `${baziContext}\n\n使用者追問：「${question.trim()}」\n\n請依規範回 300–450 字深度回答（zh + en），引用至少兩項具體命盤事實，並給出具體下一步。`,
  });

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages,
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) return res.status(502).json({ error: 'Model returned no text', stop_reason: response.stop_reason });
    let parsed;
    try { parsed = JSON.parse(textBlock.text); }
    catch { return res.status(502).json({ error: 'Bad JSON', raw: textBlock.text.slice(0, 300) }); }
    return res.status(200).json({
      answer: parsed.answer,
      _usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Rate limited' });
    if (error instanceof Anthropic.APIError) return res.status(error.status || 502).json({ error: error.message });
    return res.status(500).json({ error: 'Unexpected', detail: String(error?.message || error) });
  }
}
