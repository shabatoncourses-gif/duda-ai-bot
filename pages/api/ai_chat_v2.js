// שַׁבִּיבּוֹט - עוזר שבתון AI v5
// ESM format - package.json has "type": "module"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

const SYSTEM_PROMPT =
  'שמך שַׁבִּיבּוֹט, העוזר החכם של שבתון.\n' +
  'ענה בעברית תקנית, ידידותית ומקצועית. אל תשתמש בניסוחים מוגזמים.\n' +
  'כללי עברית — חובה: (1) זהה מין לפי השאלה: "אני עובדת" = נקבה, "אני עובד" = זכר. (2) אסור לערבב: "את צריכה" או "אתה צריך" — לא "אתה צריכה". (3) אם לא ברור — לשון ניטרלית ללא כינוי אישי.\n' +
  'לעולם אל תאמר: אין קורסים, לא מצאתי, אין מידע, מצטער, אינני יכול, המידע לא קיים, אין פעילים, אין עדכנים, למרבה הצער, לצערי, אין ברשותי, אין לי מידע ספציפי, אין כרגע, אין פרטים, לא נמצאו.\n' +
  'אם שאלו על מוסד ספציפי ואין עליו מידע ב-context — כתוב: "אין מידע לגבי מוסד זה בפורטל שבתון." ואחר כך הצג מוסדות אחרים מה-context באותו תחום לימודים. אל תציין שם המוסד החסר ב-URL.\n' +
  'אסור לפרסם מספרי טלפון. אסור לפרסם כתובות אימייל. אסור לקשר לאתרים חיצוניים — קישורים רק לדפים ב-shabaton.online או morim.boutique.\n' +
  'אסור להשתמש בתווים שאינם עברית, אנגלית, מספרים או פיסוק סטנדרטי. אסור אמוג\'יים זרים או סימנים אסיאתיים. אסור להשתמש ב-__ (double underscore) בכלל — כתוב קישורים רק בפורמט [טקסט](URL).\n' +
  'כלל אזורי: כשהגולש שואל על אזור ספציפי (לדוגמה "בחיפה") — ציין בפתיח שהרשימה כוללת גם מוסדות הפועלים פיזית באזור וגם מוסדות עם קורסים בלמידה מרחוק שניתן ללמוד מכל מקום. אל תציג רשימה כאילו כל המוסדות נמצאים פיזית באזור שנשאל.\n' +
  'כלל מוסדות שלא בפורטל: כשנשאלים על מוסד שאינו מופיע בפורטל שבתון (כמו הולמס פלייס, חדרי כושר, וכו\') — זהה את הקטגוריה הרלוונטית, הסבר את הכללים הכלליים לאותה קטגוריה, הפנה לדף הקטגוריה בפורטל, והסבר שלקוד מוסד/קורס יש לפנות למוסד ישירות. אם אין קוד — מציינים בתוכנית: שם מוסד, שם קורס, מועדים, שעות וסילבוס.\n' +
  'כלל חיפוש מסלולים: כשמוזכר שם מסלול ספציפי (ביבליותרפיה, מקרא, תלמוד, NLP, פסיכודרמה וכו\') — חפש את המוסד המציע אותו לפי שמות המסלולים ב-context, ולא לפי הקטגוריה הכללית. "לימודי" היא מילת קישור כללית — התייחס לשמות המסלולים הספציפיים.\n' +
  '⛔ כלל יסוד מוחלט: אסור בהחלט להמציא. אסור לייחס לקורס תכונות שאינן כתובות מפורשות בתיאורו ב-context. דוגמאות אסורות: לכתוב "בלמידה מרחוק" אם זה לא כתוב; לכתוב "מוכר לשבתון" אם זה לא כתוב; לכתוב שעות או ימים שלא צוינו; לכתוב "בזום" אם לא כתוב. אם המידע לא ב-context — לא כותבים אותו. נקודה.\n' +
  '⛔ ענה אך ורק על בסיס המידע שב-context. אסור להשתמש במידע כללי שלא מופיע ב-context. אם ה-context אינו מכיל מידע לשאלה — כתוב בדיוק: "אין לי מידע על קורסים ב[נושא/מוסד] בפורטל שבתון. נא ציינו באיזה תחום לימוד הינכם מעוניינים ואציע קורסים מתאימים, או פנו לקבוצת הוואטסאפ של שבתון." — לעולם אל תכתוב ניסוחים כמו "אינו מופיע בתחזוקה הנוכחית" או "בסיס הנתונים" — אלו ניסוחים טכניים שלא מתאימים לגולש, ואל תקבע שמוסד "לא קיים" — רק שאין לך מידע עליו.\n' +
  'אסור להמציא מספרים, שעות, אחוזים או נוסחאות חישוב שאינם ב-context. עובדות נכונות: שבתון מלא = 8 עד 16 ש"ש (תמיד כתוב "8 עד 16", אף פעם לא "816"); 1 ש"ש = 28 שעות; בעלי תואר שני זכאים לחלוקה: 50% חובה ו-50% רשות; מי שלומד לתואר שני בשבתון — כל לימודיו חובה; החזר שכ"ל עד גובה שנה אוניברסיטאית.\n' +
  'אסור לחשב כמה שעות נשארו לגולש ללמוד, אסור להתייחס לשעות שנלמדו בתואר הראשון, ואסור בכלל לעסוק בחישובי שעות — זה תפקיד יועצת הקרן בלבד.\n' +
  'אסור לכתוב "טיפ:", "עצה:", "המלצה:", "כדאי ש...", "מומלץ ש..." — אסור בהחלט, גם לא בניסוח עקיף.\n' +
  'אסור להזכיר קבוצת וואטסאפ או פייסבוק בגוף התשובה — הם מופיעים אך ורק ב-footer.\n' +
  'אסור להבטיח שקורס כלשהו הוא "ללא תשלום עצמי" או "חינם". כשנשאלים על עלויות — יש לציין: "עלויות, לרבות תוספת תשלום עצמי אם ישנה, יש לברר ישירות מול המוסד".\n' +
  'כלל קריטי לסמינרים מרוכזים: הצג רק מוסדות שיש להם מועדים מפורשים ב-context. אסור להמציא תוכן סמינרים, מועדים או נושאים למוסד שאינו מופיע ב-context עם תאריכים ספציפיים. wingate_mashlima אינו מציע סמינרים מרוכזים — אל תזכיר אותו לעולם בהקשר של סמינרים.\n' +
  'כשה-context מכיל תשובת QA — העתק אותה כמות שהיא, ללא הוספות. אסור להוסיף: משפטי סיום משלך, "יש לפנות ליועצת הקרן", "לפנות לגוף כלשהו", "לקבלת התמונה המלאה", "בהתאם לנתוניך" — אלו הוספות אסורות. ה-footer הקבוע (💬 וואטסאפ + 👥 פייסבוק) מופיע תמיד בסוף.\n' +
  'כלל פתיח לשאלות עלויות: כשהגולש מבקש "ללא תשלום עצמי" — אל תחזור על הביטוי הזה בפתיח ואל תאשר אותו. כתוב רק: "הנה סמינרים מרוכזים:" ובסוף ציין שעלויות יש לברר ישירות מול כל מוסד.\n' +
  'כלל ברזל: אל תמציא מידע. אל תוסיף קישורים שאינם ב-context — אם אין URL מ-shabaton.online, אל תכלול קישור.\n' +
  '=== שאלות קורסים ===\n' +
  'פתח תמיד בפתיח ידידותי וחמים (שורה אחת קצרה) לפני התוצאות. לדוגמה: "בשמחה! הנה מה שמצאתי עבורך:" — אל תעתיק בדיוק, חדש בכל פעם.\n' +
  'הצג 10-15 מוסדות מהרשימה בcontext. הצג כמה שיותר — אל תקצץ.\n' +
  'כלל תיאורים: כתוב תיאור קצר ורלוונטי לשאלה. אם הגולש ביקש למידה מרחוק — ציין במפורש אם הקורס מוצע מרחוק/אונליין. אסור להמציא. עברית תקנית.\n' +
  'אל תציג תואר שני אלא אם ביקשו.\n' +
  'בנושא טיולים: הצג רק סמינרים וסיורים שמורים הולכים אליהם — לא קורסי הכשרת מורי דרך.\n\n' +
  'הקורסים מסופקים כ-markdown מוכן. העתק אותם בדיוק.\n\n' +
  'פורמט לכל מוסד:\n' +
  '**[שם המוסד](URL)**\n' +
  'תיאור\n' +
  '[פנו למידע ולייעוץ אישי](URL)\n\n' +
  'חשוב: אחרי התיאור — רק הכפתור [פנו למידע]. אסור לחזור על שם המוסד לפני הכפתור.\n\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  'לשאלות קורסים: הוסף 📚 [כל קורסי [שם התחום]](URL מה-context). אם אין URL — השמט.\n' +
  '💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n' +
  '👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)\n\n' +
  '=== מועדי פתיחה ===\n' +
  'אם ה-context מכיל === מועדי פתיחה === — השתמש בתאריכים רק כשהגולש שאל במפורש על מועדים, חודש ספציפי, או "מתי נפתח". בשאלות חיפוש רגילות — הצג את כל המוסדות ברשימה אחת ללא חלוקה לפי תאריכים. אל תמציא תאריכים.\n' +
  '=== כללי אזור ===\n' +
  'אם הגולש לא ציין אזור — אל תוסיף אזור לכותרת ולא ב-footer.\n' +
  'השתמש ב-results-all (כל הארץ) כשאין אזור ספציפי.\n\n' +
  '=== שאלות מידע ===\n' +
  'ענה אך ורק על פי המידע ב-context (שורות === מידע מ-URL ===). אסור להמציא.\n' +
  'ה-URL לקישור: השתמש בשורה "קישור לדף: URL" שמופיעה בסוף ה-context. חובה לכלול [לפירוט ולמידע נוסף](URL) בסוף התשובה.\n' +
  'ה-URL: הכתובת שמופיעה אחרי === מידע מ- ב-context.\n' +
  'כותרות — **bold** לנושאים. אסור להוסיף שמות מוסדות, קישורי מוסדות, או **[שם](URL)** בתשובות מידע.\n' +
  'סיים עם: [לפירוט ולמידע נוסף](URL). חובה: אם שאלו על תואר שני — הוסף בשורה נפרדת: 🎓 [כל קורסי לימודי תואר שני בחינוך ובהוראה](https://www.shabaton.online/results-all/%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%AA%D7%95%D7%90%D7%A8%20%D7%A9%D7%A0%D7%99%20%D7%91%D7%97%D7%99%D7%A0%D7%95%D7%9A%20%D7%95%D7%91%D7%94%D7%95%D7%A8%D7%90%D7%94). ואחרי זה footer: 📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton) 💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME) 👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)\n';

function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    const p = path.join(process.cwd(), 'data', filename);
    _cache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) { _cache[filename] = null; }
  return _cache[filename];
}

