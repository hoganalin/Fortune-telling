// Aura AI Studio — single-file prototype
// Design system declared at top as CSS variables; 五行 accent switches at runtime.

import { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// 1. DESIGN TOKENS (五行 color system + motion)
// ─────────────────────────────────────────────────────────────────────────
const ELEMENTS = {
  metal: { zh: '金', en: 'Metal',  primary: '#E8D5B7', deep: '#C9A961', glow: '232, 213, 183', poem: '鋒芒內斂，決斷如秋' },
  wood:  { zh: '木', en: 'Wood',   primary: '#A4C9B2', deep: '#6B8E7F', glow: '164, 201, 178', poem: '生發舒展，向陽而長' },
  water: { zh: '水', en: 'Water',  primary: '#6A8CAF', deep: '#2A3F5F', glow: '106, 140, 175', poem: '至柔至剛，因勢利導' },
  fire:  { zh: '火', en: 'Fire',   primary: '#E85D55', deep: '#8B1D2E', glow: '232, 93, 85',   poem: '炎上明動，光而不耀' },
  earth: { zh: '土', en: 'Earth',  primary: '#D4B896', deep: '#8B6F47', glow: '212, 184, 150', poem: '厚德載物，中正安舒' },
};

// 天干 index → 五行
//  0:甲 1:乙 = 木   2:丙 3:丁 = 火   4:戊 5:己 = 土   6:庚 7:辛 = 金   8:壬 9:癸 = 水
const STEM_ELEMENT = ['wood','wood','fire','fire','earth','earth','metal','metal','water','water'];

// Gregorian → Julian Day Number (Fliegel–Van Flandern).
function gregorianToJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5)
    + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400)
    - 32045;
}

// Day-stem index for a Gregorian date.
// Anchor: 2000-01-07 (JDN 2451551) is a 甲子日 (day-stem 甲, index 0).
// Verified against 1992-07-17 → 甲 (甲午日主).
function dayStemIndex(dateStr) {
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return 0;
  const [y, m, d] = parts;
  const diff = gregorianToJDN(y, m, d) - 2451551;
  return ((diff % 10) + 10) % 10;
}

function deriveElement(name, dateStr) {
  if (!dateStr) return 'water';
  return STEM_ELEMENT[dayStemIndex(dateStr)];
}

// ─────────────────────────────────────────────────────────────────────────
// 1b. I18N — zh / en dictionary + LangContext
// ─────────────────────────────────────────────────────────────────────────
const STRINGS = {
  // Top bar
  nav_ceremony:   { zh: '儀式', en: 'Ceremony' },
  nav_elements:   { zh: '五行', en: 'Elements' },
  nav_archive:    { zh: '封存', en: 'Archive' },

  // Hero
  hero_edition:   { zh: 'Edition 壹 · 二〇二六 · 春',      en: 'Edition 壹 · Spring 2026' },
  hero_l1:        { zh: '顯化你的',                        en: 'Divine your' },
  hero_l2:        { zh: '人生氣場。',                      en: "life's aura." },
  hero_sub_a:     { zh: '以五行命盤為因，生成式 AI 為用。',  en: 'Five elements as cause, generative AI as vessel.' },
  hero_sub_b_pre: { zh: '為你的人生，顯化一場專屬的',        en: 'For your life, manifest a' },
  hero_sub_b_em:  { zh: '儀式',                            en: 'ritual' },
  hero_sub_b_post:{ zh: '。',                              en: ' of your own.' },
  hero_cta:       { zh: '開始儀式 · Begin Ritual',         en: 'Begin Ritual · 開始儀式' },
  hero_scroll:    { zh: '↓ 或向下觀察',                    en: '↓ Or scroll to observe' },
  hero_locale:    { zh: 'N 25°02′ · E 121°33′ · 台北',    en: 'N 25°02′ · E 121°33′ · Taipei' },

  // Ritual
  r_chapter:      { zh: 'Chapter I · 問名',               en: 'Chapter I · Inquiry' },
  r_title_pre:    { zh: '報上你的',                        en: 'Leave your' },
  r_title_em:     { zh: '名諱',                            en: 'name' },
  r_title_post:   { zh: '',                                en: ' at the threshold' },
  r_tagline:      { zh: 'Leave your name at the threshold.', en: '以姓名與生辰，開啟命盤。' },
  r_name:         { zh: '姓名 · Full Name',               en: 'Full Name · 姓名' },
  r_date:         { zh: '生辰 · Date of Birth',           en: 'Date of Birth · 生辰' },
  r_time:         { zh: '時辰 · Hour (optional)',         en: 'Hour (optional) · 時辰' },
  r_placeholder:  { zh: '例：林雲深',                      en: 'e.g. Lin Yun-shen' },
  r_submit:       { zh: '投入爐中 · Cast to the Forge',   en: 'Cast to the Forge · 投入爐中' },
  r_privacy:      { zh: '· 資料不會離開此工作階段 ·',       en: '· Data never leaves this session ·' },

  // Ceremony
  c_phase_lbl:    { zh: '第',                              en: 'Phase' },
  c_of:           { zh: '階 · 共三階',                     en: 'of 03 ·' },
  c_forging:      { zh: '正在凝聚命盤氣場',                 en: 'Forging the aura' },
  c_p1_zh:        { zh: '凝神', en: '凝神' },
  c_p1_en:        { zh: 'Centering', en: 'Centering' },
  c_p1_text:      { zh: '靜候心神歸位，筆墨未落⋯',          en: 'Centering the spirit, ink yet to fall…' },
  c_p2_zh:        { zh: '感應', en: '感應' },
  c_p2_en:        { zh: 'Resonating', en: 'Resonating' },
  c_p2_text:      { zh: '五行流轉，擷取命盤頻率⋯',          en: 'The five elements turn, the frequency emerges…' },
  c_p3_zh:        { zh: '顯化', en: '顯化' },
  c_p3_en:        { zh: 'Manifesting', en: 'Manifesting' },
  c_p3_text:      { zh: '意象成形，AI 執筆落款⋯',           en: 'The image takes form, the AI inscribes…' },

  // Element Reveal
  er_chapter:     { zh: 'Chapter II · 五行定位',          en: 'Chapter II · Constitution' },
  er_you:         { zh: '，你的命盤主屬',                   en: ', your primary element is' },
  er_guest:       { zh: '訪客',                            en: 'Guest' },
  er_meta:        { zh: '主元素',                          en: 'Primary Element' },

  // Slogan
  sl_chapter:     { zh: 'Chapter III · 品牌口號',          en: 'Chapter III · Slogan' },
  sl_gen:         { zh: '已生成 · Edition 壹',             en: 'Generated · Edition 壹' },

  // Visual
  vp_chapter:     { zh: 'Chapter IV · 動態視覺',          en: 'Chapter IV · Visual Package' },
  vp_title:       { zh: '意象 · 4K 動態視覺',              en: 'Imagery · 4K Motion Aura' },
  vp_spec:        { zh: '3840 × 2160 · 24fps · H.265',    en: '3840 × 2160 · 24fps · H.265' },
  vp_mark_label:  { zh: '顯化的氣場 · Edition 壹',         en: 'A Manifested Aura · Edition 壹' },
  vp_format:      { zh: '格式',      en: 'Format' },
  vp_aspect:      { zh: '畫面比',    en: 'Aspect' },
  vp_duration:    { zh: '片長',      en: 'Duration' },

  // Services
  sv_chapter:     { zh: 'Chapter V · 服務擬定',           en: 'Chapter V · Offerings' },
  sv_title_pre:   { zh: '為你擬定的', en: 'Three services' },
  sv_title_em:    { zh: '三道服務',   en: 'calibrated' },
  sv_title_post:  { zh: '',           en: ' for you' },
  sv_tagline:     { zh: '每項服務皆依你的主元素共振而調校。', en: 'Each service is calibrated to the resonance of your primary element.' },
  sv_inquire:     { zh: '洽談 →',     en: 'Inquire →' },

  // Analysis
  an_doc:         { zh: '文件編號 AAS-2026-壹 · 機密',     en: 'Document № AAS-2026-壹 · Confidential' },
  an_title_pre:   { zh: '關於',        en: 'An Analysis of' },
  an_title_em:    { zh: '',            en: 'the' },
  an_title_post:  { zh: '之體質分析',   en: 'Constitution' },
  an_subject:     { zh: '受命者',      en: 'Subject' },
  an_meta_primary:{ zh: '主元素',      en: 'Primary Element' },
  an_meta_season: { zh: '時令',        en: 'Season' },
  an_meta_dir:    { zh: '方位',        en: 'Direction' },
  an_meta_res:    { zh: '共振頻率',    en: 'Resonance' },
  an_meta_prep:   { zh: '起草',        en: 'Prepared by' },
  an_season_v:    { zh: '春 · 木旺',   en: 'Spring · Wood-dominant' },
  an_dir_v:       { zh: '東方',        en: 'East' },
  an_res_v:       { zh: 'A-432Hz',    en: 'A-432Hz' },
  an_prep_v:      { zh: 'Aura AI Studio', en: 'Aura AI Studio' },
  an_s1_h:        { zh: '§ 01 — 體質綜述',       en: '§ 01 — Constitutional Summary' },
  an_s1_zh:       { zh: '',                      en: '體質綜述' },
  an_s2_h:        { zh: '§ 02 — 品牌定位',       en: '§ 02 — Brand Positioning' },
  an_s2_zh:       { zh: '',                      en: '品牌定位建議' },
  an_s3_h:        { zh: '§ 03 — 節奏與儀式',     en: '§ 03 — Cadence & Ritual' },
  an_s3_zh:       { zh: '',                      en: '節奏與儀式' },
  an_end:         { zh: '— 文件終 —',            en: '— End of document —' },
  an_page:        { zh: '第 01 頁 / 共 01 頁',    en: 'Page 01 / 01' },

  // Footer
  ft_end_hed_a:   { zh: '另一場氣場',             en: 'Another aura' },
  ft_end_hed_b:   { zh: '正等待一個名字。',        en: 'awaits a name.' },
  ft_restart:     { zh: '重啟儀式 · Restart →',   en: 'Restart Ritual · 重啟 →' },
  ft_studio:      { zh: '工作室',                 en: 'Studio' },
  ft_studio_v:    { zh: 'Aura AI Studio',        en: 'Aura AI Studio' },
  ft_studio_sub:  { zh: '東方命理 × 生成式 AI',    en: 'Eastern Divination × Generative AI' },
  ft_contact:     { zh: '聯絡',                   en: 'Contact' },
  ft_author:      { zh: '作者',                   en: 'Author' },
  ft_author_v:    { zh: 'Studio 原型',            en: 'Prototype by Studio' },
  ft_stack:       { zh: '技術',                   en: 'Stack' },
  ft_edition:     { zh: 'Edition 壹 · 二〇二六春', en: 'Edition 壹 · Spring 2026' },
  ft_claim:       { zh: '五行皆出於爐 · 不主宗派',  en: 'All elements forged · No lineage claimed' },
  ft_fin:         { zh: '— 終 —',                 en: '— fin —' },

  // Archive drawer
  ar_title:       { zh: '封存 · Archive',         en: 'Archive · 封存' },
  ar_empty:       { zh: '尚無任何命盤。完成一場儀式，它會被封存於此。',
                    en: 'No readings yet. Complete a ritual — it will be archived here.' },
  ar_count_a:     { zh: '共',            en: '' },
  ar_count_b:     { zh: '筆封存',         en: ' entries archived' },
  ar_open:        { zh: '開啟 →',         en: 'Open →' },
  ar_delete:      { zh: '刪除',           en: 'Delete' },
  ar_close:       { zh: '關閉',           en: 'Close' },
  ar_clear:       { zh: '全部清除',       en: 'Clear all' },
  ar_generated:   { zh: '生成於',         en: 'Generated' },
};

