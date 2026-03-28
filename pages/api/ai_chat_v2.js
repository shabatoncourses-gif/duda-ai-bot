// שבי - עוזר שבתון AI v4
// ESM format - package.json has "type": "module"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

// ── System Prompt ──────────────────────────────────────
const SYSTEM_PROMPT =
  'שמך שבי, העוזר החכם והנעים של שבתון.\n' +
  'ענה תמיד בעברית בחום ובידידותיות.\n\n' +

  'כלל ברזל: תן תשובה עניינית מהמידע שסופק. לעולם אל תאמר שאינך יכול לענות.\n\n' +

  'לשאלות מידע על שבתון:\n' +
  '1. תחילה - תן תשובה קצרה וברורה מתוך התוכן שסופק\n' +
  '2. אחר כך - הפנה לדף הרלוונטי באתר\n' +
  '3. אל תפנה לגורמים חיצוניים\n\n' +

  'לשאלות קורסים:\n' +
  '- הצג עד 5 מוסדות מהמידע שסופק בלבד, בסדר אקראי\n' +
  '- אסור להציג מוסד שלא מופיע במידע שסופק\n' +
  '- כל מוסד: ### שם | תיאור קצר | [פנו למידע ולייעוץ אישי](URL)\n\n' +

  'פורמט קישורי מידע:\n' +
  '📋 **שם הדף**\n' +
  'תיאור קצר\n' +
  '[לפירוט ולמידע נוסף](URL)\n' +
  '"מידע וטיפים חשובים" - תמיד אחרון\n\n' +

  'footer לקורסים:\n' +
  '📚 [כל קורסי [תחום] ב[אזור]](https://www.shabaton.online/[slug-אזור]/[slug-מקודד])\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +

  'כללי footer לקורסים:\n' +
  'יש אזור בשאלה: https://www.shabaton.online/[slug-אזור]/[slug-תחום-מקודד]\n' +
  'אין אזור בשאלה: https://www.shabaton.online/results-all/[slug-תחום-מקודד]\n' +
  'אל תציג קישורי אזורים כלליים כשאין אזור בשאלה.\n\n' +
  'footer לשאלות מידע:\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
  'אסור -- או ---. שאלה בסוף: ידידותית, ללא כוכביות.';


// ── זיהוי אזור מ-regions.json ──
function detectRegion(q) {
  try {
    const data = loadJSON('regions.json');
    if (!data || !data.regions) return null;
    const qL = q.toLowerCase();
    for (const region of data.regions) {
      // בדוק keywords
      if (region.keywords && region.keywords.some(k => qL.includes(k.toLowerCase()))) {
        return { name: region.name, slug: region.slug, cities: region.cities || [] };
      }
      // בדוק cities
      if (region.cities && region.cities.some(c => qL.includes(c.toLowerCase()))) {
        return { name: region.name, slug: region.slug, cities: region.cities };
      }
    }
  } catch(e) {}
  return null;
}

// ── חיפוש קורסים ──
function searchCourses(question, region) {
  const results = [], seen = new Set();
  const qL = question.toLowerCase();
  const stop = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך']);
  const words = qL.split(/\s+/).filter(w => w.length > 2 && !stop.has(w));

  const indexes = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json','morim_index_part1.json'];
  for (const fname of indexes) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', fname), 'utf8'));
      const pages = Array.isArray(data) ? data : (data.pages || []);
      for (const page of pages) {
        const url = page.url || page.link || '';
        if (seen.has(url) || url.includes('/results-')) continue;
        const title = (page.title || '').toLowerCase();
        const desc = (page.description || '').toLowerCase();
        let score = 0;
        for (const w of words) {
          if (title.includes(w)) score += 3;
          else if (desc.includes(w)) score += 2;
          else if ((page.text||'').toLowerCase().includes(w)) score += 1;
        }
        if (!score) continue;
        if (region) {
          for (const c of region.cities) {
            if ((title+desc).includes(c.toLowerCase())) { score += 5; break; }
          }
        }
        seen.add(url);
        results.push({ title: page.title, url, description: page.description||'', score });
      }
    } catch(e) {}
  }
  return results.sort((a,b) => b.score - a.score).slice(0, 10);
}

