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
// 1a-extra. 四柱 (four pillars) · 姓名拆字 · 個人色票
// ─────────────────────────────────────────────────────────────────────────
const HEAVENLY_STEMS   = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const EARTHLY_BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
// 子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水
const BRANCH_ELEMENT = ['water','earth','wood','wood','earth','fire','fire','earth','metal','metal','earth','water'];
// 節氣精確化 — 壽星萬年曆 21st-century coefficients (per 月 / per "節" boundary).
// day = floor((Y-base) * 0.2422 + C) - floor((Y-base)/4)
// Boundaries: 小寒(Jan)→丑, 立春(Feb)→寅, 驚蟄(Mar)→卯, 清明(Apr)→辰, 立夏(May)→巳, 芒種(Jun)→午,
// 小暑(Jul)→未, 立秋(Aug)→申, 白露(Sep)→酉, 寒露(Oct)→戌, 立冬(Nov)→亥, 大雪(Dec)→子.
const JIE_C_21 = { 1:6.11, 2:4.6295, 3:6.3826, 4:5.59, 5:6.318, 6:6.5, 7:7.928, 8:8.35, 9:8.44, 10:9.098, 11:8.218, 12:7.9 };
const JIE_C_20 = { 1:6.3811, 2:5.4055, 3:7.4624, 4:6.3474, 5:7.108, 6:7.5181, 7:8.6896, 8:9.0540, 9:9.5176, 10:10.1955, 11:9.2746, 12:8.7625 };
function jieDay(year, month) {
  const base = year >= 2000 ? 2000 : 1900;
  const Y = year - base;
  const C = (year >= 2000 ? JIE_C_21 : JIE_C_20)[month];
  return Math.floor(Y * 0.2422 + C) - Math.floor(Y / 4);
}

function yearPillarIndex(y, m, d) {
  // Year switches at 立春 (precise per year)
  const beforeLichun = m < 2 || (m === 2 && d < jieDay(y, 2));
  const yy = beforeLichun ? y - 1 : y;
  const stem = ((yy - 4) % 10 + 10) % 10;
  const branch = ((yy - 4) % 12 + 12) % 12;
  return { stem, branch };
}

function solarMonthBranchIndex(y, m, d) {
  const inThisMonth = d >= jieDay(y, m);
  const branchMonth = inThisMonth ? m : (m === 1 ? 12 : m - 1);
  // Jan→丑(1), Feb→寅(2), …, Dec→子(0)
  const map = [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];
  return map[branchMonth];
}

// 五虎遁: 寅月 stem = (yearStem*2+2)%10, then +1 per branch step
function monthStemIndexFor(yearStem, monthBranchIdx) {
  const stepsFromYin = ((monthBranchIdx - 2) % 12 + 12) % 12;
  return (yearStem * 2 + 2 + stepsFromYin) % 10;
}

function hourBranchIndex(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':').map(Number);
  if (!Number.isFinite(parts[0])) return null;
  return Math.floor((parts[0] + 1) / 2) % 12;
}

// 五鼠遁: 子時 stem = (dayStem*2)%10
function hourStemIndexFor(dayStem, hourBranchIdx) {
  return (dayStem * 2 + hourBranchIdx) % 10;
}

function computeFourPillars(dateStr, timeStr) {
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length < 3 || parts.some(n => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const year = yearPillarIndex(y, m, d);
  const monthBr = solarMonthBranchIndex(y, m, d);
  const monthStem = monthStemIndexFor(year.stem, monthBr);
  const dayStem = dayStemIndex(dateStr);
  // Day branch: 2000-01-07 (JDN 2451551) is 甲子 → branch 0
  const diff = gregorianToJDN(y, m, d) - 2451551;
  const dayBranch = ((diff % 12) + 12) % 12;
  const hourBr = hourBranchIndex(timeStr);
  const hourStem = hourBr !== null ? hourStemIndexFor(dayStem, hourBr) : null;
  return {
    year:  { stem: year.stem,  branch: year.branch  },
    month: { stem: monthStem,  branch: monthBr      },
    day:   { stem: dayStem,    branch: dayBranch    },
    hour:  hourBr !== null ? { stem: hourStem, branch: hourBr } : null,
  };
}

function elementDistribution(pillars) {
  const counts = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
  if (!pillars) return counts;
  const add = (p) => {
    if (!p) return;
    counts[STEM_ELEMENT[p.stem]] += 1;
    counts[BRANCH_ELEMENT[p.branch]] += 1;
  };
  add(pillars.year); add(pillars.month); add(pillars.day); add(pillars.hour);
  return counts;
}

// 日主強弱 + 缺什麼五行 — derived insight from distribution.
const ELEMENT_ADVICE = {
  metal: { zh: '宜近白色、西向、清音；多斷捨離以引金氣。',     en: 'White tones, west-facing, clear tones; pruning calls metal in.' },
  wood:  { zh: '宜近青綠、東向、晨光；多生發、表達以引木氣。',  en: 'Green hues, east-facing, dawn light; growth and voice call wood in.' },
  water: { zh: '宜近黑藍、北向、夜寢；多藏深、靜觀以引水氣。',  en: 'Deep blues, north-facing, restful nights; depth and stillness call water in.' },
  fire:  { zh: '宜近朱紅、南向、暖光；多表態、傳承以引火氣。',  en: 'Reds, south-facing, warm light; expression and giving call fire in.' },
  earth: { zh: '宜近黃褐、中央、陶石；多守信、穩居以引土氣。',  en: 'Yellow-browns, the center, ceramic and stone; trust and rootedness call earth in.' },
};
function interpretBazi(distribution, dayElement) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  const dayCount = distribution[dayElement] || 0;
  let strength;
  if (dayCount >= 4) strength = { zh: '身強', en: 'Strong', desc_zh: `日主${ELEMENTS[dayElement].zh}得令${dayCount}分，氣勢盛，宜洩不宜補。`, desc_en: `Your ${ELEMENTS[dayElement].en} day-master holds ${dayCount} marks — abundant. Channel outward, do not reinforce.` };
  else if (dayCount <= 1) strength = { zh: '身弱', en: 'Weak', desc_zh: `日主${ELEMENTS[dayElement].zh}僅${dayCount}分，氣勢虛，宜補不宜洩。`, desc_en: `Your ${ELEMENTS[dayElement].en} day-master holds only ${dayCount} marks — needs reinforcing.` };
  else strength = { zh: '中和', en: 'Balanced', desc_zh: `日主${ELEMENTS[dayElement].zh}得${dayCount}分，剛柔相濟，氣象平正。`, desc_en: `Your ${ELEMENTS[dayElement].en} day-master holds ${dayCount} marks — well-tempered.` };

  const missing = Object.entries(distribution).filter(([, n]) => n === 0).map(([el]) => el);
  const sparse  = Object.entries(distribution).filter(([, n]) => n > 0 && n / total < 0.15).map(([el]) => el);
  return { strength, missing, sparse, total, dayCount };
}

