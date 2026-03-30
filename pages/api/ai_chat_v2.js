// שבי - עוזר שבתון AI v5
// ESM format - package.json has "type": "module"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

// ── System Prompt ──────────────────────────────────────
const SYSTEM_PROMPT =
  'שמך שבי, העוזר החכם והנעים של שבתון.\n' +
  'ענה תמיד בעברית בחום ובידידותיות.\n' +
  'כל שאלה מגולש שבתון היא בהקשר שנת שבתון — ביטוח לאומי = ביטוח לאומי בשבתון.\n' +
  'כלל ברזל: תן תשובה עניינית מהמידע שסופק. לעולם אל תאמר שאינך יכול לענות.\n' +
  'לעולם אל תאמר "לא מצאתי", "מצטער", "אין קורסים" — זה אסור לחלוטין.\n' +
  'אם לא נמצאו קורסים מדויקים — הפנה לקישור "כל קורסי [תחום]" בחיובי.\n' +
  'דוגמה טובה: "לחיפוש מלא של קורסי הידרותרפיה:" + קישור\n' +
  'ענה תמיד בעברית בלבד — אסור לכתוב אפילו משפט אחד באנגלית.\n' +
  'לעולם אל תפנה לגורמים חיצוניים ואל תתן טלפונים/אתרים חיצוניים.\n\n' +
  'לשאלות מידע: פתח חיובי, הצג את המידע מה-context, הפנה לדפי שבתון.\n' +
  'לשאלות קורסים: הצג את המוסדות שנמצאו (עד 8), בסדר אקראי שונה בכל פעם, עם תיאור לכל אחד. אל תמציא מוסדות אם אין מספיק.\n' +
  'אם מוסד מציע למידה מרחוק/זום ולא באזור שנשאל — ציין זאת מפורשות בתיאור.\n' +
  'אל תציג לימודי תואר שני אלא אם הגולש ביקש תואר שני במפורש.\n' +
  'אסור להציג מוסד שלא ברשימה. אסור שאלות אישיות. אסור -- או ---.\n\n' +
  'פורמט קורסים:\n' +
  '### שם המוסד\n' +
  'תיאור קצר\n' +
  '[פנו למידע ולייעוץ אישי](URL)\n\n' +
  'פורמט מידע:\n' +
  '📋 **שם הדף**\n' +
  'תיאור קצר\n' +
  '[לפירוט ולמידע נוסף](URL)\n\n' +
  'footer תמיד בסוף כל תשובה:\n' +
  'לקורסים: 📚 [כל קורסי [תחום] ב[אזור]](URL מה-context)\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
  '"מידע וטיפים חשובים" — תמיד אחרון ברשימת מידע\n' +
  'כללי ניסוח חשובים לכל תשובה:\n' +
  '• עברית תקינה ורהוטה בכל המשפטים\n' +
  '• אל תשתמש בניסוחים אישיים כמו "אני כאן בשבילך", "אני רגשית", "תרגיש חופשי"\n' +
  '• שאלה סיום: קצרה וענינית, למשל: "יש שאלות נוספות?" או "האם חיפשת אזור ספציפי?"\n' +
  '• בקישור "כל קורסי [תחום]" — אל תפרט דוגמאות. רק תכתוב "קורסים נוספים בתחום". אל תזכיר תחומים שאינם קשורים לשאלה.\\n' +
  '• אל תשתמש בביטויים כמו "בהחלט", "בוודאי", "כמובן" בתחילת משפט\n' +
  '• ללא כוכביות בשאלת הסיום';

// ── loadJSON ──────────────────────────────────────────
function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    const p = path.join(process.cwd(), 'data', filename);
    _cache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) { _cache[filename] = null; }
  return _cache[filename];
}

// ── זיהוי אזור מ-regions.json ──
function detectRegion(q) {
  try {
    const data = loadJSON('regions.json');
    if (!data || !data.regions) return null;
    const qL = q.toLowerCase();
    for (const region of data.regions) {
      // בדוק keywords
      if (region.keywords && region.keywords.some(k => qL.includes(k.toLowerCase()))) {
        return { name: region.name, slug: region.slug, cities: region.cities || [], keywords: region.keywords };
      }
      // בדוק ערים
      if (region.cities && region.cities.some(c => qL.includes(c.toLowerCase()))) {
        return { name: region.name, slug: region.slug, cities: region.cities, keywords: region.keywords };
      }
      // בדוק קיצורים
      if (region.abbreviations) {
        for (const [city, abbrs] of Object.entries(region.abbreviations)) {
          if (abbrs.some(a => qL.includes(a.toLowerCase()))) {
            return { name: region.name, slug: region.slug, cities: region.cities, keywords: region.keywords };
          }
        }
      }
    }
  } catch(e) {}
  return null;
}