// ── loadJSON ──
const _jsonCache = {};
function loadJSON(filename) {
  if (_jsonCache[filename] !== undefined) return _jsonCache[filename];
  try {
    const p = path.join(process.cwd(), 'data', filename);
    _jsonCache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) { _jsonCache[filename] = null; }
  return _jsonCache[filename];
}

function detectInfoPages(question) {
  const q = question.toLowerCase();
  const pages = [
    { kw: ['לידה','מענק לידה','דמי לידה','חופשת לידה','הריון'], url: 'https://www.shabaton.online/birth_shabatgon' },
    { kw: ['מענק','גובה המענק','חישוב מענק','תלוש מענק'], url: 'https://www.shabaton.online/shabaton-maanak' },
    { kw: ['ביטוח לאומי','ביטל'], url: 'https://www.shabaton.online/btl_shabaton' },
    { kw: ['תוכנית לימודים','ש"ש','לימודי חובה','לימודי השלמה','שעות רשות','שעות חובה','שעות השלמה','שעות פנויות'], url: 'https://www.shabaton.online/shabaton-hova-hashlama' },
    { kw: ['תוכנית לימודים','כמה שעות','שעות לימוד','מה לומדים'], url: 'https://www.shabaton.online/learning_programs_shabaton' },
    { kw: ['טפסים','מסמכים'], url: 'https://www.shabaton.online/forms_shabaton' },
    { kw: ['לוח זמנים','מועדים','תאריכים'], url: 'https://www.shabaton.online/luz_shabaton' },
    { kw: ['חצי שבתון','שבתון מלא','שבתון חלקי'], url: 'https://www.shabaton.online/halforfull_shabaton' },
    { kw: ['בקשת שבתון','איך מבקשים','יציאה לשבתון','איך יוצאים'], url: 'https://www.shabaton.online/shabaton_request' },
    { kw: ['תשלומים','עלויות','שכר לימוד'], url: 'https://www.shabaton.online/Payments_shabaton' },
    { kw: ['חזרה משבתון','סיום שבתון','חזרה לעבודה'], url: 'https://www.shabaton.online/end_shabaton' },
    { kw: ['זכויות','זכאות','מי זכאי','תנאים לשבתון'], url: 'https://www.shabaton.online/important' },
  ];
  return [...new Set(
    pages.filter(p => p.kw.some(k => q.includes(k))).map(p => p.url)
  )];
}

// ── שליפת תוכן מדף אתר ───────────────────────────────
async function fetchPageContent(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShabatonBot/1.0)' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // מצא את התוכן הרלוונטי
    const markers = ['שבתון', 'מענק', 'לידה', 'זכויות'];
    let start = 0;
    for (const m of markers) {
      const i = text.indexOf(m);
      if (i > 100) { start = Math.max(0, i - 100); break; }
    }
    return text.substring(start, start + 2500);
  } catch(e) { return null; }
}

