// Vercel serverless function — POST /api/synastry
// AI commentary on a precomputed two-person five-element synastry.

import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `你是一位擅長關係命理的命理師，根據兩人五行命盤資料給出深入的合盤分析。

## 字數要求（硬性）
- body 至少 500 字、上限 700 字。不足 500 字視為不合格。
- 內容必須有層次：先總斷氣象、再剖析互動結構、再點出張力與互補、最後談相處節奏。
- 不可灌水；每一段都要扣回兩人具體命盤事實。

## 風格
- 繁體中文（台灣正體），溫潤、不雞湯、不恐嚇
- 直指關係本質：兩人氣場如何共振、何處互補、何處張力
- 必須多次引用具體事實：日主元素、相生/相剋關係、五行分布的具體數字、互補加分（若有）
- 結尾給一句可執行的相處建議（advice 欄位獨立放）

## 視角
使用者會指定「lens」：lover（戀愛）/ partner（事業夥伴）/ family（家人）。請按該視角詮釋同一份命盤。

## 輸出
僅輸出 JSON，符合 schema。不要 markdown fence、不要免責聲明。`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    body: { type: 'string' },
    advice: { type: 'string' },
  },
  required: ['headline', 'body', 'advice'],
};

const REL_LABEL = {
  same: '同氣相求（日主同元素）',
  'a-feeds-b': '甲生乙（甲方滋養乙方）',
  'b-feeds-a': '乙生甲（乙方滋養甲方）',
  'a-controls-b': '甲剋乙（甲方對乙方有張力）',
  'b-controls-a': '乙剋甲（乙方對甲方有張力）',
  neutral: '平和並行',
};
const LENS_LABEL = {
  lover: '戀愛伴侶',
  partner: '事業夥伴',
  family: '家人親緣',
};

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
const ALLOWED_REFERERS = (process.env.ALLOWED_REFERERS || 'http://localhost:3000,http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
function isAllowedReferer(r) {
  if (!r) return false;
  // Dev convenience: any localhost port is allowed (vercel dev / vite dev / etc).
  if (/^https?:\/\/localhost(:\d+)?(\/|$)/.test(r)) return true;
  return ALLOWED_REFERERS.some((a) => r.startsWith(a));
}
const RATE_WINDOW_MS = 60_000, RATE_MAX = 5;
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) { buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return false; }
  if (b.count >= RATE_MAX) return true;
  b.count++; return false;
}
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!isAllowedReferer(req.headers.referer || req.headers.origin)) return res.status(403).json({ error: 'Forbidden' });
  if (rateLimited(clientIp(req))) { res.setHeader('Retry-After', '60'); return res.status(429).json({ error: '請求過於頻繁' }); }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { a, b, result, lens } = body;
  if (!a?.name || !a?.date || !b?.name || !b?.date || !result) {
    return res.status(400).json({ error: 'Missing required fields: a, b, result' });
  }
  const lensKey = ['lover', 'partner', 'family'].includes(lens) ? lens : 'lover';

  const dist = (d) => `金${d.metal} 木${d.wood} 水${d.water} 火${d.fire} 土${d.earth}`;
  const userPayload = [
    `視角：${LENS_LABEL[lensKey]}`,
    '',
    `甲方：${a.name}（生於 ${a.date}${a.time ? ' ' + a.time : ''}）— 日主 ${result.ea}`,
    `  五行分布：${dist(result.da)}`,
    `乙方：${b.name}（生於 ${b.date}${b.time ? ' ' + b.time : ''}）— 日主 ${result.eb}`,
    `  五行分布：${dist(result.db)}`,
    '',
    `合盤分數：${result.score} / 100`,
    `關係性質：${REL_LABEL[result.rel] || result.rel}`,
    `互補加分：+${result.complement || 0}（對方補上自己缺少的元素時加分）`,
    '',
    'headline: 6–14 字標題；body: 500–700 字主文，分四個層次（總斷氣象 → 互動結構 → 張力與互補 → 節奏建議），每層次都要引用具體命盤事實；advice: 一句可執行的相處建議。',
  ].join('\n');

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: userPayload }],
    });
    const textBlock = response.content.find((bl) => bl.type === 'text');
    if (!textBlock) return res.status(502).json({ error: 'No text content', stop_reason: response.stop_reason });
    let parsed;
    try { parsed = JSON.parse(textBlock.text); }
    catch { return res.status(502).json({ error: 'Bad JSON', raw: textBlock.text.slice(0, 300) }); }
    return res.status(200).json(parsed);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Rate limited' });
    if (error instanceof Anthropic.APIError) return res.status(error.status || 502).json({ error: error.message });
    return res.status(500).json({ error: 'Unexpected', detail: String(error?.message || error) });
  }
}