const LangContext = createContext({ lang: 'zh', t: (k) => k, setLang: () => {} });
const useLang = () => useContext(LangContext);
const makeT = (lang) => (key) => (STRINGS[key] && STRINGS[key][lang]) ?? key;

// Deterministic per-element content pools — used as fallback when the AI
// reading endpoint is unavailable, and as an instant scaffold before the AI
// response arrives.
const POOLS = {
  metal: {
    brand: 'Forge & Still', slogan: '鋒芒所向，皆成器物。', sloganEn: 'Every edge, an instrument.',
    lessons: [
      { zh: '立斷', en: 'Decisive Cut', glyph: '斷', desc: '本月擇一懸而未決之事，於月圓前了斷。金貴決不貴繞。', tag: '今月 · 行動' },
      { zh: '削繁', en: 'Prune', glyph: '削', desc: '盤點手邊事物，割捨三成不必要之物與人。金旺於秋，宜減不宜增。', tag: '季度 · 整理' },
      { zh: '止語', en: 'Keep Silence', glyph: '默', desc: '每週擇一日不多言。金重在質不在量，一言九鼎勝百句。', tag: '每週 · 修持' },
    ],
    remedies: [
      { zh: '白露作息', en: 'Dew-hour Rhythm', glyph: '晨', desc: '早睡早起，卯時（5–7AM）起身，對應肺經。避熬夜傷金。', tag: '作息' },
      { zh: '辛白食補', en: 'White & Pungent', glyph: '食', desc: '多食白色食物（梨、白蘿蔔、銀耳），適量辛味（薑、蔥）宣肺。', tag: '飲食' },
      { zh: '西向靜坐', en: 'Westward Sitting', glyph: '坐', desc: '書房或工作位面西，金氣歸位。掛一幅留白畫作為焦點。', tag: '環境' },
    ],
  },
  wood: {
    brand: 'Verdant Studio', slogan: '舒展如春，生發不息。', sloganEn: 'Grow towards the light.',
    lessons: [
      { zh: '伸展', en: 'Unfold', glyph: '舒', desc: '本月啟動一件擱置已久的創作。木性生發，忌壓抑。', tag: '今月 · 啟動' },
      { zh: '立志', en: 'Set Direction', glyph: '志', desc: '寫下未來三年之向。木需有方向方能成林。', tag: '季度 · 定向' },
      { zh: '晨起', en: 'Greet the Dawn', glyph: '曉', desc: '每日見日出一次，接引木氣。哪怕只是窗邊。', tag: '每日 · 修持' },
    ],
    remedies: [
      { zh: '青色入目', en: 'Green Upon Eye', glyph: '望', desc: '每日望綠植或遠山 10 分鐘，青色養肝。忌久視螢幕。', tag: '養目' },
      { zh: '酸甘食補', en: 'Sour & Sweet', glyph: '食', desc: '晨飲檸檬溫水，餐食加入青梅、番茄、綠葉菜。疏肝行氣。', tag: '飲食' },
      { zh: '東向生發', en: 'Eastward Growth', glyph: '向', desc: '床頭或書桌面東，置一盆生機盎然之綠植。', tag: '環境' },
    ],
  },
  water: {
    brand: 'Moonwell', slogan: '至柔克剛，因勢而流。', sloganEn: 'Flow finds its own form.',
    lessons: [
      { zh: '深潛', en: 'Descend', glyph: '潛', desc: '本月閉關三日，不社交、不表態。水聚於深處方有力。', tag: '今月 · 內觀' },
      { zh: '等候', en: 'Wait', glyph: '待', desc: '遇一難決之事，刻意延後 21 日再回應。水不與石爭，繞之則過。', tag: '持續 · 修養' },
      { zh: '流觀', en: 'Flow & Observe', glyph: '流', desc: '每週記錄三件「流動」之事——不論錢、情、事——觀其去向。', tag: '每週 · 覺察' },
    ],
    remedies: [
      { zh: '子時歸眠', en: 'Midnight Rest', glyph: '眠', desc: '子時前（晚 11 點）入睡，水旺於夜，對應腎經。', tag: '作息' },
      { zh: '黑色食補', en: 'Black & Salty', glyph: '食', desc: '黑豆、黑芝麻、海帶、核桃。適量鹹味養腎，忌過寒涼。', tag: '飲食' },
      { zh: '北向藏納', en: 'Northern Storage', glyph: '藏', desc: '貴重之物宜置家中北方，冷色調裝飾，忌北位雜亂。', tag: '環境' },
    ],
  },
  fire: {
    brand: 'Cinnabar & Co.', slogan: '炎上明動，光而不耀。', sloganEn: 'Burn without blinding.',
    lessons: [
      { zh: '明志', en: 'Declare', glyph: '明', desc: '本月對一人坦白心之所向。火需表達方能不悶燒。', tag: '今月 · 表態' },
      { zh: '節焰', en: 'Temper the Flame', glyph: '節', desc: '每日擇一時段不碰通訊。火旺易焚己，需自留餘地。', tag: '每日 · 收斂' },
      { zh: '燃眾', en: 'Kindle Others', glyph: '燃', desc: '本季扶助一位後進。火傳則不滅，獨燃必熄。', tag: '季度 · 傳承' },
    ],
    remedies: [
      { zh: '午後小憩', en: 'Noon Repose', glyph: '憩', desc: '午時（11AM–1PM）靜臥 20 分鐘，對應心經，養神藏火。', tag: '作息' },
      { zh: '苦紅食補', en: 'Bitter & Red', glyph: '食', desc: '苦瓜、紅豆、蓮子、番茄。苦味清心火，紅色入心。少辛辣。', tag: '飲食' },
      { zh: '南位明燈', en: 'Southern Light', glyph: '燈', desc: '居所南方置暖光小燈，夜間微明。忌南位陰暗潮濕。', tag: '環境' },
    ],
  },
  earth: {
    brand: 'Terra Hall', slogan: '厚德載物，行遠必自邇。', sloganEn: 'To go far, begin close.',
    lessons: [
      { zh: '築基', en: 'Lay the Ground', glyph: '基', desc: '本月不追新，專注一事做滿 30 日。土貴在厚積。', tag: '今月 · 沉澱' },
      { zh: '守信', en: 'Keep the Word', glyph: '信', desc: '盤點三個未兌現之承諾，本月內全部了結。土失信則崩。', tag: '立即 · 修信' },
      { zh: '納眾', en: 'Hold Space', glyph: '納', desc: '本季定期邀一次友人相聚於家中。土主聚合，不聚則散。', tag: '季度 · 連結' },
    ],
    remedies: [
      { zh: '三餐定時', en: 'Regular Meals', glyph: '食', desc: '三餐準點，勿過飢過飽。辰時（7–9AM）早餐為要，養脾。', tag: '作息' },
      { zh: '黃甘食補', en: 'Yellow & Sweet', glyph: '甘', desc: '小米、南瓜、地瓜、山藥。甘味養脾，忌生冷與過食。', tag: '飲食' },
      { zh: '中宮安定', en: 'Anchor the Center', glyph: '中', desc: '居所中央保持空曠、整潔，置一件厚重擺設（石、陶）定位。', tag: '環境' },
    ],
  },
};