// ── בניית context ─────────────────────────────────────
async function buildContext(message) {
  const region = detectRegion(message);
  const parts = [];

  // סריקת דפי אתר רלוונטיים בזמן אמת
  const infoUrls = detectInfoPages(message);
  if (infoUrls.length > 0) {
    const contents = await Promise.all(
      infoUrls.slice(0, 2).map(url => fetchPageContent(url))
    );
    contents.forEach((content, i) => {
      if (content) parts.push(`=== מידע מ-${infoUrls[i]} ===\n${content}`);
    });
  }

  // חיפוש קורסים באינדקסים
  const stop = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך']);
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
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
      if (region) region.cities.forEach(c => { if ((title+desc).includes(c.toLowerCase())) score += 5; });
      seen.add(url);
      results.push({ title: page.title, url, description: page.description||'', score });
    });
  });
  results.sort((a,b) => b.score - a.score);
  const top = results.slice(0, 8);
  if (top.length) {
    parts.push('\n=== קורסים שנמצאו ===');
    top.forEach(c => parts.push(`שם: ${c.title}\nקישור: ${c.url}${c.description ? '\nתיאור: '+c.description.substring(0,120) : ''}`));
  }

  if (region) parts.push(`\nאזור: ${region.name} | slug: ${region.slug}`);
  return { context: parts.join('\n\n'), isInfo: infoUrls.length > 0 };
}

// ── בחירת מודל ────────────────────────────────────────
function chooseModel(q) {
  return /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|אופק|תואר|זכויות/.test(q)
    ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
}

// ── Handler ────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method === 'GET')     return res.status(200).json({ status: 'ok', bot: 'shabi-v4' });
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

    console.log(`POST [${site}]: ${message.substring(0,60)}`);

    const { context, isInfo } = await buildContext(message);
    const isCourseQ = ['קורס','לימוד','לימודים','מוסד','מכללה','אוניברסיטה','השתלמות'].some(k => message.includes(k));
    const isInfoQuestion = !!(isInfo && !isCourseQ);
    const model   = chooseModel(message);
    let userContent = context
      ? `${context}\n\n---\nשאלת הגולש: ${message}`
      : message;
    if (isInfoQuestion) {
      userContent = `חפש באתר shabaton.online מידע על: ${message}\n\nאחרי החיפוש, ענה בעברית בצורה מפורטת ומדויקת לפי המידע שמצאת.`;
    }

    // הפעל web_search לכל שאלת מידע (לא שאלת קורסים)
    const courseKW = ['קורס','קורסים','לימוד','לימודים','מוסד','מכללה','אוניברסיטה','השתלמות','תואר'];
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model, max_tokens: 1500, system: SYSTEM_PROMPT,
        messages: [...history.slice(-6), { role: 'user', content: userContent }],
        ...(isInfoQuestion ? {
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          tool_choice: { type: 'auto' }
        } : {})
      })
    });

    if (!claudeRes.ok) {
      const t = await claudeRes.text();
      throw new Error('Claude ' + claudeRes.status + ': ' + t.substring(0,100));
    }
    const data = await claudeRes.json();
    // טיפול בתגובת web_search - agentic loop
    let reply = '';
    let loopData = data;
    let loopMessages = [...history.slice(-6), { role: 'user', content: userContent }];
    
    for (let i = 0; i < 3; i++) {
      // אסוף טקסט
      if (loopData.content) {
        for (const block of loopData.content) {
          if (block.type === 'text') reply += block.text;
        }
      }
      // בדוק אם יש tool_use שצריך לטפל בו
      const toolUseBlocks = loopData.content?.filter(b => b.type === 'tool_use') || [];
      if (toolUseBlocks.length === 0) break;
      
      // בנה tool_results
      const toolResults = toolUseBlocks.map(tu => ({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: tu.name === 'web_search' ? '(search results will be provided by API)' : ''
      }));
      
      // שלח המשך
      loopMessages = [...loopMessages,
        { role: 'assistant', content: loopData.content },
        { role: 'user', content: toolResults }
      ];
      
      const nextRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1500, system: SYSTEM_PROMPT, messages: loopMessages,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }] })
      });
      if (!nextRes.ok) break;
      loopData = await nextRes.json();
      reply = ''; // reset - נשתמש בתשובה החדשה
    }
    
    if (!reply) reply = loopData.content?.[0]?.text || '';
    console.log(`OK ${model} | ${reply.length} chars`);

    if (ZAPIER_WEBHOOK_URL) {
      try {
        const now = new Date();
        await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: now.toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'}),
            time: now.toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}),
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
