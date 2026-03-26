// ================================================================
// ai_chat_v2.js — Shabaton + Morim AI Chatbot
// VERSION: AI_v2_smart_search
// ================================================================

import fs from 'fs';
import path from 'path';

const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY || '';
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';
const HAIKU_MODEL  = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';

// ── System prompt ──
const SYSTEM_PROMPT = `אתה "שבי" — העוזר הוירטואלי של שבתון, חכם, ידידותי ואלגנטי.

חוקים חשובים:
- ענה תמיד בעברית, בשפה חמה וקצרה
- השתמש רק במידע שסופק לך — אל תמציא קורסים, מחירים, תאריכים
- אל תציע "לארגן קורסים" — אתה מוצא קורסים קיימים בלבד
- תשובות ממוקדות — לא יותר מ-4-5 שורות לפני הקורסים

פורמט חובה להצגת קורסים:
### שם המוסד
📍 עיר/אזור | 🎓 תיאור קצר בשחור
[מידע על הקורס](URL)

פורמט חובה בסוף כל תשובה עם קורסים:
---
📌 [כל הקורסים בתחום ובאזור](URL)
💌 [הצטרפו לעלון שבתון](https://www.shabaton.online/shabaton)
💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)

לשאלות מידע (לא קורסים) — ענה בצורה ברורה ומועילה, ללא כרטיסי קורסים.
אם מצאת דף מידע רלוונטי — קשר אליו עם תיאור מתאים: [מידע על {הנושא}](URL)

קישורים לאזורים:
- צפון: https://www.shabaton.online/results-Zafon
- מרכז: https://www.shabaton.online/search-results-merkaz
- ירושלים: https://www.shabaton.online/results-jerusalem
- דרום: https://www.shabaton.online/results-shfea-darom
- שרון: https://www.shabaton.online/results-Sharon
- הכל: https://www.shabaton.online/results-all`;

// ── Cache ──
const _cache = {};
function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    const p = path.join(process.cwd(), 'data', filename);
    _cache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`✅ ${filename}`);
  } catch(e) {
    console.warn(`⚠️ ${filename}: ${e.message}`);
    _cache[filename] = null;
  }
  return _cache[filename];
}

// ── זיהוי אזור מהשאלה ──
function detectRegion(q) {
  const qL = q.toLowerCase();
  if (/צפון|חיפה|עכו|נצרת|טבריה|נהריה|קריות|עפולה|גליל|כרמל/.test(qL))
    return { name: 'חיפה והצפון', slug: 'results-Zafon', cities: ['חיפה','נצרת','עכו','טבריה','נהריה','עפולה','קריות','גליל'] };
  if (/מרכז|תל.?אביב|רמת.?גן|גבעתיים|פתח.?תקווה|ראשון|רחובות|נס.?ציונה|חולון|בת.?ים|רמלה|לוד/.test(qL))
    return { name: 'מרכז', slug: 'search-results-merkaz', cities: ['תל אביב','רמת גן','פתח תקווה','ראשון לציון','רחובות'] };
  if (/ירושלים|בית.?שמש/.test(qL))
    return { name: 'ירושלים', slug: 'results-jerusalem', cities: ['ירושלים','בית שמש'] };
  if (/דרום|באר.?שבע|אשדוד|אשקלון|קרית.?גת/.test(qL))
    return { name: 'דרום', slug: 'results-shfea-darom', cities: ['באר שבע','אשדוד','אשקלון'] };
  if (/שרון|נתניה|הרצליה|כפר.?סבא|רעננה|הוד.?השרון/.test(qL))
    return { name: 'שרון', slug: 'results-Sharon', cities: ['נתניה','הרצליה','כפר סבא','רעננה'] };
  return null;
}

