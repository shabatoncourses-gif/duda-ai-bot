// שבי - עוזר שבתון AI v4 - עם knowledge base מלא מה-QA
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    const p = path.join(process.cwd(), 'data', filename);
    _cache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) { _cache[filename] = null; }
  return _cache[filename];
}

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

// חיפוש בQA - תומך במבנה categories
function detectInfoPage(question) {
  const q = question.toLowerCase();
  const pages = [
    { keywords: ['לידה','מענק לידה','דמי לידה','חופשת לידה'], url: 'https://www.shabaton.online/birth_shabatgon' },
    { keywords: ['מענק','גובה המענק','חישוב מענק','תלוש'], url: 'https://www.shabaton.online/shabaton-maanak' },
    { keywords: ['ביטוח לאומי','ביטל'], url: 'https://www.shabaton.online/btl_shabaton' },
    { keywords: ['תוכנית לימודים','שעות','ש"ש','לימודי חובה','לימודי השלמה'], url: 'https://www.shabaton.online/learning_programs_shabaton' },
    { keywords: ['טפסים','מסמכים'], url: 'https://www.shabaton.online/forms_shabaton' },
    { keywords: ['לוח זמנים','מועדים'], url: 'https://www.shabaton.online/luz_shabaton' },
    { keywords: ['חצי שבתון','שבתון מלא','שבתון חלקי'], url: 'https://www.shabaton.online/halforfull_shabaton' },
    { keywords: ['בקשת שבתון','איך מבקשים','יציאה לשבתון'], url: 'https://www.shabaton.online/shabaton_request' },
    { keywords: ['תשלומים','עלויות'], url: 'https://www.shabaton.online/Payments_shabaton' },
    { keywords: ['חזרה משבתון','סיום שבתון'], url: 'https://www.shabaton.online/end_shabaton' },
    { keywords: ['זכויות','זכאות','מי זכאי'], url: 'https://www.shabaton.online/important' },
  ];
  const matches = pages.filter(p => p.keywords.some(k => q.includes(k)));
  return matches.map(p => p.url);
}

async function fetchPageContent(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShabatonBot/1.0)' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    // חלץ טקסט מהתוכן הראשי - מחק תגי HTML
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // קח רק 2000 תווים רלוונטיים
    const mainStart = Math.max(0, text.indexOf('שבתון') - 200);
    return text.substring(mainStart, mainStart + 2000);
  } catch(e) {
    return null;
  }
}

async function buildContext(message) {
  const region = detectRegion(message);
  const parts = [];

  // סריקת דפי אתר רלוונטיים בזמן אמת
  const infoUrls = detectInfoPage(message);
  if (infoUrls.length > 0) {
    const pageContents = await Promise.all(
      infoUrls.slice(0, 2).map(url => fetchPageContent(url))
    );
    pageContents.forEach((content, i) => {
      if (content) {
        parts.push(`=== תוכן מדף ${infoUrls[i]} ===\n${content}`);
      }
    });
  }

  // חיפוש QA סטטי כגיבוי
  try {
    const qa = loadJSON('shabaton-qa.json');
    if (qa) {
      const items = qa.categories
        ? qa.categories.flatMap(c => c.questions || [])
        : (Array.isArray(qa) ? qa : (qa.qaItems || []));
      const qWords = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const rel = items.filter(item => {
        const t = ((item.question||item.q||'') + ' ' + (item.answer||item.a||'')).toLowerCase();
        return qWords.some(w => t.includes(w));
      }).slice(0, 3);
      if (rel.length) {
        parts.push('=== מידע נוסף ===');
        rel.forEach(item => {
          const q = item.question||item.q||'', a = item.answer||item.a||'';
          if (q && a) parts.push(`ש: ${q}\nת: ${a}`);
        });
      }
    }
  } catch(e) {}

  // חיפוש קורסים
  const courses = searchCourses(message, region);
  if (courses.length > 0) {
    parts.push('\n=== קורסים שנמצאו ===');
    courses.forEach(c => {
      parts.push(`שם: ${c.title}\nקישור: ${c.url}${c.description ? '\nתיאור: '+c.description.substring(0,120) : ''}`);
    });
  } else if (region) {
    parts.push(`\nאזור: ${region.name} | slug: ${region.slug}`);
  }

  return parts.join('\n\n');
}


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
    let context = '';
    try { context = buildContext(message); } catch(e) { console.warn('ctx:', e.message); }

    const model = /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|אופק|תואר|מענק|ביטוח|לידה|פנסיה/.test(message)
      ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [...history.slice(-6), {
          role: 'user',
          content: context ? `${context}\n\n---\nשאלת הגולש: ${message}` : message
        }]
      })
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude ${claudeRes.status}: ${errText.substring(0,100)}`);
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