// 姓名拆字 — radical-based element with honest "inferred" fallback flag.
const RADICAL_ELEMENT = {
  // Wood 木
  '木':'wood','林':'wood','森':'wood','艹':'wood','艸':'wood','竹':'wood','禾':'wood','茂':'wood','芯':'wood','花':'wood','草':'wood','茶':'wood',
  '榮':'wood','楓':'wood','梅':'wood','松':'wood','柏':'wood','桂':'wood','梓':'wood','桐':'wood','椿':'wood','楷':'wood','槿':'wood','蘭':'wood','萱':'wood','芸':'wood','若':'wood','芷':'wood','菁':'wood','蓉':'wood','薇':'wood',
  // Water 水
  '水':'water','氵':'water','冫':'water','雨':'water','魚':'water','江':'water','河':'water','海':'water','清':'water','潔':'water','雲':'water','雪':'water','霖':'water','沛':'water','泓':'water','澄':'water','漢':'water','源':'water','泰':'water','洋':'water','涵':'water','潤':'water','澤':'water','濤':'water','溢':'water',
  // Fire 火
  '火':'fire','灬':'fire','日':'fire','炎':'fire','明':'fire','昭':'fire','晴':'fire','陽':'fire','光':'fire','旭':'fire','晨':'fire','昕':'fire','晟':'fire','曜':'fire','耀':'fire','煊':'fire','燁':'fire','煜':'fire','燦':'fire','熙':'fire','彤':'fire','炫':'fire','焱':'fire',
  // Metal 金
  '金':'metal','釒':'metal','刂':'metal','刀':'metal','銀':'metal','鋼':'metal','鋒':'metal','鈞':'metal','鑫':'metal','鈺':'metal','銘':'metal','錦':'metal','鋭':'metal','鏡':'metal','鈴':'metal','鎮':'metal','鍾':'metal','劍':'metal','利':'metal','義':'metal','信':'metal',
  // Earth 土
  '土':'earth','山':'earth','石':'earth','田':'earth','岩':'earth','峰':'earth','均':'earth','坤':'earth','培':'earth','城':'earth','堯':'earth','基':'earth','圭':'earth','埔':'earth','塵':'earth','磊':'earth','碩':'earth','宇':'earth','宏':'earth','安':'earth',
};
function charElement(ch) {
  if (RADICAL_ELEMENT[ch]) return { el: RADICAL_ELEMENT[ch], inferred: false };
  for (const k of Object.keys(RADICAL_ELEMENT)) if (ch.includes(k)) return { el: RADICAL_ELEMENT[k], inferred: false };
  const order = ['wood','fire','earth','metal','water'];
  return { el: order[(ch.codePointAt(0) || 0) % 5], inferred: true };
}
const NAME_QUALITY = {
  metal: ['鋒','銳','清','潔','貞','義'],
  wood:  ['生','發','直','正','仁','榮'],
  water: ['潤','智','流','澈','藏','靜'],
  fire:  ['明','禮','炎','耀','華','彰'],
  earth: ['厚','信','穩','安','實','載'],
};
function charKeyword(ch, el) {
  const pool = NAME_QUALITY[el];
  return pool[(ch.codePointAt(0) || 0) % pool.length];
}