// Merge a successful /api/reading response over the deterministic fallback —
// AI fields win; missing fields fall back so the UI always has something to render.
function mergeReading(ai, fallback) {
  return {
    element: ai.element || fallback.element,
    brand: ai.brand || fallback.brand,
    slogan: ai.slogan?.zh || fallback.slogan,
    sloganEn: ai.slogan?.en || fallback.sloganEn,
    lessons: Array.isArray(ai.lessons) && ai.lessons.length ? ai.lessons : fallback.lessons,
    remedies: Array.isArray(ai.remedies) && ai.remedies.length ? ai.remedies : fallback.remedies,
    fortune: ai.fortune || null,
    analysis: ai.analysis || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 1c. ARCHIVE (localStorage list of past readings)
// ─────────────────────────────────────────────────────────────────────────
const ARCHIVE_KEY = 'aura_archive_v1';
const loadArchive = () => {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
};
const saveArchive = (list) => {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
};
const addToArchive = (entry) => {
  const list = loadArchive();
  // de-dupe by id if present
  const filtered = list.filter(x => x.id !== entry.id);
  filtered.unshift(entry);
  saveArchive(filtered.slice(0, 24));
  return filtered;
};

// ─────────────────────────────────────────────────────────────────────────
// 2. CANVAS FLOW-FIELD (ink-like particles, not a star field)
// ─────────────────────────────────────────────────────────────────────────
function FlowField({ intensity = 1, element = 'water' }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const COUNT = Math.floor(280 * intensity);
    particlesRef.current = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0, vy: 0,
      life: Math.random() * 200,
      maxLife: 180 + Math.random() * 220,
      w: 0.3 + Math.random() * 0.9,
    }));

    // Perlin-ish noise via layered sines (cheap, deterministic)
    const noise = (x, y, t) =>
      Math.sin(x * 0.0024 + t * 0.0006) * Math.cos(y * 0.003 - t * 0.0004) +
      Math.sin((x + y) * 0.0011 + t * 0.0009) * 0.6;

    const tick = () => {
      tRef.current += 1;
      const t = tRef.current;
      // subtle trail fade (paper-ink feel)
      ctx.fillStyle = 'rgba(10, 10, 15, 0.08)';
      ctx.fillRect(0, 0, w, h);

      const glow = ELEMENTS[element].glow;
      for (const p of particlesRef.current) {
        const n = noise(p.x, p.y, t);
        const ang = n * Math.PI * 1.6;
        p.vx = p.vx * 0.92 + Math.cos(ang) * 0.6;
        p.vy = p.vy * 0.92 + Math.sin(ang) * 0.6;
        p.x += p.vx; p.y += p.vy; p.life += 1;

        const alpha = Math.min(1, p.life / 40) * Math.max(0, 1 - p.life / p.maxLife);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${glow}, ${alpha * 0.55})`;
        ctx.lineWidth = p.w;
        ctx.moveTo(p.x - p.vx, p.y - p.vy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        if (p.life > p.maxLife || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
          p.x = Math.random() * w; p.y = Math.random() * h;
          p.vx = 0; p.vy = 0; p.life = 0;
          p.maxLife = 180 + Math.random() * 220;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [intensity, element]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. CUSTOM CURSOR (plus-lighter blend, follows with spring lag)
// ─────────────────────────────────────────────────────────────────────────
function CursorFollower() {
  const ref = useRef(null);
  const innerRef = useRef(null);
  // Layer 1: static media-query gate — any device lacking hover+fine-pointer is out.
  const mediaOk = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !('ontouchstart' in window);
  // Layer 2: runtime gate — only show once an actual mousemove fires. Touch devices
  // that slip past the media query still never dispatch mousemove, so the dot never appears.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!mediaOk) return;
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let tx = x, ty = y;
    const onMove = (e) => {
      tx = e.clientX; ty = e.clientY;
      setVisible(true);
    };
    window.addEventListener('mousemove', onMove);
    let raf = 0;
    const loop = () => {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      if (ref.current) ref.current.style.transform = `translate(${x - 140}px, ${y - 140}px)`;
      if (innerRef.current) innerRef.current.style.transform = `translate(${tx - 4}px, ${ty - 4}px)`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, [mediaOk]);

  if (!mediaOk || !visible) return null;
  return (
    <>
      <div ref={ref} className="pointer-events-none fixed top-0 left-0 z-[100] w-[280px] h-[280px] rounded-full"
           style={{ background: 'radial-gradient(circle, rgba(var(--accent-glow), 0.14), transparent 60%)', mixBlendMode: 'plus-lighter' }} />
      <div ref={innerRef} className="pointer-events-none fixed top-0 left-0 z-[101] w-2 h-2 rounded-full bg-white/80" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. MAGNETIC BUTTON (cursor-proximity offset)
// ─────────────────────────────────────────────────────────────────────────
function MagneticButton({ children, onClick, className = '', disabled = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 120) {
        const strength = (1 - dist / 120) * 0.35;
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      } else {
        el.style.transform = 'translate(0,0)';
      }
    };
    const onLeave = () => { el.style.transform = 'translate(0,0)'; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseleave', onLeave); };
  }, []);
  return (
    <button ref={ref} onClick={onClick} disabled={disabled}
      className={`transition-transform duration-200 ease-out ${className}`}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5. REVEAL (whileInView-style with IntersectionObserver)
// ─────────────────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 24, className = '', as = 'div' }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Component = as;
  return (
    <Component ref={ref} className={className}
      style={{
        transform: seen ? 'translateY(0)' : `translateY(${y}px)`,
        opacity: seen ? 1 : 0,
        transition: `transform 1.1s cubic-bezier(.2,.7,.2,1) ${delay}ms, opacity 1.1s ease ${delay}ms`,
      }}>
      {children}
    </Component>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6. STAGGER TEXT (char-by-char for hero)
// ─────────────────────────────────────────────────────────────────────────
function StaggerText({ text, className = '', delay = 0, step = 40 }) {
  return (
    <span className={className}>
      {Array.from(text).map((ch, i) => (
        <span key={i} className="inline-block"
          style={{
            animation: `staggerIn 1.2s cubic-bezier(.2,.7,.2,1) ${delay + i * step}ms both`,
          }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 7. HERO
// ─────────────────────────────────────────────────────────────────────────
function Hero({ onStart, element, onOpenArchive, onRestart }) {
  const { t, lang } = useLang();
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <section className="relative min-h-[100vh] w-full overflow-hidden" data-screen-label="01 Hero">
      <FlowField intensity={1} element={element} />
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(var(--accent-glow), 0.10), transparent 60%)' }} />

      {/* top bar */}
      <TopBar onOpenArchive={onOpenArchive} onRestart={onRestart} />

      {/* center content */}
      <div className="relative z-10 flex flex-col items-start justify-center min-h-[calc(100vh-120px)] px-10 md:px-20 max-w-[1600px] mx-auto"
           style={{ transform: `translateY(${scrollY * 0.25}px)`, opacity: 1 - Math.min(1, scrollY / 700) }}>
        <Reveal delay={100}>
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px w-16 bg-white/30" />
            <span className="text-[11px] tracking-[0.4em] text-white/60 uppercase font-mono">{t('hero_edition')}</span>
          </div>
        </Reveal>

        <h1 className="font-serif-en text-white leading-[0.92] tracking-tight mb-6"
            style={{ fontSize: 'clamp(3.5rem, 9vw, 8.5rem)' }}>
          <StaggerText key={'l1'+lang} text={t('hero_l1')} delay={200} />
          <br />
          <span className="italic text-[rgb(var(--accent-glow))]"
                style={{ textShadow: '0 0 60px rgba(var(--accent-glow), 0.35)' }}>
            <StaggerText key={'l2'+lang} text={t('hero_l2')} delay={700} />
          </span>
        </h1>

        <Reveal delay={1400} y={16}>
          <p className="font-serif-zh text-2xl md:text-3xl text-white/75 leading-[1.4] max-w-2xl mb-12"
             style={{ letterSpacing: '0.02em' }}>
            {t('hero_sub_a')}<br/>
            {t('hero_sub_b_pre')}<span className="italic text-white">{t('hero_sub_b_em')}</span>{t('hero_sub_b_post')}
          </p>
        </Reveal>

        <Reveal delay={1700}>
          <div className="flex items-center gap-6">
            <MagneticButton onClick={onStart}
              className="group relative px-10 py-5 rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.08] hover:border-white/25">
              <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ boxShadow: '0 0 40px rgba(var(--accent-glow), 0.4), inset 0 0 30px rgba(var(--accent-glow), 0.08)' }} />
              <span className="relative flex items-center gap-4 text-white/90 font-serif-en text-base tracking-wide">
                {t('hero_cta')}
                <span className="inline-block w-5 h-px bg-white/60 group-hover:w-8 transition-all duration-500" />
              </span>
            </MagneticButton>

            <span className="text-[11px] tracking-[0.3em] text-white/40 uppercase font-mono hidden md:inline">
              {t('hero_scroll')}
            </span>
          </div>
        </Reveal>
      </div>

      {/* corner meta */}
      <div className="absolute bottom-8 left-10 right-10 z-10 flex justify-between items-end text-[10px] tracking-[0.3em] text-white/40 uppercase font-mono">
        <span>{t('hero_locale')}</span>
        <span>{new Date().toISOString().slice(0,10).replace(/-/g,'.')} · 丙午 · 清明</span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 8. RITUAL INPUT
// ─────────────────────────────────────────────────────────────────────────
function RitualInput({ onSubmit }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [focus, setFocus] = useState(false);

  const canSubmit = name.trim().length >= 1 && date.length === 10;

  return (
    <section className="relative py-40 px-6 overflow-hidden" data-screen-label="02 Ritual Input">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(var(--accent-glow), 0.06), transparent 55%)' }} />

      <div className="relative max-w-md mx-auto">
        <Reveal>
          <div className="text-center mb-10">
            <div className="text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-4">Chapter I · 問名</div>
            <h2 className="font-serif-zh text-4xl md:text-5xl text-white/95 leading-[1.1] mb-4">
              報上你的<span className="italic text-[rgb(var(--accent-glow))]">名諱</span>
            </h2>
            <p className="font-serif-en italic text-white/50 text-sm">Leave your name at the threshold.</p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className={`relative rounded-2xl border backdrop-blur-2xl transition-all duration-700 ${
            focus ? 'border-white/25 bg-white/[0.05]' : 'border-white/10 bg-white/[0.025]'
          }`}
            style={{
              boxShadow: focus
                ? `0 0 80px -10px rgba(var(--accent-glow), 0.35), inset 0 1px 0 rgba(255,255,255,0.08)`
                : 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
            {/* breathing halo */}
            <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-60"
                 style={{
                   background: `radial-gradient(ellipse at 50% 0%, rgba(var(--accent-glow), 0.15), transparent 50%)`,
                   animation: 'breathe 4s ease-in-out infinite',
                 }} />

            <div className="relative p-10 space-y-8">
              <Field label="姓名 · Full Name" value={name} onChange={setName} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholder="例：林雲深" />
              <Field label="生辰 · Date of Birth" value={date} onChange={setDate} type="date" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
              <Field label="時辰 · Hour of Birth" value={time} onChange={setTime} type="time" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
              <Field label="出生地 · Place of Birth" value={location} onChange={setLocation} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholder="例：台北市 / Taipei" />

              <div className="pt-2">
                <MagneticButton
                  onClick={() => canSubmit && onSubmit({ name, date, time, location })}
                  disabled={!canSubmit}
                  className={`w-full py-4 rounded-xl font-serif-en tracking-wide transition-all ${
                    canSubmit
                      ? 'bg-white text-[#0A0A0F] hover:bg-[rgb(var(--accent-glow))]'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }`}>
                  <span className="flex items-center justify-center gap-3">
                    投入爐中 · Cast to the Forge
                    <span className="inline-block">→</span>
                  </span>
                </MagneticButton>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={300}>
          <p className="mt-8 text-center text-[11px] tracking-[0.25em] text-white/35 uppercase font-mono">
            · Data never leaves this session ·
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, onFocus, onBlur }) {
  return (
    <div className="group">
      <label className="block text-[10px] tracking-[0.3em] text-white/45 uppercase font-mono mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-0 border-b border-white/15 pb-2 text-white text-lg font-serif-zh
                   focus:outline-none focus:border-[rgb(var(--accent-glow))]
                   placeholder:text-white/25 transition-colors"
        style={{ colorScheme: 'dark' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 9. GENERATION CEREMONY (3-phase ritual loader)
// ─────────────────────────────────────────────────────────────────────────
const PHASES = [
  { zh: '凝神', en: 'Centering', text: '靜候心神歸位，筆墨未落⋯' },
  { zh: '感應', en: 'Resonating', text: '五行流轉，擷取命盤頻率⋯' },
  { zh: '顯化', en: 'Manifesting', text: '意象成形，AI 執筆落款⋯' },
];

function Ceremony({ active, onDone, element, ready = true }) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting phase/progress when the controlling prop flips off is intentional; there is no external subscription to drive this
      setPhase(0); setProgress(0); setAnimationDone(false);
      return;
    }
    let p = 0;
    const interval = setInterval(() => {
      p += 0.8;
      setProgress(Math.min(100, p));
      if (p < 33) setPhase(0);
      else if (p < 66) setPhase(1);
      else setPhase(2);
      if (p >= 100) { clearInterval(interval); setAnimationDone(true); }
    }, 60);
    return () => clearInterval(interval);
  }, [active]);

  // Only transition out of the ceremony once BOTH the animation has finished
  // AND the AI reading is ready. Holds at 100% until the reading arrives.
  useEffect(() => {
    if (!active || !animationDone || !ready) return;
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [active, animationDone, ready, onDone]);

  // compass canvas
  useEffect(() => {
    if (!active) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 520;
    c.width = size * dpr; c.height = size * dpr; ctx.scale(dpr, dpr);
    let raf = 0, t = 0;
    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;
      const glow = ELEMENTS[element].glow;

      // outer rings
      for (let r = 1; r <= 4; r++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${glow}, ${0.08 + r * 0.03})`;
        ctx.lineWidth = 0.6;
        ctx.arc(cx, cy, 60 + r * 45, 0, Math.PI * 2);
        ctx.stroke();
      }

      // rotating ticks (outer)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.003);
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const len = i % 6 === 0 ? 14 : 6;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${glow}, ${0.35 + (i % 6 === 0 ? 0.3 : 0)})`;
        ctx.lineWidth = i % 6 === 0 ? 1.2 : 0.5;
        ctx.moveTo(Math.cos(a) * 230, Math.sin(a) * 230);
        ctx.lineTo(Math.cos(a) * (230 - len), Math.sin(a) * (230 - len));
        ctx.stroke();
      }
      ctx.restore();

      // counter-rotating inner
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.006);
      const stems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
      ctx.font = '16px "Noto Serif TC", serif';
      ctx.fillStyle = `rgba(${glow}, 0.7)`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(a) * 180, Math.sin(a) * 180);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(stems[i], 0, 0);
        ctx.restore();
      }
      ctx.restore();

      // inner rotating wedge (element focus)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.012);
      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, 100);
      grad.addColorStop(0, `rgba(${glow}, 0.5)`);
      grad.addColorStop(1, `rgba(${glow}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.fill();

      // particle orbit
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 + t * 0.02;
        const r = 120 + Math.sin(t * 0.04 + i) * 18;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${glow}, ${0.4 + Math.sin(t * 0.05 + i) * 0.3})`;
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // center dot
      ctx.beginPath();
      ctx.fillStyle = `rgba(${glow}, 0.9)`;
      ctx.shadowColor = `rgba(${glow}, 0.9)`;
      ctx.shadowBlur = 30;
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, element]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex items-center justify-center overflow-hidden"
         style={{ animation: 'fadeIn 0.8s ease both' }}>
      <FlowField intensity={1.4} element={element} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />

      <div className="relative flex flex-col items-center">
        <canvas ref={canvasRef} className="w-[520px] h-[520px] max-w-[90vw] max-h-[90vw]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {animationDone && !ready ? (
            <div className="text-center" style={{ animation: 'phaseSwap 0.6s cubic-bezier(.2,.7,.2,1) both' }}>
              <div className="text-[10px] tracking-[0.5em] text-white/50 uppercase font-mono mb-3">
                Awaiting the Oracle · 等待天機
              </div>
              <h3 className="font-serif-zh text-6xl text-white mb-3 tracking-[0.15em]">
                <span style={{ animation: 'breathe 2.4s ease-in-out infinite' }}>顯化中</span>
              </h3>
              <p className="font-serif-zh text-sm text-white/60 italic">
                命盤正在 Claude 筆下落款，略候片刻…（通常 30–80 秒）
              </p>
            </div>
          ) : (
            <div key={phase} className="text-center" style={{ animation: 'phaseSwap 0.6s cubic-bezier(.2,.7,.2,1) both' }}>
              <div className="text-[10px] tracking-[0.5em] text-white/50 uppercase font-mono mb-3">
                Phase {String(phase + 1).padStart(2, '0')} of 03 · {PHASES[phase].en}
              </div>
              <h3 className="font-serif-zh text-6xl text-white mb-3 tracking-[0.15em]">{PHASES[phase].zh}</h3>
              <p className="font-serif-zh text-sm text-white/60 italic">{PHASES[phase].text}</p>
            </div>
          )}
        </div>
      </div>

      {/* progress rail */}
      <div className="absolute bottom-16 left-0 right-0 px-10">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between text-[10px] tracking-[0.3em] text-white/40 uppercase font-mono mb-3">
            <span>{animationDone && !ready ? 'Awaiting the oracle' : 'Forging the aura'}</span>
            <span>{animationDone && !ready ? '∞' : `${String(Math.floor(progress)).padStart(3, '0')}%`}</span>
          </div>
          <div className="h-px bg-white/10 relative">
            <div className="absolute left-0 top-0 h-px bg-[rgb(var(--accent-glow))] transition-all duration-100"
                 style={{
                   width: `${progress}%`,
                   boxShadow: `0 0 12px rgba(var(--accent-glow), 0.8)`,
                   animation: animationDone && !ready ? 'breathe 1.8s ease-in-out infinite' : 'none',
                 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 10. ELEMENT REVEAL
// ─────────────────────────────────────────────────────────────────────────
function ElementReveal({ element, name }) {
  const el = ELEMENTS[element];
  return (
    <section className="relative min-h-screen py-40 px-10 overflow-hidden flex items-center" data-screen-label="03 Element">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: `linear-gradient(180deg, transparent 0%, rgba(${el.glow}, 0.12) 50%, transparent 100%)` }} />
      <FlowField intensity={0.5} element={element} />

      <div className="relative max-w-[1600px] mx-auto w-full grid md:grid-cols-12 gap-10 items-center">
        <div className="md:col-span-5">
          <Reveal>
            <div className="text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-6">
              Chapter II · 五行定位
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="font-serif-zh text-white/70 text-xl leading-relaxed mb-4">
              {name || '訪客'}，你的命盤主屬
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex items-baseline gap-6 mb-8">
              <div className="font-serif-zh leading-none"
                   style={{
                     fontSize: 'clamp(8rem, 18vw, 18rem)',
                     color: el.primary,
                     textShadow: `0 0 80px rgba(${el.glow}, 0.5)`,
                   }}>
                {el.zh}
              </div>
              <div>
                <div className="font-serif-en italic text-white/60 text-3xl">{el.en}</div>
                <div className="font-mono text-[11px] tracking-[0.3em] text-white/40 uppercase mt-2">Element · Primary</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={360}>
            <p className="font-serif-zh text-2xl md:text-3xl text-white/85 leading-[1.5] max-w-xl"
               style={{ textWrap: 'pretty' }}>
              「{el.poem}」
            </p>
          </Reveal>
        </div>

        <div className="md:col-span-7">
          <Reveal delay={480}>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(ELEMENTS).map(([k, v]) => (
                <div key={k}
                     className={`aspect-[2/3] rounded-xl border backdrop-blur-xl p-4 flex flex-col justify-between relative overflow-hidden transition-all ${
                       k === element ? 'border-white/30 bg-white/[0.05] scale-105' : 'border-white/10 bg-white/[0.015] opacity-60'
                     }`}
                     style={ k === element ? { boxShadow: `0 0 60px -10px rgba(${v.glow}, 0.5)` } : {}}>
                  <div className="text-[9px] tracking-[0.3em] text-white/40 uppercase font-mono">{String(Object.keys(ELEMENTS).indexOf(k)+1).padStart(2,'0')}</div>
                  <div className="text-center">
                    <div className="font-serif-zh" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: v.primary }}>{v.zh}</div>
                    <div className="font-serif-en italic text-[11px] text-white/50 mt-1">{v.en}</div>
                  </div>
                  <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${v.primary}, transparent)` }} />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 11. ELEMENTS PREVIEW (pre-generation — gives 五行 nav its own target)