// ── חישוב slug לתחום ──────────────────────────────────
function getFieldSlug(question) {
  try {
    const data = loadJSON('study-fields.json');
    if (!data) return null;
    const items = data.studyFields || (Array.isArray(data) ? data : []);
    const qL = question.toLowerCase();
    for (const f of items) {
      const kws = f.keywords || [];
      if (kws.some(k => qL.includes(k.toLowerCase()))) {
        return { name: f.name, slug: encodeURIComponent(f.slug) };
      }
    }
  } catch(e) {}
  return null;
}

// ── חיפוש קורסים ──────────────────────────────────────
function getFieldKeywords(question) {
  try {
    const data = loadJSON('study-fields.json');
    if (!data) return null;
    const items = data.studyFields || (Array.isArray(data) ? data : []);
    const qL = question.toLowerCase();

    // ספור כמה תחומים כל keyword מופיע בהם
    const kwCount = {};
    for (const f of items) {
      for (const k of (f.keywords || [])) {
        kwCount[k.toLowerCase()] = (kwCount[k.toLowerCase()] || 0) + 1;
      }
    }

    for (const f of items) {
      const kws = f.keywords || [];
      if (kws.some(k => qL.includes(k.toLowerCase()))) {
        // החזר רק מילות מפתח ייחודיות לתחום זה (לא גנריות)
        const unique = kws
          .map(k => k.toLowerCase())
          .filter(k => k.length > 2 && (kwCount[k] || 0) === 1);
        return unique;
      }
    }
  } catch(e) {}
  return null;
}

function searchCourses(message, region) {
  const stop = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך']);
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  // keywords מהתחום לסינון תוצאות
  const fieldKeywords = getFieldKeywords(message);
  const results = [], seen = new Set();
  const indexes = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json','morim_index_part1.json'];
  for (const fname of indexes) {
    const data = loadJSON(fname);
    if (!data) continue;
    const pages = Array.isArray(data) ? data : (data.pages || []);
    for (const page of pages) {
      const url = page.url || page.link || '';
      if (seen.has(url)) continue;
      // סנן דפי קטגוריה (/results-) וחודשים שעברו
      if (url.includes('/results-')) continue;
      const pastMonths = ['/jan-','/feb-','/mar-','/apr-','/may-','/jun-'];
      if (pastMonths.some(m => url.toLowerCase().includes(m))) continue;

      const title = (page.title || '').toLowerCase();
      const desc  = (page.description || '').toLowerCase();
      const text  = (page.text||'').toLowerCase();
      let score = 0;

      words.forEach(w => {
        if (title.includes(w)) score += 3;
        else if (desc.includes(w)) score += 2;
        else if (text.includes(w)) score += 2; // הגדל מ-1 ל-2 — text חשוב לרשימות קורסים
      });
      // אם score=0 — נסה לחפש את מילות השאלה ו-fieldKeywords ב-text
      if (!score) {
        // חיפוש ב-text עם כל מילות השאלה
        const textSearchWords = fieldKeywords
          ? [...words, ...fieldKeywords.filter(k => k.length > 2)]
          : words;
        if (textSearchWords.some(w => text.includes(w))) score = 1;
      }
      if (!score) continue;

      // אם יש field keywords — וודא שהדף שייך לתחום ולא לאחר
      if (fieldKeywords) {
        // חפש ב-title+desc קודם, אחר כך ב-text (רשימות קורסים)
        const pageShort = title + ' ' + desc;
        const pageFull  = pageShort + ' ' + text;
        const specificKws = fieldKeywords.filter(k => k.length > 2);
        const shortMatch = specificKws.some(k => pageShort.includes(k));
        const textMatch  = !shortMatch && specificKws.some(k => pageFull.includes(k));
        if (!shortMatch && !textMatch) continue;
        // text match תקין - אל תוריד ניקוד, הידרותרפיה וכד' נמצאים ב-text
      }
            if (region) {
        const tdOnly = title + ' ' + desc;

        // בדוק עיר מאזור אחר תחילה (הכי חשוב)
        let wrongRegion = false;
        const regionsData = loadJSON('regions.json');
        if (regionsData) {
          for (const otherRegion of (regionsData.regions || [])) {
            if (otherRegion.slug === region.slug) continue;
            if (otherRegion.cities.some(c => c.length > 3 && tdOnly.includes(c.toLowerCase()))) {
              wrongRegion = true;
              break;
            }
          }
        }
        // בדוק עיר ממשית מהאזור הנכון
        let cityMatchCorrect = false;
        region.cities.forEach(c => {
          if (c.length > 2 && tdOnly.includes(c.toLowerCase())) {
            score += 5; cityMatchCorrect = true;
          }
        });
        region.keywords && region.keywords.forEach(k => {
          if (tdOnly.includes(k.toLowerCase())) score += 2;
        });

        // עיר מאזור אחר ללא עיר מהאזור הנכון → סנן
        if (wrongRegion && !cityMatchCorrect) { seen.add(url); continue; }

        // אין קשר לאזור כלל — סנן (אלא אם למידה מרחוק)
        if (!cityMatchCorrect && !wrongRegion) {
          const isOnline = tdOnly.match(/מרחוק|זום|zoom|אונליין|online|מקוון/i);
          if (!isOnline) { seen.add(url); continue; }
          score = Math.max(1, score - 3);
        }
      }
      seen.add(url);
      results.push({ title: page.title, url, description: page.description||'', score });
    }
  }
  return results.sort((a,b) => b.score - a.score).slice(0, 15);
}

