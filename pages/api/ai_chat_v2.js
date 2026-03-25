// ================================================================
// ai_chat_v2.js — Shabaton + Morim AI Chatbot
// Vercel serverless endpoint
// ================================================================

import fs from 'fs';
import path from 'path';

const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY || '';
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';
const HAIKU_MODEL  = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';

// ── System prompt ──
const SYSTEM_PROMPT = `אתה עוזר וירטואלי חכם ומועיל של מערך האתרים של שבתון ומורים.

האתרים שאתה מייצג:
1. shabaton.online — קורסים והשתלמויות למורים וגננות בשנת שבתון
2. morim.boutique — קורסים ייחודיים ומיוחדים למורים
3. morim.online — פורטל מורים

חוקים חשובים:
- ענה תמיד בעברית, בשפה חמה וידידותית
- השתמש אך ורק במידע מהמאגר שסופק לך — אל תמציא קורסים, מחירים, תאריכים
- אם לא מצאת מידע רלוונטי — אמור זאת בכנות והפנה לאתר הרלוונטי
- הצע קישורים לדפים ספציפיים כשזה רלוונטי
- שמור על תשובות קצרות וממוקדות — לא יותר מ-3-4 משפטים כברירת מחדל
- לשאלות מורכבות תן תשובה מפורטת יותר

קישורים שימושיים:
- כל קורסי שבתון: https://www.shabaton.online/results-all
- וואטסאפ שבתון: https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME
- morim.boutique: https://www.morim.boutique
- morim.online: https://www.morim.online`;

// ── Cache קבצי נתונים ──
const cache = {};

function loadJSON(filename) {
  if (cache[filename]) return cache[filename];
  try {
    const p = path.join(process.cwd(), 'data', filename);
    cache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`✅ Loaded: ${filename}`);
  } catch(e) {
    console.warn(`⚠️ Could not load ${filename}: ${e.message}`);
    cache[filename] = null;
  }
  return cache[filename];
}

// ── בניית context מהאינדקסים ──
function buildContext(question, sourceSite) {
  const qLower = question.toLowerCase();
  const parts = [];

  // ─ QA של שבתון ─
  const qa = loadJSON('shabaton-qa.json');
  if (qa) {
    const items = qa.qaItems || qa;
    const relevant = (Array.isArray(items) ? items : [])
      .filter(item => {
        const text = ((item.question || item.q || '') + ' ' + (item.answer || item.a || '')).toLowerCase();
        return qLower.split(/\s+/).filter(w => w.length > 3).some(w => text.includes(w));
      })
      .slice(0, 4);

    if (relevant.length > 0) {
      parts.push('=== מידע מבסיס הידע של שבתון ===');
      relevant.forEach(item => {
        const q = item.question || item.q || '';
        const a = item.answer || item.a || '';
        if (q && a) parts.push(`ש: ${q}\nת: ${a}`);
      });
    }
  }

  // ─ Info pages ─
  const info = loadJSON('shabaton-info.json');
  if (info) {
    const pages = Array.isArray(info) ? info : [];
    const relevant = pages
      .filter(p => {
        const text = ((p.title || '') + ' ' + (p.description || '')).toLowerCase();
        return qLower.split(/\s+/).filter(w => w.length > 3).some(w => text.includes(w));
      })
      .slice(0, 2);

    if (relevant.length > 0) {
      parts.push('\n=== דפי מידע רלוונטיים ===');
      relevant.forEach(p => {
        parts.push(`כותרת: ${p.title}\nתיאור: ${p.description || ''}\nקישור: ${p.url || ''}`);
      });
    }
  }

  // ─ אינדקס שבתון ─
  const indexes = ['shabaton_index_part1.json', 'shabaton_index_part2.json', 'shabaton_index.json'];
  const courseResults = [];

  for (const idx of indexes) {
    const data = loadJSON(idx);
    if (!data) continue;
    const pages = Array.isArray(data) ? data : (data.pages || []);
    const relevant = pages
      .filter(p => {
        const text = ((p.title || '') + ' ' + (p.description || '')).toLowerCase();
        return qLower.split(/\s+/).filter(w => w.length > 3).some(w => text.includes(w));
      })
      .slice(0, 3);
    courseResults.push(...relevant);
    if (courseResults.length >= 5) break;
  }

  if (courseResults.length > 0) {
    parts.push('\n=== קורסים רלוונטיים שנמצאו ===');
    courseResults.slice(0, 5).forEach(p => {
      parts.push(`שם: ${p.title}\nתיאור: ${(p.description || '').substring(0, 150)}\nקישור: ${p.url || p.link || ''}`);
    });
  }

  // ─ אינדקס מורים (אם קיים) ─
  const morimIndexes = ['morim_index.json', 'morim_index_part1.json'];
  for (const idx of morimIndexes) {
    const data = loadJSON(idx);
    if (!data) continue;
    const pages = Array.isArray(data) ? data : (data.pages || []);
    const relevant = pages
      .filter(p => {
        const text = ((p.title || '') + ' ' + (p.description || '')).toLowerCase();
        return qLower.split(/\s+/).filter(w => w.length > 3).some(w => text.includes(w));
      })
      .slice(0, 2);

    if (relevant.length > 0) {
      parts.push('\n=== קורסים נוספים ממורים.בוטיק / מורים.אונליין ===');
      relevant.forEach(p => {
        parts.push(`שם: ${p.title}\nקישור: ${p.url || p.link || ''}`);
      });
    }
  }

  return parts.join('\n\n');
}

// ── בחירת מודל ──
function chooseModel(question) {
  const complexPatterns = [
    'הסבר', 'מה ההבדל', 'השוואה', 'למה', 'איך', 'תהליך',
    'זכאות', 'תנאים', 'חישוב', 'מסלול', 'כמה שעות', 'ש"ש',
    'אופק חדש', 'עוז לתמורה', 'תואר'
  ];
  return complexPatterns.some(p => question.includes(p)) ? SONNET_MODEL : HAIKU_MODEL;
}

// ── קריאה ל-Claude ──
async function callClaude(question, context, history) {
  const model = chooseModel(question);

  const userContent = context
    ? `מידע רלוונטי מהאתרים:\n${context}\n\n---\nשאלת הגולש: ${question}`
    : question;

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
      messages: [
        ...history.slice(-6),
        { role: 'user', content: userContent }
      ]
    })
  });

  if (!response.ok) throw new Error(`Claude API ${response.status}`);
  const data = await response.json();
  return { reply: data.content?.[0]?.text || '', model };
}

// ── שמירה ל-Zapier ──
async function logToZapier(question, reply, site, model) {
  if (!ZAPIER_WEBHOOK_URL) return;
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const timeStr = now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
    await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: dateStr,
        time: timeStr,
        site,
        question,
        answer: reply,
        model,
        answer_length: String(reply.length)
      })
    });
    console.log('✅ Zapier logged');
  } catch(e) {
    console.warn('⚠️ Zapier error:', e.message);
  }
}

// ── Handler ──
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Missing API key' });

  const { message, history = [], site = 'shabaton' } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    console.log(`📨 [${site}] "${message.substring(0,60)}"`);
    const context = buildContext(message, site);
    const { reply, model } = await callClaude(message, context, history);
    console.log(`✅ ${model} | ${reply.length} chars`);
    await logToZapier(message, reply, site, model);
    return res.status(200).json({ reply, model });
  } catch(e) {
    console.error('❌', e.message);
    return res.status(500).json({ error: e.message });
  }
}