function ElementsPreview() {
  const { lang } = useLang();
  return (
    <section className="relative py-32 px-10 overflow-hidden" data-screen-label="03 Element">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(var(--accent-glow), 0.05), transparent 60%)' }} />
      <div className="relative max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <div className="text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-3">
                {lang === 'zh' ? '五行 · Elements' : 'Five Elements · 五行'}
              </div>
              <h2 className="font-serif-zh text-5xl md:text-6xl text-white leading-[1.05]">
                {lang === 'zh'
                  ? <>五元素或成<br/><span className="italic text-[rgb(var(--accent-glow))]">一套命盤。</span></>
                  : <>Five elements,<br/><span className="italic text-[rgb(var(--accent-glow))]">one constitution.</span></>}
              </h2>
            </div>
            <div className="font-serif-en italic text-white/40 text-base max-w-sm text-right hidden md:block">
              {lang === 'zh'
                ? '生辰定位之主元素。'
                : 'Birth year determines the primary element.'}
            </div>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(ELEMENTS).map(([k, v], i) => (
            <Reveal key={k} delay={i * 80}>
              <div className="aspect-[2/3] rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-white/25 transition-colors">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                     style={{ background: `radial-gradient(ellipse at 50% 100%, rgba(${v.glow}, 0.25), transparent 60%)` }} />
                <div className="relative text-[10px] tracking-[0.3em] text-white/40 uppercase font-mono">
                  {String(i+1).padStart(2,'0')} / 05
                </div>
                <div className="relative text-center">
                  <div className="font-serif-zh leading-none" style={{ fontSize: 'clamp(2.75rem, 5vw, 4.5rem)', color: v.primary, textShadow: `0 0 30px rgba(${v.glow}, 0.4)` }}>{v.zh}</div>
                  <div className="font-serif-en italic text-white/60 mt-2">{v.en}</div>
                </div>
                <div className="relative">
                  <div className="h-px w-full mb-3" style={{ background: `linear-gradient(90deg, transparent, ${v.primary}, transparent)` }} />
                  <div className="font-serif-zh text-xs text-white/55 leading-relaxed text-center">「{v.poem}」</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// 11. SLOGAN PARALLAX
// ─────────────────────────────────────────────────────────────────────────
function SloganParallax({ slogan, sloganEn }) {
  const [scroll, setScroll] = useState(0);
  const sectionRef = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      if (!sectionRef.current) return;
      const r = sectionRef.current.getBoundingClientRect();
      const progress = 1 - (r.top + r.height / 2) / window.innerHeight;
      setScroll(progress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section ref={sectionRef} className="relative min-h-[130vh] py-40 px-10 overflow-hidden" data-screen-label="04 Slogan">
      <div className="sticky top-0 min-h-screen flex flex-col justify-center">
        <Reveal>
          <div className="text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-8 max-w-[1600px] mx-auto w-full">
            Chapter III · Slogan
          </div>
        </Reveal>

        <div className="max-w-[1600px] mx-auto w-full">
          <div className="font-serif-zh text-white/95 leading-[0.95]"
               style={{ fontSize: 'clamp(3rem, 11vw, 11rem)', transform: `translateX(${-scroll * 80}px)` }}>
            {slogan.split('').map((ch, i) => (
              <span key={i} className="inline-block"
                    style={{ transform: `translateY(${Math.sin(scroll * 3 + i * 0.4) * 12}px)` }}>
                {ch}
              </span>
            ))}
          </div>
          <div className="font-serif-en italic text-white/45 mt-8 leading-tight"
               style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)', transform: `translateX(${scroll * 60}px)` }}>
            {sloganEn}
          </div>

          <div className="mt-16 flex items-center gap-6 max-w-xl">
            <div className="h-px flex-1 bg-white/15" />
            <span className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase">Generated · Edition 壹</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 12. VISUAL PACKAGE (mock 4K bg + logo)
// ─────────────────────────────────────────────────────────────────────────
function VisualPackage({ element, brandName }) {
  const el = ELEMENTS[element];
  return (
    <section className="relative py-32 px-10 overflow-hidden" data-screen-label="05 Visual">
      <div className="max-w-[1600px] mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-3">Chapter IV · Visual Package</div>
              <h2 className="font-serif-zh text-5xl md:text-6xl text-white">意象 · 4K 動態視覺</h2>
            </div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase hidden md:block">
              3840 × 2160 · 24fps · H.265
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-[16/9] group">
            {/* Simulated 4K aura video */}
            <div className="absolute inset-0"
                 style={{
                   background: `
                     radial-gradient(ellipse at 30% 40%, rgba(${el.glow}, 0.55), transparent 55%),
                     radial-gradient(ellipse at 70% 60%, ${el.deep}60, transparent 60%),
                     radial-gradient(ellipse at 50% 100%, rgba(${el.glow}, 0.25), transparent 70%),
                     #0A0A0F`,
                   animation: 'auraShift 8s ease-in-out infinite alternate',
                 }} />
            <FlowField intensity={0.7} element={element} />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

            {/* brand mark */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full border border-white/40 backdrop-blur-xl flex items-center justify-center mb-6"
                   style={{ boxShadow: `0 0 60px rgba(${el.glow}, 0.6)`, animation: 'logoBreath 4s ease-in-out infinite' }}>
                <div className="font-serif-zh text-3xl" style={{ color: el.primary }}>{el.zh}</div>
              </div>
              <div className="font-serif-en text-white text-5xl md:text-7xl tracking-wide mb-2"
                   style={{ textShadow: `0 0 40px rgba(${el.glow}, 0.5)` }}>
                {brandName}
              </div>
              <div className="font-mono text-[10px] tracking-[0.4em] text-white/60 uppercase">
                A Manifested Aura · Edition 壹
              </div>
            </div>

            {/* corner brackets */}
            <Corners />
            <Timecode />
          </div>
        </Reveal>

        <Reveal delay={300}>
          <div className="grid md:grid-cols-3 gap-6 mt-6 text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase">
            <div className="flex justify-between border-t border-white/10 pt-4"><span>Format</span><span className="text-white/80">MP4 · H.265</span></div>
            <div className="flex justify-between border-t border-white/10 pt-4"><span>Aspect</span><span className="text-white/80">16:9 · 9:16 · 1:1</span></div>
            <div className="flex justify-between border-t border-white/10 pt-4"><span>Duration</span><span className="text-white/80">00:00:12</span></div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Corners() {
  return (
    <>
      {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos, i) => (
        <div key={i} className={`absolute ${pos} w-5 h-5`}>
          <div className="absolute inset-0 border-white/30" style={{
            borderTop: pos.includes('top') ? '1px solid' : 'none',
            borderBottom: pos.includes('bottom') ? '1px solid' : 'none',
            borderLeft: pos.includes('left') ? '1px solid' : 'none',
            borderRight: pos.includes('right') ? '1px solid' : 'none',
            width: '20px', height: '20px',
          }} />
        </div>
      ))}
    </>
  );
}

function Timecode() {
  const [tc, setTc] = useState('00:00:00:00');
  useEffect(() => {
    let f = 0;
    const id = setInterval(() => {
      f = (f + 1) % (24 * 12);
      const s = Math.floor(f / 24);
      const ff = f % 24;
      setTc(`00:00:${String(s).padStart(2,'0')}:${String(ff).padStart(2,'0')}`);
    }, 42);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute bottom-6 left-6 font-mono text-[10px] tracking-[0.2em] text-white/70">
      ● REC · {tc}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 13. SERVICE CARDS (3D tilt)
// ─────────────────────────────────────────────────────────────────────────
function TriadCards({ items, element, chapter, titleZh, titleEmZh, titleEn, titleEmEn, taglineZh, taglineEn, screenLabel, accentCta }) {
  const { lang } = useLang();
  return (
    <section className="relative py-32 px-10 overflow-hidden" data-screen-label={screenLabel}>
      <div className="max-w-[1600px] mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-16">
            <div>
              <div className="text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-3">{chapter}</div>
              <h2 className="font-serif-zh text-5xl md:text-6xl text-white leading-[1.05]">
                {lang === 'zh' ? titleZh : titleEn}<br/>
                <span className="italic text-[rgb(var(--accent-glow))]">{lang === 'zh' ? titleEmZh : titleEmEn}</span>
              </h2>
            </div>
            <div className="font-serif-en italic text-white/40 text-lg max-w-xs text-right hidden md:block">
              {lang === 'zh' ? taglineZh : taglineEn}
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((s, i) => <TiltCard key={i} item={s} index={i} element={element} accentCta={accentCta} />)}
        </div>
      </div>
    </section>
  );
}

function TiltCard({ item, index, element, accentCta }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 10, y: px * 10 });
  };
  const onLeave = () => setTilt({ x: 0, y: 0 });
  const el = ELEMENTS[element];

  return (
    <Reveal delay={index * 120}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.2s ease-out',
        }}
        className="relative rounded-xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-10 overflow-hidden group hover:border-white/25 transition-colors min-h-[420px] flex flex-col">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
             style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(${el.glow}, 0.15), transparent 60%)` }} />

        <div className="flex justify-between items-start mb-auto" style={{ transform: 'translateZ(30px)' }}>
          <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase">
            {String(index + 1).padStart(2, '0')} / 03
          </div>
          <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center font-serif-zh"
               style={{ color: el.primary }}>
            {item.glyph}
          </div>
        </div>

        <div style={{ transform: 'translateZ(50px)' }}>
          <div className="font-serif-en italic text-white/40 text-sm mb-2">{item.en}</div>
          <h3 className="font-serif-zh text-3xl text-white leading-[1.2] mb-5">{item.zh}</h3>
          <p className="font-sans-zh text-white/65 text-sm leading-[1.7]">{item.desc}</p>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between" style={{ transform: 'translateZ(20px)' }}>
          <span className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase">{item.tag}</span>
          <span className="font-serif-en italic text-white/70 text-sm group-hover:text-white transition-colors">
            {accentCta}
          </span>
        </div>
      </div>
    </Reveal>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// 13b. FORTUNE (今年 / 當月 / 當日 — deterministic per (element, date))
// ─────────────────────────────────────────────────────────────────────────
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) % 10000) / 10000;
  };
}

const FORTUNE_COPY = {
  metal: {
    overall: [
      { zh: '宜決斷收束，不宜擴張。鋒芒外露易傷己；先藏後顯，順勢者昌。', en: 'A time to decide and conclude, not to expand. A sheathed blade cuts truer.' },
      { zh: '金氣當令，舊事可了結。捨去三成累贅，方得輕盈前行。', en: 'Metal rules the season — close old loops. Shed a third, move lighter.' },
      { zh: '話少而重。你的一句頂過十句，慎擇聽眾。', en: 'Fewer words, heavier weight. Choose your audience carefully.' },
    ],
    career: [{ zh: '老案可結，新案宜慎。', en: 'Close what is open; delay the new.' }, { zh: '宜精不宜多，專案擇一深做。', en: 'One deep project beats three shallow ones.' }],
    love:   [{ zh: '誠實為上，曖昧傷金。', en: 'Honesty above all; ambiguity corrodes.' }, { zh: '已有者宜守，未遇者勿急。', en: 'Hold if partnered; wait if not.' }],
    health: [{ zh: '注意肺經與大腸，多飲溫水。', en: 'Mind the lungs and colon; warm water throughout.' }, { zh: '秋燥之際宜潤，避辛辣過度。', en: 'Moisten against dryness; ease the spice.' }],
  },
  wood: {
    overall: [
      { zh: '生發之時，宜立新志。但木強易折，方向既定則不必張揚。', en: 'A season of new growth. Set direction, but do not announce it loudly.' },
      { zh: '創意湧現，需給自己留白。不是每個想法都要立刻執行。', en: 'Ideas surge — leave white space. Not every spark needs fuel.' },
      { zh: '向外伸展前，先深紮根。無根之木難經風。', en: 'Reach upward only after rooting downward.' },
    ],
    career: [{ zh: '新專案有利，宜主動提案。', en: 'New projects favor you; initiate.' }, { zh: '團隊合作多於單打獨鬥。', en: 'Collaboration outpaces solo effort.' }],
    love:   [{ zh: '表達真心，勿壓抑情緒。', en: 'Speak your heart; repression poisons wood.' }, { zh: '老關係可深化，新關係宜觀察。', en: 'Deepen old bonds; observe new ones.' }],
    health: [{ zh: '肝膽為要，忌熬夜動怒。', en: 'Liver & gallbladder — avoid late nights and anger.' }, { zh: '多伸展、多見綠。', en: 'Stretch often; greet the green.' }],
  },
  water: {
    overall: [
      { zh: '宜藏不宜顯，宜深不宜廣。遇事勿與石爭，繞之則過。', en: 'A time to go deep, not wide. Flow around stones rather than through them.' },
      { zh: '直覺清明，夢境亦可參。然行動宜緩，等水紋自定。', en: 'Intuition runs clear; dreams may be consulted. Move only when the surface stills.' },
      { zh: '退一步海闊天空。此刻的「無為」勝過十次「有為」。', en: 'Step back — what seems like nothing is the greater move.' },
    ],
    career: [{ zh: '暗中佈局，勿張揚計劃。', en: 'Set the groundwork quietly.' }, { zh: '宜研究分析，不宜拍板定案。', en: 'Research and analyze — defer final calls.' }],
    love:   [{ zh: '深談勝過熱戀。', en: 'Deep talk over hot pursuit.' }, { zh: '允許對方有自己的暗湧。', en: 'Allow the other their own undercurrents.' }],
    health: [{ zh: '腎與膀胱為重，忌過勞與寒涼。', en: 'Kidneys & bladder — avoid exhaustion and cold foods.' }, { zh: '早睡養水，子時務必歸眠。', en: 'Sleep before midnight to nourish the water.' }],
  },
  fire: {
    overall: [
      { zh: '表達之運旺，但需節制火勢。光而不耀，熱而不焚。', en: 'Expression flows, but temper the flame. Shine without scorching.' },
      { zh: '貴人從公開場合而來。但亦易招妒，謙則保全。', en: 'Benefactors appear in public spaces. Humility keeps the flame sheltered.' },
      { zh: '心之所向可直言。唯須選擇時機，過早或過晚皆失。', en: 'Speak what you want — but time it right. Too early or too late both fail.' },
    ],
    career: [{ zh: '簡報、發表、社交有利。', en: 'Presentations, launches, networking favor you.' }, { zh: '勿因一時激動做決定。', en: 'Do not decide in the heat of passion.' }],
    love:   [{ zh: '熱情需有節奏，過燃則熄。', en: 'Passion needs cadence; unchecked heat burns out.' }, { zh: '真心表白勝過曖昧試探。', en: 'Confession beats ambiguity.' }],
    health: [{ zh: '心經為要，避免情緒焚身。', en: 'The heart channel — do not let emotion consume you.' }, { zh: '午時小憩，清心火。', en: 'Noon rest to cool the inner fire.' }],
  },
  earth: {
    overall: [
      { zh: '穩字當頭。此時種下的將收十年之利，追新求快者失。', en: 'Steadiness wins. What is planted now yields for a decade; chasing novelty loses.' },
      { zh: '關係、信用、基礎此時最旺。重諾勝過華美承諾。', en: 'Relationships and trust are strongest now. Keep promises over making new ones.' },
      { zh: '不動而動。原地深耕，反而吸引人與機會前來。', en: 'Move by not moving. Deepen where you stand; opportunity comes to you.' },
    ],
    career: [{ zh: '續約、長期合作有利。', en: 'Renewals and long-term partnerships favor you.' }, { zh: '勿為急進而毀根基。', en: 'Do not break the foundation for speed.' }],
    love:   [{ zh: '日常的陪伴勝過儀式。', en: 'Daily presence outweighs ceremonial gestures.' }, { zh: '承諾之事必兌現。', en: 'Honor every promise.' }],
    health: [{ zh: '脾胃為重，三餐定時。', en: 'Spleen & stomach — keep meals regular.' }, { zh: '忌生冷，勿暴飲暴食。', en: 'Avoid cold foods and excess.' }],
  },
};

const FORTUNE_ASPECTS_META = [
  { key: 'career', zh: '事業', en: 'Career' },
  { key: 'love',   zh: '情感', en: 'Love' },
  { key: 'health', zh: '健康', en: 'Health' },
];

function buildFortune(element, period, dateKey) {
  const seed = hash32(`${element}|${period}|${dateKey}`);
  const rand = mulberry32(seed);
  const copy = FORTUNE_COPY[element];
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const overall = pick(copy.overall);
  const aspects = FORTUNE_ASPECTS_META.map((a) => {
    const line = pick(copy[a.key]);
    const base = period === 'year' ? 70 : period === 'month' ? 68 : 65;
    const score = Math.floor(base + rand() * 25);
    return { ...a, line, score };
  });
  const overallScore = Math.round(aspects.reduce((s, a) => s + a.score, 0) / aspects.length);
  return { overall, aspects, overallScore };
}

function Fortune({ element, aiFortune }) {
  const { lang } = useLang();
  const [tab, setTab] = useState('year');
  const now = new Date();
  const periods = useMemo(() => ({
    year:  { zh: '今年運勢',  en: 'This Year',   label: `${now.getFullYear()}`, subZh: '流年', subEn: 'Annual',  key: String(now.getFullYear()) },
    month: { zh: '當月運勢',  en: 'This Month',  label: `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}`, subZh: '流月', subEn: 'Monthly', key: `${now.getFullYear()}-${now.getMonth()}` },
    day:   { zh: '當日運勢',  en: 'Today',       label: `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`, subZh: '流日', subEn: 'Daily',   key: `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}` },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [now.getFullYear(), now.getMonth(), now.getDate()]);

  // Prefer AI-generated fortune when the active tab has a matching shape;
  // fall back to the deterministic hash-based builder otherwise.
  const fortune = useMemo(() => {
    const slice = aiFortune?.[tab];
    if (slice && slice.overall && Array.isArray(slice.aspects) && slice.aspects.length === 3) {
      return slice;
    }
    return buildFortune(element, tab, periods[tab].key);
  }, [aiFortune, element, tab, periods]);
  const el = ELEMENTS[element];
  const p = periods[tab];

  return (
    <section className="relative py-32 px-10 overflow-hidden" data-screen-label="08 Fortune">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: `radial-gradient(ellipse at 50% 30%, rgba(${el.glow}, 0.06), transparent 65%)` }} />
      <div className="relative max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-3">
                {lang === 'zh' ? 'Chapter VII · 運勢測度' : 'Chapter VII · Fortune'}
              </div>
              <h2 className="font-serif-zh text-5xl md:text-6xl text-white leading-[1.05]">
                {lang === 'zh' ? <>時運如水<br/><span className="italic text-[rgb(var(--accent-glow))]">觀其潮汐。</span></>
                               : <>Fortune is a tide<br/><span className="italic text-[rgb(var(--accent-glow))]">observe its phases.</span></>}
              </h2>
            </div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase hidden md:block text-right">
              {p.label}<br/>
              <span className="text-white/25">{lang === 'zh' ? p.subZh : p.subEn}</span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="flex gap-2 mb-8">
            {['year','month','day'].map((k) => (
              <button key={k}
                onClick={() => setTab(k)}
                className={`px-6 py-3 rounded-xl border backdrop-blur-xl text-sm transition-colors ${
                  tab === k ? 'border-white/30 bg-white/[0.06] text-white' : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80 hover:border-white/20'
                }`}
                style={tab === k ? { boxShadow: `0 0 30px -5px rgba(${el.glow}, 0.5)` } : {}}>
                <span className="font-serif-zh mr-2">{periods[k].zh}</span>
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">{periods[k].en}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div key={tab}
               className="rounded-xl border border-white/10 bg-white/[0.025] backdrop-blur-xl overflow-hidden"
               style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)', animation: 'phaseSwap 0.6s cubic-bezier(.2,.7,.2,1) both' }}>
            <div className="grid md:grid-cols-12 gap-10 p-10 border-b border-white/10 items-center">
              <div className="md:col-span-4">
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-3">
                  {lang === 'zh' ? '總評 · Overall' : 'Overall · 總評'}
                </div>
                <div className="flex items-baseline gap-4 mb-4">
                  <div className="font-serif-en leading-none" style={{ fontSize: 'clamp(4rem, 7vw, 6rem)', color: el.primary, textShadow: `0 0 40px rgba(${el.glow}, 0.5)` }}>
                    {fortune.overallScore}
                  </div>
                  <div className="font-mono text-sm text-white/40">/ 100</div>
                </div>
                <div className="h-px bg-white/10 relative max-w-[180px]">
                  <div className="absolute left-0 top-0 h-px" style={{ width: `${fortune.overallScore}%`, background: `linear-gradient(90deg, transparent, ${el.primary})`, boxShadow: `0 0 12px rgba(${el.glow}, 0.8)` }} />
                </div>
              </div>
              <div className="md:col-span-8">
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-3">
                  {lang === 'zh' ? '觀象 · Reading' : 'Reading · 觀象'}
                </div>
                <p className="font-serif-zh text-xl md:text-2xl text-white/90 leading-[1.6]" style={{ textWrap: 'pretty' }}>
                  {lang === 'zh' ? `「${fortune.overall.zh}」` : `"${fortune.overall.en}"`}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
              {fortune.aspects.map((a, i) => (
                <div key={a.key} className="p-10">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-1">{String(i+1).padStart(2,'0')} / 03</div>
                      <div className="font-serif-zh text-2xl text-white">{a.zh}</div>
                      <div className="font-serif-en italic text-white/45 text-sm">{a.en}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif-en leading-none" style={{ fontSize: '2.25rem', color: el.primary }}>{a.score}</div>
                      <div className="font-mono text-[10px] text-white/30 tracking-wider">/ 100</div>
                    </div>
                  </div>
                  <div className="h-px bg-white/10 relative mb-5">
                    <div className="absolute left-0 top-0 h-px transition-all duration-700"
                         style={{ width: `${a.score}%`, background: el.primary, boxShadow: `0 0 10px rgba(${el.glow}, 0.7)` }} />
                    {[25, 50, 75].map(v => (<div key={v} className="absolute top-[-3px] h-[7px] w-px bg-white/10" style={{ left: `${v}%` }} />))}
                  </div>
                  <p className="font-serif-zh text-white/75 text-base leading-[1.75]" style={{ textWrap: 'pretty' }}>
                    {lang === 'zh' ? a.line.zh : a.line.en}
                  </p>
                </div>
              ))}
            </div>

            <div className="px-10 py-5 border-t border-white/10 flex items-center justify-between font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase">
              <span>{lang === 'zh' ? '觀象於' : 'Observed at'} · {p.label}</span>
              <span>{lang === 'zh' ? '命主元素' : 'Native element'} · {el.zh} {el.en}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 14. AURA ANALYSIS (academic two-column)
// ─────────────────────────────────────────────────────────────────────────
function AuraAnalysis({ element, name, aiAnalysis }) {
  const { lang } = useLang();
  const el = ELEMENTS[element];
  const sectionHeading = (secKey, zhFallback, enFallback) => {
    const sec = aiAnalysis?.[secKey];
    if (sec?.head) {
      const zh = sec.head.zh || zhFallback;
      const en = sec.head.en || enFallback;
      return { en: `§ ${secKey.slice(1).padStart(2,'0')} — ${en}`, zh };
    }
    return { en: enFallback, zh: zhFallback };
  };
  const s1Head = sectionHeading('s1', '體質綜述', '§ 01 — Constitutional Summary');
  const s2Head = sectionHeading('s2', '當前課題', '§ 02 — Current Challenge');
  const s3Head = sectionHeading('s3', '破局路徑', '§ 03 — Path Forward');

  return (
    <section className="relative py-40 px-10 overflow-hidden" data-screen-label="07 Analysis">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="border-t border-white/15 pt-8 mb-16 flex justify-between items-end">
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-2">Document № AAS-2026-壹 · Confidential</div>
              <h2 className="font-serif-en italic text-white text-5xl md:text-6xl">An Analysis of <br/>the <span style={{ color: el.primary }}>{el.en}</span> Constitution</h2>
            </div>
            <div className="hidden md:block text-right">
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase">Subject</div>
              <div className="font-serif-zh text-white text-xl mt-1">{name || '訪客'}</div>
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-12 gap-10">
          <aside className="md:col-span-3 space-y-8">
            <Reveal delay={100}>
              <MetaBlock label="Primary Element" value={`${el.zh} · ${el.en}`} />
              <MetaBlock label="Season" value="Spring · 木旺" />
              <MetaBlock label="Direction" value="East · 東方" />
              <MetaBlock label="Resonance" value="A-432Hz" />
              <MetaBlock label="Prepared by" value="Aura AI Studio" />
            </Reveal>
          </aside>

          <div className="md:col-span-9 space-y-10">
            <Reveal delay={200}>
              <Para heading={s1Head.en} zhHeading={s1Head.zh}>
                {aiAnalysis?.s1?.body
                  ? (lang === 'zh' ? aiAnalysis.s1.body.zh : aiAnalysis.s1.body.en)
                  : (
                    <>
                      主屬{el.zh}者，秉性如{el.poem}。於事業格局上，宜以<span className="italic text-white">穩健累積</span>為基調，
                      避免短線躁進。今值丙午年，五行流轉得位，乃蓄勢待發之象。
                      外顯氣質應呼應此內在結構，不宜過度喧嘩，而以氣韻勝形貌。
                    </>
                  )}
              </Para>
            </Reveal>
            <Reveal delay={300}>
              <Para heading={s2Head.en} zhHeading={s2Head.zh}>
                {aiAnalysis?.s2?.body
                  ? (lang === 'zh' ? aiAnalysis.s2.body.zh : aiAnalysis.s2.body.en)
                  : (
                    <>
                      當前課題取「專業感」與「親和力」之中道，以<span style={{color: el.primary}}>{el.primary}</span>為主色氣，
                      搭配深色底以產生高級感與專注焦點。阻力多來自自身習氣之未察——
                      讓留白承擔一半的重量，此乃{el.zh}之外在投射。
                    </>
                  )}
              </Para>
            </Reveal>
            <Reveal delay={400}>
              <Para heading={s3Head.en} zhHeading={s3Head.zh}>
                {aiAnalysis?.s3?.body
                  ? (lang === 'zh' ? aiAnalysis.s3.body.zh : aiAnalysis.s3.body.en)
                  : (
                    <>
                      節奏建議以<span className="italic">季度</span>為單位，每季一次深度行動，
                      配合兩至三次輕量觸點。儀式感高於頻率——寧可少而慎重，不可多而喧囂。
                      這與你主元素的呼吸韻律一致。
                    </>
                  )}
              </Para>
            </Reveal>

            <Reveal delay={500}>
              <div className="pt-8 border-t border-white/15 flex justify-between text-[10px] font-mono tracking-[0.3em] text-white/40 uppercase">
                <span>— End of document —</span>
                <span>Page 01 / 01</span>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetaBlock({ label, value }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase mb-1">{label}</div>
      <div className="font-serif-zh text-white/90 text-base border-l border-white/20 pl-3">{value}</div>
    </div>
  );
}

function Para({ heading, zhHeading, children }) {
  return (
    <article>
      <div className="flex items-baseline gap-4 mb-4">
        <h3 className="font-serif-en italic text-white/95 text-xl">{heading}</h3>
        <span className="font-serif-zh text-white/50 text-base">· {zhHeading}</span>
      </div>
      <p className="font-serif-zh text-white/75 text-lg leading-[1.85]" style={{ textWrap: 'pretty' }}>
        {children}
      </p>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 15. FOOTER
// ─────────────────────────────────────────────────────────────────────────
function Footer({ element, onRestart }) {
  const el = ELEMENTS[element];
  const chips = ['React 18', 'Canvas 2D', 'CSS Variables', 'Claude · Haiku 4.5', 'Noto Serif TC', 'Fraunces', 'Tailwind 3'];
  return (
    <footer className="relative pt-32 pb-10 px-10 border-t border-white/10 overflow-hidden" data-screen-label="08 Footer">
      <div className="absolute inset-x-0 top-0 h-px"
           style={{ background: `linear-gradient(90deg, transparent, rgba(${el.glow}, 0.6), transparent)` }} />

      <div className="max-w-[1600px] mx-auto">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20">
            <div>
              <h2 className="font-serif-en italic text-white/95 leading-[0.95]" style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}>
                Another aura<br/>awaits a name.
              </h2>
            </div>
            <MagneticButton onClick={onRestart}
              className="self-start md:self-end px-8 py-4 rounded-full border border-white/20 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.08] text-white/90 font-serif-en tracking-wide whitespace-nowrap">
              重啟儀式 · Restart Ritual →
            </MagneticButton>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-4 gap-10 pb-16">
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-4">Studio</div>
            <div className="font-serif-en text-white text-lg">Aura AI Studio</div>
            <div className="font-serif-zh text-white/60 mt-1">東方命理 × 生成式 AI</div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-4">Contact</div>
            <a href="mailto:hoganlin@gmail.com" className="font-serif-en text-white/70 hover:text-white transition-colors">hoganlin@gmail.com</a>
            <div className="font-mono text-white/50 text-sm mt-1">+886 908-255-839</div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-4">Author</div>
            <div className="font-serif-en text-white/70">Rogan Studio</div>
            <div className="font-mono text-white/50 text-sm mt-1">© 2026</div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-4">Stack</div>
            <div className="flex flex-wrap gap-2">
              {chips.map(c => (
                <span key={c} className="px-3 py-1 rounded-full border border-white/15 bg-white/[0.03] text-[11px] font-mono text-white/60 tracking-wide">{c}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-8 border-t border-white/10 font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase">
          <span>Edition 壹 · Spring 2026</span>
          <span>All elements forged · No lineage claimed</span>
          <span>— fin —</span>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 15b. TOP BAR (shared nav — anchors, Archive, Lang toggle)
// ─────────────────────────────────────────────────────────────────────────
function TopBar({ onOpenArchive, onRestart }) {
  const { t, lang, setLang } = useLang();
  const scrollTo = (label) => {
    const el = document.querySelector(`[data-screen-label="${label}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    return false;
  };
  const goRitual = () => {
    // If a reading is already generated, the Ritual Input isn't rendered — trigger a full restart.
    if (!scrollTo('02 Ritual Input')) onRestart?.();
  };
  const goElements = () => {
    if (!scrollTo('03 Element')) onRestart?.();
  };
  return (
    <div className="relative z-30 flex items-center justify-between gap-3 px-5 pt-6 md:px-10 md:pt-8">
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="w-2 h-2 rounded-full bg-[rgb(var(--accent-glow))] shadow-[0_0_12px_rgb(var(--accent-glow))]" />
        <span className="hidden sm:inline text-[11px] tracking-[0.3em] text-white/60 uppercase font-mono">Aura · AI · Studio</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-5 md:gap-8 text-[10px] md:text-[11px] tracking-[0.18em] md:tracking-[0.25em] text-white/55 uppercase font-mono">
        <button onClick={goRitual} className="hover:text-white transition-colors">{t('nav_ceremony')}</button>
        <button onClick={goElements} className="hover:text-white transition-colors">{t('nav_elements')}</button>
        <button onClick={onOpenArchive} className="hover:text-white transition-colors flex items-center gap-1.5">
          <span>{t('nav_archive')}</span>
          <ArchiveBadge />
        </button>
        <div className="flex items-center border border-white/15 rounded-full overflow-hidden shrink-0">
          <button
            onClick={() => setLang('en')}
            className={`px-2 md:px-3 py-1 transition-colors ${lang === 'en' ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'}`}>
            EN
          </button>
          <button
            onClick={() => setLang('zh')}
            className={`px-2 md:px-3 py-1 transition-colors ${lang === 'zh' ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'}`}>
            繁
          </button>
        </div>
      </div>
    </div>
  );
}