// ── זיהוי דפי מידע ────────────────────────────────────
function detectInfoPages(question) {
  const q = question.toLowerCase();
  const pages = [
    { kw: ['לידה','מענק לידה','דמי לידה','חופשת לידה','הריון'], url: 'https://www.shabaton.online/birth_shabatgon' },
    { kw: ['מענק','גובה המענק','חישוב מענק','תלוש מענק','כמה מקבלים','כמה כסף'], url: 'https://www.shabaton.online/shabaton-maanak' },
    { kw: ['ביטוח לאומי','ביטל','מתי משלמים','תשלום ביטוח','דמי ביטוח','ביטוח בריאות'], url: 'https://www.shabaton.online/btl_shabaton' },
    { kw: ['שעות חובה','שעות השלמה','שעות רשות','לימודי חובה','לימודי השלמה','חלוקת שעות'], url: 'https://www.shabaton.online/shabaton-hova-hashlama' },
    { kw: ['תוכנית לימודים','כמה שעות','שעות לימוד','מה לומדים'], url: 'https://www.shabaton.online/learning_programs_shabaton' },
    { kw: ['טפסים','מסמכים'], url: 'https://www.shabaton.online/forms_shabaton' },
    { kw: ['לוח זמנים','מועדים','תאריכים','מתי להגיש'], url: 'https://www.shabaton.online/luz_shabaton' },
    { kw: ['חצי שבתון','שבתון מלא','שבתון חלקי','הבדל שבתון'], url: 'https://www.shabaton.online/halforfull_shabaton' },
    { kw: ['בקשת שבתון','איך מבקשים','יציאה לשבתון','31 במרץ'], url: 'https://www.shabaton.online/shabaton_request' },
    { kw: ['תשלומים','עלויות','שכר לימוד','החזר שכר לימוד'], url: 'https://www.shabaton.online/Payments_shabaton' },
    { kw: ['חזרה משבתון','סיום שבתון','חזרה לעבודה'], url: 'https://www.shabaton.online/end_shabaton' },
    { kw: ['זכויות','זכאות','מי זכאי','תנאים לשבתון'], url: 'https://www.shabaton.online/important' },
  ];
  return [...new Set(pages.filter(p => p.kw.some(k => q.includes(k))).map(p => p.url))];
}

// ── סריקת דף ──────────────────────────────────────────
async function fetchPageContent(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShabatonBot/1.0)' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const mainStart = Math.max(0, text.indexOf('שבתון') - 200);
    return text.substring(mainStart, mainStart + 2000);
  } catch(e) { return null; }
}

// ── חיפוש ב-QA ────────────────────────────────────────
function searchQA(question) {
  const qa = loadJSON('shabaton-qa.json');
  if (!qa) return null;
  const qL = question.toLowerCase();
  const allQ = (qa.categories || []).flatMap(c => c.questions || []);
  return allQ.find(q => (q.keywords || []).some(k => qL.includes(k.toLowerCase()))) || null;
}