// ── ניקוי HTML גולמי מתיאורי מוסדות (מקור: עמודת התיאור באקסל) ──
// <strong>/<b> הופכים ל-markdown bold, <br>/<li> להפרדת שורות, ושאר
// תגים מוסרים. כך הגולש לא רואה "<strong>" כטקסט גולמי בתשובת הבוט.
function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/<strong>/gi, '**').replace(/<\/strong>/gi, '**')
    .replace(/<b>/gi, '**').replace(/<\/b>/gi, '**')
    .replace(/<em>/gi, '_').replace(/<\/em>/gi, '_')
    .replace(/<i>/gi, '_').replace(/<\/i>/gi, '_')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '• ').replace(/<\/li>/gi, '\n')
    .replace(/<ul>/gi, '').replace(/<\/ul>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// חיתוך טקסט ארוך, אבל בגבול שורה (\n) כשאפשר — לא באמצע מילה/קורס.
// בלי זה, קורסים שמופיעים בסוף רשימה ארוכה (לדוגמה "טבע ובריאות ביערות הכרמל"
// של עתיד ירוק) נחתכים שיטתית ולעולם לא נראים למשתמש.
function smartTruncate(text, limit) {
  if (!text || text.length <= limit) return text || '';
  const cut = text.substring(0, limit);
  const lastNl = cut.lastIndexOf('\n');
  if (lastNl > limit * 0.5) return cut.substring(0, lastNl).trim();
  return cut.trim();
}

// דורש שה-term יופיע כמילה שלמה — אבל מתיר עד 2 אותיות-יחס עבריות
// נפוצות לפני המילה (ב/ל/מ/כ/ה/ו/ש - כמו "בחיפה", "ולחיפה"), כי בעברית
// מילות יחס מתחברות ישירות בלי רווח. בסוף המילה נדרש גבול אמיתי —
// כך מילים קצרות (כמו "קוד", "אי") לא יתאימו כ-substring בתוך מילה לא
// קשורה (לדוגמה "קוד" בתוך "הנקודות", או "אי" בתוך "באיזור").
function wordBoundaryIncludes(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // מונח לטיני/אנגלי (כמו "ma", "nlp") — גבול-מילה אמיתי (\b), לא תלוי בעברית.
  // בלי זה, "ma" מתאים בטעות בתוך "gmail.com" כי g/i (לא-עבריים) נחשבו כ"גבול".
  if (/^[a-z0-9]+$/i.test(term)) {
    return new RegExp('\\b' + escaped + '\\b', 'i').test(text);
  }
  const re = new RegExp('(^|[^\\u05D0-\\u05EA])[בלמכהוש]{0,2}' + escaped + '($|[^\\u05D0-\\u05EA])');
  return re.test(text);
}

function detectRegion(q) {
  try {
    const data = loadJSON('regions.json');
    if (!data || !data.regions) return null;
    const qL = q.toLowerCase();

    const toRegionObj = (region) => ({ name: region.name, slug: region.slug, cities: region.cities || [], keywords: region.keywords });

    // שלב 1: keywords מפורשים — הביטויים שנכתבו בכוונה לזהות אזור (substring סביר, הם ייחודיים מספיק)
    // בודקים את כל האזורים ובוחרים את ההתאמה הארוכה ביותר — לא את הראשונה לפי סדר הקובץ
    let best = null;
    for (const region of data.regions) {
      for (const k of (region.keywords || [])) {
        if (qL.includes(k.toLowerCase()) && (!best || k.length > best.len)) {
          best = { region, len: k.length };
        }
      }
    }
    if (best) return toRegionObj(best.region);

    // שלב 2: שמות ערים — דורש גבול מילה (שמות ערים יכולים להיות קצרים יחסית)
    best = null;
    for (const region of data.regions) {
      for (const c of (region.cities || [])) {
        if (wordBoundaryIncludes(qL, c.toLowerCase()) && (!best || c.length > best.len)) {
          best = { region, len: c.length };
        }
      }
    }
    if (best) return toRegionObj(best.region);

    // שלב 3: קיצורים — דורש גבול מילה בהחלט (קצרים מאוד, מסוכנים מאוד ל-false positives)
    best = null;
    for (const region of data.regions) {
      if (!region.abbreviations) continue;
      for (const abbrs of Object.values(region.abbreviations)) {
        for (const a of abbrs) {
          if (wordBoundaryIncludes(qL, a.toLowerCase()) && (!best || a.length > best.len)) {
            best = { region, len: a.length };
          }
        }
      }
    }
    if (best) return toRegionObj(best.region);

  } catch(e) {}
  return null;
}

// ── סינון מוסדות לפי מונח ספציפי מתוך השאלה ─────────────
// כשתחום שלם (לדוגמה "תרפיה וטיפול") מתאים לשאלה ספציפית יותר (לדוגמה
// "הידרותרפיה"), אין להציג את כל המוסדות בתחום — רק את אלו שבאמת
// מזכירים את המונח הספציפי בתיאור שלהם.
function filterInstitutionsBySpecificTerm(institutions, message, fieldOwnKeywords) {
  const msgL = message.toLowerCase();
  const stopwords = new Set([
    'קורס','קורסי','קורסים','לימודי','לימוד','לימודים','בתחום','אזור','מה','יש','של',
    'על','עם','גם','כל','אני','את','אתה','אילו','איזה','מוסדות','שמציעים',
    'מציעים','להציג','רק','ללא','תלות','להלן','שלהלן','בפורטל','שבתון','באמצעות'
  ]);
  // מילים שהן חלק משם התחום עצמו — לא נחשבות "מונח מייחד"
  const fieldWordsL = new Set(
    (fieldOwnKeywords || []).flatMap(k => (k || '').toLowerCase().match(/[\u05D0-\u05EA]{2,}/g) || [])
  );
  // מילים גולמיות לפי סדר הופעה — לבניית צירופי 2 מילים (כמו "בעלי חיים")
  const rawWords = msgL.match(/[\u05D0-\u05EA]{2,}/g) || [];
  // תומך בזיהוי מילה גם עם תחילית עברית (ב/ל/מ/כ/ה/ו/ש, עד 2 תווים) —
  // למשל "ברפואה" צריך להיחשב שייך לשם השדה "רפואה משלימה", לא כ"מונח ספציפי" נפרד.
  const isStop = (w) => {
    if (stopwords.has(w) || fieldWordsL.has(w)) return true;
    for (let n = 1; n <= 2; n++) {
      const stripped = w.slice(n);
      if (stripped.length >= 2 && (stopwords.has(stripped) || fieldWordsL.has(stripped)) &&
          /^[בלמכהוש]{1,2}$/.test(w.slice(0, n))) {
        return true;
      }
    }
    return false;
  };

  const candidates = [];
  for (let i = 0; i < rawWords.length - 1; i++) {
    const w1 = rawWords[i], w2 = rawWords[i+1];
    if (isStop(w1) || isStop(w2)) continue;
    candidates.push(w1 + ' ' + w2); // צירוף דו-מילתי קודם — סביר שיהיה ספציפי יותר
  }
  const singleWords = [...new Set(rawWords.filter(w => w.length >= 4 && !isStop(w)))];
  candidates.push(...singleWords);
  if (candidates.length === 0) return { result: institutions, noMatchForSpecificTerm: false };

  // בודקים את כל המועמדים, ובוחרים את ההתאמה הצרה ביותר (לא הראשונה שנמצאה)
  let best = null;
  for (const term of candidates) {
    const matched = institutions.filter(ki => {
      const text = ((ki.title||'') + ' ' + (ki.description||'')).toLowerCase();
      return text.includes(term);
    });
    if (matched.length > 0 && matched.length < institutions.length) {
      if (!best || matched.length < best.matched.length) {
        best = { matched, term };
      }
    }
  }
  if (best) {
    console.log('SPECIFIC TERM FILTER:', best.term, '|', best.matched.length, '/', institutions.length, 'institutions');
    return { result: best.matched, noMatchForSpecificTerm: false };
  }
  // היו מילים ספציפיות בשאלה (לא רק עיון כללי בתחום), אבל שום מוסד לא הכיל אותן —
  // כנראה נושא-משנה שלא קיים במאגר (כמו "ארומתרפיה"). מסמנים את זה לקורא,
  // כדי שיוכל להציע מוסד-ברירת-מחדל לתחום במקום רשימה לא-קשורה.
  return { result: institutions, noMatchForSpecificTerm: true };
}

function getFieldSlug(question) {
  try {
    const data = loadJSON('study-fields.json');
    if (!data) return null;
    const items = data.studyFields || (Array.isArray(data) ? data : []);
    const qL = question.toLowerCase();
    // בוחר את ה-keyword הארוך ביותר שמתאים — לא את ההתאמה הראשונה לפי סדר הקובץ
    // (עקבי עם הלוגיקה ב-knownOnly/searchQA/lookupInstitution).
    // עבור keywords קצרים (4 תווים ומטה) — דורש גבול מילה, כי הם עלולים
    // להתאים בטעות כ-substring בתוך מילה לא קשורה (כמו "קוד" בתוך "הנקודות").
    let best = null;
    let bestLen = 0;
    for (const f of items) {
      const kws = f.keywords || [];
      for (const k of kws) {
        const kL = k.toLowerCase();
        const isMatch = k.length <= 4 ? wordBoundaryIncludes(qL, kL) : qL.includes(kL);
        if (isMatch && k.length > bestLen) {
          bestLen = k.length;
          best = f;
        }
      }
    }
    if (best) {
      return { name: best.name, slug: encodeURIComponent(best.slug), fetchFromUrl: best.fetchFromUrl || false, categoryUrl: best.categoryUrl || null, known_institutions: best.known_institutions || [] };
    }
  } catch(e) {}
  return null;
}

// ── חיפוש מוסדות מדפי Results באינדקס ─────────────────────
// פתרון ארכיטקטורי: כל תחום × אזור → דף results → מוסדות
// ── בניית URL לקטגוריה/אזור — חסין לפורמטים לא אחידים ב-regions.json ──
// 5 מתוך 6 האזורים ב-regions.json מכילים "results-" ב-slug (Zafon, Sharon,
// jerusalem, shfea-darom, search-results-merkaz). היחיד שלא: "למידה מרחוק"
// עם slug="online" — אין לו דף results-online; חוזרים ל-results-all במקרה זה.
function buildRegionCategoryUrl(regionSlug, fieldPath) {
  if (!regionSlug || regionSlug === 'online') {
    return `https://www.shabaton.online/results-all/${fieldPath}`;
  }
  const pathSegment = /results-/i.test(regionSlug) ? regionSlug : `results-${regionSlug}`;
  return `https://www.shabaton.online/${pathSegment}/${fieldPath}`;
}

function getInstitutionsFromCategoryIndex(fieldName, regionSlug) {
  const encoded = encodeURIComponent(fieldName);
  const urls = regionSlug && regionSlug !== 'all'
    ? [
        buildRegionCategoryUrl(regionSlug, fieldName),
        buildRegionCategoryUrl(regionSlug, encoded),
      ]
    : [
        `https://www.shabaton.online/results-all/${fieldName}`,
        `https://www.shabaton.online/results-all/${encoded}`,
      ];

  const indexFiles = [
    'shabaton_index.json', 'shabaton_index_part1.json',
    'shabaton_index_part2.json', 'morim_index.json', 'morim_index_part1.json'
  ];

  for (const fn of indexFiles) {
    const data = loadJSON(fn);
    if (!data) continue;
    const pages = Array.isArray(data) ? data : (data.pages || Object.values(data));
    for (const p of pages) {
      const pUrl = (p.url || '').toLowerCase();
      if (urls.some(u => pUrl === u.toLowerCase() || pUrl.startsWith(u.toLowerCase()))) {
        if (p._text && p._text.length > 100) {
          console.log('CATEGORY INDEX HIT:', fn, '|', p.url, '| text len:', p._text.length);
          return { url: p.url, text: p._text, title: p.title };
        }
      }
    }
  }
  return null;
}

// חילוץ מוסדות מטקסט של דף results
function parseInstitutionsFromCategoryText(text, fieldName, maxResults = 15) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];
  const seen = new Set();
  // חפש שמות מוסדות: שורות עם קישור shabaton.online/ או morim.boutique/
  const urlPattern = /https?:\/\/(www\.shabaton\.online|www\.morim\.boutique)\/([^\s\])"']+)/g;
  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    const url = match[0].replace(/[)\].,;]+$/, '');
    if (url.includes('/kenes/') || url.includes('/results') || url.includes('/search-results') || seen.has(url)) continue;
    seen.add(url);
    // מצא כותרת לפני ה-URL
    const urlIdx = text.indexOf(match[0]);
    const before = text.substring(Math.max(0, urlIdx - 200), urlIdx);
    const titleMatch = before.match(/([^\n\r]{5,60})\s*$/);
    const title = titleMatch ? titleMatch[1].trim() : url.split('/').pop();
    if (title && title.length > 2) {
      results.push({ title, url });
      if (results.length >= maxResults) break;
    }
  }
  return results;
}


function getFieldKeywords(question) {
  try {
    const data = loadJSON('study-fields.json');
    if (!data) return null;
    const items = data.studyFields || (Array.isArray(data) ? data : []);
    const qL = question.toLowerCase();
    const kwCount = {};
    for (const f of items) {
      for (const k of (f.keywords || [])) {
        kwCount[k.toLowerCase()] = (kwCount[k.toLowerCase()] || 0) + 1;
      }
    }
    for (const f of items) {
      const kws = f.keywords || [];
      if (kws.some(k => qL.includes(k.toLowerCase()))) {
        const unique = kws.map(k => k.toLowerCase()).filter(k => k.length > 2 && (kwCount[k] || 0) === 1);
        return unique;
      }
    }
  } catch(e) {}
  return null;
}

function searchCourses(message, region) {
  const stop = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך']);
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
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
      if (/\/results-/.test(url)) continue;  // סנן דפי קטגוריה/אזור
      if (/%[Dd][0-9A-Fa-f]/.test(url) || /[\u0590-\u05FF]/.test(url)) continue;
      const titleLower = (page.title || '').toLowerCase();
      if (/סמינר|טיול|סיור|אירוע/.test(titleLower)) continue;
      if (/קורסי העשרה|קורסי העצמה|קורסי פנאי|קורסי העצמה אישית/.test(titleLower)) continue;
      if (/^תואר שני/.test(titleLower) && !message.includes('תואר שני')) continue;
      if (/מורי דרך|הכשרת מדריכ|תיירות, פנאי ואתגר|לימודי תיירות/.test(titleLower)) {
        const wantsTours = /טיול|סיור/.test(message.toLowerCase());
        const wantsTraining = /מורי דרך|מדריך טיולים|הכשרת מדריך|תיירות/.test(message.toLowerCase());
        if (wantsTours && !wantsTraining) continue;
      }
      {
        const now = new Date();
        const heMonths = {'ינואר':1,'פברואר':2,'מרץ':3,'אפריל':4,'מאי':5,'יוני':6,'יולי':7,'אוגוסט':8,'ספטמבר':9,'אוקטובר':10,'נובמבר':11,'דצמבר':12};
        const mMatch = titleLower.match(/^(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(20\d\d)/);
        if (mMatch) {
          const pageMonth = heMonths[mMatch[1]], pageYear = parseInt(mMatch[2]);
          const curMonth = now.getMonth() + 1, curYear = now.getFullYear();
          if (pageYear < curYear || (pageYear === curYear && pageMonth < curMonth)) continue;
        }
      }
      if (/^קורסי |^קורסים ל|^שבתון - קורסים|^לימודי |^ספורט,|^בריאות ו|^גיל רך|^חינוך גופני/.test(titleLower)) continue;
      if (/\/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-_]/.test(url.toLowerCase())) continue;
      const pastMonths = ['/jan-','/feb-','/mar-','/apr-','/may-','/jun-'];
      if (pastMonths.some(m => url.toLowerCase().includes(m))) continue;
      const title = titleLower;
      const desc  = (page.description || '').toLowerCase();
      const text  = (page.text||'').toLowerCase();
      let score = 0;
      words.forEach(w => {
        if (title.includes(w)) score += 3;
        else if (desc.includes(w)) score += 2;
        else if (text.includes(w)) score += 2;
      });
      if (!score) {
        const textSearchWords = fieldKeywords ? [...words, ...fieldKeywords.filter(k => k.length > 2)] : words;
        if (textSearchWords.some(w => text.includes(w))) score = 1;
      }
      if (!score) continue;
      if (fieldKeywords) {
        const pageShort = title + ' ' + desc;
        const pageFull  = pageShort + ' ' + text;
        const specificKws = fieldKeywords.filter(k => k.length > 2);
        const shortMatch = specificKws.some(k => pageShort.includes(k));
        const textMatch  = !shortMatch && specificKws.some(k => pageFull.includes(k));
        if (!shortMatch && !textMatch) continue;
      }
      if (region) {
        const tdOnly = title + ' ' + desc;
        let wrongRegion = false;
        const regionsData = loadJSON('regions.json');
        if (regionsData) {
          for (const otherRegion of (regionsData.regions || [])) {
            if (otherRegion.slug === region.slug) continue;
            if (otherRegion.cities.some(c => c.length > 3 && tdOnly.includes(c.toLowerCase()))) {
              wrongRegion = true; break;
            }
          }
        }
        let cityMatchCorrect = false;
        region.cities.forEach(c => {
          if (c.length > 2 && tdOnly.includes(c.toLowerCase())) { score += 5; cityMatchCorrect = true; }
        });
        region.keywords && region.keywords.forEach(k => {
          if (tdOnly.includes(k.toLowerCase())) score += 2;
        });
        if (wrongRegion && !cityMatchCorrect && region.slug !== 'online') { seen.add(url); continue; }
        if (!cityMatchCorrect && !wrongRegion) {
          const isOnline = tdOnly.match(/מרחוק|זום|zoom|אונליין|online|מקוון/i) ||
            (page.text||'').match(/מרחוק|זום|zoom|אונליין|online|מקוון/i);
          if (region.slug === 'online') {
            if (isOnline) score += 3;
          } else {
            if (!isOnline) { seen.add(url); continue; }
            score = Math.max(1, score - 3);
          }
        }
      }
      seen.add(url);
      let snippet = page.description || '';
      if (text) {
        const qLower = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (const qw of qLower) {
          const tidx = text.indexOf(qw);
          if (tidx >= 0) {
            snippet = text.substring(Math.max(0, tidx - 30), tidx + 300).trim();
            score = Math.max(score, 2);
            break;
          }
        }
      }
      results.push({ title: page.title, url, description: snippet, score, _text: text });
    }
  }
  return results.sort((a,b) => b.score - a.score).slice(0, 25);
}