function ArchiveBadge() {
  const [n, setN] = useState(() => loadArchive().length);
  useEffect(() => {
    const tick = () => setN(loadArchive().length);
    window.addEventListener('aura:archive-changed', tick);
    return () => window.removeEventListener('aura:archive-changed', tick);
  }, []);
  if (n === 0) return null;
  return <span className="text-[9px] px-1.5 py-px rounded-full bg-[rgb(var(--accent-glow))]/20 text-[rgb(var(--accent-glow))] border border-[rgb(var(--accent-glow))]/30">{n}</span>;
}

// ─────────────────────────────────────────────────────────────────────────
// 15c. ARCHIVE DRAWER (right slide-out — past readings)
// ─────────────────────────────────────────────────────────────────────────
function ArchiveDrawer({ open, onClose, onRestore }) {
  const { t, lang } = useLang();
  const [items, setItems] = useState(() => loadArchive());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-reading localStorage when the drawer opens is an external-sync read, not a render cascade
    if (open) setItems(loadArchive());
  }, [open]);

  const refresh = () => {
    setItems(loadArchive());
    window.dispatchEvent(new Event('aura:archive-changed'));
  };

  const remove = (id) => {
    saveArchive(loadArchive().filter(x => x.id !== id));
    refresh();
  };

  const clearAll = () => {
    saveArchive([]);
    refresh();
  };

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity duration-500"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      {/* drawer */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-[91] w-full max-w-md bg-[#0A0A0F]/95 backdrop-blur-2xl border-l border-white/10 overflow-y-auto transition-transform duration-[600ms]"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transitionTimingFunction: 'cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <div className="sticky top-0 z-10 px-8 pt-8 pb-5 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.4em] text-white/40 uppercase font-mono mb-1">{t('nav_archive')}</div>
            <h3 className="font-serif-en italic text-white text-2xl">{t('ar_title')}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            className="w-9 h-9 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center">
            ×
          </button>
        </div>

        <div className="px-8 py-6">
          {items.length === 0 ? (
            <div className="py-20 text-center font-serif-zh text-white/50 text-sm leading-relaxed">
              {t('ar_empty')}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5 text-[10px] tracking-[0.3em] text-white/40 uppercase font-mono">
                <span>{t('ar_count_a')}{items.length}{t('ar_count_b')}</span>
                <button onClick={clearAll} className="hover:text-[rgb(var(--accent-glow))] transition-colors">
                  {t('ar_clear')}
                </button>
              </div>
              <ul className="space-y-3">
                {items.map((it) => <ArchiveItem key={it.id} item={it} onRestore={onRestore} onRemove={remove} lang={lang} t={t} />)}
              </ul>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function ArchiveItem({ item, onRestore, onRemove, lang, t }) {
  const el = ELEMENTS[item.element];
  const when = new Date(item.createdAt);
  const dateStr = `${when.getFullYear()}.${String(when.getMonth()+1).padStart(2,'0')}.${String(when.getDate()).padStart(2,'0')} ${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')}`;
  return (
    <li
      className="group relative rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/25 transition-colors overflow-hidden"
      style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)` }}>
      <div className="absolute top-0 right-0 w-28 h-28 pointer-events-none opacity-60"
           style={{ background: `radial-gradient(circle at 80% 20%, rgba(${el.glow}, 0.3), transparent 70%)` }} />
      <div className="relative p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full border flex items-center justify-center shrink-0"
               style={{ borderColor: el.primary, boxShadow: `0 0 20px rgba(${el.glow}, 0.4)` }}>
            <span className="font-serif-zh text-xl" style={{ color: el.primary }}>{el.zh}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-serif-zh text-white text-lg truncate">{item.name || t('er_guest')}</div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase mt-1">
              {el.en} · {item.date || '—'}
            </div>
            <div className="font-serif-en italic text-white/60 text-sm mt-3 leading-snug line-clamp-2">
              {lang === 'zh' ? item.slogan : item.sloganEn}
            </div>
            <div className="font-mono text-[9px] tracking-[0.25em] text-white/30 uppercase mt-3">
              {t('ar_generated')} · {dateStr}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
          <button
            onClick={() => onRemove(item.id)}
            className="text-[10px] tracking-[0.3em] uppercase font-mono text-white/40 hover:text-white/80 transition-colors">
            {t('ar_delete')}
          </button>
          <button
            onClick={() => onRestore(item)}
            className="text-[10px] tracking-[0.3em] uppercase font-mono text-[rgb(var(--accent-glow))] hover:text-white transition-colors">
            {t('ar_open')}
          </button>
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 16. APP
// ─────────────────────────────────────────────────────────────────────────
function AppInner() {
  const [lang, setLangState] = useState(() => localStorage.getItem('aura_lang') || 'zh');
  const setLang = useCallback((l) => { setLangState(l); localStorage.setItem('aura_lang', l); }, []);
  const t = useMemo(() => makeT(lang), [lang]);
  const langValue = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  // hero | ritual | ceremony | result
  const savedState = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('aura_state') || 'null') || {}; }
    catch { return {}; }
  }, []);
  const [state, setState] = useState(savedState.state || 'hero');
  const [user, setUser] = useState(savedState.user || { name: '', date: '', time: '' });
  const [generated, setGenerated] = useState(savedState.generated || null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  useEffect(() => {
    localStorage.setItem('aura_state', JSON.stringify({ state, user, generated }));
  }, [state, user, generated]);

  const element = generated?.element || 'water';
  const el = ELEMENTS[element];

  // Apply accent CSS var
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-glow', el.glow);
    document.documentElement.style.setProperty('--accent-primary', el.primary);
  }, [element, el.glow, el.primary]);

  const handleSubmit = async (data) => {
    setUser(data);
    setState('ceremony');
    const elem = deriveElement(data.name, data.date);
    const fallback = { element: elem, ...POOLS[elem] };

    let result = fallback;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000); // 90s hard cap
    try {
      const resp = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          date: data.date,
          time: data.time || '',
          location: data.location || '',
          element: elem,
        }),
        signal: controller.signal,
      });
      if (resp.ok) {
        const ai = await resp.json();
        result = mergeReading(ai, fallback);
      } else {
        const errBody = await resp.text().catch(() => '');
        console.warn('[aura] /api/reading non-OK', resp.status, errBody.slice(0, 300));
      }
    } catch (err) {
      console.warn('[aura] /api/reading failed, using fallback', err);
    } finally {
      clearTimeout(timeoutId);
    }

    setGenerated(result);
    // Archive it
    const entry = {
      id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      createdAt: Date.now(),
      name: data.name, date: data.date, time: data.time,
      ...result,
    };
    addToArchive(entry);
    window.dispatchEvent(new Event('aura:archive-changed'));
  };

  const restoreFromArchive = (entry) => {
    setUser({ name: entry.name, date: entry.date, time: entry.time || '' });
    const { id, createdAt, name, date, time, ...rest } = entry;
    void id; void createdAt; void name; void date; void time;
    setGenerated(rest);
    setState('result');
    setArchiveOpen(false);
    setTimeout(() => window.scrollTo({ top: window.innerHeight * 1.2, behavior: 'smooth' }), 150);
  };

  const restart = useCallback(() => {
    setState('ritual');
    setGenerated(null);
    // After the Ritual Input re-mounts, scroll to it.
    setTimeout(() => {
      const ri = document.querySelector('[data-screen-label="02 Ritual Input"]');
      if (ri) ri.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }, 120);
  }, []);

  return (
    <LangContext.Provider value={langValue}>
      <CursorFollower />
      <ArchiveDrawer open={archiveOpen} onClose={() => setArchiveOpen(false)} onRestore={restoreFromArchive} />
      <Ceremony active={state === 'ceremony'} ready={!!generated} element={generated?.element || 'water'} onDone={() => setState('result')} />

      <main className="relative">
        <Hero
          element={generated?.element || 'water'}
          onOpenArchive={() => setArchiveOpen(true)}
          onRestart={restart}
          onStart={restart} />

        {(state === 'hero' || state === 'ritual') && !generated && (
          <>
            <RitualInput onSubmit={handleSubmit} />
            <ElementsPreview />
          </>
        )}

        {generated && (
          <>
            <ElementReveal element={generated.element} name={user.name} />
            <SloganParallax slogan={generated.slogan} sloganEn={generated.sloganEn} />
            <VisualPackage element={generated.element} brandName={generated.brand} />
            <TriadCards
              items={generated.lessons}
              element={generated.element}
              chapter={lang === 'zh' ? 'Chapter V · 本命功課' : 'Chapter V · Your Practice'}
              titleZh="為你擬定的" titleEmZh="三項功課"
              titleEn="Three" titleEmEn="practices for you"
              taglineZh="依你的主元素共振，擬定本月、季、日之修持方向。"
              taglineEn="Three practices calibrated to the resonance of your primary element."
              screenLabel="06 Lessons"
              accentCta={lang === 'zh' ? '記下 →' : 'Note →'} />
            <TriadCards
              items={generated.remedies}
              element={generated.element}
              chapter={lang === 'zh' ? 'Chapter VI · 五行藥方' : 'Chapter VI · Remedies'}
              titleZh="為你開的" titleEmZh="三帖藥方"
              titleEn="Three" titleEmEn="remedies for you"
              taglineZh="作息、飲食、環境——讓五行在日常中緩緩調和。"
              taglineEn="Rhythm, diet, environment — let the five elements quietly realign."
              screenLabel="07 Remedies"
              accentCta={lang === 'zh' ? '收方 →' : 'Receive →'} />
            <Fortune element={generated.element} aiFortune={generated.fortune} />
            <AuraAnalysis element={generated.element} name={user.name} aiAnalysis={generated.analysis} />
          </>
        )}

        <Footer element={element} onRestart={restart} />
      </main>
    </LangContext.Provider>
  );
}

export default function App() { return <AppInner />; }
