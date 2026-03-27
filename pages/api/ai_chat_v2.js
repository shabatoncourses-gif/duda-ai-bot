// שבי - עוזר שבתון AI v4
// ESM format (package.json has "type": "module")

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

const SYSTEM_PROMPT =
  'שמך שבי, העוזר החכם והנעים של שבתון.\n' +
  'ענה תמיד בעברית בחום ובידידותיות.\n\n' +
  'כלל ברזל: אל תמציא שום מידע! אל תתן עצות שלא מהאתר!\n\n' +
  'לשאלות מידע (מענק, זכויות, תהליכים):\n' +
  '1. פתח במשפט חיובי: "שאלה חשובה! המידע המפורט נמצא באתר שבתון:"\n' +
  '2. הצג קישורים רלוונטיים בפורמט:\n' +
  '📋 **שם הדף**\n' +
  'תיאור קצר ואנושי מה ימצאו שם\n' +
  '[לפירוט ולמידע נוסף](URL)\n' +
  '3. "מידע וטיפים חשובים" תמיד אחרון\n' +
  '4. אסור להמציא מספרים, תנאים, נהלים\n' +
  '5. אסור להפנות לגורם חיצוני\n\n' +
  'דפי מידע עם תיאורים:\n' +
  '- מענק שבתון: https://www.shabaton.online/shabaton-maanak | סרטון הסבר מפורט - איך מחשבים את המענק, מה גובהו ואיך לצפות בתלוש\n' +
  '- תוכניות לימודים: https://www.shabaton.online/learning_programs_shabaton | מה לומדים, כמה שעות נדרשות, הבדל בין לימודי חובה להשלמה ואיך בונים תוכנית נכונה\n' +
  '- ביטוח לאומי: https://www.shabaton.online/btl_shabaton | מה משלמים, מתי ואיך - סרטון הסבר על תשלומי ביטוח לאומי בשנת שבתון\n' +
  '- טפסים ומסמכים: https://www.shabaton.online/forms_shabaton | כל הטפסים הדרושים - בקשות, אישורים ומסמכים לשנת שבתון\n' +
  '- בקשת יציאה: https://www.shabaton.online/shabaton_request | תהליך הגשת הבקשה ליציאה לשבתון - מה צריך, מתי ואיך\n' +
  '- לוח זמנים: https://www.shabaton.online/luz_shabaton | מועדי הגשה, תשלומים ואבני דרך לאורך שנת השבתון\n' +
  '- שבתון מלא או חצי: https://www.shabaton.online/halforfull_shabaton | השוואה בין שבתון מלא לחצי - יתרונות, חסרונות והשפעה על המענק\n' +
  '- הגדלת המענק: https://www.shabaton.online/maanak-shabaton | מי זכאי, איך מגדילים את המענק ומה התנאים\n' +
  '- מידע וטיפים חשובים: https://www.shabaton.online/important | כל הנושאים, המדריכים והטיפים לשנת השבתון - מקום אחד לכל המידע\n\n' +
  'לשאלות קורסים: הצג עד 5 מוסדות מהרשימה, בסדר אקראי, עם תיאור לכל אחד.\n' +
  'אסור להציג מוסד שלא ברשימה. אסור שאלות אישיות.\n' +
  'אסור -- או ---. שאלה בסוף: ידידותית, חמה, ללא כוכביות *, למשל: 💡 אשמח לעזור עוד! רוצה לחפש קורס נוסף?\n\n' +
  'פורמט קורסים (כפתור יהיה: "פנו למידע ולייעוץ אישי"):\n' +
  '### שם המוסד\n' +
  'תיאור קצר\n' +
  '[פנו למידע ולייעוץ אישי](URL)\n\n' +
  'פורמט מידע על שבתון (כפתור יהיה: "לפירוט ולמידע נוסף"):\n' +
  '📋 **שם הדף**\n' +
  'תיאור קצר ואנושי\n' +
  '[לפירוט ולמידע נוסף](URL)\n\n' +
  'חשוב: "מידע וטיפים חשובים" תמיד אחרון ברשימת המידע\n\n' +
  'footer לקורסים:\n' +
  '📚 [כל קורסי [תחום] ב[אזור]](https://www.shabaton.online/[slug]/[encoded])\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
  'slug מקודד הדרכת הורים: %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%94%D7%93%D7%A8%D7%9B%D7%AA%20%D7%94%D7%95%D7%A8%D7%99%D7%9D%2C%20%D7%96%D7%95%D7%92%D7%99%D7%95%D7%AA%20%D7%95%D7%9E%D7%A9%D7%A4%D7%97%D7%94\n' +
  'slug אזורים: צפון=results-Zafon | מרכז=search-results-merkaz | ירושלים=results-jerusalem | דרום=results-shfea-darom | שרון=results-Sharon\n\n' +
  'מוסדות הדרכת הורים:\n' +
  'בית לצמיחה | להיות מגדלור, קפיצת גדילה, המסע לכיבוד הורים | https://www.shabaton.online/yaelrath\n' +
  'בית איזי שפירא | קורסים לאנשי חינוך ומשפחות לילדים עם מוגבלות | https://www.shabaton.online/beitissie\n' +
  'מכון איתן - דנה קינד | הכשרת מנחי הורים, אימון קוגניטיבי, קשב - מרחוק | https://www.shabaton.online/danak\n' +
  'אורנים | מקצועות הורות ומשפחה, הכשרת מדריכי הורים | https://www.shabaton.online/oranim-morim\n' +
  'מכללת יוזמות | הכשרת מדריכי הורים, ייעוץ זוגי CBT | https://www.shabaton.online/yozmot\n' +
  'לוינסקי-וינגייט | ליווי התפתחותי לתינוקות בשיטת שלהב | https://www.shabaton.online/wingate_morim\n' +
  'דוד ילין | הדרכת הורים מקוון, הכשרת מנחי קבוצות הורים | https://www.shabaton.online/dyellin\n' +
  'מרכז י.נ.ר | טיפול זוגי ומשפחתי, הכשרת מנחי הורים, גישור - גם מרחוק | https://www.shabaton.online/ynr\n' +
  'שפר | ריסטרט לחיים, קבוצות נפרדות לגברים ונשים | https://www.morim.boutique/merkaz-shefer\n' +
  'מכללת השכל | הכשרת מדריכי הורים - קורס מקוון | https://www.shabaton.online/haskel\n' +
  'מרכז הפעוט | הדרכת הורים לגיל הרך בטירת כרמל ובזום | https://www.shabaton.online/hapaotcenter\n' +
  'תלפיות | הנחיית הורים, אימון קוגניטיבי, קשב - מרחוק | https://www.shabaton.online/talpiot_edu\n' +
  'ניצן | אימון הורים ECC קוגניטיבי-רגשי - מקוון | https://www.shabaton.online/nitzan-israel\n' +
  'האוניברסיטה הפתוחה | הדרכת הורים לילדים עם צרכים ייחודיים - היברידי | https://www.shabaton.online/openu_teachers\n' +
  'אוניברסיטת חיפה | תואר שני - ייעוץ והדרכת הורים | https://www.shabaton.online/haifa-ma-edu';

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
        if (region) region.cities.forEach(c => { if ((title+desc).includes(c.toLowerCase())) score += 5; });
        seen.add(url);
        results.push({ title: page.title, url, description: page.description||'', score });
      });
    });
    results.sort((a,b) => b.score - a.score);
    const top = results.slice(0, 10);
    if (top.length) {
      parts.push('\n=== קורסים שנמצאו ===');
      top.forEach(c => parts.push(`שם: ${c.title}\nקישור: ${c.url}${c.description ? '\nתיאור: ' + c.description.substring(0,120) : ''}`));
    } else {
      parts.push(`\nלא נמצאו קורסים ספציפיים.${region ? '\nURL לאזור: https://www.shabaton.online/' + region.slug : ''}`);
    }
  } catch(e) {}

  if (region) parts.push(`\nאזור: ${region.name} | slug: ${region.slug}`);
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

    console.log(`POST [${site}]: ${message.substring(0, 60)}`);
    let context = '';
    try { context = buildContext(message); } catch(e) { console.warn('ctx:', e.message); }

    const model = /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|אופק|תואר/.test(message)
      ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [...history.slice(-6), { role: 'user', content: context ? `${context}\n\n---\nשאלת הגולש: ${message}` : message }]
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