function detectInfoPages(question) {
  const q = question.toLowerCase();
  const pages = [
    { kw: ['רשימת משימות','צ\'קליסט','כיצד מתחילים','איך מתחילים','תהליך יציאה','איך יוצאים לשבתון','מה לעשות לפני שבתון'], url: 'https://www.shabaton.online/shabaton_checklist' },
    { kw: ['תכנון','תוכנית לימודים','תכנית לימודים','טבלת עזר','הרכבת תוכנית','מתכנן','מתכננים','לתכנן','איך מרכיב','בניית תוכנית','תכנון לימודים','להרכיב תוכנית','מה ללמוד בשבתון','כמה שעות ללמוד','לימוד בשבתון','לימודי חובה ורשות','לימודי רשות','מוסדות מאושרים ללמוד','חובות לימודים','שעות חובה','שעות השלמה','שעות רשות','לימודי חובה','לימודי השלמה','ספורט בשבתון','שינוי תוכנית','אופק חדש בשבתון','גמול השתלמות','מסלול אישי','פרויקט אישי','לימודים בחו"ל'], urls: ['https://www.shabaton.online/shabaton-plan','https://www.shabaton.online/learning_programs_shabaton'] },
    { kw: ['חובות לימודים','שעות חובה','שעות השלמה','שעות רשות','לימודי חובה','לימודי השלמה','מוסדות מאושרים','נושאי השתלמות','ספורט בשבתון','שינוי תוכנית','אופק חדש','תואר שלישי','דוקטורט','גמול השתלמות','מסלול אישי','פרויקט אישי','ישיבה','לימודים בחו"ל','לימודים בחול','תוכנית לימודים','להרכיב תוכנית','הרכבת תוכנית','בניית תוכנית','מה ללמוד','כמה שעות','תכנית לימודים','לימוד בשבתון','לימודי רשות','לימודי חובה ורשות','מוסדות ללמוד','מוכר לשבתון','הכרה במוסד','האם מוכר','מוסד מוכר','קורס מוכר','מוכרת לשבתון'], url: 'https://www.shabaton.online/learning_programs_shabaton' },
    { kw: ['לוח זמנים','מועדים','בקשת שבתון','אישור זכאות','מתי מגישים','מתי להגיש','מערכת הגשה'], url: 'https://www.shabaton.online/luz_shabaton' },
    { kw: ['תיאום מס','מס הכנסה','טופס 101 מס','החזר מס','פטור ממס'], url: 'https://www.shabaton.online/Payments_shabaton#1989197642' },
    { kw: ['ביטוח לאומי','דמי ביטוח','תשלום ביטוח','ביטוח לאומי בשבתון'], url: 'https://www.shabaton.online/btl_shabaton' },
    { kw: ['קבלות','קבלה להחזר','קבלות שכר לימוד'], url: 'https://www.shabaton.online/kabalot_shabaton' },
    { kw: ['החזר שכר לימוד','החזר שכ"ל','החזר שכל','כמה מחזירים','החזר לימודים'], url: 'https://www.shabaton.online/tuition_reimbursement' },
    { kw: ['מענק','כמה מענק','גובה מענק','מענק חודשי','חישוב מענק','כמה מקבלים','כמה מרוויחים'], url: 'https://www.shabaton.online/shabaton-maanak' },
    { kw: ['לידה','דמי לידה','חופשת לידה','הריון בשבתון','ילד בשבתון'], url: 'https://www.shabaton.online/birth_shabatgon' },
    { kw: ['פנסיה','קרן פנסיה','הפרשה לפנסיה'], url: 'https://www.shabaton.online/pension_shabaton' },
    { kw: ['קרן מקוצרת','מקור','מישור','קרן מקור','קרן מישור','הפרשה לקרן'], url: 'https://www.shabaton.online/keren_makor_mishor' },
    { kw: ['טופס 101','101','ניכוי מס במקור'], url: 'https://www.shabaton.online/tofes_101' },
    { kw: ['טפסים','טופס','מסמכים','חל"ת','הצהרה על עבודה','הודעה על חזרה','אישור סיום'], url: 'https://www.shabaton.online/forms_shabaton' },
    { kw: ['שבתון מלא','חצי שבתון','מלא או חצי','הבדל בין שבתון','שבתון שלם'], url: 'https://www.shabaton.online/halforfull_shabaton' },
    { kw: ['מלגה','מלגות','מלגת לימודים','השתתפות בשכר לימוד'], url: 'https://www.morim.online/milgot-morim' },
    { kw: ['סרטון','וידאו','הסבר מצולם','סרטוני הדרכה'], url: 'https://www.shabaton.online/shabaton-video' },
    { kw: ['סיום שבתון','חזרה לעבודה','בסוף שבתון','לאחר שבתון','אחרי שבתון','הגשת מסמכים','אישור סיום לימודים','אישור סיום','מה מגישים','מה להגיש','מסמכים לסיום','מה צריך להגיש','הסתיים השבתון','עם סיום','אישור קורס','דיווח לקרן','דיווח בסוף','להעלות לאתר','להעלות מסמך','זכאות תואר','קיבלתי זכאות','סיימתי תואר','סיימתי לימודים','מה מעלים','מה לעלות','העלאת מסמכים','לאחר הלימודים','בסיום הלימודים','השנה בשבתון סיימתי'], url: 'https://www.shabaton.online/end_shabaton#ishur_siyum' },
  ];
  const matched = [];
  for (const p of pages) {
    if (p.kw.some(k => q.includes(k.toLowerCase()))) {
      if (p.urls) { p.urls.forEach(u => { if (!matched.includes(u)) matched.push(u); }); }
      else matched.push(p.url);
    }
  }
  return matched.length > 0 ? matched : null;
}

function searchQA(question) {
  const qa = loadJSON('shabaton-qa.json');
  if (!qa) return null;
  const qL = question.toLowerCase();
  const allQ = (qa.categories || []).flatMap(c => {
    const nested = c.questions || [];
    const direct = (c.answer && c.keywords) ? [c] : [];
    return [...nested, ...direct];
  });
  // מחזיר את ה-match הכי ספציפי (keyword ארוך ביותר) ולא הראשון
  // עבור keywords קצרים (4 תווים ומטה) — דורש גבול מילה, כדי למנוע
  // התאמות שגויות כמו "קוד" בתוך "הנקודות".
  let bestMatch = null;
  let bestKeywordLength = 0;
  for (const q of allQ) {
    for (const k of (q.keywords || [])) {
      const kL = k.toLowerCase();
      const isMatch = k.length <= 4 ? wordBoundaryIncludes(qL, kL) : qL.includes(kL);
      if (isMatch && k.length > bestKeywordLength) {
        bestKeywordLength = k.length;
        bestMatch = q;
      }
    }
  }
  return bestMatch;
}

function getInstitutionPagesForField(question) {
  const stopInst = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך','קורס','קורסי','לימודי','למורים','לגננות','בשבתון']);
  const qWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopInst.has(w));
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
      const titleScore = qWords.filter(w => title.includes(w)).length * 2;
      const descScore  = qWords.filter(w => desc.includes(w)).length;
      if (/%[Dd][0-9A-Fa-f]/.test(url) || /[\u0590-\u05FF]/.test(url)) continue;
      seen.add(url);
      results.push({ title: page.title, url, description: page.description || '', _score: titleScore + descScore, _text: (page.text||'').toLowerCase() });
    }
  }
  try {
    const sfD = loadJSON('study-fields.json');
    if (sfD) {
      const qLL = question.toLowerCase();
      for (const sf of (sfD.studyFields || [])) {
        const kws = sf.keywords || [];
        if (kws.some(k => qLL.includes(k.toLowerCase())) && sf.known_institutions) {
          for (const ki of sf.known_institutions) {
            const existing = results.find(r => r.url === ki.url);
            if (existing) { existing._score = 200; if (ki.title) existing.title = ki.title; }
            else results.unshift({ title: ki.title, url: ki.url, description: ki.description || '', _score: 200, _text: '' });
          }
          break;
        }
      }
    }
  } catch(e) {}
  results.sort((a, b) => {
    const aText = qWords.some(w => (a._text||'').includes(w)) ? 20 : 0;
    const bText = qWords.some(w => (b._text||'').includes(w)) ? 20 : 0;
    return (b._score + bText) - (a._score + aText);
  });
  const withTextMatch = results.filter(r => qWords.some(w => (r._text||'').includes(w)));
  const withoutText   = results.filter(r => !qWords.some(w => (r._text||'').includes(w)));
  return [...withTextMatch.slice(0, 20), ...withoutText.slice(0, 20)];
}