// ── חיפוש חכם באינדקסים ──
function searchIndex(question, region) {
  const qL = question.toLowerCase();
  
  // מילות חיפוש משמעותיות (ללא מילות עזר)
  const stopWords = new Set(['את','של','על','עם','אל','לי','לו','לה','הם','הן','כל','גם','רק','כבר','אבל','אם','כי','שם','פה','זה','זו','זאת','היה','הוא','היא','אני','אתה','אנחנו','כן','לא','מה','מי','איך','מתי','איפה','בצפון','בדרום','במרכז','בירושלים','בשרון']);
  const searchWords = qL.split(/\s+/)
    .map(w => w.replace(/['"?,!.]/g,''))
    .filter(w => w.length > 2 && !stopWords.has(w));

  const results = [];
  const seen = new Set();
  
  const allIndexes = [
    'shabaton_index_part1.json',
    'shabaton_index_part2.json', 
    'shabaton_index.json',
    'morim_index.json',
    'morim_index_part1.json'
  ];

  for (const fname of allIndexes) {
    const data = loadJSON(fname);
    if (!data) continue;
    const pages = Array.isArray(data) ? data : (data.pages || []);

    for (const page of pages) {
      const url = page.url || page.link || '';
      if (seen.has(url)) continue;

      const title = (page.title || '').toLowerCase();
      const desc  = (page.description || '').toLowerCase();
      const text  = (page.text || '').toLowerCase();
      const combined = title + ' ' + desc + ' ' + text;

      // סנן דפי קטגוריה גנריים (results-)
      if (url.includes('/results-') || url.includes('/search-results')) continue;
      // סנן דפי מידע כלליים
      if (url.includes('/end_shabaton') || url.includes('/shabaton-maanak')) continue;

      // חשב ציון
      let score = 0;
      for (const w of searchWords) {
        if (title.includes(w)) score += 3;
        else if (desc.includes(w)) score += 2;
        else if (text.includes(w)) score += 1;
      }
      if (score === 0) continue;

      // בדיקת אזור
      if (region) {
        const hasRegion = region.cities.some(c => combined.includes(c.toLowerCase()));
        const hasWrongRegion = combined.includes('ירושלים') && region.name !== 'ירושלים' ||
          combined.includes('באר שבע') && region.name !== 'דרום' ||
          combined.includes('תל אביב') && region.name !== 'מרכז';
        
        if (!hasRegion && hasWrongRegion) continue;
        if (hasRegion) score += 5;
      }

      seen.add(url);
      results.push({ title: page.title, url, description: page.description || '', score });
    }
  }

  return results
    .sort((a,b) => b.score - a.score)
    .slice(0, 6);
}

// ── בניית context לClaude ──
function buildContext(question, site) {
  const region = detectRegion(question);
  const parts  = [];

  // מידע מ-QA
  const qa = loadJSON('shabaton-qa.json');
  if (qa) {
    const items = qa.qaItems || qa;
    const qL = question.toLowerCase();
    const relevant = (Array.isArray(items) ? items : [])
      .filter(item => {
        const t = ((item.question||item.q||'') + ' ' + (item.answer||item.a||'')).toLowerCase();
        return question.split(/\s+/).filter(w=>w.length>3).some(w=>t.includes(w.toLowerCase()));
      }).slice(0, 3);

    if (relevant.length > 0) {
      parts.push('=== מידע רלוונטי על שבתון ===');
      relevant.forEach(item => {
        const q = item.question || item.q || '';
        const a = item.answer   || item.a || '';
        if (q && a) parts.push(`ש: ${q}\nת: ${a}`);
      });
    }
  }

  // חיפוש קורסים באינדקס
  const courses = searchIndex(question, region);
  if (courses.length > 0) {
    parts.push('\n=== קורסים ומוסדות שנמצאו ===');
    courses.forEach(c => {
      parts.push(`שם: ${c.title}\nקישור: ${c.url}${c.description ? '\nתיאור: ' + c.description.substring(0,120) : ''}`);
    });
  } else {
    // אין תוצאות — ספר לClaude ותן לו להפנות
    const regionStr = region ? ` ב${region.name}` : '';
    parts.push(`\n=== תוצאות חיפוש ===\nלא נמצאו קורסים ספציפיים לשאלה${regionStr}.`);
    if (region) {
      parts.push(`קישור לכל הקורסים${regionStr}: https://www.shabaton.online/${region.slug}`);
    }
  }

  if (region) {
    parts.push(`\nאזור שזוהה: ${region.name}`);
  }

  return parts.join('\n\n');
}

// ── בחירת מודל ──
function chooseModel(question) {
  const complex = /הסבר|מה ההבדל|השוואה|למה|תהליך|זכאות|תנאים|חישוב|מסלול|כמה שעות|ש"ש|אופק חדש|עוז לתמורה|תואר/;
  return complex.test(question) ? SONNET_MODEL : HAIKU_MODEL;
}

// ── קריאה ל-Claude ──
async function callClaude(question, context, history) {
  const model = chooseModel(question);
  const userContent = context
    ? `${context}\n\n---\nשאלת הגולש: ${question}`
    : question;

  console.log(`🤖 Calling Claude: model=${model} msgLen=${userContent.length}`);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [...history.slice(-6), { role: 'user', content: userContent }]
    })
  });

  if (!response.ok) {
    let errText = '';
    try { errText = await response.text(); } catch(te) { errText = 'unknown'; }
    throw new Error(`Claude API ${response.status}: ${errText}`);
  }
  const data = await response.json();
  return { reply: data.content?.[0]?.text || '', model };
}

// ── Zapier ──
async function logToZapier(question, reply, site, model) {
  if (!ZAPIER_WEBHOOK_URL) return;
  try {
    const now = new Date();
    await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }),
        time: now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }),
        site, question, answer: reply, model,
        answer_length: String(reply.length)
      })
    });
  } catch(e) { console.warn('⚠️ Zapier:', e.message); }
}

// ── Handler ──
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });

  const { message, history = [], site = 'shabaton' } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  console.log(`🔑 API key present: ${!!ANTHROPIC_API_KEY} | key prefix: ${ANTHROPIC_API_KEY.substring(0,10)}...`);

  try {
    const region = detectRegion(message);
    console.log(`📨 [${site}] "${message.substring(0,60)}" | region: ${region?.name || 'none'}`);
    const context = buildContext(message, site);
    const { reply, model } = await callClaude(message, context, history);
    console.log(`✅ ${model} | ${reply.length} chars`);
    await logToZapier(message, reply, site, model);
    return res.status(200).json({ reply, model });
  } catch(e) {
    console.error('❌ FULL ERROR:', e.message, e.stack?.split('\n')[1]);
    return res.status(500).json({ error: e.message });
  }
}
