// שבי - עוזר שבתון AI
// ESM format (package.json has "type": "module")

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method === 'GET')     return res.status(200).json({ status: 'ok', bot: 'shabi' });
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || '';
  const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';

  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Missing API key' });

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }

    const message = body.message || '';
    const history = body.history || [];
    const site    = body.site    || 'shabaton';

    if (!message) return res.status(400).json({ error: 'message required' });

    console.log(`POST [${site}]: ${message.substring(0, 60)}`);

    let context = '';
    try { context = buildContext(message); } catch(e) { console.warn('context:', e.message); }

    const SYSTEM_PROMPT = 'שמך שבי, העוזר החכם של שבתון.\n' +
      'ענה תמיד בעברית. אופי חביב, ידידותי, מקצועי.\n' +
      'אל תמציא קורסים - השתמש אך ורק במידע שסופק לך מהאינדקס.\n' +
      'אם מוסד לא מופיע ברשימת הקורסים שסופקה - אל תציג אותו בשום מקרה.\n' +
      'אסור לשאול שאלות אישיות. שאל שאלות מקצועיות בלבד.\n' +
      'הצג את המוסדות בסדר אקראי בכל תשובה.\n' +
      'אם יש פחות מ-3 מוסדות פרונטליים באזור - הצע גם קורסים בלמידה מרחוק.\n' +
      'אם הגולש מחפש למידה מרחוק - אל תציין אזור גיאוגרפי, כי למידה מרחוק אינה תלויה באזור.\n' +
      'אסור תווים בשפות זרות. לימודים פנים אל פנים = לימודים פרונטליים.\n\n' +
      'חוקי פורמט נוקשים:\n' +
      '- אסור בהחלט לכתוב -- או --- בשום מקום בתשובה\n' +
      '- כל הטקסט באותו גודל פונט - אסור להשתמש ב-### לשאלות\n' +
      '- שאלה בסוף תשובה - כתוב כטקסט רגיל עם אייקון קטן בלבד, למשל: 💬 שאלה?\n' +
      '- קורסים: ### שם המוסד (רק לשמות מוסדות, לא לשאלות)\n\n' +
      'פורמט קורסים:\n' +
      '### שם המוסד\n' +
      'תיאור קצר\n' +
      '[מידע על הקורס](URL)\n\n' +
      'footer (ללא שום קו הפרדה):\n' +
      '📚 [כל קורסי [תחום] ב[אזור]](https://www.shabaton.online/[slug]/[תחום])\n' +
      '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
      '💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
      'אחרי ה-footer: שאלה מקצועית אחת בטקסט רגיל עם אייקון קטן.\n\n' +
      'רשימת מוסדות הדרכת הורים בצפון (אלה בלבד):\n' +
      'בית לצמיחה (yaelrath) | בית איזי שפירא (beitissie) | מכון איתן-דנה קינד (danak)\n' +
      'אורנים (oranim-morim) | מכללת יוזמות (yozmot) | לוינסקי-וינגייט (wingate_morim)\n' +
      'דוד ילין (dyellin) | מרכז י.נ.ר (ynr) | שפר (merkaz-shefer)\n' +
      'מכללת השכל (haskel) | מרכז הפעוט (hapaotcenter) | תלפיות (talpiot_edu)\n' +
      'ניצן (nitzan-israel) | האוניברסיטה הפתוחה (openu_teachers) | אוניברסיטת חיפה (haifa-ma-edu)\n\n' +
      'slug אזורים: צפון=results-Zafon | מרכז=search-results-merkaz | ירושלים=results-jerusalem | דרום=results-shfea-darom | שרון=results-Sharon\n' +
      'slug תחום הדרכת הורים: קורסי הדרכת הורים, זוגיות ומשפחה'

    const model = /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|אופק|תואר/.test(message)
      ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

    const userContent = context ? `${context}\n\n---\nשאלת הגולש: ${message}` : message;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude ${claudeRes.status}: ${errText.substring(0, 100)}`);
    }

    const data = await claudeRes.json();
    const reply = data.content?.[0]?.text || '';
    console.log(`OK ${model} | ${reply.length} chars`);

    if (ZAPIER_WEBHOOK_URL) {
      try {
        const now = new Date();
        await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }),
            time: now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }),
            site, question: message, answer: reply, model,
            needs_learning: reply.includes('לא נמצאו') ? 'YES' : 'OK'
          })
        });
      } catch(ze) {}
    }

    return res.status(200).json({ reply, model });

  } catch(e) {
    console.error('ERROR:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ── פונקציות עזר ──

function detectRegion(q) {
  if (/צפון|חיפה|עכו|נצרת|טבריה|נהריה|גליל|כרמל/.test(q))
    return { name: 'צפון', slug: 'results-Zafon', cities: ['חיפה','נצרת','עכו','טבריה','גליל','כרמל','טירת'] };
  if (/מרכז|תל.?אביב|רמת.?גן|פתח.?תקווה|ראשון|רחובות/.test(q))
    return { name: 'מרכז', slug: 'search-results-merkaz', cities: ['תל אביב','רמת גן','פתח תקווה','ראשון לציון','רחובות'] };
  if (/ירושלים|בית.?שמש/.test(q))
    return { name: 'ירושלים', slug: 'results-jerusalem', cities: ['ירושלים'] };
  if (/דרום|באר.?שבע|אשדוד/.test(q))
    return { name: 'דרום', slug: 'results-shfea-darom', cities: ['באר שבע','אשדוד'] };
  if (/שרון|נתניה|הרצליה|כפר.?סבא/.test(q))
    return { name: 'שרון', slug: 'results-Sharon', cities: ['נתניה','הרצליה','כפר סבא'] };
  return null;
}

function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    const p = path.join(process.cwd(), 'data', filename);
    _cache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) { _cache[filename] = null; }
  return _cache[filename];
}

function buildContext(question) {
  const region = detectRegion(question);
  const parts = [];

  try {
    const qa = loadJSON('shabaton-qa.json');
    if (qa) {
      const items = Array.isArray(qa) ? qa : (qa.qaItems || []);
      const qw = question.split(/\s+/).filter(w => w.length > 3);
      const rel = items.filter(item => {
        const t = ((item.question||item.q||'') + ' ' + (item.answer||item.a||'')).toLowerCase();
        return qw.some(w => t.includes(w.toLowerCase()));
      }).slice(0, 3);
      if (rel.length) {
        parts.push('=== מידע על שבתון ===');
        rel.forEach(item => {
          const q = item.question||item.q||'', a = item.answer||item.a||'';
          if (q && a) parts.push(`ש: ${q}\nת: ${a}`);
        });
      }
    }
  } catch(e) {}

  try {
    const qL = question.toLowerCase();
    const stop = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך']);
    const words = qL.split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
    const results = [], seen = new Set();

    ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json'].forEach(fname => {
      const data = loadJSON(fname);
      if (!data) return;
      const pages = Array.isArray(data) ? data : (data.pages || []);
      pages.forEach(page => {
        const url = page.url || page.link || '';
        if (seen.has(url) || url.includes('/results-')) return;
        const title = (page.title || '').toLowerCase();
        const desc  = (page.description || '').toLowerCase();
        let score = 0;
        words.forEach(w => {
          if (title.includes(w)) score += 3;
          else if (desc.includes(w)) score += 2;
          else if ((page.text||'').toLowerCase().includes(w)) score += 1;
        });
        if (!score) return;
        // הסר דפים שלא קשורים ישירות לתחום (מניעת המצאות)
        var titleCheck = title + desc;
        if (words.some(function(w){ return w.length > 4; }) && score < 3 && !region) return;
        if (region) region.cities.forEach(c => { if ((title+desc).includes(c.toLowerCase())) score += 5; });
        seen.add(url);
        results.push({ title: page.title, url, description: page.description||'', score });
      });
    });

    results.sort((a,b) => b.score - a.score);
    // ערבב בין תוצאות בעלות ציון דומה
    const topScored = results.filter(r => r.score >= results[0]?.score - 2);
    const rest = results.filter(r => r.score < results[0]?.score - 2);
    for (let i = topScored.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [topScored[i], topScored[j]] = [topScored[j], topScored[i]];
    }
    const top = [...topScored, ...rest].slice(0, 10);
    if (top.length) {
      parts.push('\n=== קורסים שנמצאו ===');
      top.forEach(c => parts.push(`שם: ${c.title}\nקישור: ${c.url}${c.description ? '\nתיאור: ' + c.description.substring(0,120) : ''}`));
    } else {
      parts.push(`\nלא נמצאו קורסים ספציפיים.${region ? '\nURL: https://www.shabaton.online/' + region.slug : ''}`);
    }
  } catch(e) {}

  if (region) parts.push(`\nאזור: ${region.name} | slug: ${region.slug}`);
  return parts.join('\n\n');
}