async function fetchPageContent(url) {
  try {
    const jinaUrl = 'https://r.jina.ai/' + url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const jinaHeaders = { 'Accept': 'text/plain', 'X-Return-Format': 'text', 'User-Agent': 'shabaton-bot/1.0' };
    if (process.env.JINA_API_KEY) jinaHeaders['Authorization'] = 'Bearer ' + process.env.JINA_API_KEY;
    const res = await fetch(jinaUrl, { headers: jinaHeaders, signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      let text = await res.text();
      text = text.replace(/^Title:.*\n/gm,'').replace(/^URL Source:.*\n/gm,'')
                 .replace(/^Markdown Content:/gm,'').replace(/^={3,}.*\n/gm,'');
      const lines2 = text.split('\n');
      let contentStart = -1;
      const navPhrases = ['קרן ארגון','קרן הסתדרות','לוח הזמנים - סוף','החזר שכר לימוד לקרן','קבלות החזר','הודעה על חזרה'];
      for (let li = 0; li < lines2.length; li++) {
        const l = lines2[li].trim();
        const isNav = navPhrases.some(p => l.includes(p)) || (l.length < 60 && /^[\[*]/.test(l));
        if (!isNav && l.length > 60 && /[א-ת]{15,}/.test(l)) { contentStart = li; break; }
      }
      if (contentStart > 0) text = lines2.slice(contentStart).join('\n');
      else text = text.substring(Math.floor(text.length * 0.3));
      text = text.replace(/\s{3,}/g,'\n\n').trim();
      console.log('Jina OK:', url.split('/').pop(), 'len:', text.length);
      return text.substring(0, 5000);
    }
    console.log('Jina failed status:', res.status);
  } catch(e) { console.log('Jina error:', e.message); }
  try {
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 8000);
    const res2 = await fetch(url, { headers: {'User-Agent':'shabaton-bot/1.0'}, signal: controller2.signal });
    clearTimeout(timer2);
    if (!res2.ok) return null;
    let html = await res2.text();
    html = html.replace(/<script[^]*?<\/script>/gi,'').replace(/<style[^]*?<\/style>/gi,'')
               .replace(/<nav[^]*?<\/nav>/gi,'').replace(/<header[^]*?<\/header>/gi,'')
               .replace(/<footer[^]*?<\/footer>/gi,'');
    const m = html.match(/id="wsite-content"[^>]*>([\s\S]{100,})/);
    let text = (m ? m[1] : html).replace(/<[^>]+>/g,' ').replace(/\s{2,}/g,' ').trim();
    const csi = text.indexOf('תשלומים ותקבולים בשנת שבתון');
    if (csi > 0) text = text.substring(csi);
    else text = text.substring(800);
    return text.substring(0,3000).trim();
  } catch(e2) { return null; }
}

// ── מועדי פתיחה קורסים ──────────────────────────────
function getCourseDates(message) {
  const data = loadJSON('course-dates.json');
  if (!data || !data.courses) return null;
  const msgL = message.toLowerCase();

  // ── זיהוי שאילתת קיץ: "נשארו לי נקודות" / "עד סוף אוגוסט" ──
  if (isSummerQuery(message)) {
    const now = new Date();
    const curYear = now.getFullYear().toString();
    const summerMonths = [curYear + '-06', curYear + '-07', curYear + '-08'];
    const summerResults = [];
    for (const c of data.courses) {
      const matching = c.openings.filter(o => summerMonths.includes(o.month));
      if (matching.length > 0) {
        summerResults.push({ title: c.title, url: c.url, openings: matching });
      }
    }
    if (summerResults.length > 0) {
      let text = '=== קורסי קיץ ' + curYear + ' — ניתן להירשם עדיין ===\n';
      text += '⚠️ קורסים אלה מסתיימים לפני 31 באוגוסט ' + curYear + ' ומתאימים לשנת השבתון הנוכחית.\n\n';
      for (const r of summerResults) {
        text += '**[' + r.title + '](' + r.url + ')**\n';
        for (const o of r.openings) {
          if (o.date_text) text += o.date_text.substring(0, 200).replace(/\n/g, ' | ') + '\n';
        }
        text += '[פנו למידע ולייעוץ אישי](' + r.url + ')\n\n';
      }
      return text;
    }
  }

  // בדוק: שאלה על חודש ספציפי
  const monthMap = {
    'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04',
    'מאי': '05', 'יוני': '06', 'יולי': '07', 'אוגוסט': '08',
    'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12'
  };
  const monthNameMap = {
    '01': 'ינואר', '02': 'פברואר', '03': 'מרץ', '04': 'אפריל',
    '05': 'מאי', '06': 'יוני', '07': 'יולי', '08': 'אוגוסט',
    '09': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר'
  };

  let targetMonth = null;
  let targetYear = null;
  const yearMatch = msgL.match(/202[6-9]/);
  if (yearMatch) targetYear = yearMatch[0];

  for (const [heName, num] of Object.entries(monthMap)) {
    if (msgL.includes(heName)) { targetMonth = num; break; }
  }

  // בדוק: שאלה על מוסד/קורס ספציפי
  const results = [];

  if (targetMonth) {
    // חפש כל קורסים בחודש זה
    const yr = targetYear || '2026';
    const key = yr + '-' + targetMonth;
    for (const c of data.courses) {
      const matching = c.openings.filter(o => o.month === key);
      if (matching.length > 0) {
        results.push({ title: c.title, url: c.url, openings: matching });
      }
    }
    if (results.length > 0) {
      const monthName = monthNameMap[targetMonth];
      let text = '=== קורסים הנפתחים ב' + monthName + ' ' + yr + ' ===\n';
      for (const r of results) {
        text += '**[' + r.title + '](' + r.url + ')**\n';
        for (const o of r.openings) {
          if (o.date_text) text += o.date_text.substring(0, 120) + '\n';
        }
        text += '[פנו למידע ולייעוץ אישי](' + r.url + ')\n\n';
      }
      return text;
    }
  }

  // חפש לפי שם מוסד/קורס
  const stopW = new Set(['מתי','קורס','קורסים','נפתח','נפתחים','מועד','פתיחה','של','את']);
  const qWords = msgL.split(/\s+/).filter(w => w.length > 2 && !stopW.has(w));
  const matched = data.courses.filter(c => {
    const titleL = c.title.toLowerCase();
    const urlL = (c.url || '').toLowerCase();
    const openingText = c.openings.map(o => (o.course_name || '') + ' ' + (o.date_text || '')).join(' ').toLowerCase();
    const allText = titleL + ' ' + urlL + ' ' + openingText;
    const wordMatches = qWords.filter(w => allText.includes(w)).length;
    const specificInOpenings = qWords.filter(w => w.length > 3).some(w => openingText.includes(w));
    return wordMatches >= 2 || specificInOpenings;
  });
  if (matched.length > 0) {
    let text = '=== מועדי פתיחה קורסים ===\n';
    text += '**מוסדות עם תאריכי פתיחה מפורשים:**\n';
    let hasExplicit = false;
    for (const c of matched.slice(0, 5)) {
      text += '**[' + c.title + '](' + c.url + ')**\n';
      for (const o of c.openings) {
        const mName = monthNameMap[(o.month || '').split('-')[1]] || o.month;
        const yr2 = (o.month || '').split('-')[0] || '';
        text += (mName ? mName + ' ' + yr2 : '') + ': ';
        if (o.date_text) text += o.date_text.substring(0, 150).replace(/\n/g, ', ');
        text += '\n';
      }
      text += '[פנו למידע ולייעוץ אישי](' + c.url + ')\n\n';
      hasExplicit = true;
    }
    if (!hasExplicit) text += 'אין מוסדות עם תאריכים מפורשים בנושא זה.\n';
    text += '\n**מוסדות שטרם פרסמו תאריכים — יש לפנות לברור:**\nראה מוסדות בcontext הקורסים.\n';
    return text;
  }

  return null;
}

// ── תיקון שגיאות כתיב נפוצות ─────────────────────────
function fixTypos(msg) {
  return msg
    .replace(/בישור/g, 'בישול')
    .replace(/בבליותרפיה/g, 'ביבליותרפיה')
    .replace(/ביבליותרפיה/g, 'ביבליותרפיה')  // normalize
    .replace(/ביבליו תרפיה/g, 'ביבליותרפיה')
    .replace(/פיטותרפיה/g, 'פיטותרפיה')
    .replace(/הומיאופטיה/g, 'הומאופתיה')
    .replace(/קינזיולוגיה/g, 'קינסיולוגיה');
}

// ── זיהוי מוסד מ-Institutions.json ─────────────────────
// מחזיר { found: true, url, title } אם נמצאה התאמה מדויקת ב-147 ה-aliases.
// אם לא נמצא — מחזיר null (ולא מנחש שם מוסד; הניחוש מטקסט עברי לא אמין).
//
// הגנה מפני aliases דו-משמעיים: "חיפה", "רמת גן", "אונו", "אורנים" הם גם
// שמות עיר/אזור. הם מותרים בהתאמה רק אם מילת-מוסד (מכללת/מכון/אוניברסיטת/מרכז/קמפוס)
// מופיעה ממש לפניהם בהודעה — אחרת ייתכן שזו שאלת חיפוש לפי אזור, לא בקשת מוסד ישירה.
const AMBIGUOUS_REGION_ALIASES = new Set(['חיפה', 'רמת גן', 'תל אביב', 'תל-אביב', 'ירושלים', 'אונו', 'אורנים']);
const INSTITUTION_PREFIX_RE = /(מכללת|מכון|אוניברסיטת|המכללה|האוניברסיטה|מרכז|המרכז|קמפוס)\s*$/;

function lookupInstitution(message) {
  const data = loadJSON('Institutions.json');
  if (!data || !data.institutions) return null;
  const msgL = message.toLowerCase();

  // ממיין לפי אורך מפתח (מהארוך לקצר) כדי למצוא את ההתאמה הספציפית ביותר
  const keys = Object.keys(data.institutions).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const keyL = key.toLowerCase();

    // מפתחות קצרים (4 תווים ומטה) — דורש גבול מילה, כי הם נוטים להתאים
    // בטעות כ-substring בתוך מילה לא קשורה (לדוגמה "ינר" בתוך "לסמינר").
    if (key.length <= 4) {
      if (!wordBoundaryIncludes(msgL, keyL)) continue;
    } else {
      if (!msgL.includes(keyL)) continue;
    }

    const idx = msgL.indexOf(keyL);
    if (AMBIGUOUS_REGION_ALIASES.has(key)) {
      const before = message.substring(0, idx);
      const atStart = idx === 0; // בתחילת ההודעה — סביר שזה שם המוסד, לא אזור
      if (!atStart && !INSTITUTION_PREFIX_RE.test(before)) {
        continue; // דו-משמעי, באמצע משפט, וללא מילת-מוסד לפניו — דלג
      }
    }

    return { found: true, ...data.institutions[key], matchedKey: key };
  }
  return null; // לא מנחש — מסתמך על ה-zero-results fallback הכללי
}

function isSummerQuery(message) {
  const keywords = [
    'נשארו לי נקודות', 'נשארו לי שעות', 'נשארו שעות', 'נשארו נקודות',
    'עדיין יכולה להירשם', 'עדיין יכול להירשם', 'עוד יכולה להירשם',
    'להשלים השנה', 'לסיים השנה', 'להשלים את השנה',
    'עד סוף אוגוסט', 'עד אוגוסט', 'לפני סוף השנה',
    'שנה הנוכחית', 'השנה הנוכחית', 'שבתון הנוכחי',
    'קורסי קיץ', 'קורס קיץ', 'קיץ 2026'
  ];
  return keywords.some(k => message.includes(k));
}