// HEX <-> HSL
function hexToHsl(hex) {
  const m = hex.replace('#','').match(/.{2}/g) || ['00','00','00'];
  const [r, g, b] = m.map(x => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function personalPalette(name, dateStr, element) {
  const seed = (hash32((name || '') + '|' + (dateStr || '')) >>> 0);
  const base = ELEMENTS[element] || ELEMENTS.water;
  const [h, s, l] = hexToHsl(base.primary);
  const r = (n) => (seed >>> (n * 4)) & 0xff;
  const dh1 = (r(0) % 30) - 15;
  const dh2 = (r(2) % 50) - 25 + 160;
  const dh3 = (r(4) % 40) - 20 + 35;
  return [
    { name: 'Primary',   hex: hslToHex((h + dh1 + 360) % 360, s, l) },
    { name: 'Accent',    hex: hslToHex((h + dh2 + 360) % 360, Math.min(s + 12, 88), Math.max(l - 12, 24)) },
    { name: 'Highlight', hex: hslToHex((h + dh3 + 360) % 360, Math.min(s + 5, 90),  Math.min(l + 16, 78)) },
  ];
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

// 命主檔案 — 找同名同生日的歷次紀錄，用來顯示「距上次 X 天 / 元素變化」
function findPriorReadings(name, date) {
  if (!name || !date) return [];
  return loadArchive()
    .filter((x) => x.name === name && x.date === date)
    .sort((a, b) => b.createdAt - a.createdAt);
}
function daysBetween(a, b) {
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

// 個人化提問建議池 — 依「日主強弱」「所缺元素」推薦該問什麼
const QUESTION_POOL = {
  weak:    [{ zh: '今年該專注守成還是擴張？',  cat: '事業' }, { zh: '怎麼補回失去的精力？',     cat: '健康' }],
  strong:  [{ zh: '哪段感情關係正在消耗我？',  cat: '情感' }, { zh: '何時是放手的好時機？',     cat: '事業' }],
  balanced:[{ zh: '下一步的方向會在哪裡顯化？', cat: '方向' }, { zh: '這段時期的核心課題是？',   cat: '修持' }],
  metal:   { zh: '我該如何下決斷而不傷人？',   cat: '事業' },
  wood:    { zh: '哪些表達被我壓抑了？',       cat: '情感' },
  water:   { zh: '我需要更深的獨處嗎？',       cat: '修持' },
  fire:    { zh: '怎麼讓熱情不焚身？',         cat: '健康' },
  earth:   { zh: '我能信任現在的根基嗎？',     cat: '方向' },
};
function suggestQuestions(name, date) {
  const pillars = computeFourPillars(date, '');
  if (!pillars) return [];
  const dist = elementDistribution(pillars);
  const dayEl = STEM_ELEMENT[pillars.day.stem];
  const insight = interpretBazi(dist, dayEl);
  const stKey = insight.strength.en === 'Weak' ? 'weak' : insight.strength.en === 'Strong' ? 'strong' : 'balanced';
  const out = [...QUESTION_POOL[stKey]];
  insight.missing.slice(0, 2).forEach((el) => { if (QUESTION_POOL[el]) out.push(QUESTION_POOL[el]); });
  return out.slice(0, 4);
}

// 合盤 — 兩人五行互動分數（純前端規則計算，不需 AI）
const SHENG = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const KE    = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
function computeSynastry(a, b) {
  const pa = computeFourPillars(a.date, a.time || '');
  const pb = computeFourPillars(b.date, b.time || '');
  if (!pa || !pb) return null;
  const ea = STEM_ELEMENT[pa.day.stem];
  const eb = STEM_ELEMENT[pb.day.stem];
  const da = elementDistribution(pa);
  const db = elementDistribution(pb);
  // base score: 五行相生 +25、相同 +15、相剋 -10、其他 +5
  let rel = 'neutral', base = 50;
  if (ea === eb)            { rel = 'same';    base = 65; }
  else if (SHENG[ea] === eb){ rel = 'a-feeds-b'; base = 80; }
  else if (SHENG[eb] === ea){ rel = 'b-feeds-a'; base = 80; }
  else if (KE[ea] === eb)   { rel = 'a-controls-b'; base = 35; }
  else if (KE[eb] === ea)   { rel = 'b-controls-a'; base = 35; }
  // 互補分布 — 對方有的剛好補上自己缺的
  const totalA = Object.values(da).reduce((s,n)=>s+n,0) || 1;
  const totalB = Object.values(db).reduce((s,n)=>s+n,0) || 1;
  let complement = 0;
  ['metal','wood','water','fire','earth'].forEach((el) => {
    const lackA = da[el] / totalA < 0.1;
    const lackB = db[el] / totalB < 0.1;
    if (lackA && db[el] / totalB > 0.25) complement += 8;
    if (lackB && da[el] / totalA > 0.25) complement += 8;
  });
  const score = Math.max(10, Math.min(98, base + complement));
  return { score, rel, ea, eb, da, db, complement, pa, pb };
}
const SYN_REL_COPY = {
  same:           { zh: '同氣相求',  desc: '兩人氣息相近，理解快、共鳴深；但需警覺視角過度重疊。' },
  'a-feeds-b':    { zh: '甲生乙',    desc: '一方滋養另一方，付出與被滋養的循環自然成形。' },
  'b-feeds-a':    { zh: '乙生甲',    desc: '一方滋養另一方，付出與被滋養的循環自然成形。' },
  'a-controls-b': { zh: '甲剋乙',    desc: '張力存在；若能轉化為相互鍛鍊，反成深化關係的力量。' },
  'b-controls-a': { zh: '乙剋甲',    desc: '張力存在；若能轉化為相互鍛鍊，反成深化關係的力量。' },
  neutral:        { zh: '平和並行',  desc: '彼此獨立，不互擾也不強拉，適合各自精進的關係。' },
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
function Hero({ onStart, element, onOpenArchive, onRestart, onOpenSynastry }) {
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
      <TopBar onOpenArchive={onOpenArchive} onRestart={onRestart} onOpenSynastry={onOpenSynastry} />

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
  const [question, setQuestion] = useState('');
  const [focus, setFocus] = useState(false);

  const canSubmit = name.trim().length >= 1 && date.length === 10;

  const prior = useMemo(() => findPriorReadings(name.trim(), date), [name, date]);
  const lastEntry = prior[0];
  const daysSince = lastEntry ? daysBetween(Date.now(), lastEntry.createdAt) : null;
  const suggestions = useMemo(() => (canSubmit ? suggestQuestions(name, date) : []), [name, date, canSubmit]);

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

              {lastEntry && (
                <div className="rounded-lg border border-[rgb(var(--accent-glow))]/30 bg-[rgb(var(--accent-glow))]/[0.05] p-4">
                  <div className="font-mono text-[10px] tracking-[0.3em] text-[rgb(var(--accent-glow))] uppercase mb-1.5">
                    歡迎回來 · Welcome back
                  </div>
                  <div className="font-serif-zh text-white/85 text-sm leading-relaxed">
                    距上次測算 <span className="text-[rgb(var(--accent-glow))] tabular-nums">{daysSince}</span> 天 · 主元素為 <span style={{ color: ELEMENTS[lastEntry.element]?.primary }}>{ELEMENTS[lastEntry.element]?.zh}</span>
                  </div>
                </div>
              )}

              {suggestions.length > 0 && (
                <div>
                  <label className="block text-[10px] tracking-[0.3em] text-white/45 uppercase font-mono mb-2">
                    今日想問 · Suggested Inquiry
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {suggestions.map((q, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setQuestion(q.zh)}
                        className={`text-xs font-serif-zh px-3 py-1.5 rounded-full border transition-colors ${
                          question === q.zh
                            ? 'border-[rgb(var(--accent-glow))]/60 bg-[rgb(var(--accent-glow))]/10 text-white'
                            : 'border-white/15 text-white/70 hover:border-white/35 hover:text-white'
                        }`}>
                        <span className="text-white/40 mr-1.5">{q.cat}</span>{q.zh}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="或自己寫一個問題（選填）"
                    className="w-full bg-transparent border-0 border-b border-white/10 pb-1.5 text-white/85 text-sm font-serif-zh focus:outline-none focus:border-[rgb(var(--accent-glow))] placeholder:text-white/25 transition-colors"
                  />
                </div>
              )}

              <div className="pt-2">
                <MagneticButton
                  onClick={() => canSubmit && onSubmit({ name, date, time, location, question })}
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
    <section className="relative min-h-screen py-20 md:py-40 px-5 md:px-10 overflow-hidden flex items-center" data-screen-label="03 Element">
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
          {name && Array.from(name).filter((c) => c.trim()).length > 0 && (
            <Reveal delay={460}>
              <div className="mt-10 pt-6 border-t border-white/10 max-w-xl">
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mb-4">
                  Name Resonance · 姓名拆解
                </div>
                <div className="flex gap-2 md:gap-3 flex-wrap">
                  {Array.from(name).filter((c) => c.trim()).map((ch, i) => {
                    const { el: ce, inferred } = charElement(ch);
                    const meta = ELEMENTS[ce];
                    return (
                      <div key={i}
                           className={`rounded-lg border bg-white/[0.02] px-3 md:px-4 py-3 backdrop-blur-xl ${inferred ? 'border-white/5 opacity-70' : 'border-white/10'}`}
                           style={!inferred ? { boxShadow: `inset 0 0 30px -10px rgba(${meta.glow}, 0.35)` } : {}}>
                        <div className="font-serif-zh text-3xl md:text-4xl leading-none"
                             style={{ color: meta.primary, textShadow: inferred ? 'none' : `0 0 20px rgba(${meta.glow}, 0.4)` }}>
                          {ch}
                        </div>
                        <div className="font-mono text-[9px] tracking-[0.2em] text-white/50 uppercase mt-2">
                          {inferred ? <>字氣 ~ {meta.en}</> : <>{meta.zh} · {meta.en}</>}
                        </div>
                        <div className="font-serif-zh text-[11px] text-white/55 mt-1">
                          「{charKeyword(ch, ce)}」
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          )}
        </div>

        <div className="md:col-span-7">
          <Reveal delay={480}>
            <div className="grid grid-cols-5 gap-2 md:gap-3">
              {Object.entries(ELEMENTS).map(([k, v]) => (
                <div key={k}
                     className={`aspect-[2/3] rounded-xl border backdrop-blur-xl p-2 md:p-4 flex flex-col justify-between relative overflow-hidden transition-all ${
                       k === element ? 'border-white/30 bg-white/[0.05] scale-105' : 'border-white/10 bg-white/[0.015] opacity-60'
                     }`}
                     style={ k === element ? { boxShadow: `0 0 60px -10px rgba(${v.glow}, 0.5)` } : {}}>
                  <div className="text-[8px] md:text-[9px] tracking-[0.2em] md:tracking-[0.3em] text-white/40 uppercase font-mono">{String(Object.keys(ELEMENTS).indexOf(k)+1).padStart(2,'0')}</div>
                  <div className="text-center leading-none">
                    <div className="font-serif-zh" style={{ fontSize: 'clamp(1.25rem, 5vw, 3.5rem)', color: v.primary }}>{v.zh}</div>
                    <div className="font-serif-en italic text-[8px] md:text-[11px] text-white/50 mt-1 truncate">{v.en}</div>
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

// 11a. BAZI · 四柱命盤 + 五行分布
// ─────────────────────────────────────────────────────────────────────────
function Bazi({ pillars, distribution, name }) {
  if (!pillars) return null;
  const dayElement = STEM_ELEMENT[pillars.day.stem];
  const insight = interpretBazi(distribution, dayElement);
  const cells = [
    { label: '年柱', sub: 'Year',         p: pillars.year  },
    { label: '月柱', sub: 'Month',        p: pillars.month },
    { label: '日柱', sub: 'Day · 主',      p: pillars.day, primary: true },
    { label: '時柱', sub: 'Hour',         p: pillars.hour  },
  ];
  const total = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  return (
    <section className="relative py-24 md:py-32 px-5 md:px-10 overflow-hidden" data-screen-label="03b Bazi">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-3">
            Chapter II.5 · 四柱命盤
          </div>
          <h2 className="font-serif-zh text-3xl md:text-5xl text-white leading-[1.1] mb-12">
            {name || '訪客'} 之四柱
            <span className="italic text-white/55"> 與五行分布</span>
          </h2>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-16">
          {cells.map((c, i) => (
            <Reveal key={c.label} delay={i * 80}>
              <div className={`rounded-xl border ${c.primary ? 'border-white/30 bg-white/[0.05]' : 'border-white/10 bg-white/[0.02]'} backdrop-blur-xl p-5 md:p-6 h-full`}
                   style={c.primary && c.p ? { boxShadow: `0 0 60px -20px rgba(${ELEMENTS[STEM_ELEMENT[c.p.stem]].glow}, 0.6)` } : {}}>
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/45 uppercase mb-2">{c.sub}</div>
                <div className="font-serif-zh text-white/65 text-sm mb-3">{c.label}</div>
                {c.p ? (
                  <>
                    <div className="flex items-baseline gap-1.5 md:gap-2">
                      <div className="font-serif-zh leading-none"
                           style={{ fontSize: 'clamp(2.75rem, 6vw, 4.5rem)', color: ELEMENTS[STEM_ELEMENT[c.p.stem]].primary }}>
                        {HEAVENLY_STEMS[c.p.stem]}
                      </div>
                      <div className="font-serif-zh leading-none"
                           style={{ fontSize: 'clamp(2.75rem, 6vw, 4.5rem)', color: ELEMENTS[BRANCH_ELEMENT[c.p.branch]].primary }}>
                        {EARTHLY_BRANCHES[c.p.branch]}
                      </div>
                    </div>
                    <div className="mt-4 font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase">
                      {STEM_ELEMENT[c.p.stem]} · {BRANCH_ELEMENT[c.p.branch]}
                    </div>
                  </>
                ) : (
                  <div className="font-serif-zh text-white/30 text-xl mt-6">時辰未明<br/><span className="font-mono text-[10px] tracking-[0.2em] uppercase">Hour unknown</span></div>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={300}>
          <div className="border-t border-white/15 pt-8">
            <div className="flex items-end justify-between mb-6">
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/45 uppercase">
                Element Distribution · 五行分布
              </div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-white/35 uppercase hidden md:block">
                {pillars.hour ? '8 marks · 4 pillars' : '6 marks · 3 pillars'}
              </div>
            </div>
            <div className="space-y-3">
              {Object.entries(distribution).map(([el, n]) => {
                const pct = (n / total) * 100;
                const meta = ELEMENTS[el];
                return (
                  <div key={el} className="flex items-center gap-3 md:gap-4">
                    <div className="font-serif-zh text-xl md:text-2xl w-6 md:w-8" style={{ color: meta.primary }}>{meta.zh}</div>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase w-14 md:w-16 hidden sm:block">{meta.en}</div>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-[width] duration-700"
                           style={{ width: `${pct}%`, background: meta.primary, boxShadow: `0 0 16px rgba(${meta.glow}, 0.55)` }} />
                    </div>
                    <div className="font-mono text-xs text-white/65 w-12 text-right tabular-nums">{n} / {total}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        <Reveal delay={400}>
          <div className="mt-12 grid md:grid-cols-2 gap-5 md:gap-8">
            <div className="rounded-xl border border-white/15 bg-white/[0.03] p-6 md:p-8 backdrop-blur-xl">
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/45 uppercase mb-3">Day-master · 日主</div>
              <div className="flex items-baseline gap-3 mb-3">
                <div className="font-serif-zh text-4xl md:text-5xl" style={{ color: ELEMENTS[dayElement].primary }}>
                  {insight.strength.zh}
                </div>
                <div className="font-serif-en italic text-white/55 text-xl">{insight.strength.en}</div>
              </div>
              <p className="font-serif-zh text-white/75 text-base leading-[1.85]" style={{ textWrap: 'pretty' }}>
                {insight.strength.desc_zh}
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.03] p-6 md:p-8 backdrop-blur-xl">
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/45 uppercase mb-3">Missing · 命中所缺</div>
              {insight.missing.length === 0 ? (
                <>
                  <div className="font-serif-zh text-3xl md:text-4xl text-white/85 mb-2">五行俱全</div>
                  <p className="font-serif-zh text-white/65 text-base leading-[1.85]">命盤五行皆有著落，不必強補；著重日主之強弱調適即可。</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    {insight.missing.map((el) => (
                      <span key={el} className="font-serif-zh text-3xl md:text-4xl" style={{ color: ELEMENTS[el].primary }}>
                        {ELEMENTS[el].zh}
                      </span>
                    ))}
                    <span className="font-serif-zh text-white/55 text-base ml-1">缺</span>
                  </div>
                  <p className="font-serif-zh text-white/75 text-base leading-[1.85]" style={{ textWrap: 'pretty' }}>
                    {insight.missing.map((el) => ELEMENT_ADVICE[el].zh).join(' ')}
                  </p>
                </>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
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
               style={{ fontSize: 'clamp(3rem, 11vw, 11rem)', transform: `translateX(${-scroll * 80}px)`, textShadow: `0 0 80px var(--user-highlight)` }}>
            {slogan.split('').map((ch, i) => (
              <span key={i} className="inline-block"
                    style={{ transform: `translateY(${Math.sin(scroll * 3 + i * 0.4) * 12}px)` }}>
                {ch}
              </span>
            ))}
          </div>
          <div className="font-serif-en italic mt-8 leading-tight"
               style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)', transform: `translateX(${scroll * 60}px)`, color: 'var(--user-primary)' }}>
            {sloganEn}
          </div>

          <div className="mt-16 flex items-center gap-6 max-w-xl">
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, var(--user-accent), transparent)` }} />
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
function VisualPackage({ element, brandName, palette }) {
  const el = ELEMENTS[element];
  return (
    <section className="relative py-20 md:py-32 px-5 md:px-10 overflow-hidden" data-screen-label="05 Visual">
      <div className="max-w-[1600px] mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-8 md:mb-10">
            <div>
              <div className="text-[10px] md:text-[11px] tracking-[0.4em] text-white/50 uppercase font-mono mb-3">Chapter IV · Visual Package</div>
              <h2 className="font-serif-zh text-3xl md:text-6xl text-white leading-tight">意象 · 4K 動態視覺</h2>
            </div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase hidden md:block">
              3840 × 2160 · 24fps · H.265
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-[4/3] sm:aspect-[16/9] group">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full border border-white/40 backdrop-blur-xl flex items-center justify-center mb-4 md:mb-6"
                   style={{ boxShadow: `0 0 60px rgba(${el.glow}, 0.6)`, animation: 'logoBreath 4s ease-in-out infinite' }}>
                <div className="font-serif-zh text-2xl md:text-3xl" style={{ color: el.primary }}>{el.zh}</div>
              </div>
              <div className="font-serif-en text-white text-3xl md:text-7xl tracking-wide mb-2 break-words max-w-full"
                   style={{ textShadow: `0 0 40px rgba(${el.glow}, 0.5)` }}>
                {brandName}
              </div>
              <div className="font-mono text-[9px] md:text-[10px] tracking-[0.3em] md:tracking-[0.4em] text-white/60 uppercase">
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

        {Array.isArray(palette) && palette.length > 0 && (
          <Reveal delay={400}>
            <div className="mt-10 md:mt-14 pt-6 md:pt-8 border-t border-white/15">
              <div className="flex items-end justify-between mb-5 md:mb-6">
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/45 uppercase">
                  Personal Palette · 你的專屬色票
                </div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-white/35 uppercase hidden md:block">
                  Derived from name + birth
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 md:gap-5">
                {palette.map((p) => (
                  <div key={p.name} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 md:p-4 flex items-center gap-3 md:gap-4 backdrop-blur-xl">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-md flex-shrink-0"
                         style={{ background: p.hex, boxShadow: `0 0 36px -8px ${p.hex}` }} />
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] md:text-[10px] tracking-[0.3em] text-white/55 uppercase truncate">{p.name}</div>
                      <div className="font-mono text-xs md:text-sm text-white/90 mt-1">{p.hex.toUpperCase()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
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
              <h2 className="font-serif-en italic text-white text-5xl md:text-6xl">An Analysis of <br/>the <span style={{ color: 'var(--user-primary)' }}>{el.en}</span> Constitution</h2>
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
// ─────────────────────────────────────────────────────────────────────────
// 15c-bis. SHARE CARD (1200×630 canvas → PNG download)
// ─────────────────────────────────────────────────────────────────────────
function drawShareCard({ name, element, brand, slogan, sloganEn, palette }) {
  const W = 1200, H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const el = ELEMENTS[element] || ELEMENTS.water;
  const p = palette || [{ hex: el.primary }, { hex: el.deep }, { hex: el.primary }];

  // Background
  ctx.fillStyle = '#0A0A0F';
  ctx.fillRect(0, 0, W, H);
  // Radial glow primary
  const g1 = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.3, H * 0.4, 700);
  g1.addColorStop(0, p[0].hex + 'aa');
  g1.addColorStop(1, '#0A0A0F00');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, 600);
  g2.addColorStop(0, p[1].hex + '88');
  g2.addColorStop(1, '#0A0A0F00');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
  // Vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 800);
  vg.addColorStop(0, '#00000000'); vg.addColorStop(1, '#000000bb');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // Frame corners
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  const cs = 32, m = 48;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x + cs * dx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + cs * dy);
    ctx.stroke();
  });

  // Top mono label
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 14px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('AURA · AI · STUDIO  ·  EDITION 壹', m + 16, m + 36);

  // Element 漢字 — centerpiece
  ctx.textAlign = 'center';
  ctx.fillStyle = el.primary;
  ctx.shadowColor = el.primary; ctx.shadowBlur = 40;
  ctx.font = '600 220px "Noto Serif TC", "Songti TC", serif';
  ctx.fillText(el.zh, W / 2, 290);
  ctx.shadowBlur = 0;

  // Brand name
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 56px Georgia, "Times New Roman", serif';
  ctx.fillText(brand || 'Untitled', W / 2, 380);

  // Slogan zh
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '400 30px "Noto Serif TC", "Songti TC", serif';
  ctx.fillText(slogan || '', W / 2, 440);

  // Slogan en
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'italic 400 20px Georgia, serif';
  ctx.fillText(sloganEn || '', W / 2, 478);

  // Palette dots
  if (Array.isArray(palette) && palette.length) {
    const totalW = palette.length * 30 + (palette.length - 1) * 18;
    let x = (W - totalW) / 2;
    palette.forEach((c) => {
      ctx.fillStyle = c.hex;
      ctx.beginPath(); ctx.arc(x + 15, 525, 15, 0, Math.PI * 2); ctx.fill();
      x += 48;
    });
  }

  // Bottom subject line
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 14px ui-monospace, Menlo, monospace';
  ctx.fillText(`A MANIFESTED AURA  ·  ${(name || 'GUEST').toUpperCase()}`, W / 2, H - m - 12);

  return canvas;
}

function ShareCardButton({ user, generated, palette }) {
  const [busy, setBusy] = useState(false);
  if (!generated) return null;
  const handle = async () => {
    setBusy(true);
    try {
      const canvas = drawShareCard({
        name: user.name,
        element: generated.element,
        brand: generated.brand,
        slogan: generated.slogan,
        sloganEn: generated.sloganEn,
        palette,
      });
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aura-${(user.name || 'guest').replace(/\s+/g, '_')}-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="px-5 md:px-10 -mt-8 md:-mt-12 mb-12">
      <div className="max-w-[1600px] mx-auto flex justify-center">
        <button
          onClick={handle}
          disabled={busy}
          className="group relative px-6 md:px-8 py-3 rounded-full border border-white/20 bg-white/[0.04] backdrop-blur-xl text-white/85 hover:text-white hover:border-white/40 hover:bg-white/[0.08] transition-all font-mono text-[11px] tracking-[0.3em] uppercase disabled:opacity-50">
          {busy ? '生成中…' : '↓ 下載分享卡 · Download Share Card'}
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 15d. SYNASTRY (合盤) — two-person element compatibility, front-end-only
// ─────────────────────────────────────────────────────────────────────────
function SynastryPage({ open, onClose }) {
  const [a, setA] = useState({ name: '', date: '', time: '' });
  const [b, setB] = useState({ name: '', date: '', time: '' });
  const [lens, setLens] = useState('lover');
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const ready = a.name && a.date.length === 10 && b.name && b.date.length === 10;
  const result = useMemo(() => (ready ? computeSynastry(a, b) : null), [a, b, ready]);

  const fetchAi = async () => {
    if (!result) return;
    setAiLoading(true); setAiError(null); setAi(null);
    try {
      const slim = { score: result.score, rel: result.rel, ea: result.ea, eb: result.eb, da: result.da, db: result.db, complement: result.complement };
      const resp = await fetch('/api/synastry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a, b, result: slim, lens }),
      });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText} — ${raw.slice(0, 200) || '(empty body)'}`);
      setAi(JSON.parse(raw));
    } catch (e) {
      setAiError(String(e?.message || e).slice(0, 200));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] bg-[#0A0A0F]/97 backdrop-blur-2xl overflow-y-auto transition-opacity duration-500"
      style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}>
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-12 md:py-20">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="text-[10px] tracking-[0.4em] text-white/40 uppercase font-mono mb-2">Chapter ✦ · 合盤</div>
            <h2 className="font-serif-zh text-3xl md:text-5xl text-white leading-tight">兩人合盤<span className="italic text-white/55"> · Synastry</span></h2>
            <p className="font-serif-en italic text-white/50 text-sm mt-3">輸入兩人姓名與生辰，照見彼此命盤如何共振。</p>
          </div>
          <button onClick={onClose} aria-label="close" className="w-10 h-10 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center">×</button>
        </div>

        <div className="grid md:grid-cols-2 gap-5 md:gap-6 mb-8">
          {[{ k: 'A', who: a, set: setA, label: '甲 · Person A' }, { k: 'B', who: b, set: setB, label: '乙 · Person B' }].map(({ k, who, set, label }) => (
            <div key={k} className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-6 space-y-5">
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/45 uppercase">{label}</div>
              <Field label="姓名" value={who.name} onChange={(v) => set({ ...who, name: v })} placeholder="例：林雲深" />
              <Field label="生辰" type="date" value={who.date} onChange={(v) => set({ ...who, date: v })} />
              <Field label="時辰（選填）" type="time" value={who.time} onChange={(v) => set({ ...who, time: v })} />
            </div>
          ))}
        </div>

        {!ready && (
          <div className="text-center py-10 font-serif-zh text-white/40 text-sm">填妥兩人姓名與生辰，合盤即可顯現。</div>
        )}

        {ready && result && (
          <div className="space-y-6">
            <div className="rounded-xl border border-white/15 bg-white/[0.03] p-8 backdrop-blur-xl text-center">
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/45 uppercase mb-3">合盤分數 · Compatibility</div>
              <div className="font-serif-en text-7xl md:text-8xl text-white tabular-nums leading-none mb-2"
                   style={{ textShadow: `0 0 60px rgba(${ELEMENTS[result.ea].glow}, 0.5)` }}>
                {result.score}
              </div>
              <div className="font-serif-zh text-2xl text-white/85 mt-4">{SYN_REL_COPY[result.rel].zh}</div>
              <p className="font-serif-zh text-white/65 text-base leading-[1.85] max-w-xl mx-auto mt-3">
                {SYN_REL_COPY[result.rel].desc}
              </p>
              {result.complement > 0 && (
                <p className="font-serif-zh text-[rgb(var(--accent-glow))]/85 text-sm mt-3">
                  互補加分 +{result.complement}：對方剛好補上你命中所缺的元素。
                </p>
              )}

              <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase mr-1">視角</span>
                {[{ k: 'lover', zh: '戀愛' }, { k: 'partner', zh: '事業' }, { k: 'family', zh: '家人' }].map((l) => (
                  <button key={l.k} type="button" onClick={() => setLens(l.k)}
                    className={`text-xs font-serif-zh px-3 py-1 rounded-full border transition-colors ${
                      lens === l.k ? 'border-[rgb(var(--accent-glow))]/60 bg-[rgb(var(--accent-glow))]/10 text-white' : 'border-white/15 text-white/60 hover:text-white'
                    }`}>{l.zh}</button>
                ))}
                <button type="button" onClick={fetchAi} disabled={aiLoading}
                  className="ml-2 text-xs font-mono tracking-[0.2em] uppercase px-4 py-1.5 rounded-full bg-white text-[#0A0A0F] hover:bg-[rgb(var(--accent-glow))] disabled:opacity-50 transition-colors">
                  {aiLoading ? '生成中…' : 'AI 短評 →'}
                </button>
              </div>

              {(ai || aiError) && (
                <div className="mt-5 text-left rounded-lg border border-white/10 bg-black/30 p-5">
                  {aiError ? (
                    <p className="font-mono text-xs text-red-300/80">短評生成失敗：{aiError}</p>
                  ) : (
                    <>
                      <div className="font-serif-zh text-white text-xl mb-2">{ai.headline}</div>
                      <p className="font-serif-zh text-white/80 text-base leading-[1.85]" style={{ textWrap: 'pretty' }}>{ai.body}</p>
                      <p className="font-serif-zh text-[rgb(var(--accent-glow))]/90 text-sm mt-3 italic">— {ai.advice}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {[{ name: a.name, el: result.ea, dist: result.da }, { name: b.name, el: result.eb, dist: result.db }].map((p, i) => {
                const total = Object.values(p.dist).reduce((s,n)=>s+n,0) || 1;
                return (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
                    <div className="font-mono text-[10px] tracking-[0.3em] text-white/45 uppercase mb-2">{i === 0 ? '甲' : '乙'} · 日主</div>
                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="font-serif-zh text-white text-xl">{p.name}</span>
                      <span className="font-serif-zh text-3xl" style={{ color: ELEMENTS[p.el].primary }}>{ELEMENTS[p.el].zh}</span>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(p.dist).map(([el, n]) => (
                        <div key={el} className="flex items-center gap-2">
                          <span className="font-serif-zh text-sm w-5" style={{ color: ELEMENTS[el].primary }}>{ELEMENTS[el].zh}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full" style={{ width: `${(n/total)*100}%`, background: ELEMENTS[el].primary }} />
                          </div>
                          <span className="font-mono text-[10px] text-white/55 w-6 text-right tabular-nums">{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TopBar({ onOpenArchive, onRestart, onOpenSynastry }) {
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
        <button onClick={onOpenSynastry} className="hover:text-white transition-colors">{lang === 'zh' ? '合盤' : 'Synastry'}</button>
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
  const daysAgo = daysBetween(Date.now(), item.createdAt);
  const ago = daysAgo === 0 ? '今日' : daysAgo === 1 ? '昨日' : `${daysAgo} 天前`;
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
            <div className="font-mono text-[9px] tracking-[0.25em] text-white/30 uppercase mt-3 flex items-center gap-2">
              <span>{t('ar_generated')} · {dateStr}</span>
              <span className="text-[rgb(var(--accent-glow))]/70">· {ago}</span>
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
  const [synastryOpen, setSynastryOpen] = useState(false);
  useEffect(() => {
    localStorage.setItem('aura_state', JSON.stringify({ state, user, generated }));
  }, [state, user, generated]);

  const element = generated?.element || 'water';
  const el = ELEMENTS[element];

  const pillars      = useMemo(() => computeFourPillars(user.date, user.time), [user.date, user.time]);
  const distribution = useMemo(() => elementDistribution(pillars),              [pillars]);
  const palette      = useMemo(() => personalPalette(user.name, user.date, element), [user.name, user.date, element]);

  // Apply element + user-palette CSS vars (so children can opt into "your color")
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-glow', el.glow);
    document.documentElement.style.setProperty('--accent-primary', el.primary);
    if (palette && generated) {
      document.documentElement.style.setProperty('--user-primary',   palette[0].hex);
      document.documentElement.style.setProperty('--user-accent',    palette[1].hex);
      document.documentElement.style.setProperty('--user-highlight', palette[2].hex);
    } else {
      document.documentElement.style.setProperty('--user-primary',   el.primary);
      document.documentElement.style.setProperty('--user-accent',    el.deep);
      document.documentElement.style.setProperty('--user-highlight', el.primary);
    }
  }, [element, el.glow, el.primary, el.deep, palette, generated]);

  // Sync result-state to URL so the page is shareable.
  useEffect(() => {
    if (generated && user.name && user.date) {
      const params = new URLSearchParams({ n: user.name, d: user.date });
      if (user.time)     params.set('t', user.time);
      if (user.location) params.set('l', user.location);
      const next = `${window.location.pathname}?${params.toString()}`;
      if (next !== window.location.pathname + window.location.search) {
        window.history.replaceState(null, '', next);
      }
    } else if (state === 'hero' || state === 'ritual') {
      if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    }
  }, [generated, user.name, user.date, user.time, user.location, state]);

  const handleSubmit = async (data) => {
    setUser(data);
    setState('ceremony');
    const elem = deriveElement(data.name, data.date);
    const fallback = { element: elem, ...POOLS[elem] };

    // Compute structural data once and ship it to the AI.
    const submitPillars = computeFourPillars(data.date, data.time);
    const submitDist    = elementDistribution(submitPillars);
    const dayElement    = submitPillars ? STEM_ELEMENT[submitPillars.day.stem] : elem;
    const insight       = interpretBazi(submitDist, dayElement);
    const nameChars     = Array.from(data.name || '').filter((c) => c.trim()).map((ch) => {
      const { el: ce, inferred } = charElement(ch);
      return { ch, element: ce, inferred };
    });
    const pillarsForApi = submitPillars ? {
      year:  { stem: HEAVENLY_STEMS[submitPillars.year.stem],  branch: EARTHLY_BRANCHES[submitPillars.year.branch],  element: STEM_ELEMENT[submitPillars.year.stem] },
      month: { stem: HEAVENLY_STEMS[submitPillars.month.stem], branch: EARTHLY_BRANCHES[submitPillars.month.branch], element: STEM_ELEMENT[submitPillars.month.stem] },
      day:   { stem: HEAVENLY_STEMS[submitPillars.day.stem],   branch: EARTHLY_BRANCHES[submitPillars.day.branch],   element: STEM_ELEMENT[submitPillars.day.stem] },
      hour:  submitPillars.hour ? { stem: HEAVENLY_STEMS[submitPillars.hour.stem], branch: EARTHLY_BRANCHES[submitPillars.hour.branch], element: STEM_ELEMENT[submitPillars.hour.stem] } : null,
    } : null;

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
          pillars: pillarsForApi,
          distribution: submitDist,
          dayMaster: { element: dayElement, strength: insight.strength.zh, dayCount: insight.dayCount, total: insight.total },
          missing: insight.missing,
          nameChars,
          question: data.question || '',
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

  // On mount: if URL has shared params and we have no in-flight reading, auto-trigger.
  const bootedFromUrlRef = useRef(false);
  useEffect(() => {
    if (bootedFromUrlRef.current) return;
    bootedFromUrlRef.current = true;
    if (generated) return; // already restored from localStorage
    const sp = new URLSearchParams(window.location.search);
    const n = sp.get('n'), d = sp.get('d'), t = sp.get('t') || '', l = sp.get('l') || '';
    if (n && /^\d{4}-\d{2}-\d{2}$/.test(d || '')) {
      handleSubmit({ name: n, date: d, time: t, location: l });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <SynastryPage open={synastryOpen} onClose={() => setSynastryOpen(false)} />
      <Ceremony active={state === 'ceremony'} ready={!!generated} element={generated?.element || 'water'} onDone={() => setState('result')} />

      <main className="relative">
        <Hero
          element={generated?.element || 'water'}
          onOpenArchive={() => setArchiveOpen(true)}
          onOpenSynastry={() => setSynastryOpen(true)}
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
            <Bazi pillars={pillars} distribution={distribution} name={user.name} />
            <SloganParallax slogan={generated.slogan} sloganEn={generated.sloganEn} />
            <VisualPackage element={generated.element} brandName={generated.brand} palette={palette} />
            <ShareCardButton user={user} generated={generated} palette={palette} />
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