// ── דפי מוסדות לסריקה בזמן אמת כש-text חסר ──────────
function getInstitutionPagesForField(question) {
  // מחזיר דפי מוסדות לסריקה — כולל כל האינדקסים, ממוין לפי רלוונטיות
  const stop = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך','קורס','קורסי','לימודי']);
  const qWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  const results = [];
  const seen = new Set();
  const indexes = ['morim_index.json','morim_index_part1.json','shabaton_index_part1.json','shabaton_index_part2.json'];
  for (const fname of indexes) {
    const data = loadJSON(fname);
    if (!data) continue;
    const pages = Array.isArray(data) ? data : (data.pages || []);
    for (const page of pages) {
      const url = page.url || page.link || '';
      if (seen.has(url) || url.includes('/results-')) continue;
      const title = (page.title || '').toLowerCase();
      const desc  = (page.description || '').toLowerCase();
      if (!title) continue;
      // ניקוד: דפים שtitle/desc קרוב לשאלה — קודם בתור
      const titleScore = qWords.filter(w => title.includes(w)).length * 2;
      const descScore  = qWords.filter(w => desc.includes(w)).length;
      seen.add(url);
      results.push({ title: page.title, url, description: page.description || '', _score: titleScore + descScore });
    }
  }
  // מיין: דפים קרובים לשאלה קודם, ואז שאר הדפים
  results.sort((a,b) => b._score - a._score);
  return results.slice(0, 40);
}

// ── buildContext ──────────────────────────────────────
async function buildContext(message) {
  const region = detectRegion(message);
  const parts = [];

  const infoUrls = detectInfoPages(message);
  if (infoUrls.length > 0) {
    const contents = await Promise.all(infoUrls.slice(0, 2).map(url => fetchPageContent(url)));
    let gotContent = false;
    contents.forEach((content, i) => {
      if (content) { parts.push(`=== מידע מ-${infoUrls[i]} ===\n${content}`); gotContent = true; }
    });
    if (!gotContent) {
      const qaMatch = searchQA(message);
      if (qaMatch) {
        parts.push('=== מידע על שבתון ===\n' + qaMatch.answer);
      } else {
        parts.push('=== דפי מידע רלוונטיים ===\n' + infoUrls.map(u => '- ' + u).join('\n'));
      }
    }
  }

  const courses = searchCourses(message, region);


  // אם תוצאות מועטות — סרוק דפי מוסדות בזמן אמת לפי תחום
  if (fieldKeywords && fieldKeywords.length > 0) {
    const institutionPages = getInstitutionPagesForField(message);
    if (institutionPages.length > 0) {
      const existingUrls = new Set(courses.map(c => c.url));
      const scanned = await Promise.all(
        institutionPages.filter(p => !existingUrls.has(p.url)).slice(0, 10).map(async p => {
          const content = await fetchPageContent(p.url);
          if (!content) return null;
          // בדוק אם הדף מציין את המונח הספציפי
          const qWords = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          const relevant = qWords.some(w => content.toLowerCase().includes(w));
          if (!relevant) return null;
          return { title: p.title, url: p.url, description: p.description, score: 2 };
        })
      );
      scanned.filter(Boolean).forEach(p => {
        if (!existingUrls.has(p.url)) {
          courses.push(p);
          existingUrls.add(p.url);
        }
      });
    }
  }

  if (courses.length > 0) {
    parts.push('\n=== קורסים שנמצאו ===');
    courses.forEach(c => parts.push(`שם: ${c.title}\nקישור: ${c.url}${c.description ? '\nתיאור: '+c.description.substring(0,120) : ''}`));
  }

  const fieldInfo = getFieldSlug(message);
  if (region) {
    const fieldSlug = fieldInfo ? fieldInfo.slug : null;
    const fieldName = fieldInfo ? fieldInfo.name : null;
    if (fieldSlug) {
      parts.push(`\nאזור: ${region.name} (slug: ${region.slug})\nתחום: ${fieldName}\n` +
        `קישור לכל קורסי התחום באזור: https://www.shabaton.online/${region.slug}/${fieldSlug}\n` +
        `קישור לכל קורסי התחום בכל הארץ: https://www.shabaton.online/results-all/${fieldSlug}`);
    } else {
      parts.push(`\nאזור: ${region.name} | slug: ${region.slug}`);
    }
  } else if (fieldInfo) {
    parts.push(`\nתחום: ${fieldInfo.name}\nקישור לכל קורסי התחום: https://www.shabaton.online/results-all/${fieldInfo.slug}`);
  }

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
  if (req.method === 'GET')     return res.status(200).json({ status: 'ok', bot: 'shabi-v5' });
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
    const isCourseQ = ['קורס','קורסים','לימוד','לימודים','מוסד','מכללה','אוניברסיטה','השתלמות'].some(k => message.includes(k));
    const isInfoQuestion = !!(isInfo && !isCourseQ);
    const model = chooseModel(message);

    const userContent = context
      ? `${context}\n\n---\nשאלת הגולש: ${message}`
      : message;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model, max_tokens: 2500, system: SYSTEM_PROMPT,
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
    let reply = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') reply += block.text;
      }
    }
    if (!reply) reply = data.content?.[0]?.text || '';
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