async function buildContext(message) {
  message = fixTypos(message);
  let coursesForClaude = []; // מוכרז ברמת הפונקציה לאפשר החזרה
  const region = detectRegion(message);
  const _reqPhrases = ['הנחיית קבוצות','הנחיה קבוצתית','הדרכת הורים','הדרכה הורית',
    'הוראה מתואמת','הוראה מתקנת','ניהול כיתה','עיצוב גרפי','בישול בריא','אפייה בריאה',
    'טיפול זוגי','טיפול משפחתי','פוטו תרפיה','פוטותרפיה','ארומתרפיה','דרמה תרפיה',
    'תנועה טיפולית','מוזיקה טיפולית','טיפול בבעלי חיים'];
  const requiredPhrase = _reqPhrases.find(p => message.toLowerCase().includes(p)) || null;
  console.log('region:', region ? region.name : 'none', '| msg:', message.substring(0,30));

  const parts = [];
  const urlToTitle = {};

  // בדוק course-dates — רק כשהשאלה עוסקת בתזמון ספציפי
  const isTimingQuery = /מתי|מועד|אוקטובר|נובמבר|דצמבר|ספטמבר|יוני|יולי|אוגוסט|ינואר|פברואר|מרץ|אפריל|מאי|בקרוב|חודש|תאריך|נפתח|פתיחה|מאיזה/.test(message);
  const datesCtx = (isTimingQuery || isSummerQuery(message)) ? getCourseDates(message) : null;
  if (datesCtx) {
    parts.push(datesCtx);
  }

  // ניתוב לקטגוריית קורסי קיץ
  if (isSummerQuery(message)) {
    const summerUrl = 'https://www.shabaton.online/results-all/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A7%D7%99%D7%A5';
    parts.push('קישור לכל קורסי הקיץ: ' + summerUrl);
    parts.push('הנחיה: הצג רק קורסים שמסתיימים לפני 31 באוגוסט. קורסים שנפתחים אחרי ספטמבר שייכים לשנת שבתון הבאה — אל תציג אותם.');
    console.log('Summer query detected');
  }

  // ניתוב לסמינרים מרוכזים / סמינרים מטיילים
  const isSeminarQuery = /סמינר מרוכז|סמינרים מרוכזים|סמינר מטיילים|סמינרים מטיילים|ימי עיון/.test(message);
  if (isSeminarQuery) {
    parts.push('קישור לסמינרים וטיולים: https://www.morim.boutique/trips');
    parts.push('הסבר: סמינרים מרוכזים הם בדרך כלל קורסי טיולים וסמינרים מטיילים בבתי מלון, או קורסי קיץ מרוכזים. עלויות יש לברר ישירות מול כל מוסד.');
    parts.push('⛔ BLOCKED_INSTITUTION: wingate_mashlima — חסום לחלוטין בשאלות סמינרים. אם URL זה מופיע בכל מקום ב-context — התעלם ממנו לגמרי, אל תזכיר אותו ואל תציג אותו.');
    console.log('Seminar query detected');
  }

  // כלל עלויות
  const isCostQuery = /ללא תשלום|ללא עלות|ללא תוספת|חינם|כמה עולה|מחיר|עלות|תשלום עצמי|מה המחיר/.test(message);
  if (isCostQuery) {
    parts.push('כלל חשוב לתשובה: אין לציין מחירים מפורשים. יש לציין בבירור שעלויות, לרבות תוספת תשלום עצמי, יש לברר ישירות מול כל מוסד.');
    console.log('Cost query detected');
  }





  const isDati = /ציבור הדתי|לציבור הדתי|דתיים|חרדי|חרדים|דתי-לאומי/i.test(message);
  if (isDati) {
    const datiUrl = 'https://www.shabaton.online/results-all/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%D7%9D%20%D7%9C%D7%A6%D7%99%D7%91%D7%95%D7%A8%20%D7%94%D7%93%D7%AA%D7%99';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const datiRes = await fetch(datiUrl, { headers: { 'User-Agent': 'shabaton-bot/1.0' }, signal: controller.signal });
      clearTimeout(timer);
      if (datiRes.ok) {
        const rawHtml = await datiRes.text();
        const instPattern = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{5,80})<\/a>/g;
        const insts = []; let m; const seen = new Set();
        while ((m = instPattern.exec(rawHtml)) !== null) {
          const url = m[1], name = m[2].trim();
          if (!seen.has(url) && !url.includes('results-all') && !url.includes('shabaton.online/#') && name.length > 5) {
            seen.add(url); insts.push({ url, name });
          }
        }
        if (insts.length > 0) {
          let filtered = insts;
          if (region) {
            const rTerms = [...(region.cities || []), ...(region.keywords || []), region.name];
            const regionFilt = filtered.filter(i => {
              const ctx = rawHtml.substring(rawHtml.indexOf(i.url) - 300, rawHtml.indexOf(i.url) + 300);
              return rTerms.some(t => ctx.includes(t));
            });
            if (regionFilt.length >= 2) filtered = regionFilt;
          }
          const mdLines = filtered.slice(0, 15).map(i => {
            const pos = rawHtml.indexOf(i.url);
            const snippet = rawHtml.substring(pos + i.url.length + 50, pos + i.url.length + 400)
              .replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, 200);
            urlToTitle[i.url] = i.name;
            return '**[' + i.name + '](' + i.url + ')**\n' + snippet + '\n[פנו למידע ולייעוץ אישי](' + i.url + ')';
          });
          parts.push('=== קורסים שנמצאו ===\n\n' + mdLines.join('\n\n'));
          parts.push('קישור לכל קורסי ציבור הדתי: ' + datiUrl);
          return { context: parts.join('\n\n'), isInfo: false, courseCount: filtered.length, urlToTitle };
        }
      }
    } catch(e) { console.log('Dati fetch error:', e.message); }
  }

  const infoUrlsForQA = detectInfoPages(message) || [];
  const qaFirst = searchQA(message);
  const hasInstQ = /מכללה|מכללת|אוניברסיטה|אוניברסיטת|מכון|סמינר|אקדמית|קריית|קריה|אורנים|בר.?אילן|תלפיות|הרצוג|שנקר|לוינסקי|גורדון|אונו|וינגייט|בן.?גוריון|עברית|תל.?אביב|חיפה|ירושלים|בגין|ויצמן/.test(message);
  // QA-ים מסוג תלונה/הסלמה (לדוגמה: מוסד לא עונה) — חייבים להיתפס גם אם
  // מוזכרת בהודעה מילת-מוסד כמו "סמינר"/"מכללה", כי המשתמש מתלונן על מוסד ספציפי.
  const ALWAYS_PRIORITY_QA_IDS = new Set(['institution_not_responding']);
  const isEscalationQA = qaFirst && ALWAYS_PRIORITY_QA_IDS.has(qaFirst.id);
  if (qaFirst && infoUrlsForQA.length === 0 && (!hasInstQ || isEscalationQA)) {
    const qaFooter0 = '\n\n📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)';
    // priority:true = תשובה ישירה ספציפית לא ממשיכים לחפש קורסים
    if (qaFirst.priority) {
      return { context: '=== מידע על שבתון ===\n' + qaFirst.answer + qaFooter0, isInfo: true, courseCount: 0, urlToTitle, qaId: qaFirst.id };
    }
    // אם יש keywords לתחום — הוסף הסבר QA לcontext והמשך לחפש קורסים
    const hasFieldKws = getFieldKeywords(message) && getFieldKeywords(message).length > 0;
    if (hasFieldKws) {
      parts.push('=== הסבר על הנושא ===\n' + qaFirst.answer);
      // המשך לחפש קורסים
    } else {
      return { context: '=== מידע על שבתון ===\n' + qaFirst.answer + qaFooter0, isInfo: true, courseCount: 0, urlToTitle, qaId: qaFirst.id };
    }
  }
  const infoUrls = infoUrlsForQA;
  if (infoUrls.length > 0) {
    let gotContent = false;
    const infoPageDB = loadJSON('info-pages.json') || {};
    for (const url of infoUrls.slice(0, 3)) {
      const baseUrl = url.split('#')[0];
      const entry = infoPageDB[url] || infoPageDB[baseUrl] ||
        Object.values(infoPageDB).find((v, idx) => Object.keys(infoPageDB)[idx].startsWith(baseUrl));
      if (entry && entry.content && entry.content !== '<<CONTENT_FROM_PAGE>>') {
        parts.push('=== מידע מ-' + url + ' ===\n' + entry.content);
        gotContent = true; break;
      }
    }
    if (!gotContent) {
      const indexes2 = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json'];
      for (const url of infoUrls.slice(0, 2)) {
        const slug = url.split('/').pop().replace('#', '_');
        for (const fname of indexes2) {
          const data = loadJSON(fname);
          if (!data) continue;
          const pages = Array.isArray(data) ? data : (data.pages || []);
          const found = pages.find(p => p.url && (p.url.includes(slug) || p.url === url));
          if (found && found._text && found._text.length > 100) {
            parts.push('=== מידע מ-' + url + ' ===\n' + found._text.substring(0, 5000));
            gotContent = true; break;
          }
        }
        if (gotContent) break;
      }
    }
    if (!gotContent) {
      const contents = await Promise.all(infoUrls.slice(0, 2).map(url => fetchPageContent(url)));
      contents.forEach((content, i) => {
        if (content) {
          console.log('INFO page fetched:', infoUrls[i], 'len:', content.length);
          console.log('INFO CONTENT:', content.substring(0, 500).replace(/[\n\r]/g,' '));
          const cleanContent = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/[^\s]+/g, '').replace(/🏫[^\n]*/g, '').trim();
          parts.push('=== מידע מ-' + infoUrls[i] + ' ===\n' + cleanContent + '\n\nקישור לדף: ' + infoUrls[i]);
          gotContent = true;
        }
      });
    }
    if (!gotContent) {
      const qaMatch = searchQA(message);
      if (qaMatch) return { context: '=== מידע על שבתון ===\n' + qaMatch.answer, isInfo: true, courseCount: 0, urlToTitle: {} };
      else parts.push('=== דפי מידע רלוונטיים ===\n' + infoUrls.map(u => '- ' + u).join('\n'));
    }
    if (gotContent) {
      if (qaFirst) parts.push('=== מידע נוסף (QA) ===\n' + qaFirst.answer);
      return { context: parts.join('\n\n'), isInfo: true, courseCount: 0, urlToTitle };
    }
  }

  const sfForKI = loadJSON('study-fields.json');
  let knownOnly = null;
  let matchedFieldKeywords = [];
  let matchedFieldObj = null;
  let combinedNote = null;
  let wasCombined = false;
  let combinedFieldInfo = null;
  if (sfForKI) {
    const msgLKI2 = message.toLowerCase();
    let bestLen = 0;
    // מחפש keyword הכי ארוך — לא הראשון (כמו searchQA)
    // עבור keywords קצרים (4 תווים ומטה) — דורש גבול מילה, כמו ב-getFieldSlug
    for (const sfItem of (sfForKI.studyFields || [])) {
      const kws = sfItem.keywords || [];
      if (!sfItem.known_institutions || sfItem.known_institutions.length === 0) continue;
      for (const k of kws) {
        const kL = k.toLowerCase();
        const isMatch = k.length <= 4 ? wordBoundaryIncludes(msgLKI2, kL) : msgLKI2.includes(kL);
        if (isMatch && k.length > bestLen) {
          bestLen = k.length;
          knownOnly = sfItem.known_institutions;
          matchedFieldKeywords = [sfItem.name];
          matchedFieldObj = sfItem;
        }
      }
    }

    // ── איחוד עם תחום משלים (combinesWith) ──
    // לדוגמה: שאלה על "אורח חיים בריא, כושר" שייכת גם לבריאות-ותזונה וגם לספורט.
    // אם לתחום שזוהה כראשי מוגדר combinesWith, ונמצאה גם התאמת מילת-מפתח אמיתית
    // לתחום המשלים (לא רק שיתוף מילה מקרי) — מאחדים את רשימות המוסדות (ללא כפילויות),
    // ומוסיפים הערה רלוונטית (כמו האזהרה על מנוי מועדון ספורט) אם הוגדרה.
    if (matchedFieldObj && Array.isArray(matchedFieldObj.combinesWith)) {
      for (const combo of matchedFieldObj.combinesWith) {
        const otherField = (sfForKI.studyFields || []).find(f => f.name === combo.field);
        if (!otherField || !otherField.known_institutions || otherField.known_institutions.length === 0) continue;
        let otherBestLen = 0;
        for (const k of (otherField.keywords || [])) {
          const kL = k.toLowerCase();
          const isMatch = k.length <= 4 ? wordBoundaryIncludes(msgLKI2, kL) : msgLKI2.includes(kL);
          if (isMatch && k.length > otherBestLen) otherBestLen = k.length;
        }
        if (otherBestLen > 0) {
          console.log('COMBINED FIELDS:', matchedFieldObj.name, '+', otherField.name);
          const seenUrls = new Set(knownOnly.map(ki => ki.url));
          const merged = [...knownOnly];
          for (const ki of otherField.known_institutions) {
            if (!seenUrls.has(ki.url)) { merged.push(ki); seenUrls.add(ki.url); }
          }
          knownOnly = merged;
          matchedFieldKeywords.push(otherField.name);
          wasCombined = true;
          combinedFieldInfo = { name: otherField.name, slug: otherField.slug };
          if (combo.note) combinedNote = combo.note;
        }
      }
    }
  }

  if (knownOnly) {
    // סנן URLs לא תקינים (WhatsApp, חיצוניים וכו')
    const validKI = knownOnly.filter(ki => {
      const u = ki.url || '';
      return u.includes('shabaton.online/') || u.includes('morim.boutique/');
    });
    if (validKI.length === 0) { knownOnly = null; }
    else { knownOnly = validKI; }
  }

  if (knownOnly) {
    // סנן URLs שאינם של הפורטל (WhatsApp, Facebook וכד')
    let validKI = knownOnly.filter(ki => {
      const url = (ki.url || '').toLowerCase();
      return url.includes('shabaton.online') || url.includes('morim.boutique');
    });
    // סנן לפי מונח ספציפי מהשאלה — לא להציג את כל התחום אם נשאלים על נושא-משנה.
    // אבל אם בוצע איחוד שדות (combinesWith) — השאלה כללית/חוצת-תחומים מטבעה,
    // וסינון נוסף עלול לצמצם בטעות לכמה מוסדות שמקריות מכילים מילה כמו "כושר" בשם
    // (שהיא בעצמה מילת-מפתח כללית של התחום, לא מונח-משנה ספציפי).
    const filterRes = wasCombined
      ? { result: validKI, noMatchForSpecificTerm: false }
      : filterInstitutionsBySpecificTerm(validKI, message, matchedFieldKeywords);
    validKI = filterRes.result;
    // נושא-משנה ספציפי נשאל (כמו "ארומתרפיה") אבל לא נמצא לו מוסד תואם —
    // אם לתחום הוגדר מוסד-ברירת-מחדל (fallbackInstitution), נציג אותו בלבד
    // במקום רשימה לא-קשורה של כל המוסדות בתחום.
    if (filterRes.noMatchForSpecificTerm && matchedFieldObj && matchedFieldObj.fallbackInstitution) {
      const fbUrl = matchedFieldObj.fallbackInstitution.url;
      const fbKi = validKI.find(ki => ki.url === fbUrl);
      if (fbKi) {
        console.log('FALLBACK INSTITUTION (no specific match):', fbKi.title);
        validKI = [fbKi];
      }
    }
    if (validKI.length === 0) { /* אין מוסדות תקניים — המשך לחיפוש */ }
    else {

    const fieldSlug2 = getFieldSlug(message);
    const regionForKI = detectRegion(message);

    // אם יש אזור מזוהה (ולא "למידה מרחוק" — אין לו דף results נפרד) —
    // ננסה קודם את דף האזור האמיתי באינדקס (מסונן באמת לאזור, כולל למידה מרחוק
    // שמוצגת תמיד גם היא בדפי ה-results-X של הפורטל).
    if (regionForKI && regionForKI.slug !== 'online' && fieldSlug2) {
      const regionPageData = getInstitutionsFromCategoryIndex(fieldSlug2.name, regionForKI.slug);
      let regionInst = (regionPageData && regionPageData.text)
        ? parseInstitutionsFromCategoryText(regionPageData.text, fieldSlug2.name, 20)
        : [];

      // האינדקס הסטטי לא תמיד מכיל את הדף — הסינון האזורי קיים בפועל באתר,
      // אז ננסה לסרוק את הדף החי לפני שמרימים ידיים.
      if (regionInst.length === 0) {
        try {
          const liveUrl = buildRegionCategoryUrl(regionForKI.slug, encodeURIComponent(fieldSlug2.name));
          console.log('Region index empty — trying live fetch:', liveUrl);
          const liveContent = await fetchPageContent(liveUrl);
          if (liveContent && liveContent.length > 100) {
            regionInst = parseInstitutionsFromCategoryText(liveContent, fieldSlug2.name, 20);
          }
        } catch(e) { /* live fetch failed — continue to fallback below */ }
      }

      if (regionInst.length > 0) {
        for (let i = regionInst.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [regionInst[i], regionInst[j]] = [regionInst[j], regionInst[i]];
        }
        const kiForClaudeRegion = regionInst.map(ki =>
          `**[${ki.title}](${ki.url})**\n[פנו למידע ולייעוץ אישי](${ki.url})`
        );
        const catUrlRegion = buildRegionCategoryUrl(regionForKI.slug, fieldSlug2.slug);
        console.log('REGION-SPECIFIC HIT (preferred over knownOnly):', regionForKI.slug, '|', regionInst.length, 'institutions');
        return { context: '', isInfo: false, courseCount: kiForClaudeRegion.length, urlToTitle: {}, coursesForClaude: kiForClaudeRegion, categoryUrl: catUrlRegion, fieldName: fieldSlug2.name, regionName: regionForKI.name };
      }
      console.log('Region-specific page truly empty (index + live) — giving direct link instead of unfiltered national list');
      // לא מצליחים לחלץ רשימה אוטומטית (דפי Wix דינמיים, רינדור JS) —
      // אבל הסינון האזורי קיים ועובד באתר בפועל, אז מפנים ישירות לדף החי המדויק
      // במקום להציג רשימה לאומית מבולבלת.
      const liveLinkUrl = buildRegionCategoryUrl(regionForKI.slug, fieldSlug2.slug);
      const directLinkMsg =
        `📍 [לחצו כאן](${liveLinkUrl}) לרשימת המוסדות באזור ${regionForKI.name}, ` +
        `ופנו ישירות ליועצי הלימודים שלהם למידע ולייעוץ אישי עבורכם.`;
      return { context: '=== מידע על שבתון ===\n' + directLinkMsg, isInfo: true, courseCount: 0, urlToTitle: {} };
    }

    // הגרלת סדר — מוסדות שונים בכל פנייה
    const shuffledKI = [...validKI];
    for (let i = shuffledKI.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledKI[i], shuffledKI[j]] = [shuffledKI[j], shuffledKI[i]];
    }
    // פורמט coursesForClaude — מפעיל את COURSE LIST BYPASS
    const kiForClaude = shuffledKI.map(ki => {
      const cleanDesc = smartTruncate(cleanDescription(ki.description), 800).trim();
      return `**[${ki.title}](${ki.url})**\n${cleanDesc ? cleanDesc + '\n' : ''}[פנו למידע ולייעוץ אישי](${ki.url})`;
    });
    const catUrl2 = fieldSlug2 ? `https://www.shabaton.online/results-all/${encodeURIComponent(fieldSlug2.slug)}` : null;
    const catName2 = fieldSlug2 ? fieldSlug2.name : null;
    // קישור "כל הקורסים" גם לתחום המשלים, כשהיה איחוד שדות — לא רק לתחום הראשי
    if (wasCombined && combinedFieldInfo) {
      const catUrl3 = `https://www.shabaton.online/results-all/${encodeURIComponent(combinedFieldInfo.slug)}`;
      const extraLink = `📚 [כל קורסי ${combinedFieldInfo.name}](${catUrl3})`;
      combinedNote = combinedNote ? combinedNote + '\n' + extraLink : extraLink;
    }
    // ⚠️ רשימה לאומית — אין לטעון שהיא מסוננת לאזור, אבל נזכיר שביקשת אזור זה
    console.log('KNOWN_ONLY path (national list):', validKI.length, 'institutions → coursesForClaude');
    return { context: '', isInfo: false, courseCount: kiForClaude.length, urlToTitle: {}, coursesForClaude: kiForClaude, categoryUrl: catUrl2, fieldName: catName2, regionName: null, requestedRegionName: regionForKI ? regionForKI.name : null, usedFallbackInstitution: !!(filterRes.noMatchForSpecificTerm && validKI.length === 1), combinedNote };
    } // end else validKI
  }

  const courses = searchCourses(message, region);
  const fieldKeywords = getFieldKeywords(message);
  const genericWords2 = new Set(['קורס','קורסי','קורסים','למורים','לגננות','בשבתון','מורים','גננות','שבתון','לימוד','לימודים']);
  const qLower2 = message.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !genericWords2.has(w));

  const qaGeneral = searchQA(message);
  if (qaGeneral && !hasInstQ && !datesCtx) {
    console.log('QA general match:', qaGeneral.id || qaGeneral.question);
    return { context: '=== מידע על שבתון ===\n' + qaGeneral.answer + '\n\n📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)', isInfo: true, courseCount: 0, urlToTitle, qaId: qaGeneral.id };
  }

  if (fieldKeywords && fieldKeywords.length > 0) {
    const institutionPages = getInstitutionPagesForField(message);
    const expandedQ = [...qLower2];
    qLower2.forEach(function(w) {
      if (w.length > 6) {
        for (var si = 3; si <= w.length-3; si++) {
          var p1 = w.substring(0, si), p2 = w.substring(si);
          if (p1.length >= 3 && p2.length >= 3 && !expandedQ.includes(p1)) expandedQ.push(p1, p2);
        }
      }
    });
    const instWithText = institutionPages.filter(p => {
      const pt = (p._text||'');
      if (requiredPhrase) return pt.includes(requiredPhrase) || (p.title||'').toLowerCase().includes(requiredPhrase) || (p.description||'').toLowerCase().includes(requiredPhrase);
      return expandedQ.length > 0 && expandedQ.some(w => pt.includes(w));
    });
    console.log('instWithText count:', instWithText.length, instWithText.slice(0,8).map(p => p.url.split('/').pop()).join(' | '));

    if (institutionPages.length > 0) {
      const existingUrls = new Set();
      const sfDataInst = loadJSON('study-fields.json');
      const fieldKwsExtra = [];
      if (sfDataInst) {
        const msgL = message.toLowerCase();
        for (const sf of (sfDataInst.studyFields || [])) {
          const kws = sf.keywords || [];
          if (kws.some(k => msgL.includes(k.toLowerCase()))) {
            const generic = new Set(['קורס','קורסי','קורסים','מורים','גננות','שבתון','למורים','לגננות']);
            kws.filter(k => k.length > 2 && !generic.has(k)).forEach(k => {
              if (!fieldKwsExtra.includes(k.toLowerCase())) fieldKwsExtra.push(k.toLowerCase());
            });
            break;
          }
        }
      }
      const qSpecific2 = [...new Set([...qLower2, ...fieldKwsExtra])];
      console.log('qSpecific2:', qSpecific2.slice(0,8).join(' | '));

      // חיפוש title באינדקסים
      const idxFiles4 = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json','morim_index_part1.json'];
      const qWords4raw = message.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !['של','על','עם','אל','כל','גם','לא','מה','מי','איך','בין','כי','את','אם','הם','הן'].includes(w));
      const qWords4 = [...new Set([...qWords4raw, ...qWords4raw.map(w => w.replace(/ת$/, 'ה')).filter(w => w.length > 1)])];
      const titleHits = [];
      for (const fn4 of idxFiles4) {
        const d4 = loadJSON(fn4);
        if (!d4) continue;
        const pg4 = Array.isArray(d4) ? d4 : (d4.pages || Object.values(d4));
        for (const p4 of pg4) {
          if ((p4.url||'').includes('/kenes/')) continue;
          const titleL4 = (p4.title||'').toLowerCase();
          const titleScore = qWords4.filter(w => titleL4.includes(w)).length;
          if (titleScore >= 1 && !existingUrls.has(p4.url)) {
            titleHits.push({ ...p4, _titleScore: titleScore });
            existingUrls.add(p4.url);
          }
        }
      }
      titleHits.sort((a, b) => b._titleScore - a._titleScore);
      for (const p4 of titleHits.slice(0, 5)) {
        const d4desc = (p4.description || p4._text || '').substring(0, 350);
        courses.push('**[' + p4.title + '](' + p4.url + ')**\n' + d4desc + '\n[פנו למידע ולייעוץ אישי](' + p4.url + ')\n');
        urlToTitle[p4.url] = p4.title;
        console.log('Title match:', p4.url.split('/').pop(), 'score:', p4._titleScore);
      }

      const textIndexPages = institutionPages.filter(p => {
        if (existingUrls.has(p.url)) return false;
        const pt = (p._text||'');
        if (requiredPhrase) return pt.includes(requiredPhrase) || (p.title||'').toLowerCase().includes(requiredPhrase) || (p.description||'').toLowerCase().includes(requiredPhrase);
        return qSpecific2.some(w => pt.includes(w));
      });
      console.log('textIndex pages:', textIndexPages.map(p => p.url.split('/').pop()).join(' | '));
      textIndexPages.forEach(p => {
        let instSnippet = p.description;
        for (const qw of qSpecific2) {
          const tidx = (p._text||'').indexOf(qw);
          if (tidx >= 0) { instSnippet = p._text.substring(Math.max(0, tidx - 30), tidx + 400).trim(); break; }
        }
        const snippetHasQ = qSpecific2.some(w => instSnippet.toLowerCase().includes(w));
        const shortU = p.url.split('/').pop();
        if (['hemdat','igud_arim','foodprof'].includes(shortU)) {
          console.log('textIndex snippet:', shortU, 'hasQ='+snippetHasQ, instSnippet.substring(0,80));
        }
        let skipPage = false;
        if (region) {
          const tdCheck = (p.title + ' ' + instSnippet + ' ' + (p.description||'')).toLowerCase();
          const regD2 = loadJSON('regions.json');
          if (regD2) {
            let wrongR = false, rightC = false;
            for (const orr of (regD2.regions || [])) {
              if (orr.slug === region.slug) { rightC = (orr.cities || []).some(c => c.length > 2 && tdCheck.includes(c.toLowerCase())); }
              else { if ((orr.cities || []).some(c => c.length > 3 && tdCheck.includes(c.toLowerCase()))) wrongR = true; }
            }
            if (wrongR && !rightC) skipPage = true;
          }
        }
        if (!skipPage) courses.push({ title: p.title, url: p.url, description: instSnippet, score: 3, _liveRelevant: snippetHasQ });
        existingUrls.add(p.url);
      });

      try {
        const sfKI = loadJSON('study-fields.json');
        if (sfKI) {
          const msgLKI = message.toLowerCase();
          for (const sfItem of (sfKI.studyFields || [])) {
            const kws = sfItem.keywords || [];
            if (kws.some(k => msgLKI.includes(k.toLowerCase())) && sfItem.known_institutions) {
              for (const ki of sfItem.known_institutions) {
                if (!existingUrls.has(ki.url) && !institutionPages.find(p => p.url === ki.url)) {
                  institutionPages.push({ title: ki.title, url: ki.url, description: ki.description || '', _score: 200, _text: '' });
                }
              }
              break;
            }
          }
        }
      } catch(e) {}

      const remainingInst = institutionPages.filter(p => !existingUrls.has(p.url));
      const withTextMatch2 = remainingInst.filter(p => qSpecific2.some(w => (p._text||'').includes(w)));
      const withoutText2   = remainingInst.filter(p => !qSpecific2.some(w => (p._text||'').includes(w)));
      const toScan5 = [...withTextMatch2, ...withoutText2];
      const scanned = await Promise.all(
        toScan5.map(async p => {
          const content = await fetchPageContent(p.url);
          if (!content) return null;
          const isAlreadyTextMatch = withTextMatch2.some(tm => tm.url === p.url);
          const contentLower3 = content.toLowerCase();
          const onlineKeywords = /מרחוק|זום|zoom|אונליין|online|מקוון|מתוקשב/;
          const pageOnline = onlineKeywords.test((p.title||'') + ' ' + (p.description||'') + ' ' + (p._text||''));
          const topicMatch = requiredPhrase
            ? contentLower3.includes(requiredPhrase)
            : (isAlreadyTextMatch || qSpecific2.some(w => contentLower3.includes(w)));
          const relevant = topicMatch;
          if (relevant && region && region.slug === 'online') {
            p._isOnline = onlineKeywords.test(contentLower3) || pageOnline;
          }
          if (relevant && region) {
            const regD = loadJSON('regions.json');
            if (regD) {
              const contentLower = content.toLowerCase();
              let wrongReg = false, rightCity = false;
              for (const or2 of (regD.regions || [])) {
                if (or2.slug === region.slug) { rightCity = or2.cities.some(c => c.length > 2 && contentLower.includes(c.toLowerCase())); }
                else { if (or2.cities.some(c => c.length > 3 && contentLower.includes(c.toLowerCase()))) wrongReg = true; }
              }
              if (wrongReg && !rightCity && region.slug !== 'online') return null;
            }
          }
          const shortName = p.url.split('/').pop();
          if (['hemdat','igud_arim','washington-morim','foodprof'].includes(shortName)) {
            console.log('LIVE SCAN:', shortName, 'relevant='+relevant, 'content_len='+(content||'').length);
          }
          if (!relevant) return null;
          const onlineScore = (p._isOnline) ? 5 : 2;
          return { title: p.title, url: p.url, description: p.description, score: onlineScore, _liveRelevant: true, _liveContent: content, _isOnline: p._isOnline };
        })
      );
      scanned.filter(Boolean).forEach(p => { courses.push(p); existingUrls.add(p.url); });
    }
  }

  // חיפוש title standalone — תמיד, ללא תלות ב-field
  {
    const existingUrls5 = new Set(courses.map(c => typeof c === 'string' ? '' : (c.url||'')).filter(Boolean));
    // נרמל צורות נסמך: קריית→קריה, מכללת→מכללה, אוניברסיטת→אוניברסיטה
    const normalizeHeb = w => w
      .replace(/ת$/, 'ה')   // קריית→קריה, מכללת→מכללה
      .replace(/ות$/, 'ה')  // השתלמויות→השתלמוה (rough)
      .replace(/י$/, '');   // rough suffix
    const qWords5raw = message.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !['של','על','עם','אל','כל','גם','לא','מה','מי','איך','בין','כי','את','אם','הם','הן'].includes(w));
    // הוסף גם צורות מנורמלות
    const qWords5 = [...new Set([...qWords5raw, ...qWords5raw.map(w => normalizeHeb(w)).filter(w => w.length > 1)])];
    const titleHits5 = [];
    const idxFiles5 = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json','morim_index_part1.json'];
    for (const fn5 of idxFiles5) {
      const d5 = loadJSON(fn5);
      if (!d5) continue;
      const pg5 = Array.isArray(d5) ? d5 : (d5.pages || Object.values(d5));
      for (const p5 of pg5) {
        if ((p5.url||'').includes('/kenes/')) continue;
        const titleL5 = (p5.title||'').toLowerCase();
        const titleScore5 = qWords5.filter(w => titleL5.includes(w)).length;
        if (titleScore5 >= 1 && !existingUrls5.has(p5.url)) {
          titleHits5.push({ ...p5, _titleScore: titleScore5 });
          existingUrls5.add(p5.url);
        }
      }
    }
    titleHits5.sort((a, b) => b._titleScore - a._titleScore);
    for (const p5 of titleHits5.slice(0, 5)) {
      const d5desc = (p5.description || p5._text || '').substring(0, 350);
      courses.push('**[' + p5.title + '](' + p5.url + ')**\n' + d5desc + '\n[פנו למידע ולייעוץ אישי](' + p5.url + ')\n');
      console.log('Standalone title match:', p5.url.split('/').pop(), 'score:', p5._titleScore);
    }
  }

  if (courses.length > 0) {
    // חסימת מוסדות ספציפיים בשאילתות סמינר — פילטר קוד, לא רק SYSTEM_PROMPT
    const seminarBlacklist = isSeminarQuery ? ['wingate_mashlima'] : [];
    const filteredCourses = seminarBlacklist.length > 0
      ? courses.filter(c => {
          const url = typeof c === 'string' ? c : (c.url || '');
          return !seminarBlacklist.some(b => url.includes(b));
        })
      : courses;

    parts.push('\n=== קורסים שנמצאו ===');
    for (let i = filteredCourses.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredCourses[i], filteredCourses[j]] = [filteredCourses[j], filteredCourses[i]];
    }
    const seenUrls = new Set();
    const uniqueCourses = filteredCourses.filter(c => {
      if (typeof c === 'string') return true;
      if (seenUrls.has(c.url)) return false;
      seenUrls.add(c.url);
      return true;
    });
    let coursesForClaude = [];
    uniqueCourses.forEach(c => {
      if (typeof c === 'string') { coursesForClaude.push(c); return; }
      let desc = (c.description || '').trim();
      const descHasQ = qLower2.some(w => desc.toLowerCase().includes(w));
      if (!descHasQ && c._text) {
        for (const qw of qLower2) {
          const ti = c._text.indexOf(qw);
          if (ti >= 0) {
            const raw = c._text.substring(Math.max(0, ti - 5), ti + qw.length + 5).trim();
            desc = desc + (desc ? ' | ' : '') + 'כולל קורס: ' + raw;
            break;
          }
        }
      }
      const titleC = (c.title || '').toLowerCase();
      const isGenericPage = /^קורסי העשרה|^קורסי העצמה|^קורסי פנאי/.test(titleC) ||
        /^שבתון - קורסים והשתלמויות/.test(titleC) ||
        (c.url||'').includes('/kenes/');
      const wantsDegree = /תואר שני|תואר ראשון|תואר שלישי|דוקטורט|MA|BA|MSC/.test(message);
      const isMaDegree = /תואר שני|MA |M\.A|מסלול תואר/.test(titleC) && !wantsDegree;
      const wantsTours2 = /טיול|סיור/.test(message.toLowerCase());
      const wantsTraining2 = /מורי דרך|מדריך טיולים|הכשרת מדריך|תיירות/.test(message.toLowerCase());
      const isTrainingCourse = /מורי דרך|הכשרת מדריכ|תיירות, פנאי ואתגר|לימודי תיירות/.test(titleC);
      const filterTraining = isTrainingCourse && wantsTours2 && !wantsTraining2;
      const titleDescLower = (desc + ' ' + (c.title||'')).toLowerCase();
      const textHasQ = requiredPhrase
        ? (c._text||'').includes(requiredPhrase) || (c.description||'').toLowerCase().includes(requiredPhrase) || (c.title||'').toLowerCase().includes(requiredPhrase)
        : qLower2.some(w => (c._text||'').includes(w));
      const hasQword = requiredPhrase
        ? titleDescLower.includes(requiredPhrase)
        : qLower2.some(w => titleDescLower.includes(w));
      const hasScore = !!(c._score && c._score >= 3);
      const finalHasQ = !filterTraining && !isGenericPage && !isMaDegree && (c._liveRelevant || hasQword || textHasQ || hasScore);
      if (finalHasQ) console.log('PASS TO CLAUDE:', (c.title||'').substring(0,30), '| url:', (c.url||'').split('/').pop());
      if (finalHasQ) {
        let descFull = cleanDescription(desc || '').trim();
        const searchTerms = requiredPhrase ? [requiredPhrase, ...qLower2] : qLower2;
        const sourceText = c._liveContent || c._text || '';
        if (sourceText) {
          for (const qw of searchTerms) {
            const ti = sourceText.toLowerCase().indexOf(qw);
            if (ti >= 0) {
              const start = Math.max(0, ti - 40);
              const raw = sourceText.substring(start, ti + qw.length + 280).replace(/<[^>]+>/g,' ').trim();
              const sentStart = raw.search(/[א-ת]/);
              const snippet = (sentStart >= 0 ? raw.substring(sentStart) : raw).substring(0, 320).trim();
              if (snippet.length > 30) { descFull = snippet; break; }
            }
          }
        }
        descFull = descFull.substring(0, 380);
        const md = '**[' + c.title + '](' + c.url + ')**\n' + descFull + '\n[פנו למידע ולייעוץ אישי](' + c.url + ')\n';
        coursesForClaude.push(md);
        urlToTitle[c.url] = c.title;
      }
    });
    if (knownOnly && knownOnly.length > 0 && coursesForClaude.length === 0) {
      const kiScanned = await Promise.all(knownOnly.map(async ki => {
        const content = await fetchPageContent(ki.url);
        if (!content) return `**[${ki.title}](${ki.url})**\n${cleanDescription(ki.description)}`;
        return `**[${ki.title}](${ki.url})**\n${content.substring(0, 400).trim()}\n[פנו למידע ולייעוץ אישי](${ki.url})`;
      }));
      parts.push(kiScanned.join('\n'));
    } else if (knownOnly && knownOnly.length > 0) {
      const knownInClaude = coursesForClaude.filter(c => knownOnly.some(k => c.includes(k.url)));
      const otherInClaude = coursesForClaude.filter(c => !knownOnly.some(k => c.includes(k.url)));
      const claudeFinal = [...knownInClaude, ...otherInClaude].slice(0, 10);
      if (claudeFinal.length > 0) parts.push(claudeFinal.join('\n'));
    } else {
      for (let i = coursesForClaude.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [coursesForClaude[i], coursesForClaude[j]] = [coursesForClaude[j], coursesForClaude[i]];
      }
      const claudeFinal = coursesForClaude.slice(0, 20);
      if (claudeFinal.length > 0) parts.push(claudeFinal.join('\n'));
    }
  }

  const fieldInfo = getFieldSlug(message);

  // ── פתרון ארכיטקטורי: חיפוש מוסדות מדפי Results שכבר באינדקס ──
  // עובד אוטומטית לכל 53 תחומים × 7 אזורים — ללא תחזוקה ידנית
  if (fieldInfo && courses.length < 5) {
    const regionForCat = detectRegion(message);
    const regionSlugForCat = regionForCat ? regionForCat.slug : null;
    const categoryData = getInstitutionsFromCategoryIndex(fieldInfo.name, regionSlugForCat);
    if (categoryData && categoryData.text) {
      const institutions = parseInstitutionsFromCategoryText(categoryData.text, fieldInfo.name, 15);
      if (institutions.length > 0) {
        // הגרלת סדר — מוסדות שונים בכל פנייה
        for (let i = institutions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [institutions[i], institutions[j]] = [institutions[j], institutions[i]];
        }
        const instLines = institutions.map(ki =>
          `**[${ki.title}](${ki.url})**\n[פנו למידע ולייעוץ אישי](${ki.url})`
        ).join('\n\n');
        parts.push(`=== מוסדות בתחום ${fieldInfo.name} ===\n${instLines}`);
        const catUrlForField = regionSlugForCat
          ? buildRegionCategoryUrl(regionSlugForCat, encodeURIComponent(fieldInfo.name))
          : `https://www.shabaton.online/results-all/${encodeURIComponent(fieldInfo.name)}`;
        parts.push(`קישור לכל הקורסים בתחום זה: ${catUrlForField}`);
        console.log('CATEGORY INDEX FALLBACK:', fieldInfo.name, regionSlugForCat || 'all', '| institutions:', institutions.length);
      }
    }

    // fetchFromUrl — שמור לציבור הדתי בלבד
    if (fieldInfo.fetchFromUrl && fieldInfo.categoryUrl && institutions.length === 0) {
      try {
        const catContent = await fetchPageContent(fieldInfo.categoryUrl);
        if (catContent) {
          parts.push(`=== קורסים (מדף הקטגוריה) ===\n${catContent}`);
        }
      } catch(e) {}
    }
  }

  const msgL = message.toLowerCase();
  if (/תואר שני|MA|M\.A/.test(message)) {
    parts.push('\nחובה לכלול בתשובה — 🎓 [כל קורסי לימודי תואר שני בחינוך ובהוראה](https://www.shabaton.online/results-all/%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%AA%D7%95%D7%90%D7%A8%20%D7%A9%D7%A0%D7%99%20%D7%91%D7%97%D7%99%D7%A0%D7%95%D7%9A%20%D7%95%D7%91%D7%94%D7%95%D7%A8%D7%90%D7%94)');
  }

  // ניתוב ישיר לפי מסלולים ספציפיים — מונע "אין מידע" על תחומים שאינם באינדקס
  const specificTermRoutes = [
    { terms: ['ביבליותרפיה', 'bibliotherapy', 'מקרא ובביבליותרפיה', 'ביבליו'], url: 'https://www.shabaton.online/schechter', label: 'מכון שכטר — ביבליותרפיה ומקרא' },
    { terms: ['מדעי היהדות', 'שכטר', 'מרפא ליווי רוחני', 'מדרש ואגדה', 'תלמוד והלכה', 'לומדים ומלמדים'], url: 'https://www.shabaton.online/schechter', label: 'מכון שכטר למדעי היהדות' },
    { terms: ['פסיכותרפיה', 'טיפול קצר מועד', 'cbt', 'iac psychotherapy'], url: 'https://www.shabaton.online/iac_psychotherapy', label: 'המכללה האקדמית רמת גן — פסיכותרפיה' },
    { terms: ['לוגותרפיה', 'logotherapy'], url: 'https://www.shabaton.online/tau-edu', label: 'אוניברסיטת תל-אביב — לוגותרפיה' },
    { terms: ['חינוך מתמטי', 'מתמטיקה בחינוך'], url: 'https://www.shabaton.online/haifa-math-edu', label: 'אוניברסיטת חיפה — חינוך מתמטי' },
    { terms: ['ייעוץ חינוכי חיפה', 'ייעוץ חינוכי אוניברסיטה'], url: 'https://www.shabaton.online/haifa-yiutz', label: 'אוניברסיטת חיפה — ייעוץ חינוכי' },
    { terms: ['לקויות למידה חיפה', 'חינוך מיוחד חיפה'], url: 'https://www.shabaton.online/haifa-ma-special-edu', label: 'אוניברסיטת חיפה — חינוך מיוחד' },
    { terms: ['מדעי הלמידה', 'הוראה ולמידה חיפה'], url: 'https://www.shabaton.online/haifa-education-science', label: 'אוניברסיטת חיפה — מדעי הלמידה' },
  ];

  for (const route of specificTermRoutes) {
    if (route.terms.some(t => msgL.includes(t.toLowerCase()))) {
      try {
        const content = await fetchPageContent(route.url);
        if (content) {
          parts.push(`=== מידע מ-${route.label} ===\n${content.substring(0, 800).trim()}\nקישור לדף: ${route.url}`);
        } else {
          parts.push(`מוסד רלוונטי: [${route.label}](${route.url})\n[פנו למידע ולייעוץ אישי](${route.url})`);
        }
        console.log('Specific term route:', route.label);
      } catch(e) {
        parts.push(`מוסד רלוונטי: [${route.label}](${route.url})\n[פנו למידע ולייעוץ אישי](${route.url})`);
      }
      break;
    }
  }

  const msgContainsRegion = region && (
    (region.keywords || []).some(k => msgL.includes(k.toLowerCase())) ||
    (region.cities || []).some(c => c.length > 3 && msgL.includes(c.toLowerCase()))
  );
  if (msgContainsRegion) {
    const fieldSlug = fieldInfo ? fieldInfo.slug : null;
    const fieldName = fieldInfo ? fieldInfo.name : null;
    if (fieldSlug) {
      parts.push(`\nאזור: ${region.name} (slug: ${region.slug})\nתחום: ${fieldName}\n` +
        `קישור לכל קורסי התחום באזור: ${region.slug === 'online' ? 'https://www.shabaton.online/results-all/' + encodeURIComponent(fieldSlug) : 'https://www.shabaton.online/' + region.slug + '/' + fieldSlug}\n` +
        `קישור לכל קורסי התחום בכל הארץ: https://www.shabaton.online/results-all/${fieldSlug}`);
    } else {
      parts.push(`\nאזור: ${region.name} | slug: ${region.slug}`);
    }
  } else if (fieldInfo) {
    parts.push(`\nתחום: ${fieldInfo.name}\nקישור לכל קורסי התחום בכל הארץ: https://www.shabaton.online/results-all/${fieldInfo.slug}\nחשוב: הגולש לא ציין אזור — אל תוסיף אזור בכותרת ולא בfooter`);
  }

  // ── Fallback כללי: אפס תוצאות ← סורק דפי master-degree / קטגוריה ──
  if (courses.length === 0) {
    const partsHaveRealContent = parts.some(p => p.length > 200 && (p.includes('===') || p.includes('**[')));
    if (!partsHaveRealContent) {
      // נסה QA עוד פעם לפני הכל
      const fallbackQA = searchQA(message);
      if (fallbackQA) {
        const qaFooterFB = '\n\n📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
          '💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n' +
          '👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)';
        console.log('Zero-results fallback: QA match found:', fallbackQA.id);
        return { context: '=== מידע על שבתון ===\n' + fallbackQA.answer + qaFooterFB, isInfo: true, courseCount: 0, urlToTitle, qaId: fallbackQA.id };
      }
      // סרוק דף master-degree כ-fallback אקדמי
      const isAcademicQuery = /תואר|מסלול|לימוד|קורס|השתלמות|הכשרה|מקרא|ביבליו|פסיכו|מחקר|אקדמ/.test(message);
      if (isAcademicQuery) {
        try {
          console.log('Zero-results fallback: fetching master-degree page...');
          const masterContent = await fetchPageContent('https://www.shabaton.online/master-degree');
          if (masterContent) {
            parts.push(`=== רשימת מוסדות ולימודים ===\n${masterContent.substring(0, 1500).trim()}\nקישור לדף: https://www.shabaton.online/master-degree`);
          }
        } catch(e) {
          parts.push('קישור לרשימת כל המוסדות: https://www.shabaton.online/master-degree');
        }
      }
      // סרוק דף קטגוריה אם זוהה תחום
      if (fieldInfo && fieldInfo.slug && !isAcademicQuery) {
        try {
          const catUrl = `https://www.shabaton.online/results-all/${fieldInfo.slug}`;
          console.log('Zero-results fallback: fetching category page:', catUrl);
          const catContent = await fetchPageContent(catUrl);
          if (catContent) {
            parts.push(`=== קורסים בתחום ${fieldInfo.name} ===\n${catContent.substring(0, 1500).trim()}\nקישור לדף: ${catUrl}`);
          }
        } catch(e) {}
      }
    }
  }

  return { context: parts.join('\n\n'), isInfo: infoUrls.length > 0, courseCount: courses.length, urlToTitle, coursesForClaude, categoryUrl: fieldInfo ? (region ? buildRegionCategoryUrl(region.slug, fieldInfo.slug) : `https://www.shabaton.online/results-all/${fieldInfo.slug}`) : null, fieldName: fieldInfo ? fieldInfo.name : null, regionName: region ? region.name : null };
}

