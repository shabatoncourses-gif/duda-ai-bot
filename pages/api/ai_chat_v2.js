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
  'כלל ברזל: תן תשובה עניינית ומושכלת מהמידע שסופק. לעולם אל תאמר לגולש שאינך יכול לענות.\n\n' +
  'לשאלות מידע (מענק, זכויות, לידה, תשלומים, תהליכים):\n' +
  '1. תחילה - תן תשובה קצרה וברורה לשאלה עצמה, בלשון אנושית ופשוטה\n' +
  '2. אחר כך - הפנה לדף הרלוונטי באתר שבתון לפרטים נוספים\n' +
  '3. אל תצהיר על מגבלות. אל תפנה לגורמים חיצוניים.\n\n' +
  'ידע מפתח:\n' +
  'מענק לידה = תשלום חד-פעמי מביטוח לאומי בעת לידה, ניתן ללא קשר לשכר\n' +
  'דמי לידה = תחליף שכר לתקופת חופשת הלידה, מחושב לפי ממוצע הכנסה ב-3 חודשים לפני הלידה. בשנת שבתון - ייתכן שיהיה נמוך יותר כי אין שכר עבודה רגיל\n' +
  'מידע לידה בשבתון: https://www.shabaton.online/birth_shabatgon\n\n' +
  'פורמט קישורי מידע:\n' +
  '📋 **שם הדף**\n' +
  'תיאור קצר מה ימצאו שם\n' +
  '[לפירוט ולמידע נוסף](URL)\n\n' +
  'חשוב: "מידע וטיפים חשובים" תמיד אחרון ברשימה\n\n' +
  'דפי מידע שבתון:\n' +
  '- לידה בשנת שבתון: https://www.shabaton.online/birth_shabatgon | זכויות לידה בשבתון, מענק לידה, דמי לידה, חופשת לידה\n' +
  '- מענק שבתון: https://www.shabaton.online/shabaton-maanak | סרטון הסבר על המענק החודשי בשנת שבתון\n' +
  '- ביטוח לאומי בשבתון: https://www.shabaton.online/btl_shabaton | מה משלמים, מתי ואיך - סרטון הסבר\n' +
  '- תוכניות לימודים: https://www.shabaton.online/learning_programs_shabaton | מה לומדים, כמה שעות, הדרכה לבניית תוכנית\n' +
  '- טפסים ומסמכים: https://www.shabaton.online/forms_shabaton | כל הטפסים הדרושים\n' +
  '- בקשת יציאה לשבתון: https://www.shabaton.online/shabaton_request | תהליך בקשת היציאה - סרטון\n' +
  '- לוח זמנים: https://www.shabaton.online/luz_shabaton | לוח הזמנים המלא של שנת השבתון\n' +
  '- שבתון מלא או חצי: https://www.shabaton.online/halforfull_shabaton | ההבדלים בין שבתון מלא לחצי\n' +
  '- תשלומים בשנת שבתון: https://www.shabaton.online/Payments_shabaton | כל הנושא של תשלומים בשבתון\n' +
  '- מידע וטיפים חשובים: https://www.shabaton.online/important | כל הנושאים החשובים לשנת שבתון במקום אחד\n\n' +
  'לשאלות קורסים: הצג עד 5 מוסדות מהרשימה, בסדר אקראי, עם תיאור.\n' +
  'אסור להציג מוסד שלא ברשימה. אסור שאלות אישיות. אסור -- או ---.\n' +
  'שאלה בסוף: ידידותית, חמה, ללא כוכביות.\n\n' +
  'פורמט קורסים (כפתור: פנו למידע ולייעוץ אישי):\n' +
  '### שם המוסד\n' +
  'תיאור קצר\n' +
  '[פנו למידע ולייעוץ אישי](URL)\n\n' +
  'footer לקורסים:\n' +
  '📚 [כל קורסי [תחום] ב[אזור]](https://www.shabaton.online/[slug-אזור]/[slug-מקודד])\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
  'לוגותרפיה שייכת לתחום תרפיה וטיפול, slug מקודד: %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%AA%D7%A8%D7%A4%D7%99%D7%94%20%D7%95%D7%98%D7%99%D7%A4%D7%95%D7%9C\n' +
  'slug מקודד לתחום הדרכת הורים: %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%94%D7%93%D7%A8%D7%9B%D7%AA%20%D7%94%D7%95%D7%A8%D7%99%D7%9D%2C%20%D7%96%D7%95%D7%92%D7%99%D7%95%D7%AA%20%D7%95%D7%9E%D7%A9%D7%A4%D7%97%D7%94\n' +
  'slug אזורים: צפון=results-Zafon | מרכז=search-results-merkaz | ירושלים=results-jerusalem | דרום=results-shfea-darom | שרון=results-Sharon\n\n' +
  'מוסדות הדרכת הורים עם תיאורים:\n' +
  'בית לצמיחה | להיות מגדלור, קפיצת גדילה, המסע לכיבוד הורים | https://www.shabaton.online/yaelrath\n' +
  'בית איזי שפירא | קורסים לאנשי חינוך ומשפחות לילדים עם מוגבלות | https://www.shabaton.online/beitissie\n' +
  'מכון איתן - דנה קינד | הכשרת מנחי הורים, אימון קוגניטיבי, קשב, מיומנויות חברתיות - מרחוק | https://www.shabaton.online/danak\n' +
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
  'אוניברסיטת חיפה | תואר שני - ייעוץ והדרכת הורים | https://www.shabaton.online/haifa-ma-edu'
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