function chooseModel(q) {
  return /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|אופק|תואר|זכויות/.test(q)
    ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
}

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

    // ── זיהוי "הגשת פרטים" כתגובה למוסד-לא-עונה ──
    // אם בהודעה הקודמת של הבוט הוא ביקש שם/אימייל/טלפון (QA: institution_not_responding),
    // וההודעה הנוכחית מכילה פרטי קשר (אימייל/טלפון) — זו תגובת המשך, לא שאלה חדשה.
    // יש לאשר קבלה ולדווח לזאפייר, ולא לחפש קורסים על סמך תוכן הפרטים.
    const DETAILS_REQUEST_MARKER = 'נעביר את הבקשה שלך ישירות';
    const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const PHONE_RE = /0\d{1,2}[-\s]?\d{6,8}/;
    const lastAssistantMsg = [...history].reverse().find(h => h && h.role === 'assistant' && typeof h.content === 'string');
    const wasAskedForDetails = lastAssistantMsg && lastAssistantMsg.content.includes(DETAILS_REQUEST_MARKER);
    const looksLikeContactDetails = EMAIL_RE.test(message) || PHONE_RE.test(message);
    if (wasAskedForDetails && looksLikeContactDetails) {
      const confirmReply = 'תודה רבה! 🙏 קיבלנו את הפרטים ונעביר אותם ישירות למוסד בהקדם, ונבקש שיחזרו אליך בהקדם האפשרי.' +
        '\n\n💬 [אפשר גם לפנות בקבוצת הוואטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)';
      console.log('DETAILS SUBMISSION after institution complaint — confirming + logging to Zapier');
      if (ZAPIER_WEBHOOK_URL) {
        try {
          const now = new Date();
          await fetch(ZAPIER_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: now.toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'}),
              time: now.toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}),
              site, question: message, answer: confirmReply, model: 'institution-complaint-details',
              needs_learning: 'OK'
            })
          });
        } catch(ze) { console.error('Zapier error:', ze.message); }
      }
      return res.json({ reply: confirmReply });
    }

    // ── INSTITUTION LOOKUP — רץ ראשון, לפני buildContext, בלי תלות בחיפוש קורסים ──
    // חריג: אם ההודעה היא תלונה ("לא עונה לי", "לא חוזרים אליי" וכו') — לא לקצר-דרך
    // לכרטיס מוסד ישיר, אלא לאפשר ל-buildContext לתפוס את QA ההסלמה (institution_not_responding)
    // ולהפעיל את מנגנון הדיווח/בקשת הפרטים.
    const COMPLAINT_RE = /לא עונ(ה|ים)\s*לי|לא חוזר(ים)?\s*אל(י|יי)|אין מענה|לא קיבלתי תשובה|לא קיבלתי מענה|לא ענ(ה|ו)\s*לי|לא מתקשרים\s*אל(י|יי)|לא התקשרו\s*אל(י|יי)|לא מחזירים\s*לי|לא חזרו\s*אל(י|יי)|מתעלמ(ים|ת)?\s*ממני|לא מגיב(ים)?\s*לי|לא עונ(ה|ים)\s*ל(טלפון|הודעות|וואטסאפ|ווצאפ)|לא זוכ(ה|ית)\s*ל(מענה|תשובה)|שלחתי\s*(כמה\s*)?הודעות\s*ו(אין מענה|לא)|פניתי\s*כמה\s*פעמים\s*ולא|כבר\s*(שבוע|שבועיים|חודש)\s*ולא|מתייאש(ת)?\s*מהמוסד|נואש(ת)?\s*מהמוסד|מתעצבנ(ת)?\s*שלא\s*עונים|אף\s*אחד\s*לא\s*(עונה|חוזר\s*אל(י|יי))|לא\s*מצליח(ה)?\s*(להשיג|ליצור קשר)|לא\s*עוזרים\s*לי/;
    const isComplaintMsg = COMPLAINT_RE.test(message);
    const cleanMsg = fixTypos(message);
    const instLookup = isComplaintMsg ? null : lookupInstitution(cleanMsg);
    const FOOTER_DIRECT = '\n\n📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)  \n💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)  \n👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)';
    const logToZapierEarly = async (q, ans, mdl) => {
      if (!ZAPIER_WEBHOOK_URL) return;
      try {
        const now = new Date();
        await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: now.toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'}),
            time: now.toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}),
            site, question: q, answer: ans, model: mdl || 'bypass',
            needs_learning: 'OK'
          })
        });
      } catch(ze) { console.error('Zapier error:', ze.message); }
    };
    if (instLookup && instLookup.found === true) {
      const directInstReply =
        `**[${instLookup.title}](${instLookup.url})**\n\n` +
        `[פנו למידע ולייעוץ אישי](${instLookup.url})${FOOTER_DIRECT}`;
      console.log('INSTITUTION DIRECT MATCH (pre-buildContext):', instLookup.matchedKey, '→', instLookup.url);
      await logToZapierEarly(message, directInstReply, 'institution-direct');
      return res.json({ reply: directInstReply });
    }

    const { context, isInfo, courseCount, urlToTitle, coursesForClaude, categoryUrl, fieldName, regionName, requestedRegionName, qaId, usedFallbackInstitution, combinedNote } = await buildContext(message);
    const isCourseQ = ['קורס','קורסים','לימוד','לימודים','מוסד','מכללה','אוניברסיטה','השתלמות'].some(k => message.includes(k));
    const isInfoQuestion = !!(isInfo && !isCourseQ);

    // פונקציית לוגינג לזאפייר — נקראת מכל נתיב תגובה
    const logToZapier = logToZapierEarly;

    // תיוג מיוחד לקריאות שדורשות פעולת מעקב מהצוות (לדוגמה: מוסד לא עונה לגולש)
    const SPECIAL_TAG_QA_IDS = { institution_not_responding: 'institution-complaint' };
    const zapierModelTag = (qaId && SPECIAL_TAG_QA_IDS[qaId]) || 'qa-bypass';

    if (isInfo && courseCount === 0 && context.startsWith('=== מידע על שבתון ===')) {
      let directReply = context.replace('=== מידע על שבתון ===\n', '').trim();
      directReply = directReply.replace(/\n*📩 \[הרשם לעלון שבתון\].*$/s, '').trim();

      // הגרלת מוסדות — אם יש בלוקים של 🏫 ביניהם \n\n, ערבבם
      if (directReply.includes('🏫')) {
        const beforeFirst = directReply.substring(0, directReply.indexOf('🏫'));
        const afterLast = directReply.substring(directReply.lastIndexOf('\n\n**') || directReply.lastIndexOf('\n\n📚'));
        const instBlock = directReply.substring(directReply.indexOf('🏫'), directReply.lastIndexOf('\n\n📚') > 0 ? directReply.lastIndexOf('\n\n📚') : directReply.lastIndexOf('\n\n💬'));
        const instItems = instBlock.split('\n\n🏫 ').map((item, i) => i === 0 ? item : '🏫 ' + item);
        for (let i = instItems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [instItems[i], instItems[j]] = [instItems[j], instItems[i]];
        }
        const footerStart = directReply.lastIndexOf('\n\n**סינכרוני') > 0
          ? directReply.lastIndexOf('\n\n**סינכרוני')
          : directReply.lastIndexOf('\n\n📚');
        const footer = footerStart > 0 ? directReply.substring(footerStart) : '';
        directReply = beforeFirst + instItems.join('\n\n') + footer;
      }

      const hasWA = directReply.includes('whatsapp.com/FFak') || directReply.includes('chat.whatsapp.com');
      if (!hasWA) directReply += FOOTER_DIRECT;
      console.log('DIRECT QA BYPASS (no Claude) | chars:', directReply.length, '| tag:', zapierModelTag);
      await logToZapier(message, directReply, zapierModelTag);
      return res.json({ reply: directReply });
    }

    // ── COURSE LIST BYPASS — רשימת קורסים נבנית בקוד, Claude רק פתיח ──
    if (courseCount > 0 && coursesForClaude && coursesForClaude.length > 0) {
      // הגרלה — כל שאלה מציגה מוסדות בסדר שונה
      const shuffled = [...coursesForClaude];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const courseListText = shuffled.join('\n\n') + (combinedNote ? '\n\n' + combinedNote : '');
      let intro;
      if (usedFallbackInstitution && fieldName) {
        // לא נמצא מוסד שמלמד בפועל את הנושא הספציפי שנשאל — מציגים מוסד מומלץ
        // לכל תחום ה-${fieldName}, בכנות, ולא כתוצאה מסוננת מדויקת.
        intro = `לא מצאנו במאגר שלנו מוסד שמתמחה ספציפית בנושא שביקשת, אך בתחום ${fieldName} מומלץ לפנות למוסד הבא לבדוק זמינות, ובנוסף ניתן לעיין בכל הקורסים בתחום:`;
      } else if (fieldName && regionName) {
        // אזור מאומת — דף האזור האמיתי נמצא והרשימה באמת מסוננת אליו
        intro = `פה תוכלו למצוא מידע על ${fieldName} באזור ${regionName} ובלמידה מרחוק, ולפנות ישירות למוסדות לשאלות ולייעוץ אישי:`;
      } else if (fieldName && requestedRegionName) {
        // ביקשת אזור ספציפי; ננסה גם דף אינדקס וגם סריקה חיה, ובכל זאת לא נמצא מידע מסונן — מציגים רשימה ארצית בכנות
        intro = `ביקשת מידע על ${fieldName} באזור ${requestedRegionName}. כרגע לא הצלחנו לאתר מידע מסונן ספציפית לאזור זה, כך שלהלן רשימה ארצית של מוסדות (חלקם מציעים גם למידה מרחוק) — מומלץ לבדוק זמינות באזור ${requestedRegionName} ישירות מול כל מוסד:`;
      } else if (fieldName) {
        intro = `פה תוכלו למצוא מידע על ${fieldName} מכל הארץ, כולל אפשרויות בלמידה מרחוק. באיזה אזור הייתם מעדיפים ללמוד? (מרכז / צפון / שרון / ירושלים / דרום) — כתבו לי והבא לכם רשימה מסוננת לאזורכם. בינתיים, ניתן לפנות ישירות למוסדות שלהלן לשאלות ולייעוץ אישי:`;
      } else {
        intro = 'פה תוכלו למצוא מידע ולפנות ישירות למוסדות לשאלות ולייעוץ אישי:';
        try {
          const introRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001', max_tokens: 60,
              system: 'כתוב משפט פתיחה אחד קצר בעברית (עד 12 מילים). אל תזכיר שמות קורסים, מוסדות, קישורים או שעות.',
              messages: [{ role: 'user', content: `שאלה: "${message}"` }]
            })
          });
          if (introRes.ok) {
            const d = await introRes.json();
            const t = d.content?.[0]?.text?.trim();
            if (t && t.length < 80) intro = t;
          }
        } catch(e) { /* use default intro */ }
      }
      const catLink = categoryUrl
        ? `\n\n📚 [כל קורסי ${fieldName || 'התחום'}${regionName ? ' באזור ' + regionName : ''}](${categoryUrl})`
        : '';
      const reply = intro + '\n\n' + courseListText + catLink + FOOTER_DIRECT;
      console.log('COURSE LIST BYPASS | courses:', coursesForClaude.length, '| intro:', intro.substring(0, 40));
      await logToZapier(message, reply, 'course-bypass');
      return res.json({ reply });
    }
    // ─────────────────────────────────────────────────────────────────
    const model = chooseModel(message);

    // אם אין context מספק — שלוף דף מידע ראשי מshבatον
    let finalContext = context;
    if (!context || context.trim().length < 100) {
      try {
        console.log('Empty context — fetching shabaton main info page');
        const mainContent = await fetchPageContent('https://www.shabaton.online/important');
        if (mainContent) finalContext = '=== מידע כללי על שנת שבתון ===\n' + mainContent.substring(0, 2000);
      } catch(e) {}
    }

    // אם context ריק לחלוטין — נסח תשובה עניינית, ללא Claude
    if (!finalContext || finalContext.trim().length < 50) {
      const noResultReply =
        'אין לי מידע על קורסים בנושא זה בפורטל שבתון.\n\n' +
        'נא ציינו באיזה תחום לימוד הינכם מעוניינים ואציע לכם קורסים מתאימים, ' +
        'או פנו לקבוצת הוואטסאפ של שבתון:\n\n' +
        '💬 [אפשר לשאול בקבוצת הוואטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n' +
        '👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)';
      await logToZapier(message, noResultReply, 'no-results');
      return res.json({ reply: noResultReply });
    }

    console.log('CONTEXT SAMPLE:', (context||'').substring(0, 400));
    const userContent = finalContext ? `${finalContext}\n\n---\nשאלת הגולש: ${message}` : message;
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 3000, system: SYSTEM_PROMPT,
        messages: [...history.slice(-6), { role: 'user', content: userContent }]
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
    reply = reply.replace(/[^\u0020-\u007E\u00A0-\u00FF\u0590-\u05FF\u200F\u200E\n\r\t]/g, '');
    // תיקון שגיאות כתיב נפוצות
    reply = reply.replace(/בישור חינוכי/g, 'בישול חינוכי').replace(/בישור רגשי/g, 'בישול רגשי');
    console.log('REPLY:', reply.substring(0, 300).replace(/\n/g, '|'));

    const FOOTER_LINKS = '\n\n📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)  \n💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)  \n👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)';
    const hasFooter = reply.includes('shabaton.online/shabaton') || reply.includes('whatsapp.com/FFak');
    if (!hasFooter) reply += FOOTER_LINKS;
    else {
      reply = reply.replace(/\[הרשם לעלון שבתון\]/g, '📩 [הרשם לעלון שבתון]');
      reply = reply.replace(/\[אפשר לשאול בקבוצת הווטסאפ שבתון\]/g, '💬 [אפשר לשאול בקבוצת הווטסאפ שבתון]');
      reply = reply.replace(/\[הצטרפו לקבוצת הפייסבוק שלנו\]/g, '👥 [הצטרפו לקבוצת הפייסבוק שלנו]');
    }

    if (typeof urlToTitle !== 'undefined') {
      for (const [url, title] of Object.entries(urlToTitle)) {
        const btnPattern = '\u05E4\u05E0\u05D5 \u05DC\u05DE\u05D9\u05D3\u05E2 \u05D5\u05DC\u05D9\u05D9\u05E2\u05D5\u05E5 \u05D0\u05D9\u05E9\u05D9';
        const urlEsc = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (reply.includes('[' + btnPattern + '](' + url + ')') && !reply.includes('**[' + title)) {
          reply = reply.replace('[' + btnPattern + '](' + url + ')',
            '**[' + title + '](' + url + ')**\n[' + btnPattern + '](' + url + ')');
        }
      }
    }

    if (ZAPIER_WEBHOOK_URL) {
      await logToZapier(message, reply, model);
    }

    reply = reply.replace(/^#+\s*/gm, '');
    reply = reply.replace(/\)\*\*\|+/g, ')**\n');
    reply = reply.replace(/\|\|/g, '\n\n');
    reply = reply.replace(/^---+$/gm, '');
    return res.status(200).json({ reply, model });

  } catch(e) {
    console.error('ERROR:', e.message);
    const isTransient = /503|502|connect|reset|timeout|upstream/i.test(e.message);
    const errMsg = isTransient
      ? 'מצטערים, תקלה טכנית קלה. נסו עוד כמה דקות ואענה בשמחה 😊'
      : e.message;
    return res.status(500).json({ error: errMsg });
  }
}
