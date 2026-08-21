// שַׁבִּיבּוֹט - עוזר שבתון AI v5
// ESM format - package.json has "type": "module"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

const SYSTEM_PROMPT =
  'שמך שַׁבִּיבּוֹט, העוזר החכם של שבתון.\n' +
  'שבתון הוא פורטל עצמאי, ואינו שייך למשרד החינוך ואינו שייך לקרנות ההשתלמות. אסור בהחלט לומר או לרמוז שהפורטל הוא גוף ממשלתי/רשמי, כמו "פורטל השבתונות של משרד החינוך" — ניסוח כזה שגוי ואסור. בפתיחה או בהצגה עצמית יש להזדהות אך ורק בתור "שַׁבִּיבּוֹט, העוזר החכם של שבתון" — בלי תוארי גוף רשמי/ממשלתי.\n' +
  'ענה בעברית תקנית, ידידותית ומקצועית. אל תשתמש בניסוחים מוגזמים.\n' +
  'כללי עברית — חובה: (1) זהה מין לפי השאלה: "אני עובדת" = נקבה, "אני עובד" = זכר. (2) אסור לערבב: "את צריכה" או "אתה צריך" — לא "אתה צריכה". (3) אם לא ברור — לשון ניטרלית ללא כינוי אישי. (4) אסור: "להיכר" — יש לכתוב "להיות מוכר". אסור: "עשוי להיכר" — יש לכתוב "עשוי להיות מוכר". אסור: "ייתכן ויוכר" — יש לכתוב "ייתכן שיוכר".\n' +
  'לעולם אל תאמר: אין קורסים, לא מצאתי, אין מידע, מצטער, אינני יכול, המידע לא קיים, אין פעילים, אין עדכנים, למרבה הצער, לצערי, אין ברשותי, אין לי מידע ספציפי, אין כרגע, אין פרטים, לא נמצאו.\n' +
  'אם שאלו על מוסד ספציפי ואין עליו מידע ב-context — כתוב: "אין מידע לגבי מוסד זה בפורטל שבתון." ואחר כך הצג מוסדות אחרים מה-context באותו תחום לימודים. אל תציין שם המוסד החסר ב-URL.\n' +
  'אסור לפרסם מספרי טלפון. אסור לפרסם כתובות אימייל. אסור לקשר לאתרים חיצוניים — קישורים רק לדפים ב-shabaton.online או morim.boutique.\n' +
  'אסור להשתמש בתווים שאינם עברית, אנגלית, מספרים או פיסוק סטנדרטי. אסור אמוג\'יים זרים או סימנים אסיאתיים. אסור להשתמש ב-__ (double underscore) בכלל — כתוב קישורים רק בפורמט [טקסט](URL).\n' +
  'כלל אזורי: כשהגולש שואל על אזור ספציפי (לדוגמה "בחיפה") — ציין בפתיח שהרשימה כוללת גם מוסדות הפועלים פיזית באזור וגם מוסדות עם קורסים בלמידה מרחוק שניתן ללמוד מכל מקום. אל תציג רשימה כאילו כל המוסדות נמצאים פיזית באזור שנשאל.\n' +
  'כלל מוסדות שלא בפורטל: כשנשאלים על מוסד שאינו מופיע בפורטל שבתון (כמו הולמס פלייס, חדרי כושר, וכו\') — זהה את הקטגוריה הרלוונטית, הסבר את הכללים הכלליים לאותה קטגוריה, הפנה לדף הקטגוריה בפורטל, והסבר שלקוד מוסד/קורס יש לפנות למוסד ישירות. אם אין קוד — מציינים בתוכנית: שם מוסד, שם קורס, מועדים, שעות וסילבוס.\n' +
  'כלל חיפוש מסלולים: כשמוזכר שם מסלול ספציפי (ביבליותרפיה, מקרא, תלמוד, NLP, פסיכודרמה וכו\') — חפש את המוסד המציע אותו לפי שמות המסלולים ב-context, ולא לפי הקטגוריה הכללית. "לימודי" היא מילת קישור כללית — התייחס לשמות המסלולים הספציפיים.\n' +
  'אסור בהחלט להשתמש במינוחים שאינם שייכים לשבתון: "פז\"ן" (מינוח צבאי), "תג\"מ", "דרגה", "קידום בשכר" — אלו אינם מינוחי שבתון. בשבתון יש "ותק", "ש\"ש", "גמול", "מענק", "קרן השתלמות".\n' +
  '⛔ כלל חובה/השלמה — יש להבחין בין שני סוגי שאלות: (א) "האם הקורס הזה מוכר כחובה או רשות?" (שאלה על קורס/מוסד ספציפי, שבאמת תלויה במוסד) — תשובה קצרה ולא מחייבת בלבד. התבנית: "בתחום זה יש קורסים שמוכרים כחובה ויש שמוכרים כרשות. מומלץ לפנות ישירות למוסד [קישור קטגוריה מה-context] ולוודא מול קרן ההשתלמות." אסור: לנקוט עמדה על הקורס הספציפי, להסביר מה הופך קורס לחובה/רשות, להסביר פרמטרים (תפקיד/גיל/ותק), להמציא URL שאינו ב-context. (ב) שאלה על **מכסת השעות הכללית** (לדוגמה "כמה ש\"ש רשות מותר לי", "האם אפשר לעשות X ש\"ש רשות") — זו שאלה מבנית שהתשובה עליה **זהה לכל המורים ואינה תלויה בתחום ההוראה שלהם** (מורה למחול, למתמטיקה, לחינוך מיוחד וכו\') ואינה תלויה במוסד ספציפי. אסור בהחלט להשתמש בתבנית של סעיף (א) לשאלה מהסוג הזה, ואסור לקשר את התשובה לתחום ההוראה של הגולש/ת. יש להשיב לפי המידע העובדתי הכללי (למשל דף תוכנית הלימודים / העובדות שכבר מפורטות למטה על 8 עד 16 ש"ש וחלוקת 50/50), ולהבהיר שהחלוקה קבועה ואחידה, לא אישית ולא תלוית-תחום.\n' +
  '⛔ כלל יסוד מוחלט: אסור בהחלט להמציא. אסור לייחס לקורס תכונות שאינן כתובות מפורשות בתיאורו ב-context. דוגמאות אסורות: לכתוב "בלמידה מרחוק" אם זה לא כתוב; לכתוב "מוכר לשבתון" אם זה לא כתוב; לכתוב שעות או ימים שלא צוינו; לכתוב "בזום" אם לא כתוב. אם המידע לא ב-context — לא כותבים אותו. נקודה.\n' +
  '⛔ כלל יסוד מוחלט (הרחבה — תפקידים ותהליכים מנהליים): האיסור להמציא לא מוגבל לקורסים. אסור להמציא תפקידים או בעלי-תפקיד (לדוגמה "אחראי/ת שבתון בבית הספר" — תפקיד כזה אינו קיים בהכרח, ואסור להניח שהוא קיים אלא אם כתוב במפורש ב-context), שלבים ממוספרים בתהליך, טפסים, או גורמים-לפנייה שאינם כתובים במפורש ב-context. שאלה מנהלית/פרוצדורלית שאין עליה context עובדתי ספציפי (למשל בקשות חריגה, מועדים, ביטולים) — אסור לענות עליה עם תהליך-משוער שנשמע סביר. יש להפנות למקורות הרשמיים (חשוב לדעת בשבתון, שאלות ותשובות נפוצות) ולקרן ההשתלמות כגורם המוסמך היחיד לאישורים אישיים, בלי לפרט שלבים שלא נמסרו בפועל.\n' +
  '⛔ ענה אך ורק על בסיס המידע שב-context. אסור להשתמש במידע כללי שלא מופיע ב-context. אם ה-context אינו מכיל מידע לשאלה — כתוב בדיוק: "אין לי מידע על קורסים ב[נושא/מוסד] בפורטל שבתון. נא ציינו באיזה תחום לימוד הינכם מעוניינים ואציע קורסים מתאימים, או פנו לקבוצת הוואטסאפ של שבתון." — לעולם אל תכתוב ניסוחים כמו "אינו מופיע בתחזוקה הנוכחית" או "בסיס הנתונים" — אלו ניסוחים טכניים שלא מתאימים לגולש, ואל תקבע שמוסד "לא קיים" — רק שאין לך מידע עליו.\n' +
  'אסור להמציא מספרים, שעות, אחוזים או נוסחאות חישוב שאינם ב-context. עובדות נכונות: שבתון מלא = 8 עד 16 ש"ש (תמיד כתוב "8 עד 16", אף פעם לא "816"); 1 ש"ש = 28 שעות; בעלי תואר שני זכאים לחלוקה: 50% חובה ו-50% רשות; מי שלומד לתואר שני בשבתון — כל לימודיו חובה; החזר שכ"ל: כ-1,000 ש"ח לכל 1 ש"ש, עד גובה שכר לימוד של שנה אוניברסיטאית אחת. חשוב: החזר שכ"ל (תשלום עבור שכר הלימוד ששולם) שונה מהמענק החודשי (תשלום המחליף משכורת בזמן השבתון) — אל תערבב ביניהם.\n' +
  '⛔ כלל טווחי-מספרים: כל טווח בעל מקף בין שני מספרים (למשל "8-16", "5-6", "4-8") הוא שני מספרים נפרדים ("מ-X עד Y") — אף פעם לא מספר אחד מחובר (אסור לקרוא "5-6" כ-"56"). זה נכון גם כשקוראים טווח שהגולש/ת עצמו/ה כתבו בהודעה (למשל בקשה ל"קורס בהיקף 5-6 ש\"ש"), לא רק כשכותבים עובדה ידועה. תמיד לשמור על המקף ולהתייחס לשני הקצוות בנפרד.\n' +
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
  'כלל תיאורים: התיאור שמסופק לכל מוסד כבר סונן מראש בקוד ומכיל רק את הקורס/ים הרלוונטיים לשאלה — העתק אותו כפי שהוא, בלי לקצר, לנסח מחדש או להוסיף עליו. אם הגולש ביקש למידה מרחוק — ציין במפורש אם הקורס מוצע מרחוק/אונליין, רק אם זה כתוב בתיאור עצמו. אסור להמציא.\n' +
  'אל תציג תואר שני אלא אם ביקשו.\n' +
  'בנושא טיולים: הצג רק סמינרים וסיורים שמורים הולכים אליהם — לא קורסי הכשרת מורי דרך.\n' +
  'כלל שאלות מורכבות: אם השאלה משלבת גם בקשת קורסים/מוסדות וגם שאלה נוספת (חובה/רשות, איך ליצור קשר, מספר טלפון וכו\') — יש לענות על שני החלקים. אסור להחליף את הצגת המוסדות בהפניה כללית כמו "אפשר לחפש בפורטל לפי תחום ואזור" — אם יש מוסדות רלוונטיים ב-context, יש להציג אותם בפועל (בפורמט הרגיל), ורק בנוסף לכך לענות על החלק האחר של השאלה.\n\n' +
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

// ── אינדקס גלובלי של שמות-מוסדות (חוצה-שדות) ──
// לצורך הודעות שמזכירות מוסד ספציפי בשם, בלי לנקוב שום תחום-לימוד — לדוגמה
// תשובת-המשך קצרה כמו "אורנים" בתגובה לשאלה "לאיזה מוסד נרשמת?". הזיהוי
// הרגיל (getFieldKeywords/searchQA) לא היה תופס את זה בכלל, כי הוא מבוסס
// כולו על מילות-מפתח של *שדה*, לא על שמות-מוסדות. "עוגן" לכל מוסד הוא
// המקטע שלפני המפריד הראשון בכותרת (למשל "אורנים" מתוך "אורנים, היחידה
// ללימודי תעודה...") — כי זה בדרך-כלל השם הייחודי בפועל, לא התיאור הכללי
// שאחריו.
let _institutionNameIndex = null;
function getInstitutionNameIndex() {
  if (_institutionNameIndex) return _institutionNameIndex;
  const sf = loadJSON('study-fields.json');
  const byUrl = new Map();
  for (const f of (sf && sf.studyFields) || []) {
    for (const ki of f.known_institutions || []) {
      if (!ki.title || !ki.url) continue;
      const anchor = ki.title.split(/[-–,]/)[0].trim();
      if (anchor.length < 3) continue;
      if (!byUrl.has(ki.url)) byUrl.set(ki.url, { title: ki.title, url: ki.url, anchor, fields: [] });
      byUrl.get(ki.url).fields.push(f.name);
    }
  }
  _institutionNameIndex = [...byUrl.values()];
  return _institutionNameIndex;
}
function findInstitutionsByNameInMessage(message) {
  const msgL = (message || '').toLowerCase();
  const matches = getInstitutionNameIndex().filter(entry => msgL.includes(entry.anchor.toLowerCase()));
  matches.sort((a, b) => b.anchor.length - a.anchor.length); // עוגן ארוך/ספציפי יותר קודם
  return matches;
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

// ── חילוץ "מונחים ספציפיים" מתוך הודעה (מילים/צירופי-מילים שאינם stopwords ──
// או שם השדה עצמו). זהו עותק מכוון (לא refactor) של לוגיקת חילוץ המועמדים
// שבתוך filterInstitutionsBySpecificTerm — נשמר נפרד ולא מוזג לתוכה כדי לא
// לגעת בפונקציה הקיימת (שמכוונת בעדינות רבה למקרי-קצה רבים, ראו התיעוד שם).
// משמש רק לסינון שורות-תיאור בתוך מוסד (filterDescriptionLinesByTerms) —
// לא לבחירת אילו מוסדות להציג, לכן אין כאן צורך במנגנוני fallback/OR/best-match.
function extractSpecificTerms(message, fieldOwnKeywords) {
  const msgL = message.toLowerCase();
  const stopwords = new Set([
    'קורס','קורסי','קורסים','לימודי','לימוד','לימודים','בתחום','אזור','מה','יש','של',
    'על','עם','גם','כל','אני','את','אתה','אילו','איזה','מוסדות','שמציעים',
    'מציעים','להציג','רק','ללא','תלות','להלן','שלהלן','בפורטל','שבתון','באמצעות',
    'מקוון','מרחוק','אונליין','online','היברידי','זום','סינכרוני','א-סינכרוני',
    'שש','חובה','רשות','נקודות','שעות','ש"ש',
    'ללמוד','למוד','ולמוד','ללמד','ולמד','להכשיר','לרכוש','לפתח','לרכוש',
    'באיזור','באזור','איזור','אזור','פרדס','כרכור','רכור','חנה','פרונטלי','פרונטל','פנים',
    'ירושלים','תל אביב','חיפה','באר שבע'
  ]);
  const fieldNameWords = new Set(
    ((fieldOwnKeywords || [])[0] || '').toLowerCase().match(/[\u05D0-\u05EA]{2,}/g) || []
  );
  const rawWords = (msgL.match(/[\u05D0-\u05EA]{2,}|[a-z]{2,}/gi) || []);
  const isStop = (w) => {
    if (stopwords.has(w) || fieldNameWords.has(w)) return true;
    for (let n = 1; n <= 2; n++) {
      const stripped = w.slice(n);
      if (stripped.length >= 2 && (stopwords.has(stripped) || fieldNameWords.has(stripped)) &&
          /^[בלמכהוש]{1,2}$/.test(w.slice(0, n))) {
        return true;
      }
    }
    return false;
  };
  const stripPrefix = (w) => {
    if (w.length < 5) return w;
    const rest = w.slice(1);
    if (rest.length >= 3 && /^[בלמכהוש]$/.test(w[0])) return rest;
    if (w.length >= 6) {
      const rest2 = w.slice(2);
      if (rest2.length >= 3 && /^[בלמכהוש]{2}$/.test(w.slice(0,2))) return rest2;
    }
    return w;
  };
  const candidates = [];
  for (let i = 0; i < rawWords.length - 1; i++) {
    const w1 = rawWords[i], w2 = rawWords[i+1];
    if (isStop(w1) || isStop(w2)) continue;
    candidates.push(w1 + ' ' + w2);
  }
  const singleWords = rawWords.filter(w => {
    const isLatin = /^[a-z]+$/i.test(w);
    return (isLatin ? w.length >= 2 : w.length >= 4) && !isStop(w);
  }).map(stripPrefix);
  candidates.push(...singleWords);
  // שם אדם עם תואר מקצועי ("ד"ר X") — מונח ספציפי מאוד גם לסינון שורות
  const titledNameMatch = msgL.match(/(?:דוקטור|ד"ר|ד'ר|פרופ'|פרופסור)\s+([\u05D0-\u05EA]{2,}(?:\s+[\u05D0-\u05EA]{2,}){0,2})/);
  if (titledNameMatch) candidates.push(titledNameMatch[1].trim());
  return [...new Set(candidates)];
}

// ── משאיר, מתוך תיאור מוסד מרובה-שורות (קורס אחד לכל שורה בד"כ), רק את ──
// השורות שמכילות לפחות אחד מהמונחים הספציפיים שחולצו מהשאלה. כך במקום
// להציג תחת כל מוסד את *כל* הקורסים שלו בתחום, מציגים רק את הקורס/ים
// שרלוונטיים בפועל לחיפוש של הגולש.
// נופל חזרה לתיאור המלא כשאין מה לסנן (שאילתה כללית על התחום), כשיש רק
// שורה אחת ממילא, או כשאף שורה לא תואמת (למשל כשהמונח מופיע רק בכותרת
// המוסד עצמו ולא בפירוט הקורסים) — עדיף מוסד עם "יותר מדי" מידע מאשר
// תיאור ריק, בהתאם לכלל הברזל "אסור להמציא / אסור למחוק מידע קיים".
function filterDescriptionLinesByTerms(description, terms) {
  if (!description || !terms || terms.length === 0) return description;
  const lines = description.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return description;
  const termAliases = { 'אומנות': ['אומנות','אמנות'], 'אמנות': ['אמנות','אומנות'],
    'טיפולי': ['טיפולי','טיפול','טיפולית','תרפיה'], 'טיפולית': ['טיפולית','טיפול','טיפולי','תרפיה'],
    'תרפיה': ['תרפיה','טיפול','טיפולי','טיפולית'] };
  // התאמה סובלנית ליחיד/רבים: "סמינרים" (מהשאלה) צריך למצוא גם שורות "סמינר X"
  // (יחיד, כמו שכל קורס/סמינר בודד רשום). מסירים סיומת ים/ות כשהמילה עדיין
  // מספיק ארוכה כדי לא ליצור התאמות מקריות עם מילים קצרות לא-קשורות.
  const pluralInsensitive = (t) => {
    const variants = [t];
    if (t.endsWith('ים') && t.length > 5) variants.push(t.slice(0, -2));
    if (t.endsWith('ות') && t.length > 5) variants.push(t.slice(0, -2));
    return variants;
  };
  const expandedTerms = [...new Set(terms.flatMap(t => (termAliases[t.toLowerCase()] || [t]).flatMap(pluralInsensitive)))]
    .map(t => t.toLowerCase()).filter(t => t.length >= 2);
  if (expandedTerms.length === 0) return description;
  const matching = lines.filter(line => {
    const lineL = line.toLowerCase();
    return expandedTerms.some(t => lineL.includes(t));
  });
  return matching.length > 0 ? matching.join('\n') : description;
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
    'מציעים','להציג','רק','ללא','תלות','להלן','שלהלן','בפורטל','שבתון','באמצעות',
    // מילות אמצעי-לימוד — מתארות איך ללמוד, לא מה ללמוד
    'מקוון','מרחוק','אונליין','online','היברידי','זום','סינכרוני','א-סינכרוני',
    // מילות ש"ש ופורמט — לא נושא
    'שש','חובה','רשות','נקודות','שעות','ש"ש',
    // מילות פעולה לימודיות כלליות — לא נושא
    'ללמוד','למוד','ולמוד','ללמד','ולמד','להכשיר','לרכוש','לפתח','לרכוש',
    // מילות אזור/מיקום — לא נושא לימוד
    'באיזור','באזור','איזור','אזור','פרדס','כרכור','רכור','חנה','פרונטלי','פרונטל','פנים',
    'ירושלים','תל אביב','חיפה','באר שבע'
  ]);
  // מילים שהן חלק משם התחום עצמו — לא נחשבות "מונח מייחד".
  // חשוב: משתמשים רק במילות שם השדה (fieldOwnKeywords[0] = שם השדה), לא בכל ה-keywords.
  // אחרת מונחי-משנה ספציפיים כמו "נגרות" (keyword של "אמנות ואומנויות") יוחרגו בטעות
  // ולא ישמשו לסינון, מה שגורם להצגת כל התחום במקום רק מוסדות הנגרות.
  const fieldNameWords = new Set(
    ((fieldOwnKeywords || [])[0] || '').toLowerCase().match(/[\u05D0-\u05EA]{2,}/g) || []
  );
  const fieldWordsL = fieldNameWords;
  // מילים גולמיות לפי סדר הופעה — עברית + לטינית (כדי לתפוס "AI", "NLP", "CBT" וכו')
  const rawWords = (msgL.match(/[\u05D0-\u05EA]{2,}|[a-z]{2,}/gi) || []);
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
  // מנרמל מילה על ידי הסרת תחילית עברית (ב/ל/מ/כ/ה/ו/ש) כשהיא מקדימה שורש ≥3 אותיות.
  // בלי זה, "במוזיאון" לא יתאים ל-"מוזיאון" בתיאורי המוסדות.
  const stripPrefix = (w) => {
    if (w.length < 5) return w;
    const rest = w.slice(1);
    if (rest.length >= 3 && /^[בלמכהוש]$/.test(w[0])) return rest;
    if (w.length >= 6) {
      const rest2 = w.slice(2);
      if (rest2.length >= 3 && /^[בלמכהוש]{2}$/.test(w.slice(0,2))) return rest2;
    }
    return w;
  };
  const singleWords = [...new Set(rawWords.filter(w => {
    const isLatin = /^[a-z]+$/i.test(w);
    return (isLatin ? w.length >= 2 : w.length >= 4) && !isStop(w);
  }).map(stripPrefix))];
  candidates.push(...singleWords);

  // ── שם אדם עם תואר מקצועי ("ד"ר X", "דוקטור X", "פרופ' X") ──
  // שם מלווה בתואר הוא סימן חד-משמעי לזהות מוסד ספציפי — בדרך כלל מוסד
  // הנקרא על שם אותו אדם. אם השם מופיע ב-**כותרת** של מוסד (לא רק
  // בתיאור שלו — כי אדם יכול להיות מוזכר בתיאור של מוסד אחר כמרצה אורח,
  // כמו "קורסים עם ד"ר X" תחת מוסד אחר), זו כמעט ודאות שזה המוסד המבוקש.
  // לכן זה מוכרע באופן החלטי *לפני* מנגנון "ההתאמה הצרה ביותר" הרגיל —
  // אחרת ביטוי-נושא מקרי (כמו "בשפה וחשבון") עלול "לנצח" רק כי הוא נותן
  // צמצום מספרי צר יותר, למרות שהשם המפורש הוא הסימן האמין יותר.
  const titledNameMatch = msgL.match(/(?:דוקטור|ד"ר|ד'ר|פרופ'|פרופסור)\s+([\u05D0-\u05EA]{2,}(?:\s+[\u05D0-\u05EA]{2,}){0,2})/);
  if (titledNameMatch) {
    const fullName = titledNameMatch[1].trim();
    const titleOnlyMatches = institutions.filter(ki => (ki.title || '').toLowerCase().includes(fullName));
    if (titleOnlyMatches.length > 0 && titleOnlyMatches.length < institutions.length) {
      console.log('TITLED NAME MATCH (institution title):', fullName, '→', titleOnlyMatches.length, '/', institutions.length);
      return { result: titleOnlyMatches, noMatchForSpecificTerm: false, matchedTerm: fullName };
    }
  }

  if (candidates.length === 0) return { result: institutions, noMatchForSpecificTerm: false };

  // ── OR logic: כשיש "או" בהודעה, מחפשים לפי כל חלק בנפרד ומאחדים ──
  // "פסיכולוגיה חיובית או ACT" → מוסדות שיש בהם פסיכולוגיה חיובית + מוסדות עם ACT
  const orParts = msgL.split(/\s+(?:או|or)\s+/i).filter(p => p.trim());
  if (orParts.length > 1) {
    const seenUrls = new Set();
    const orMatched = [];
    for (const part of orParts) {
      const partWords = (part.match(/[\u05D0-\u05EA]{2,}|[a-zA-Z]{2,}/g) || [])
        .filter(w => w.length >= 2 && !isStop(w.toLowerCase())).map(stripPrefix);
      const partRaw = part.match(/[a-zA-Z]{2,}/g) || []; // גם מילים לטיניות
      const allPartTerms = [...new Set([...partWords, ...partRaw.map(w => w.toLowerCase())])];
      if (allPartTerms.length === 0) continue;
      for (const ki of institutions) {
        if (seenUrls.has(ki.url)) continue;
        const text = ((ki.title||'') + ' ' + (ki.description||'')).toLowerCase();
        const matched = allPartTerms.some(term => term.length >= 2 && text.includes(term));
        if (matched) {
          orMatched.push(ki);
          seenUrls.add(ki.url);
        }
      }
    }
    if (orMatched.length > 0 && orMatched.length < institutions.length) {
      console.log('OR FILTER:', orParts.map(p=>p.trim()).join(' | '), '→', orMatched.length, '/', institutions.length);
      return { result: orMatched, noMatchForSpecificTerm: false };
    }
  }

  // בודקים את כל המועמדים, ובוחרים את ההתאמה הצרה ביותר (לא הראשונה שנמצאה)
  // aliasing: מונחים עם וריאציות נפוצות
  const termAliases = { 'אומנות': ['אומנות','אמנות'], 'אמנות': ['אמנות','אומנות'],
    'טיפולי': ['טיפולי','טיפול','טיפולית','תרפיה'], 'טיפולית': ['טיפולית','טיפול','טיפולי','תרפיה'],
    'תרפיה': ['תרפיה','טיפול','טיפולי','טיפולית'] };
  // נצפה בפרודקשן: מוסד "אקו פלייבק" משתמש במילה "תרפיה" (לא "טיפול") בתיאור
  // שלו, ולכן נפל משדה הסינון-הספציפי עבור "קורסי דרמה טיפולית" — 2026-08.
  const hasTermInText = (text, term) => {
    const aliases = termAliases[term] || [term];
    return aliases.some(a => text.includes(a));
  };
  let best = null;
  for (const term of candidates) {
    const matched = institutions.filter(ki => {
      const text = ((ki.title||'') + ' ' + (ki.description||'')).toLowerCase();
      return hasTermInText(text, term);
    });
    if (matched.length > 0 && matched.length < institutions.length) {
      if (!best || matched.length < best.matched.length) {
        best = { matched, term };
      }
    }
  }
  if (best) {
    console.log('SPECIFIC TERM FILTER:', best.term, '|', best.matched.length, '/', institutions.length, 'institutions');
    return { result: best.matched, noMatchForSpecificTerm: false, matchedTerm: best.term };
  }
  // היו מילים ספציפיות בשאלה (לא רק עיון כללי בתחום), אבל שום מוסד לא הכיל אותן —
  // כנראה נושא-משנה שלא קיים במאגר (כמו "ארומתרפיה"). מסמנים את זה לקורא,
  // כדי שיוכל להציע מוסד-ברירת-מחדל לתחום במקום רשימה לא-קשורה.
  return { result: institutions, noMatchForSpecificTerm: true };
}

// מסיר תיאורי-תנאי-קדם ("לבעלי תעודת הוראה ותואר שני") מהודעה לפני התאמת תחום —
// אלה מתארים את מבקש השאלה (קהל המטרה), לא את נושא הלימוד המבוקש, ולכן לא
// צריכים "לנצח" במנגנון "המילה הארוכה ביותר מנצחת" על חשבון הנושא האמיתי
// (לדוגמה: "בימוי תיאטרון לבעלי תעודת הוראה ותואר שני" אמור להתאים לתיאטרון,
// לא ל"תעודת הוראה" או "תואר שני" שהן רק תנאי-קדם). משמש בכל מקומות התאמת
// התחום (getFieldSlug, knownOnly, filterInstitutionsBySpecificTerm) כדי שהתוצאה
// תהיה עקבית בכל הקוד.
//
// בנוסף: מסיר גם אזכורים – בכל מקום בהודעה, לא רק כסיומת – של תואר שהמבקש/ת
// כבר *מחזיק/ה* בו כיום ("אני עם תואר שני", "יש לי כבר תואר שני", "בעל/ת
// תואר שני"). גם אלה מתארים רקע קיים של המבקש/ת ולא נושא לימוד מבוקש, ולכן
// לא אמורים לגרום להתאמה שגויה לקטגוריית "תואר שני" כשההודעה בפועל מבקשת
// משהו אחר לגמרי (למשל "קורסים קלים ומקוונים"). לעומת זאת ניסוח כמו "מחפש/ת
// תואר שני" אינו נפגע — הוא לא תואם אף אחד מהתבניות כאן.
// מאתרת ומאחדת את כל שורות התיאור של מוסד (לפי URL) מכל השדות שבהם הוא
// מופיע ב-study-fields.json, ללא כפילויות. משמש את instLookup כדי להציג
// בתשובה גם את פירוט הקורסים בפועל, לא רק כרטיס-קישור יבש.
function getInstitutionDescriptionByUrl(url, message) {
  const sf = loadJSON('study-fields.json');
  if (!sf) return '';
  const seenLines = new Set();
  const allLines = [];
  for (const field of (sf.studyFields || [])) {
    for (const ki of (field.known_institutions || [])) {
      if (ki.url !== url) continue;
      const lines = (ki.description || '').split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (!seenLines.has(line)) { seenLines.add(line); allLines.push(line); }
      }
    }
  }
  if (allLines.length === 0) return '';
  const fullDesc = allLines.join('\n');
  const terms = extractSpecificTerms(message, []);
  const filtered = filterDescriptionLinesByTerms(fullDesc, terms);
  return smartTruncate(cleanDescription(filtered), 800).trim();
}


function stripPrerequisiteQualifiers(message) {
  let stripped = message.replace(/ל?בעלי\s+[^.?!]*$/u, '').trim();
  stripped = stripped.replace(
    /(אני\s+)?(עם|יש\s+לי\s+כבר|יש\s+לי|כבר\s+יש\s+לי|כבר\s+סיימתי|כבר\s+עשיתי|כבר\s+השלמתי|בעל|בעלת)\s+תואר\s+(שני|שלישי|ראשון)/gu,
    ''
  ).trim();
  return stripped || message;
}

function getFieldSlug(question) {
  try {
    const data = loadJSON('study-fields.json');
    if (!data) return null;
    const items = data.studyFields || (Array.isArray(data) ? data : []);
    const qL = stripPrerequisiteQualifiers(question).toLowerCase();
    // בוחר את ה-keyword הארוך ביותר שמתאים — לא את ההתאמה הראשונה לפי סדר הקובץ
    // (עקבי עם הלוגיקה ב-knownOnly/searchQA/lookupInstitution).
    // עבור keywords קצרים (4 תווים ומטה) — דורש גבול מילה, כי הם עלולים
    // להתאים בטעות כ-substring בתוך מילה לא קשורה (כמו "קוד" בתוך "הנקודות").
    // ── "למידה מרחוק" מפסיד תיקו-באורך, אבל עדיין מנצח בזכות אורך אמיתי ──
    // נצפה בפרודקשן: "קורס גיטרה מקוון" הציג רשימה ענקית של *כל* קורסי
    // הלמידה-מרחוק במקום קורסי גיטרה, כי "מקוון" ו"גיטרה" שניהם 5 תווים —
    // תיקו באורך שהוכרע לפי סדר-איטרציה גרידא (למידה מרחוק מופיע קודם
    // בקובץ). "למידה מרחוק" הוא תיאור-אופן-למידה חוצה-שדות, לא נושא-לימוד
    // עצמאי, ולכן לא אמור לנצח תיקו-באורך מול נושא אמיתי. אבל הוא כן צריך
    // להמשיך לנצח כרגיל כשה-keyword שלו ארוך/ספציפי יותר בפועל (למשל מול
    // "למידה" הבודדת של שדה אחר — ניסיון קודם לתקן את זה בלי להתחשב
    // באורך בכלל שבר את זה, ותוקן כאן ל-tie-break בלבד).
    let best = null;
    let bestLen = 0;
    for (const f of items) {
      const kws = f.keywords || [];
      for (const k of kws) {
        const kL = k.toLowerCase();
        const isMatch = k.length <= 4 ? wordBoundaryIncludes(qL, kL) : qL.includes(kL);
        if (!isMatch) continue;
        const isBetter = k.length > bestLen ||
          (k.length === bestLen && best && best.name === 'למידה מרחוק' && f.name !== 'למידה מרחוק');
        if (isBetter) {
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
// jerusalem, shfea-darom, results-merkaz). היחיד שלא: "למידה מרחוק"
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
    // ── בוחר לפי אורך ה-keyword התואם הארוך ביותר, לא ראשון-בסדר-הקובץ ──
    // "למידה מרחוק" מפסיד רק בתיקו-מדויק-באורך (אותה סיבה כמו ב-getFieldSlug:
    // תיאור-אופן-למידה חוצה-שדות, לא נושא עצמאי) — אבל עדיין מנצח כרגיל
    // כשה-keyword שלו ארוך/ספציפי יותר בפועל (כמו מול "למידה" הבודדת של
    // שדה אחר). ניסיון קודם בלי השוואת-אורך בכלל שבר את המקרה הזה.
    let bestField = null;
    let bestLen = 0;
    for (const f of items) {
      const kws = f.keywords || [];
      for (const k of kws) {
        if (!qL.includes(k.toLowerCase())) continue;
        const isBetter = k.length > bestLen ||
          (k.length === bestLen && bestField && bestField.name === 'למידה מרחוק' && f.name !== 'למידה מרחוק');
        if (isBetter) { bestLen = k.length; bestField = f; }
      }
    }
    if (bestField) {
      const kws = bestField.keywords || [];
      return kws.map(k => k.toLowerCase()).filter(k => k.length > 2 && (kwCount[k] || 0) === 1);
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
  const filtered = filterExcludedResults(results, extractExclusionTerms(message));
  return filtered.sort((a,b) => b.score - a.score).slice(0, 25);
}

// ── מחשבון המרת שעות קורס לש"ש ──
// עונה רק כשמזוהה בבירור בקשת המרה לש"ש (לא שאלות כלליות כמו "מה זה ש"ש",
// שאלה כזו ממשיכה לטפל בה ה-QA הקיים). אין חלקי ש"ש — התוצאה תמיד מעוגלת
// כלפי מטה. אין הפניה ליועצת קרן ההשתלמות — לשאלות/אימות נוסף מפנים
// לקבוצת הוואטסאפ של שבתון בלבד.
const SHASH_WHATSAPP_LINK = 'https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME';
const SHASH_ACADEMIC_MINUTES = 45; // דקות בשעה אקדמית אחת
const SHASH_HOURS_PER_UNIT = 28;   // שעות אקדמיות ב-1 ש"ש

function tryCalculateShaShFromMessage(message) {
  const m = message || '';
  // חייב להזכיר ש"ש במפורש — לא מטפלים בשאלות כלליות שלא ביקשו המרה
  const mentionsShaSh = /ש"ש|ש''ש|שעה שבועית|שעות שבועיות/.test(m);
  if (!mentionsShaSh) return null;
  // חייב להכיל תיאור של משך הקורס (מפגשים/שעות/דקות) — אחרת זו שאלה כללית
  // ("מה זה ש"ש", "כמה שעות רשות צריך") ולא בקשת חישוב, ויש להשאיר את זה ל-QA הרגיל
  const hasTimingWords = /מפגש|מפגשים|דקות|שעות\s*אקדמי|שעות\s*לימוד/.test(m);
  if (!hasTimingWords) return null;

  const meetingsMatch = m.match(/(\d+)\s*מפגשים/);
  const hoursPerMeetingMatch = m.match(/(\d+)\s*שעות(?:\s*של)?/);
  const minutesMatch = m.match(/(\d+)\s*דקות/);
  const academicHoursDirectMatch = m.match(/(\d+)\s*שעות\s*אקדמי/);

  let totalMinutes = null;

  if (meetingsMatch && hoursPerMeetingMatch) {
    // תבנית: X מפגשים, Y שעות במפגש, Z דקות לשעה (ברירת מחדל 60 דקות אם לא צוין)
    const meetings = parseInt(meetingsMatch[1], 10);
    const hoursPerMeeting = parseInt(hoursPerMeetingMatch[1], 10);
    const minutesPerHour = minutesMatch ? parseInt(minutesMatch[1], 10) : 60;
    totalMinutes = meetings * hoursPerMeeting * minutesPerHour;
  } else if (academicHoursDirectMatch) {
    // תבנית: X שעות אקדמיות ישירות
    totalMinutes = parseInt(academicHoursDirectMatch[1], 10) * SHASH_ACADEMIC_MINUTES;
  } else if (minutesMatch && !meetingsMatch) {
    // תבנית: X דקות בסה"כ, ללא מפגשים/שעות
    totalMinutes = parseInt(minutesMatch[1], 10);
  }

  if (totalMinutes === null || isNaN(totalMinutes) || totalMinutes <= 0) {
    // זוהתה בקשת המרה, אך לא ניתן היה לחלץ נתונים ברורים מההודעה —
    // מחזירים את כלל ההמרה הכללי בלבד, ומפנים לקבוצת הוואטסאפ (לא ליועצת קרן)
    return '📐 **כלל ההמרה לש"ש:**\n\n' +
      `• שעה אקדמית = ${SHASH_ACADEMIC_MINUTES} דקות\n` +
      `• 1 ש"ש = ${SHASH_HOURS_PER_UNIT} שעות אקדמיות\n\n` +
      'לא הצלחתי לזהות בבירור את מספר המפגשים ואורך כל מפגש מההודעה שלך.\n\n' +
      `אפשר לשלוח את הפרטים המדויקים (מספר מפגשים, אורך כל מפגש) [בקבוצת הוואטסאפ של שבתון](${SHASH_WHATSAPP_LINK}) ונעזור בחישוב.`;
  }

  const academicHours = totalMinutes / SHASH_ACADEMIC_MINUTES;
  const shaShFloor = Math.floor(academicHours / SHASH_HOURS_PER_UNIT);

  return '📐 **חישוב ש"ש:**\n\n' +
    `• סה"כ דקות לימוד: ${totalMinutes}\n` +
    `• שעות אקדמיות (${SHASH_ACADEMIC_MINUTES} דקות כל אחת): ${academicHours.toFixed(2)}\n` +
    `• ש"ש (${SHASH_HOURS_PER_UNIT} שעות אקדמיות = 1 ש"ש): **${shaShFloor} ש"ש**\n\n` +
    '⚠️ אין חלקי ש"ש — התוצאה מעוגלת תמיד כלפי מטה.\n\n' +
    `לאימות סופי ולשאלות נוספות [אפשר לפנות לקבוצת הוואטסאפ של שבתון](${SHASH_WHATSAPP_LINK}).`;
}

// ── חיפוש תאריך פתיחה לקורס ספציפי ──
// כשנשאלים "מתי נפתח קורס X", מחלצים את שם הקורס ומחפשים אותו כטקסט חופשי
// בתוך course-dates.json (לא רק לפי כותרת מוסד — גם בתוך הבלוקים המרוכזים
// של כמה קורסים תחת אותו מוסד/חודש). אם נמצא תאריך מפורש — מחזירים אותו.
// אם לא נמצא תאריך אבל הקורס מזוהה תחת מוסד ידוע (לפי study-fields.json) —
// מפנים לדף המוסד ומציעים לפנות לברור המועד, במקום להשאיר בלי תשובה או
// להחזיר תוצאות לא קשורות. הערה: נמנעים במכוון מ-\b על טקסט עברי — הוא לא
// מזהה אותיות עבריות כתווי-מילה ונכשל בשקט (בדיוק כמו הבאג שתוקן במקומות
// אחרים בקובץ הזה).
function tryFindCourseOpeningDate(message) {
  const msgL = message.toLowerCase();
  const isDateQuestion = /מתי\s*נפתח|מתי\s*מתחיל|תאריך\s*פתיחה|באיזה\s*תאריך|מועד\s*פתיחה|מתי\s*מתחילים|מתי\s*יוצא/.test(msgL);
  if (!isDateQuestion) return null;

  let courseQuery = message
    .replace(/מתי\s*נפתח/g, '')
    .replace(/מתי\s*מתחיל(ים)?/g, '')
    .replace(/תאריך\s*פתיחה\s*(של)?/g, '')
    .replace(/באיזה\s*תאריך/g, '')
    .replace(/מועד\s*פתיחה\s*(של)?/g, '')
    .replace(/מתי\s*יוצא/g, '')
    .replace(/הקורס(?=\s|$)/g, '')
    .replace(/^\s*(של\s+)?/g, '')
    .replace(/^\s*קורס(?=\s|$)\s*/g, '')
    .replace(/^\s*ה(?=[א-ת])/g, '')
    .trim();
  courseQuery = courseQuery.replace(/[?!.,]+$/g, '').trim();
  if (courseQuery.length < 3) return null; // אין שם קורס ברור מספיק לחיפוש

  const courseQueryL = courseQuery.toLowerCase();

  // 1. חיפוש שורה-שורה בתוך course-dates.json — כולל בתוך בלוקים מרוכזים
  const datesData = loadJSON('course-dates.json');
  if (datesData && datesData.courses) {
    for (const c of datesData.courses) {
      for (const o of (c.openings || [])) {
        const courseNameText = o.course_name || '';
        const lines = courseNameText.split('\n');
        for (const line of lines) {
          if (line.trim() && line.toLowerCase().includes(courseQueryL)) {
            return `📅 **${courseQuery}**\n\n${line.trim()}\n\n[פנו למידע ולייעוץ אישי](${c.url})`;
          }
        }
      }
    }
  }

  // 2. לא נמצא תאריך מפורש — בודקים אם הקורס מזוהה תחת מוסד ידוע
  const sfData = loadJSON('study-fields.json');
  if (sfData && sfData.studyFields) {
    for (const field of sfData.studyFields) {
      for (const inst of (field.known_institutions || [])) {
        const desc = (inst.description || '').toLowerCase();
        if (desc.includes(courseQueryL)) {
          return `לא מצאתי תאריך פתיחה מפורש לקורס **${courseQuery}** כרגע.\n\n` +
            `הקורס מוצע על ידי **[${inst.title}](${inst.url})** — ` +
            `מומלץ לפנות ישירות דרך הדף שלהם לברור המועד המדויק.\n\n` +
            `[פנו למידע ולייעוץ אישי](${inst.url})`;
        }
      }
    }
  }

  // 3. לא נמצא בשום מקום — משאירים לזרימה הרגילה לטפל (לא עונים ישירות)
  return null;
}

// ── חילוץ "חריגי החרגה" מהודעה — "חוץ מ-X", "מלבד X", "לא כולל X" וכו' ──
// כשמישהי מבקשת "חוץ ממרכז החומר, איפה עוד אפשר ללמוד אמנות?" היא לא רוצה
// לראות שוב את מרכז החומר ברשימת התוצאות. מחזיר מערך של מחרוזות (באותיות
// קטנות) שיש לסנן מכל רשימת מוסדות/קורסים לפני הצגתה.
function extractExclusionTerms(message) {
  const excluded = [];
  const patterns = [
    /חוץ\s*מ-?\s*([^.,!?\n]+)/g,
    /מלבד\s+([^.,!?\n]+)/g,
    /לא\s*כולל\s+([^.,!?\n]+)/g,
    /פרט\s*ל-?\s*([^.,!?\n]+)/g,
    /בלי\s+([^.,!?\n]+)/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(message)) !== null) {
      let term = m[1].trim().replace(/[?!.,]+$/, '').trim();
      // חותכים במילת עצירה טבעית אם יש (כדי לא לחתוך משפט שלם בטעות)
      term = term.split(/\s+(?:איפה|היכן|מה|אילו|מי|כיצד|איך)\b/)[0].trim();
      if (term.length >= 2) excluded.push(term.toLowerCase());
    }
  }
  return excluded;
}

// מסנן רשימת מוסדות/תוצאות לפי חריגי ההחרגה שחולצו מההודעה. פועל על כל
// שדה טקסט סביר (title/url) כדי לתפוס גם ניסוח חלקי של שם המוסד.
// לא מסתפקים בהתאמת-תת-מחרוזת מלאה: "חוץ ממרכז החומר בחולון" מחלץ את
// הביטוי "מרכז החומר בחולון" (כולל העיר, שהיא הקשר ולא חלק משם המוסד),
// בעוד שהכותרת בפועל היא "מרכז החומר - סדנת אמנויות בחולון" — אין שם
// התאמת-תת-מחרוזת מלאה כי "בחולון" לא צמוד ל"החומר" בכותרת. לכן מנסים
// גם קידומות הולכות ומתקצרות של הביטוי (ממילה אחרונה כלפי פנים) עד
// שנמצאת התאמה, כדי לתפוס את גרעין שם המוסד גם כשיש טקסט נוסף בין
// החלקים בכותרת האמיתית.
function filterExcludedResults(list, excludeTerms) {
  if (!excludeTerms || excludeTerms.length === 0 || !list || list.length === 0) return list;
  return list.filter(item => {
    const hay = ((item.title || '') + ' ' + (item.url || '')).toLowerCase();
    return !excludeTerms.some(term => {
      if (hay.includes(term)) return true;
      const words = term.split(/\s+/).filter(Boolean);
      for (let cut = words.length; cut >= Math.min(2, words.length); cut--) {
        const prefix = words.slice(0, cut).join(' ');
        if (prefix.length >= 3 && hay.includes(prefix)) return true;
      }
      return false;
    });
  });
}

function detectInfoPages(question) {
  const q = question.toLowerCase();
  const pages = [
    { kw: ['רשימת משימות','צ\'קליסט','כיצד מתחילים','איך מתחילים','תהליך יציאה','איך יוצאים לשבתון','מה לעשות לפני שבתון'], url: 'https://www.shabaton.online/shabaton_checklist' },
    { kw: ['תכנון','תוכנית לימודים','תכנית לימודים','תוכנית הלימודים','תכנית הלימודים','טבלת עזר','הרכבת תוכנית','מתכנן','מתכננים','לתכנן','איך מרכיב','בניית תוכנית','תכנון לימודים','להרכיב תוכנית','מה ללמוד בשבתון','כמה שעות ללמוד','לימוד בשבתון','לימודי חובה ורשות','לימודי רשות','מוסדות מאושרים ללמוד','חובות לימודים','שעות חובה','שעות השלמה','שעות רשות','לימודי חובה','לימודי השלמה','ספורט בשבתון','שינוי תוכנית','אופק חדש בשבתון','גמול השתלמות','מסלול אישי','פרויקט אישי','לימודים בחו"ל'], urls: ['https://www.shabaton.online/shabaton-plan','https://www.shabaton.online/learning_programs_shabaton'] },
    { kw: ['חובות לימודים','שעות חובה','שעות השלמה','שעות רשות','ש"ש רשות','ש"ש חובה','רשות בשבתון','כמה רשות','לימודי חובה','לימודי השלמה','מוסדות מאושרים','נושאי השתלמות','ספורט בשבתון','שינוי תוכנית','אופק חדש','תואר שלישי','דוקטורט','גמול השתלמות','מסלול אישי','פרויקט אישי','ישיבה','לימודים בחו"ל','לימודים בחול','תוכנית לימודים','תוכנית הלימודים','תכנית הלימודים','להרכיב תוכנית','הרכבת תוכנית','בניית תוכנית','מה ללמוד','כמה שעות','תכנית לימודים','לימוד בשבתון','לימודי רשות','לימודי חובה ורשות','מוסדות ללמוד','מוכר לשבתון','הכרה במוסד','האם מוכר','מוסד מוכר','קורס מוכר','מוכרת לשבתון','תוכנית הלימודים אושרה','תכנית הלימודים אושרה','אישור תוכנית הלימודים','אישור תכנית הלימודים','אישור הקרן','התוכנית אושרה','התכנית אושרה','אושרה על ידי הקרן','פורטל עובדי הוראה'], url: 'https://www.shabaton.online/learning_programs_shabaton' },
    { kw: ['לוח זמנים','מועדים','בקשת שבתון','אישור זכאות','מתי מגישים','מתי להגיש','מערכת הגשה'], url: 'https://www.shabaton.online/luz_shabaton' },
    { kw: ['טלפון','טלפונית','לדבר עם יועץ','יועץ טלפוני','יועצת השתלמות','מספר טלפון','כתובת','איך ליצור קשר','יצירת קשר','ליצור קשר','לדבר עם מישהו','לדבר עם נציג','הסתדרות המורים','ארגון המורים','ארגון המורים העל יסודיים','בנק בינלאומי','ועדת חריגים','ועדת השתלמויות','אגף השתלמויות','מינהלת אופק חדש'], url: 'https://www.shabaton.online/phones_shabaton' },
    { kw: ['תיאום מס','מס הכנסה','טופס 101 מס','החזר מס','פטור ממס'], url: 'https://www.shabaton.online/Payments_shabaton#1989197642' },
    { kw: ['ביטוח לאומי','דמי ביטוח','תשלום ביטוח','ביטוח לאומי בשבתון'], url: 'https://www.shabaton.online/btl_shabaton' },
    { kw: ['קבלות','קבלה להחזר','קבלות שכר לימוד'], url: 'https://www.shabaton.online/kabalot_shabaton' },
    { kw: ['החזר שכר לימוד','החזר שכ"ל','החזר שכל','כמה מחזירים','החזר לימודים','כמה מקבלים חזרה','חזרה על שכר לימוד','כמה מקבלים חזרה על שכר לימוד','כמה מחזירים על שכר לימוד','כמה מקבלים על שכר לימוד','החזר על שכר לימוד','כמה מקבלים על לימודים','החזר כספי','ההחזר הכספי'], url: 'https://www.shabaton.online/tuition_reimbursement' },
    { kw: ['מענק','כמה מענק','גובה מענק','מענק חודשי','חישוב מענק','כמה מרוויחים'], url: 'https://www.shabaton.online/shabaton-maanak' },
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

// מסיר גרשיים/מרכאות (" ' ׳ ״) לפני השוואה — כדי ש-keyword כמו "ש"ש" יתאים
// אוטומטית גם לניסוח בלי גרשיים ("שש"), בלי שיהיה צורך להוסיף ידנית זוג
// keywords בכל פעם שזה קורה עם קיצור חדש. זו נורמליזציה בטוחה לגמרי (אין
// סיכון להתאמת-שווא) בניגוד לנורמליזציית יחיד/רבים או כתיב-מלא/חסר, שדורשות
// הבנה מורפולוגית של עברית ומסוכנות יותר לביצוע גורף.
function stripQuoteMarks(s) {
  return s.replace(/["'׳״]/g, '');
}
function searchQA(question) {
  const qa = loadJSON('shabaton-qa.json');
  if (!qa) return null;
  const qL = stripQuoteMarks(question.toLowerCase());
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
      const kL = stripQuoteMarks(k.toLowerCase());
      const isMatch = kL.length <= 4 ? wordBoundaryIncludes(qL, kL) : qL.includes(kL);
      if (isMatch && kL.length > bestKeywordLength) {
        bestKeywordLength = kL.length;
        bestMatch = q;
      }
    }
  }
  return bestMatch;
}

// ── מחבר relatedLinks בפועל לתשובת QA ──────────────────────────
// עד כה relatedLinks היה שדה "מת": מוגדר בכמה ערכי QA, אבל אף נקודת-קריאה
// בקוד לא באמת הציגה אותו — כל תיקון היה צריך לשכפל קישורים ידנית לתוך
// טקסט ה-answer. הפונקציה הזו מוסיפה בסוף התשובה כל קישור מ-relatedLinks
// שה-URL שלו עדיין *לא* מופיע כבר בטקסט (כדי לא לשכפל קישורים שכבר שוכתבו
// ידנית בתוך ה-answer, כמו ב-QA-ים שנכתבו אחרי הגילוי הזה).
function formatQAAnswer(qa) {
  if (!qa) return '';
  let text = qa.answer || '';
  if (Array.isArray(qa.relatedLinks) && qa.relatedLinks.length > 0) {
    const extraLinks = qa.relatedLinks.filter(l => l && l.url && !text.includes(l.url));
    if (extraLinks.length > 0) {
      text += '\n\n' + extraLinks.map(l => `🔗 [${l.text || l.url}](${l.url})`).join('\n');
    }
  }
  return text;
}

// ── סיווג-QA בעזרת Claude — fallback כשההתאמה הדטרמיניסטית (searchQA) לא
// מצאה כלום. הבעיה שזה בא לפתור: keyword matching נוקשה מפספס ניסוחים
// שונים לאותה כוונה בדיוק (יחיד/רבים, כתיב מלא/חסר, מילים נרדפות) — כל
// מקרה כזה דורש הוספת keyword ידנית *אחרי* שהוא כבר קרה. נותנים ל-Claude
// (מודל קל/מהיר) להשוות את השאלה מול רשימת הנושאים ולזהות התאמה סמנטית,
// בלי תלות בניסוח המדויק. נקרא רק כש-searchQA כבר החזיר null, כדי לא
// להוסיף latency/עלות לרוב הבקשות שכן נתפסות דטרמיניסטית.
async function classifyQAWithClaude(message, apiKey) {
  if (!apiKey) return null;
  const qa = loadJSON('shabaton-qa.json');
  if (!qa) return null;
  const allQ = (qa.categories || []).flatMap(c => c.questions || []);
  if (allQ.length === 0) return null;
  // רשימה קומפקטית: id + השאלה המייצגת בלבד (לא כל ה-variations/keywords —
  // חוסך טוקנים; Claude לא צריך את הרשימה המלאה כדי לזהות כוונה דומה).
  const topicList = allQ.map(q => `${q.id}: ${q.question}`).join('\n');
  const prompt = 'להלן רשימת נושאי-שאלות-נפוצות בבוט "שבתון" (פורמט id: שאלה מייצגת).\n' +
    'קרא את שאלת המשתמש וקבע אם היא תואמת אחד הנושאים — כולל ניסוחים שונים לאותה כוונה (יחיד/רבים, כתיב מלא/חסר, מילים נרדפות, סדר מילים שונה). אל תתאים אם הכוונה שונה במהותה, גם אם יש חפיפת-מילים מקרית.\n\n' +
    'רשימת נושאים:\n' + topicList + '\n\n' +
    'שאלת המשתמש: "' + message + '"\n\n' +
    'השב אך ורק ב-id המדויק אם יש התאמה, או במילה "none" אם אין. בלי שום טקסט נוסף, בלי הסבר.';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) { console.log('QA classify: API status', res.status); return null; }
    const data = await res.json();
    const answer = (data.content && data.content[0] && data.content[0].text || '').trim();
    if (!answer || answer.toLowerCase() === 'none') return null;
    const matched = allQ.find(q => q.id === answer);
    if (!matched) { console.log('QA classify: unrecognized id returned:', answer); return null; }
    console.log('QA CLASSIFY (Claude fallback):', matched.id);
    return matched;
  } catch (e) {
    console.log('QA classify error:', e.message);
    return null;
  }
}

// ── אימות התאמת-שדה בעזרת Claude — רק כשההתאמה ניצחה במילה קצרה/כללית ──
// (עד 6 תווים). זה בדיוק דפוס-הבאגים שנצפה בפועל בשיחה הזו: "בית", "תא",
// "ירו", "ים", "קש", "פנסיה" — כולן מילים קצרות שגם מתאימות בהקשר לגמרי
// אחר. מילים ארוכות וספציפיות ("הוראה מתקנת", "קלפים טיפוליים") כמעט אף
// פעם לא גורמות להתאמות-שווא, ולכן לא עוברות דרך הבדיקה הזו — כדי לא
// להוסיף latency לרוב הבקשות, שכבר מתאימות נכון בלי שום בדיקה נוספת.
async function verifyFieldMatchWithClaude(message, fieldName, matchedKeyword, apiKey) {
  if (!apiKey) return true; // בלי מפתח — לא ניתן לאמת, נותנים אמון בהתאמה כברירת מחדל
  const prompt = 'שאלה של משתמש בבוט "שבתון" (עוזר לעובדי הוראה בנושא לימודים בשנת שבתון) הותאמה לתחום-לימוד "' + fieldName + '" על סמך המילה "' + matchedKeyword + '" שמופיעה בה.\n' +
    'בדוק: האם השאלה באמת מבקשת מידע או קורסים בתחום "' + fieldName + '", או שהמילה "' + matchedKeyword + '" מופיעה בהקשר שונה לגמרי (למשל שאלת מדיניות/זכויות/מנהלה שרק מזכירה את המילה אגב, לא מחפשת קורסים בנושא)?\n\n' +
    'שאלת המשתמש: "' + message + '"\n\n' +
    'השב אך ורק "כן" אם ההתאמה נכונה, או "לא" אם זו התאמת-שווא. בלי שום טקסט נוסף.';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) { console.log('Field verify: API status', res.status); return true; } // בכשל, לא חוסמים
    const data = await res.json();
    const answer = (data.content && data.content[0] && data.content[0].text || '').trim();
    const rejected = answer.includes('לא') && !answer.includes('כן');
    console.log('FIELD VERIFY (Claude):', fieldName, '| keyword:', matchedKeyword, '| answer:', answer, '| result:', rejected ? 'REJECTED' : 'confirmed');
    return !rejected;
  } catch (e) {
    console.log('Field verify error:', e.message);
    return true; // בכשל/timeout, לא חוסמים — ברירת מחדל היא אמון בהתאמה
  }
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

// ── פענוח HTML entities + הסרת תפריט-הניווט הנפוץ מתוכן דפים שנשלף ──
// המקור: fetchPageContent שולף HTML גולמי (בנתיב fallback, כשJina נכשל)
// ומסיר רק תגיות (<...>), לא entities כמו &nbsp;/&quot;/&ndash; — אלה היו
// נשארים כטקסט גולמי ומכוערים בתשובה. כמו כן, הרבה דפים בפורטל כוללים
// widget ניווט קבוע ("מצאו קורסים/מסלולי לימוד... כל האזורים... בחרו
// תחום לימודים...") עם רשימת כל 54 התחומים — לא תוכן, רק תפריט שממלא
// אלפי תווים ודוחק את התוכן האמיתי מחוץ למגבלת האורך.
function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—').replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘').replace(/&rdquo;/gi, '”').replace(/&ldquo;/gi, '“')
    .replace(/&hellip;/gi, '…').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/[ \t]{2,}/g, ' ').trim();
}
function stripNavDropdown(text) {
  if (!text) return text;
  // עוגן על תחילת/סוף התפריט עצמו, לא על מה שבא *אחריו* (שמשתנה בין עמודים).
  // התגלו כמה variants של widgets דומים באתר: לפעמים רשימת-אזורים לפני
  // רשימת-תחומים, לפעמים רשימת-אזורים *לבד* ("בחרו אזור לימודים"), לפעמים
  // בלי רשימת-אזורים כלל. משתמשים ברשימה המפורשת של 5 האזורים (קבועה,
  // בסדר משתנה בין הופעות) — עמיד יותר מהגבלת-אורך גרידא.
  const REGION_NAMES = 'תל.?אביב והמרכז|חיפה והצפון|השפלה והדרום|ירושלים והסביבה|השרון';
  text = text.replace(/(?:מצאו[^]{0,80}?)*כל האזורים[^]{0,300}?השפלה והדרום\s*/g, '');
  text = text.replace(new RegExp('בחרו אזור לימודים(?:\\s*(?:' + REGION_NAMES + '))+\\s*', 'g'), ' ');
  text = text.replace(/[-\s]*בחרו תחום לימודים[^]{0,2200}?(?:תרפיה וטיפול\s*|$)/g, ' ');
  return text.replace(/\s{2,}/g, ' ').trim();
}

async function fetchPageContent(url) {
  // ── חותכים טקסט-גולמי החל מ-offset מסוים בלי לקטוע מילה באמצע ──
  // נצפה בפרודקשן: כש-Jina נכשל (קוד 402, בעיה מתועדת) והנתיב-החלופי
  // (fetch ישיר של ה-HTML) לא מוצא את העוגן שהוא מחפש (מתאים רק לדף
  // תשלומים ספציפי, לא לדפי-מדיניות אחרים), הוא נופל ל-text.substring(800)
  // עיוור — וזה קוטע לפעמים באמצע מילה ממש (לדוגמה "ומהם נושאי ההשתלמות"
  // הפך ל-"ון נושאי ההשתלמות..." בתשובה אמיתית שהוצגה למשתמש) — ב-2026-08.
  const skipToWordBoundary = (t, offset) => {
    if (offset <= 0 || offset >= t.length) return t;
    const nextBreak = t.slice(offset).search(/\s/);
    return nextBreak >= 0 ? t.slice(offset + nextBreak).trimStart() : t.slice(offset);
  };
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
      else text = skipToWordBoundary(text, Math.floor(text.length * 0.3));
      text = decodeHtmlEntities(stripNavDropdown(text)).replace(/\s{3,}/g,'\n\n').trim();
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
    text = decodeHtmlEntities(stripNavDropdown(text));
    const csi = text.indexOf('תשלומים ותקבולים בשנת שבתון');
    if (csi > 0) text = text.substring(csi);
    else text = skipToWordBoundary(text, 800);
    return text.substring(0,3000).trim();
  } catch(e2) { return null; }
}

// הודעה שמזכירה חודש רק בתור הקשר-זמן ("אוגוסט כעת") אבל למעשה שואלת על
// סיום שבתון (מה עושים, מה נותר לעשות) — לא באמת מחפשת "קורסים שנפתחים
// באוגוסט". בלי ההגנה הזו, אזכור-חודש-אגבי גורם לדחיסת רשימת-פתיחות-קורסים
// לא-קשורה לצד המידע האמיתי (הצ'קליסט לסיום שבתון). קבוע משותף (לא מקומי
// לפונקציה אחת) כי הבעיה הזו מופיעה בשלוש נקודות-קריאה נפרדות בקובץ.
const END_OF_SABBATICAL_RE = /בסוף שבתון|סיום שבתון|לקראת חזרה|חוזרים לעבודה|מה נותר לי לעשות|מה עושים בסוף|לקראת סוף/;

// ── מועדי פתיחה קורסים ──────────────────────────────
// לפעמים ב-course-dates.json, date_text הוא לא תיאור-מוכן-לתצוגה (כמו
// "1.9.2026 קבוצת בוקר...") אלא ערך גולמי שדלף מתא-תאריך באקסל בלי טקסט
// משלו — נראה כמו "2026-08-02 00:00:00". מזהים את התבנית הזו ומהפכים
// אותה לפורמט תאריך קריא (DD.MM.YYYY), במקום להציג את הפורמט הטכני הגולמי.
function formatDateText(raw) {
  if (!raw) return raw;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+00:00:00)?$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return raw;
}
function getCourseDates(message, filterUrls) {
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
          if (o.date_text) text += formatDateText(o.date_text.substring(0, 200)).replace(/\n/g, ' | ') + '\n';
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
          if (o.date_text) text += formatDateText(o.date_text.substring(0, 120)) + '\n';
        }
        text += '[פנו למידע ולייעוץ אישי](' + r.url + ')\n\n';
      }
      return text;
    }
  }

  // חפש לפי שם מוסד/קורס — מעדיף התאמת כותרת על פני תוכן פתיחות
  const stopW = new Set(['מתי','קורס','קורסים','נפתח','נפתחים','מועד','פתיחה','של','את','יש','מה']);
  const stripPfx = (w) => {
    if (w.length < 5) return w;
    const rest = w.slice(1);
    if (rest.length >= 3 && /^[בלמכהוש]$/.test(w[0])) return rest;
    return w;
  };
  const qWords = msgL.split(/\s+/)
    .map(w => w.replace(/[?!.,;:'"״"'()[\]]/g, '')) // הסרת פיסוק
    .filter(w => (w.length > 2 || (/^[a-z]{2,}$/i.test(w))) && !stopW.has(w))
    .flatMap(w => { const s = stripPfx(w); return s !== w ? [w, s] : [w]; });
  const specificWords = [...new Set(qWords.filter(w => {
    if (/^[a-z]+$/i.test(w)) return w.length >= 2; // מילים לטיניות: AI, NLP, CBT, VR וכו'
    return w.length > 4; // עברית: דורש 5+ תווים כבעבר
  }))];
  const matched = data.courses.filter(c => {
    if (filterUrls && filterUrls.length > 0 && !filterUrls.includes(c.url)) return false;
    const titleL = c.title.toLowerCase();
    const openingText = c.openings.map(o => (o.course_name || '') + ' ' + (o.date_text || '')).join(' ').toLowerCase();
    // התאמת כותרת: ≥2 מילים מהשאלה מופיעות בכותרת המוסד — התאמה חזקה
    const titleMatches = qWords.filter(w => titleL.includes(w)).length;
    if (titleMatches >= 2) return true;
    // כל המילות הספציפיות חייבות להיות בכותרת או בתיאור.
    // בודק כותרת תחילה (התאמה חזקה) ואחר כך תיאור — מאפשר "AI" בתיאורים.
    if (specificWords.length > 0) {
      const descL = (c.description || '').toLowerCase();
      const fullText = titleL + ' ' + descL;
      // aliasing: אמנות↔אומנות (שני כתיבים לאותו תחום)
      // aliasing: טיפולי↔טיפול (שם עצם/תואר לאותו שורש)
      const aliases = w => {
        if (w === 'אמנות') return ['אמנות', 'אומנות'];
        if (w === 'אומנות') return ['אומנות', 'אמנות'];
        if (w === 'טיפולי') return ['טיפולי', 'טיפול', 'טיפולית'];
        if (w === 'טיפולית') return ['טיפולית', 'טיפול', 'טיפולי'];
        return [w];
      };
      const allSpecificMatch = specificWords.every(w => {
        const stripped = stripPfx(w);
        return aliases(w).some(a => fullText.includes(a)) ||
               aliases(stripped).some(a => fullText.includes(a));
      });
      if (allSpecificMatch) return true;
    }
    return false;
  });
  const GENERIC_PHRASES = [
    'שלחו טופס', 'פנו לברור', 'פנו לבירור', 'ההרשמה בעיצומה',
    'מועדים שונים', 'לאורך השנה', 'בזמן ובמקום', 'עצמאי ומקוון',
    'נפתחים בקרוב', 'בקרוב', 'יפתח בקרוב', 'פנו למידע'
  ];
  const isGeneric = (txt) => GENERIC_PHRASES.some(p => txt.includes(p));

  if (matched.length > 0) {
    let text = '=== מועדי פתיחה קורסים ===\n';
    let hasAny = false;
    for (const c of matched.slice(0, 5)) {
      // מסנן רק פתיחות עם תאריכים מפורשים (לא "שלחו טופס" וכד')
      const explicitOpenings = c.openings.filter(o => o.date_text && !isGeneric(o.date_text));
      if (explicitOpenings.length === 0) continue;
      text += '**[' + c.title + '](' + c.url + ')**\n';
      for (const o of explicitOpenings) {
        const mName = monthNameMap[(o.month || '').split('-')[1]] || o.month;
        const yr2 = (o.month || '').split('-')[0] || '';
        text += (mName ? '**' + mName + ' ' + yr2 + ':**' : '') + '\n';
        // כל תאריך בשורה נפרדת
        text += formatDateText(o.date_text.trim()).replace(/,\s*/g, '\n') + '\n';
      }
      text += '[פנו למידע ולייעוץ אישי](' + c.url + ')\n\n';
      hasAny = true;
    }
    if (!hasAny) return null;
    text += '📚 [קורסים הנפתחים בקרוב](https://www.shabaton.online/bekarov)';
    return text;
  }

  return null;
}

// ── תיקון שגיאות כתיב נפוצות ─────────────────────────
// ── חיבור semantic-mappings.json לזרימה בפועל ──────────────
// הקובץ קיים בפרויקט אבל לא היה מחובר לשום מקום בקוד. מוסיף שני דברים,
// שניהם בגישה *תוספתית בלבד* (מוסיפים מילים לסוף ההודעה, לא מוחקים/מחליפים
// טקסט קיים) — כדי לא להתנגש עם כללי הנרמול הידניים הקיימים ב-fixTypos
// (כמו CANVA/הום סטיילינג, שכיוון הנרמול שלהם כבר נבדק ואומת בנפרד):
//
// 1) synonyms: אם ההודעה מכילה מונח כלשהו מתוך קבוצת "מילים נרדפות"
//    (mainTerm או כל variation) — מוסיפים לסוף ההודעה את שאר המונחים
//    בקבוצה שעוד לא מופיעים בה. כך לא משנה איזה ניסוח הגולש/ת השתמשו בו,
//    כל הניסוחים הנרדפים "יהיו נוכחים" בהודעה לצורך התאמת שדה/מונח ספציפי.
// 2) intentPatterns.seekingSolution: אם ההודעה מכילה גם ביטוי-של-חיפוש-פתרון
//    (כמו "איך להתמודד עם") וגם תיאור-בעיה מוכר (כמו "משמעת בכיתה") —
//    מוסיפים את מונחי הפתרון הרלוונטיים (כמו "ניהול כיתה") לסוף ההודעה.
function applySemanticMappings(message) {
  const sm = loadJSON('semantic-mappings.json');
  if (!sm) return message;
  const msgL = message.toLowerCase();
  const extra = [];

  for (const entry of Object.values(sm.synonyms || {})) {
    const allTerms = [entry.mainTerm, ...(entry.variations || [])].filter(Boolean);
    const present = allTerms.some(t => msgL.includes(t.toLowerCase()));
    if (present) {
      for (const t of allTerms) {
        if (!msgL.includes(t.toLowerCase())) extra.push(t);
      }
    }
  }

  const seeking = sm.intentPatterns && sm.intentPatterns.seekingSolution;
  if (seeking) {
    const hasPattern = (seeking.patterns || []).some(p => msgL.includes(p.toLowerCase()));
    if (hasPattern) {
      for (const [problem, solutions] of Object.entries(seeking.problemToSolution || {})) {
        if (msgL.includes(problem.toLowerCase())) {
          for (const s of solutions) if (!msgL.includes(s.toLowerCase())) extra.push(s);
        }
      }
    }
  }

  if (extra.length === 0) return message;
  return message + ' ' + [...new Set(extra)].join(' ');
}

function fixTypos(msg) {
  return msg
    .replace(/בישור/g, 'בישול')
    .replace(/בבליותרפיה/g, 'ביבליותרפיה')
    .replace(/ביבליותרפיה/g, 'ביבליותרפיה')  // normalize
    .replace(/ביבליו תרפיה/g, 'ביבליותרפיה')
    .replace(/פיטותרפיה/g, 'פיטותרפיה')
    .replace(/הומיאופטיה/g, 'הומאופתיה')
    .replace(/קינזיולוגיה/g, 'קינסיולוגיה')
    .replace(/קייץ/g, 'קיץ')
    .replace(/פרשס חנה/g, 'פרדס חנה')
    .replace(/\bהרכור\b/g, 'כרכור')
    .replace(/פרונטחי/g, 'פרונטלי')
    .replace(/\bAI\b/g, 'בינה מלאכותית')
    .replace(/\bai\b/g, 'בינה מלאכותית')
    .replace(/chatgpt/gi, 'בינה מלאכותית')
    .replace(/chat gpt/gi, 'בינה מלאכותית')
    .replace(/קנווה|קנבה|קאנבה|קאנווה|קנבא|קאנבא/g, 'canva')
    .replace(/home\s*styl(e|ing)/gi, 'הום סטיילינג')
    .replace(/עיצוב פנים/g, 'הום סטיילינג')
    .replace(/\bלנפש\b/g, 'להעצמה')
    .replace(/משהו לנפש/g, 'העצמה אישית')
    .replace(/לנוח לנפש/g, 'העצמה אישית');
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
    'קורסי קיץ', 'קורס קיץ', 'קיץ 2026', 'קיץ',
    'יש לי עוד', 'נותרו לי עוד', 'נותרו לי', 'כמעט מסתיים', 'כמעט נגמר',
    // "קורסים + חודש קיץ" — גולש מחפש קורסים שנפתחים בקיץ
    'קורסים ביולי', 'קורסים באוגוסט', 'קורסים ביוני',
    'קורסים לחודש יולי', 'קורסים לחודש אוגוסט', 'קורסים לחודש יוני',
    'קורסים לחודשים יולי', 'קורסים לחודשים יוני',
    'קורס ביולי', 'קורס באוגוסט', 'נפתח ביולי', 'נפתח באוגוסט'
  ];
  if (keywords.some(k => message.includes(k))) return true;
  // דפוס שנה עברית (תשפ"ו / תשפ"ז וכו') ביחד עם ש"ש/רשות/חובה — מרמז על
  // שנת שבתון נוכחית-מסוימת שעומדת להסתיים, בלי תלות בעדכון שנתי של הקוד.
  if (/תשפ["׳']?[א-ת]/.test(message) && /ש["׳']?ש|רשות|חובה/.test(message)) return true;
  return false;
}

async function buildContext(message, history, precomputedQA, apiKey) {
  message = fixTypos(message);

  // ── זיהוי הודעת-המשך קצרה ("ועם בן זוג", "ומה לגבי הצפון") ──
  // הודעות כאלה, בלי הקשר, מתפרשות לגמרי לא נכון ע"י כל לוגיקת ההתאמה (אזור/QA/
  // שדה/מוסד) — כי כולה פועלת אך ורק על תוכן ההודעה הנוכחית, בלי שום זיכרון שיחה.
  // ה-COURSE LIST BYPASS (הנתיב הנפוץ ביותר) אפילו לא מגיע לקריאה ל-Claude שמקבלת
  // את ה-history — אז בלי תיקון כאן, הקשר השיחה הולך לאיבוד לחלוטין בכל מקרה כזה.
  // היוריסטיקה: הודעה קצרה (≤5 מילים) שמתחילה במילת-חיבור ("ו"/"גם"/"או") ככל הנראה
  // ממשיכה את ההודעה הקודמת של אותו משתמש — משלבים אותה איתה רק לצורך ההתאמה.
  if (Array.isArray(history) && history.length > 0) {
    const wordCount = message.trim().split(/\s+/).length;
    const firstWord = message.trim().split(/\s+/)[0] || '';
    const FOLLOWUP_STARTERS = new Set(['ו','גם','או','אז','וגם','ועם','ומה','ואיך','ואם','ובאיזה','ולגבי','ובמה']);
    const looksLikeFollowUp = wordCount <= 6 && FOLLOWUP_STARTERS.has(firstWord);
    if (looksLikeFollowUp) {
      const lastUserMsg = [...history].reverse().find(h => h && h.role === 'user' && typeof h.content === 'string');
      if (lastUserMsg && lastUserMsg.content) {
        console.log('FOLLOW-UP DETECTED — merging with previous user message for matching:', lastUserMsg.content.substring(0,50));
        message = lastUserMsg.content.trim() + ' ' + message.trim();
      }
    }
  }

  // ── תשובת-המשך קצרה לשאלה המבהירה "לאיזה מוסד נרשמת?" ──
  // טווח מכוון-בכוונה: בודקים אך ורק אם התשובה *האחרונה של הבוט עצמו*
  // (לא של המשתמש) הייתה בדיוק השאלה המבהירה של already_registered_
  // cant_find_course_1 — מזוהה לפי משפט ייחודי מתוכה. כך זה לא משנה שום
  // התנהגות אחרת: אם הבוט לא שאל את השאלה הזו, הבדיקה כלל לא רצה. אם כן
  // שאל, והתשובה קצרה, מנסים לפענח אותה כשם-מוסד ישירות — כי getFieldKeywords/
  // searchQA לא תופסים שם-מוסד בלי הקשר-שדה, וההודעה הייתה נופלת ל-fallback
  // גנרי בלי לענות בפועל למה שהמשתמש התכוון.
  if (Array.isArray(history) && history.length > 0) {
    const lastAssistantMsg = [...history].reverse().find(h => h && h.role === 'assistant' && typeof h.content === 'string');
    const wasAskedWhichInstitution = lastAssistantMsg && lastAssistantMsg.content.includes('לאיזה מוסד או קורס נרשמת');
    if (wasAskedWhichInstitution) {
      const wordCount = message.trim().split(/\s+/).length;
      if (wordCount <= 6) {
        const namedInst = findInstitutionsByNameInMessage(message);
        if (namedInst.length > 0) {
          console.log('SHORT REPLY TO "WHICH INSTITUTION" — resolved by name:', namedInst.map(i=>i.anchor).join(', '));
          const list = namedInst.slice(0, 3).map(ki =>
            `🏫 **[${ki.title}](${ki.url})**\n[פנו למידע ולייעוץ אישי](${ki.url})`
          ).join('\n\n');
          return {
            context: `מצאתי — הנה איך ליצור קשר ישירות עם המוסד:\n\n${list}`,
            isInfo: true, courseCount: namedInst.length, urlToTitle: {}
          };
        }
        // לא זוהה מוסד בתשובה הקצרה — לא כופים כלום, ממשיכים לטיפול הרגיל
        // (שיתנהג בדיוק כמו היום, לרוב יגיע ל-fallback הכללי).
      }
    }
  }

  let coursesForClaude = []; // מוכרז ברמת הפונקציה לאפשר החזרה
  // כש-CITY FILTER מדלג על עיר-מבוקשת כי התאמה-נושאית אמיתית לא נמצאת בה
  // (למשל "קורס פסיפס בירושלים" — אין פסיפס בירושלים, מוצגת רשימה ארצית) —
  // נרשם כאן כדי שה-intro בהמשך יוכל להיות כן ולא לטעון "אלה מוסדות באזורכם".
  let topicOverrodeCityFlag = null;
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
  // הודעה שמזכירה חודש רק בתור הקשר-זמן ("אוגוסט כעת") אבל למעשה שואלת על
  // סיום שבתון (מה עושים, מה נותר לעשות) — לא באמת מחפשת "קורסים שנפתחים
  // באוגוסט". בלי ההגנה הזו, אזכור-חודש-אגבי גורם לדחיסת רשימת-פתיחות-קורסים
  // לא-קשורה לצד המידע האמיתי (הצ'קליסט לסיום שבתון).
  const isTimingQuery = !END_OF_SABBATICAL_RE.test(message) && /מתי|מועד|אוקטובר|נובמבר|דצמבר|ספטמבר|יוני|יולי|אוגוסט|ינואר|פברואר|מרץ|אפריל|מאי|בקרוב|חודש|תאריך|נפתח|פתיחה|מאיזה/.test(message);
  const datesCtx = (isTimingQuery || isSummerQuery(message)) ? getCourseDates(message) : null;
  if (datesCtx) {
    parts.push(datesCtx);
  }

  // ניתוב לקטגוריית קורסי קיץ
  // (summerNote נשמר גם בנפרד מ-parts, כי נתיב KNOWN_ONLY/known_institutions
  // לא משתמש ב-parts כלל ומחזיר context משלו — בלי זה ההערה הזו "נעלמת"
  // בכל פעם שהשאלה גם תואמת תחום לימוד/מוסד, בדיוק כמו שקרה עם QA-ים אחרים).
  let summerNote = null;
  if (isSummerQuery(message)) {
    const summerUrl = 'https://www.shabaton.online/results-all/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A7%D7%99%D7%A5';
    summerNote = `📚 [כל קורסי הקיץ](${summerUrl})\n⚠️ קורסי קיץ מוכרים רק אם הם מסתיימים לפני 31 באוגוסט — קורסים שנפתחים אחרי ספטמבר שייכים לשנת שבתון הבאה.`;
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

  // combinedNote מוכרז כאן (מוקדם) כי גם בלוק ה-QA-combine למטה וגם נתיב
  // ה-COURSE LIST BYPASS בהמשך הפונקציה צריכים לכתוב/לקרוא ממנו.
  let combinedNote = null;
  let qaComboHandled = false;
  const infoUrlsForQA = detectInfoPages(message) || [];
  // אם handler כבר הריץ סיווג-QA בעזרת Claude (fallback לניסוחים שההתאמה
  // הדטרמיניסטית מפספסת) — משתמשים בו כשה-searchQA הרגיל לא מצא כלום.
  // precomputedQA === undefined means "לא סופק" (לדוגמה בבדיקות ישנות/ידניות)
  // → מתנהג בדיוק כמו לפני השינוי.
  // ── זיהוי גמיש יותר ל'נרשמתי...ולא מוצא/יודע' ──
  // רשימת ה-keywords הרגילה של ה-QA דורשת שהביטויים יופיעו צמודים ממש
  // ("נרשמתי אבל לא מוצא") — אבל כששם-מוסד מוזכר בין השניים ("נרשמתי
  // באורנים לקורס ולא מוצא אותו"), ההתאמה-הצמודה נשברת. בודקים גם
  // התאמה-קרובה (עד 40 תווים בין "נרשמתי" ל"לא מוצא/יודע"), כ-fallback
  // רק לזיהוי הכוונה הזו הספציפית (לא שינוי כללי ל-searchQA).
  let detQA = searchQA(message);
  if (!detQA) {
    const looseMatch = /נרשמתי[^.!?]{0,40}(לא\s*(מוצא|יודע|יודעת)|(?:איפה|היכן)[^.!?]{0,20}(?:הקורס|למצוא))/.test(message);
    if (looseMatch) {
      const sf = loadJSON('shabaton-qa.json');
      const allQ = (sf && sf.categories || []).flatMap(c => c.questions || []);
      detQA = allQ.find(q => q.id === 'already_registered_cant_find_course_1') || null;
      if (detQA) console.log('LOOSE MATCH: already_registered_cant_find_course_1 (שם-מוסד כנראה הופרד בין החלקים)');
    }
  }
  // ── זיהוי גמיש ל"בקשה [חריגה/יציאה] לשנת שבתון" ──
  // נצפה בפרודקשן: "בקשה חליציאה לשנת שבתון" (כנראה שגיאת-הקלדה של
  // "בקשה ליציאה") — לא תואם שום keyword בהתאמה-צמודה, ובלי QA ייעודי
  // ההודעה נפלה ל-Claude חופשי בלי context מבוסס, שהמציא תפקיד לא-קיים
  // ("אחראי שבתון") — הפרה ישירה של כלל "אסור להמציא" שכבר קיים ב-system
  // prompt, אבל עדיף למנוע את התרחיש מלכתחילה עם QA ייעודי, לא רק לסמוך
  // על שהמודל תמיד יצליח להישמע לכלל בפועל.
  if (!detQA) {
    const looseAppMatch = /בקש[^.!?]{0,25}(חריג|יציא)[^.!?]{0,15}שבתון/.test(message);
    if (looseAppMatch) {
      const sf = loadJSON('shabaton-qa.json');
      const allQ = (sf && sf.categories || []).flatMap(c => c.questions || []);
      detQA = allQ.find(q => q.id === 'application_exception_request_safe_1') || null;
      if (detQA) console.log('LOOSE MATCH: application_exception_request_safe_1');
    }
  }
  // ── זיהוי גמיש ל"תואר שני + לימודי/שעות השלמה" (בכל סדר) ──
  // נצפה בפרודקשן: "אם אני לומדת תואר שני כמה שעות לימודי השלמה אני יכולה
  // ללמוד" הוחזרה כרשימת מוסדות-לתואר-שני (matched via field keyword "תואר
  // שני"), במקום תשובה עובדתית על מכסת השעות. "תואר שני" ו"השלמה" כמעט
  // אף פעם לא צמודים במשפט טבעי (תמיד יש מילות-שאלה באמצע) — לכן proximity
  // ולא substring, ובודקים את שני הכיוונים (השאלה יכולה לפתוח בכל אחד מהם).
  if (!detQA) {
    const looseDegreeMatch = /תואר שני[^.!?]{0,40}(לימודי השלמה|שעות השלמה)|(לימודי השלמה|שעות השלמה)[^.!?]{0,40}תואר שני/.test(message);
    if (looseDegreeMatch) {
      const sf = loadJSON('shabaton-qa.json');
      const allQ = (sf && sf.categories || []).flatMap(c => c.questions || []);
      detQA = allQ.find(q => q.id === 'masters_degree_completion_hours_1') || null;
      if (detQA) console.log('LOOSE MATCH: masters_degree_completion_hours_1');
    }
  }
  const qaFirst = detQA || (precomputedQA !== undefined ? precomputedQA : null);
  const hasInstQ = /מכללה|מכללת|אוניברסיטה|אוניברסיטת|מכון|סמינר|אקדמית|קריית|קריה|אורנים|בר.?אילן|תלפיות|הרצוג|שנקר|לוינסקי|גורדון|אונו|וינגייט|בן.?גוריון|עברית|תל.?אביב|חיפה|ירושלים|בגין|ויצמן/.test(message);
  // QA-ים מסוג תלונה/הסלמה (לדוגמה: מוסד לא עונה) — חייבים להיתפס גם אם
  // מוזכרת בהודעה מילת-מוסד כמו "סמינר"/"מכללה", כי המשתמש מתלונן על מוסד ספציפי.
  const ALWAYS_PRIORITY_QA_IDS = new Set(['institution_not_responding', 'intensive_seminars', 'cinema_city_entertainment_center', 'half_shabaton_work_less', 'unused_study_budget_1', 'short_online_completion_institutions', 'tuition_reimbursement_rate', 'commercial_gym_recognition', 'hours_allocation_quota_1', 'end_of_sabbatical_checklist_1', 'monthly_grant_1', 'birth_during_sabbatical_1', 'first_time_sabbatical_orientation_1', 'already_registered_cant_find_course_1', 'application_exception_request_safe_1', 'unlisted_course_professional_development_1', 'masters_degree_completion_hours_1']);
  const isEscalationQA = qaFirst && ALWAYS_PRIORITY_QA_IDS.has(qaFirst.id);
  // ── "נרשמתי ולא מוצא את הקורס" + שם-מוסד כבר בהודעה (או בתגובה קצרה
  // להמשך-שיחה, למשל "אורנים" בלבד לאחר ששאלנו "לאיזה מוסד נרשמת?") ──
  // עונים ישירות עם פרטי-ההתקשרות של אותו מוסד, במקום השאלה-המבהירה
  // הגנרית של ה-QA — כי getFieldKeywords לא היה תופס את זה בכלל (שם-מוסד
  // הוא לא מילת-מפתח של שדה-לימוד), וללא הבדיקה הזו ההודעה הייתה נופלת
  // לאחד מנתיבי-ה-fallback הכלליים בלי לפתור בפועל את מה שהמשתמש ביקש.
  if (qaFirst && qaFirst.id === 'already_registered_cant_find_course_1') {
    const namedInst = findInstitutionsByNameInMessage(message);
    if (namedInst.length > 0) {
      const list = namedInst.slice(0, 3).map(ki =>
        `🏫 **[${ki.title}](${ki.url})**\n[פנו למידע ולייעוץ אישי](${ki.url})`
      ).join('\n\n');
      return {
        context: `מצאתי — הנה איך ליצור קשר ישירות עם המוסד לגבי הקורס שנרשמת אליו:\n\n${list}`,
        isInfo: true, courseCount: namedInst.length, urlToTitle: {}
      };
    }
  }
  if (qaFirst && (infoUrlsForQA.length === 0 || isEscalationQA) && (!hasInstQ || isEscalationQA)) {
    const qaFooter0 = '\n\n📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)';
    // priority:true = תשובה ישירה ספציפית לא ממשיכים לחפש קורסים
    if (qaFirst.priority) {
      return { context: '=== מידע על שבתון ===\n' + formatQAAnswer(qaFirst) + qaFooter0, isInfo: true, courseCount: 0, urlToTitle, qaId: qaFirst.id };
    }
    // אם יש keywords לתחום — הוסף הסבר QA לcontext (לנתיב Claude) *וגם*
    // ל-combinedNote (לנתיב COURSE LIST BYPASS, שמתעלם מ-parts/context לגמרי
    // ומרכיב את התשובה הסופית ישירות מ-coursesForClaude + combinedNote) —
    // בלי זה, כששאלה כמו "חדרי כושר בשבתון" עוברת דרך ה-bypass (וזה רוב
    // המקרים), טקסט-ה-QA היה נעלם בשקט ורק המוסד עצמו היה מוצג.
    const hasFieldKws = getFieldKeywords(message) && getFieldKeywords(message).length > 0;
    if (hasFieldKws) {
      parts.push('=== הסבר על הנושא ===\n' + formatQAAnswer(qaFirst));
      combinedNote = combinedNote ? formatQAAnswer(qaFirst) + '\n\n' + combinedNote : formatQAAnswer(qaFirst);
      qaComboHandled = true;
      // המשך לחפש קורסים
    } else {
      return { context: '=== מידע על שבתון ===\n' + formatQAAnswer(qaFirst) + qaFooter0, isInfo: true, courseCount: 0, urlToTitle, qaId: qaFirst.id };
    }
  }
  const infoUrls = infoUrlsForQA;
  // אם כבר קיבלנו תשובת-QA מלוטשת+ממוקדת למעלה (qaComboHandled) — לא ממשיכים
  // *גם* לשלוף עמוד-מדיניות גולמי ולדחוף אותו ל-parts; זה כפול ומיותר, ובדיוק
  // ה"בליל" (טקסט גולמי לא-מעובד + widget ניווט) שתיקנו כמה פעמים. תשובת ה-QA
  // כבר עונה על הנושא בצורה נקייה.
  if (!qaComboHandled && infoUrls.length > 0) {
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
    let contents = [];
    if (!gotContent) {
      contents = await Promise.all(infoUrls.slice(0, 2).map(url => fetchPageContent(url)));
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
      if (qaMatch) return { context: '=== מידע על שבתון ===\n' + formatQAAnswer(qaMatch), isInfo: true, courseCount: 0, urlToTitle: {} };
      else parts.push('=== דפי מידע רלוונטיים ===\n' + infoUrls.map(u => '- ' + u).join('\n'));
    }
    if (gotContent) {
      if (qaFirst) parts.push('=== מידע נוסף (QA) ===\n' + formatQAAnswer(qaFirst));
      // אם ההודעה *גם* מכילה מילת-מפתח אמיתית של תחום לימוד (למשל "שחיה"
      // לצד "מוכר לשבתון") — לא עוצרים כאן עם תשובת-מדיניות בלבד: משאירים
      // את מידע-הדף ב-parts (כבר הוכנס למעלה) וממשיכים לחפש מוסדות
      // רלוונטיים (כמו AquAerobic), בדיוק כמו הטיפול הקיים ב-qaFirst.priority
      // למעלה (hasFieldKws) — כדי שהתשובה הסופית תשלב גם כלל וגם מוסד.
      // גם ל-combinedNote (לא רק parts) — כי נתיב ה-COURSE LIST BYPASS
      // (שמשמש את רוב תשובות-המוסדות) מתעלם מ-parts/context לגמרי.
      const hasFieldKwsInfo = getFieldKeywords(message) && getFieldKeywords(message).length > 0;
      if (!hasFieldKwsInfo) {
        return { context: parts.join('\n\n'), isInfo: true, courseCount: 0, urlToTitle };
      }
      const infoNoteTextRaw = contents.filter(Boolean).map((c, i) =>
        c.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/[^\s]+/g, '').replace(/🏫[^\n]*/g, '').trim()
      ).join('\n\n');
      // ── מגבילים לאורך סביר (כמו smartTruncate(...,800) לתיאורי-מוסדות) ──
      // כשזה מצטרף ל-combinedNote (ליד רשימת מוסדות), זו אמורה להיות הערה
      // משלימה קצרה — לא כל דף-המדיניות הגולמי (שיכול להגיע לאלפי תווים
      // ולכלול כמה נושאים שלא קשורים לשאלה הספציפית).
      const infoNoteText = smartTruncate(infoNoteTextRaw, 800);
      if (infoNoteText) combinedNote = combinedNote ? infoNoteText + '\n\n' + combinedNote : infoNoteText;
      console.log('INFO PAGE + FIELD KEYWORDS: ממשיכים לחפש מוסדות לצד מידע המדיניות');
    }
  }

  const sfForKI = loadJSON('study-fields.json');
  let knownOnly = null;
  let matchedFieldKeywords = [];
  let matchedFieldObj = null;
  // מיפוי url→שם שדה — משמש להוספת כותרת-משנה לכל תחום בתשובה מרובת-שדות,
  // בלי לגעת (mutate) באובייקטי המוסד המקוריים מה-cache המשותף.
  const fieldByUrl = new Map();
  let wasCombined = false;
  let combinedFieldInfo = null;
  const msgForFieldMatch = stripPrerequisiteQualifiers(applySemanticMappings(message));
  // גרסה *לא*-מורחבת סמנטית, לשימוש רק בסינון-מונח-ספציפי בתוך מוסד
  // (filterInstitutionsBySpecificTerm / extractSpecificTerms להצגת תיאור) —
  // שם צריך דיוק, לא recall: מילים גנריות שההרחבה הסמנטית מוסיפה (כמו
  // "טיפול"/"צילום" עבור "פוטותרפיה") היו גורמות לסינון להיות רחב מדי
  // ולהראות שורות קורס לא-קשורות.
  const msgForNarrowing = stripPrerequisiteQualifiers(message);
  if (sfForKI) {
    const msgLKI2 = msgForFieldMatch.toLowerCase();
    let bestLen = 0;
    let bestKeyword = null;
    // מחפש keyword הכי ארוך — לא הראשון (כמו searchQA)
    // עבור keywords קצרים (4 תווים ומטה) — דורש גבול מילה, כמו ב-getFieldSlug
    // ── "למידה מרחוק" מפסיד תיקו-באורך, לא תחרות רגילה ──
    // נצפה בפרודקשן: "קורס גיטרה מקוון" הציג את כל מוסדות-הלמידה-מרחוק
    // (33 מוסדות לא-קשורים) במקום מוסדות מוסיקה, כי "מקוון" ו"גיטרה" שניהם
    // 5 תווים — תיקו שהוכרע רק לפי סדר-איטרציה. זו העתקה שלישית (!) של אותה
    // לוגיקה (יש גם ב-getFieldSlug וב-getFieldKeywords, שתוקנו קודם) — וזו
    // ה-עותק שבאמת קובע את רשימת המוסדות המוצגת, אז התיקון כאן קריטי.
    for (const sfItem of (sfForKI.studyFields || [])) {
      const kws = sfItem.keywords || [];
      if (!sfItem.known_institutions || sfItem.known_institutions.length === 0) continue;
      for (const k of kws) {
        const kL = k.toLowerCase();
        const isMatch = k.length <= 4 ? wordBoundaryIncludes(msgLKI2, kL) : msgLKI2.includes(kL);
        if (!isMatch) continue;
        const isBetter = k.length > bestLen ||
          (k.length === bestLen && matchedFieldObj && matchedFieldObj.name === 'למידה מרחוק' && sfItem.name !== 'למידה מרחוק');
        if (isBetter) {
          bestLen = k.length;
          bestKeyword = k;
          knownOnly = sfItem.known_institutions;
          matchedFieldKeywords = [sfItem.keywords[0]];
          matchedFieldObj = sfItem;
        }
      }
    }

    // ── תיקון "מורי דרך": תיירות מול טיולים וסיורים לימודיים ──
    // "מורי דרך" הוא keyword גם ב"תיירות" (הכשרת מורי-דרך) וגם ב"טיולים
    // וסיורים לימודיים" (סיורים שמורים *הולכים* אליהם) — ולא רק תיקו פשוט:
    // applySemanticMappings מרחיב הודעה כזו עם מונחים רבים (כולל "תיירות
    // קולינרית", שהוא-עצמו keyword ב"טיולים וסיורים לימודיים"!), כך ש"טיולים"
    // מנצח לפעמים בפער-אורך אמיתי, לא רק בתיקו. לכן זו הכרעה נפרדת אחרי
    // הלולאה, לא תלוית-אורך: כששאלה מזהה כוונת *הכשרה* מפורשת (wantsTrainingIntent)
    // וטיולים ניצח, אבל תיירות עצמה גם מתאימה למילות-המפתח שלה — תיירות
    // צריכה לנצח, כי שם נמצא המוסד הרלוונטי (למשל וינגייט, הסבת מורי דרך).
    const wantsTrainingIntent = /מורי דרך|מדריך טיולים|הכשרת מדריך|הסבת מורי דרך|רישיון מדריך|תעודת מורה דרך/.test(msgLKI2);
    let trainingOverrideApplied = false;
    if (wantsTrainingIntent && matchedFieldObj && matchedFieldObj.name === 'טיולים וסיורים לימודיים') {
      const tourismField = (sfForKI.studyFields || []).find(f => f.name === 'תיירות');
      const tourismMatches = tourismField && (tourismField.keywords || []).some(k => {
        const kL = k.toLowerCase();
        return k.length <= 4 ? wordBoundaryIncludes(msgLKI2, kL) : msgLKI2.includes(kL);
      });
      if (tourismField && tourismMatches && tourismField.known_institutions && tourismField.known_institutions.length > 0) {
        console.log('TRAINING OVERRIDE: טיולים וסיורים לימודיים → תיירות');
        knownOnly = tourismField.known_institutions;
        matchedFieldKeywords = [tourismField.keywords[0]];
        matchedFieldObj = tourismField;
        trainingOverrideApplied = true;
      }
    }

    // ── אימות-שדה ממוקד בעזרת Claude — רק כשההתאמה ניצחה במילה קצרה (≤6
    // תווים), כי זה בדיוק דפוס-הבאגים שנצפה בפועל ("בית", "תא", "ירו", "ים",
    // "קש", "פנסיה"). לא רץ אם התיקון הדטרמיניסטי (TRAINING OVERRIDE) כבר
    // טיפל בהתאמה, ולא רץ בלי apiKey (התנהגות זהה לקודם במקרה כזה).
    if (matchedFieldObj && bestKeyword && bestLen <= 6 && !trainingOverrideApplied && apiKey) {
      const confirmed = await verifyFieldMatchWithClaude(message, matchedFieldObj.name, bestKeyword, apiKey);
      if (!confirmed) {
        console.log('FIELD MATCH REJECTED by Claude verify — falling through');
        matchedFieldObj = null;
        knownOnly = null;
        matchedFieldKeywords = [];
      }
    }

    if (knownOnly && matchedFieldObj) {
      knownOnly.forEach(ki => fieldByUrl.set(ki.url, matchedFieldObj.name));
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
        if (combo.requiresKeyword) {
          // שילוב מותנה-פרופיל: לא בודקים את מילות המפתח של otherField עצמו,
          // אלא ביטוי מפורש (כמו "גננת|גננות|גן ילדים") שמעיד על הפרופיל
          // הרלוונטי — למשל "אמנות ואומנויות" לא קשור מילולית ל"הוראה מתקנת",
          // אבל רלוונטי במפורש כשמדובר בגננת (קורסי אמנות = חובה עבורה).
          if (new RegExp(combo.requiresKeyword).test(msgLKI2)) otherBestLen = combo.requiresKeyword.length;
        } else {
          for (const k of (otherField.keywords || [])) {
            const kL = k.toLowerCase();
            const isMatch = k.length <= 4 ? wordBoundaryIncludes(msgLKI2, kL) : msgLKI2.includes(kL);
            if (isMatch && k.length > otherBestLen) otherBestLen = k.length;
          }
        }
        if (otherBestLen > 0) {
          console.log('COMBINED FIELDS:', matchedFieldObj.name, '+', otherField.name);
          const seenUrls = new Set(knownOnly.map(ki => ki.url));
          const merged = [...knownOnly];
          for (const ki of otherField.known_institutions) {
            if (!seenUrls.has(ki.url)) { merged.push(ki); seenUrls.add(ki.url); fieldByUrl.set(ki.url, otherField.name); }
          }
          knownOnly = merged;
          matchedFieldKeywords.push(otherField.keywords[0]);
          wasCombined = true;
          combinedFieldInfo = { name: otherField.name, slug: otherField.slug };
          if (combo.note) combinedNote = combo.note;
        }
      }
    }
  }

  // ── "לימודי תעודה" בלי תחום ספציפי ──
  // "לימודי תעודה" הוא תיאור-פורמט (כמו "תואר"/"הסמכה"), לא נושא לימוד —
  // הוא לא תואם אף keyword בשום שדה ב-study-fields.json, כך שכש-matchedFieldObj
  // עדיין null בשלב הזה, ההודעה הייתה נופלת ל-fallback הכללי (getInstitutionPagesForField/
  // searchCourses בהמשך הפונקציה) שמדרג לפי חפיפת-מילים גולמית מול קבצי אינדקס —
  // ומחזיר בליל מוסדות לא-קשורים לגמרי (תפירה, טיפול בצבע, ריקוד, פיסול, צילום...)
  // כי "לימודי"/"תעודה" הן מילים נפוצות בתיאורי קורסים בכל תחום שהוא.
  // כשאין תחום מזוהה בכלל — עדיף לשאול את הגולש/ת באיזה תחום, במקום להציג
  // רשימה אקראית. (אם *גם* צוין תחום ספציפי, matchedFieldObj לא יהיה null,
  // והבדיקה הזו לא תופעל — הבקשה תטופל כרגיל דרך אותו תחום.)
  if (!matchedFieldObj) {
    const msgLTeuda = msgForFieldMatch.toLowerCase();
    const wantsCertificateGeneric = /לימודי תעודה|קורס תעודה|קורסי תעודה|תוכנית תעודה|לימודים לתעודה/.test(msgLTeuda);
    if (wantsCertificateGeneric) {
      console.log('CERTIFICATE STUDIES - NO FIELD: asking user to specify field');
      return {
        context: '=== מידע על שבתון ===\n' +
          'לימודי תעודה קיימים במגוון רחב מאוד של תחומים — כדי שאוכל להציע לך את הקורסים והמוסדות המתאימים ביותר, ספר/י לי באיזה תחום לימוד את/ה מעוניין/ת (לדוגמה: אמנות ואמנויות, בריאות ותזונה, טיפול רגשי, ניהול, שפות, תיירות ועוד).\n\n🔎 [חיפוש קורסים לפי תחום לימוד](https://www.shabaton.online/search-courses)',
        isInfo: true, courseCount: 0, urlToTitle: {}
      };
    }
  }

  // ── Multi-field: "הוראה מתקנת וגם הדרכת הורים" / "מוסיקה או סטיילינג" ──
  // כשהשאלה מכילה "וגם"/"וכן"/"או" בין שני נושאים ששייכים לשדות שונים,
  // מזהים את השדה השני ומאחדים את המוסדות שלו עם השדה הראשי.
  // גם "בלימודי חובה X בלימודי רשות Y" (או "ל"-מתחיל) נחשב חיבור-משתמע בין
  // שני נושאים — דרך נפוצה לבקש נושא אחד לשעות-חובה ונושא שני לשעות-רשות,
  // בלי מילת-חיבור מפורשת כמו "וגם".
  const MULTI_FIELD_CONNECTOR = /וגם|וכן|\sאו\s|[בל]לימודי חובה|[בל]לימודי רשות/;
  if (knownOnly && sfForKI && matchedFieldObj && MULTI_FIELD_CONNECTOR.test(' ' + msgForFieldMatch + ' ')) {
    const connParts = msgForFieldMatch.split(/\s+(?:וגם|וכן|או)\s+|[בל]לימודי חובה\s*|[בל]לימודי רשות\s*/);
    for (const part of connParts) {
      const partL = part.toLowerCase().trim();
      let bestExtraLen = 0, bestExtraField = null;
      const primaryNameL = matchedFieldObj.name.toLowerCase();
      // כמה טוב החלק הזה מתאים לשדה הראשי *עצמו* — אם התאמה לשדה אחר לא
      // עולה על זה, החלק הזה כבר מכוסה על ידי השדה הראשי, ואין להוסיף שדה
      // נוסף (חלש/כללי יותר) רק כי הוא חולק מילה גנרית. למשל "הדרכת טיולים"
      // כבר מכוסה היטב ע"י "תיירות" (הכשרת מדריכי-דרך) — אין צורך להוסיף
      // גם "טיולים וסיורים לימודיים" (סיורים כלליים) רק כי "טיולים" חופפת.
      let bestPrimaryLen = 0;
      for (const k of (matchedFieldObj.keywords || [])) {
        const kL = k.toLowerCase();
        const m = k.length <= 4 ? wordBoundaryIncludes(partL, kL) : partL.includes(kL);
        if (m && k.length > bestPrimaryLen) bestPrimaryLen = k.length;
      }
      for (const sfItem of sfForKI.studyFields) {
        if (sfItem.name === matchedFieldObj.name) continue;
        if (!sfItem.known_institutions?.length) continue;
        for (const k of (sfItem.keywords || [])) {
          const kL = k.toLowerCase();
          // אם המונח הוא תת-מחרוזת של שם השדה הראשי עצמו (למשל "סטיילינג"
          // בתוך "עיצוב פנים - הום סטיילינג") — זו כנראה חפיפת-מילה מקרית
          // בין שדות, לא שני נושאים שונים באמת. מדלגים כדי לא לגרום לשילוב-שווא.
          if (kL.length >= 4 && primaryNameL.includes(kL)) continue;
          const m = k.length <= 4 ? wordBoundaryIncludes(partL, kL) : partL.includes(kL);
          if (m && k.length > bestExtraLen) { bestExtraLen = k.length; bestExtraField = sfItem; }
        }
      }
      if (bestExtraField && bestExtraField.name === 'טיולים וסיורים לימודיים' &&
          /מורי דרך|מדריך טיולים|הכשרת מדריך|הסבת מורי דרך/.test(partL)) {
        // אותה תופעה כמו התיקון המקורי של "מורי דרך": ההרחבה הסמנטית מזריקה
        // "תיירות קולינרית" (keyword ייחודי ל"טיולים וסיורים") שמנצח במקרה
        // באורך את ההתאמה ל"תיירות" — אבל כוונת-הכשרה מפורשת (כמו כאן)
        // כבר קבענו שצריכה לנצח לטובת "תיירות". מדלגים על bestExtraField
        // הזה במקום להוסיף אותו בטעות.
        bestExtraField = null;
      }
      if (bestExtraField && bestExtraLen <= bestPrimaryLen) { bestExtraField = null; }
      if (bestExtraField && bestExtraLen >= 4) {
        const seen = new Set(knownOnly.map(ki => ki.url));
        let added = 0;
        for (const ki of bestExtraField.known_institutions) {
          if (!seen.has(ki.url) && (ki.url||'').match(/shabaton\.online|morim\.boutique/)) {
            knownOnly.push(ki); seen.add(ki.url); added++; fieldByUrl.set(ki.url, bestExtraField.name);
          }
        }
        if (added > 0) {
          wasCombined = true;
          matchedFieldKeywords.push(bestExtraField.keywords[0]);
          console.log('MULTI-FIELD (וגם):', bestExtraField.name, '+', added, 'institutions');
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

    // ── סינון לפי עיר ספציפית ──
    // אוסף ערים מ-כל האזורים (לא רק מהאזור שזוהה), כי detectRegion עלול לטעות.
    // דילוג מוחלט כשבוצע שילוב רב-שדות (wasCombined): רוב המוסדות שהצטרפו
    // מהשדות המשלימים (כמו "אמנות ואומנויות" עבור גננת חינוך מיוחד) לא
    // מתויגים עם locations כלל — סינון גיאוגרפי כאן היה מצמצם בחזרה כמעט
    // לאפס ומאבד את השילוב הרב-נושאי שזה עתה נבנה בכוונה.
    if (knownOnly && !wasCombined) {
      const sfRegions = loadJSON('regions.json');
      const allRegionCities = sfRegions ? sfRegions.regions.flatMap(r => r.cities || []) : [];
      const msgLower = msgForFieldMatch.toLowerCase();
      const mentionedCity = allRegionCities.find(c =>
        c.length >= 4 && wordBoundaryIncludes(msgLower, c.toLowerCase())
      );
      if (mentionedCity) {
        const cityFiltered = knownOnly.filter(ki =>
          (ki.locations || []).some(loc => loc.toLowerCase().includes(mentionedCity.toLowerCase()))
        );
        if (cityFiltered.length > 0) {
          // ── מודעות למונח-ספציפי לפני שממצים לעיר ──
          // נצפה בפרודקשן: "קורס פסיפס בירושלים" צמצם קודם ל-6 מוסדות-אמנות
          // הממוקמים בירושלים (אף אחד לא פסיפס), ורק *אז* ניסה סינון-נושאי
          // לרוץ על אותם 6 בלבד — ומצא כלום, כי 7 מוסדות-הפסיפס האמיתיים
          // לא ממוקמים בירושלים בכלל. התוצאה: מוסדות לא-קשורים (עץ, צילום,
          // יהדות) רק כי הם קרובים גיאוגרפית. בודקים קודם אם יש התאמה-נושאית
          // אמיתית ברשימה *המלאה* (לפני צמצום-עיר): אם יש חפיפה בין
          // ההתאמה-הנושאית לעיר — עדיף (משיג את שני הדברים); אם ההתאמה-
          // הנושאית קיימת אבל בלי שום מוסד בעיר המבוקשת — עדיף להציג את
          // ההתאמה-הנושאית ארצית, על פני עיר-נכונה+נושא-לא-קשור.
          const topicPreview = filterInstitutionsBySpecificTerm(knownOnly, msgForNarrowing, matchedFieldKeywords);
          const hasGenuineTopicMatch = !topicPreview.noMatchForSpecificTerm && topicPreview.result.length < knownOnly.length;
          if (hasGenuineTopicMatch) {
            const topicUrls = new Set(topicPreview.result.map(ki => ki.url));
            const intersection = cityFiltered.filter(ki => topicUrls.has(ki.url));
            if (intersection.length > 0) {
              console.log(`CITY FILTER (all-regions): "${mentionedCity}" → ${cityFiltered.length}/${knownOnly.length} institutions, topic-intersection: ${intersection.length}`);
              knownOnly = intersection;
              knownOnly._cityFilterApplied = mentionedCity;
            } else {
              console.log(`CITY FILTER SKIPPED: topic match "${topicPreview.matchedTerm}" has 0 institutions in "${mentionedCity}" — showing topic match nationally instead`);
              knownOnly = topicPreview.result;
              // מסמנים כאילו טופל, כדי שמנגנון ה-fetch-לדף-אזור הנפרד (בהמשך
              // הפונקציה) ידע לדלג — יש לנו כבר תוצאה נכונה ומטופלת, גם אם
              // היא לא ממוקדת-עיר בפועל (העדפנו נושא נכון על פני עיר נכונה).
              knownOnly._cityFilterApplied = mentionedCity;
              topicOverrodeCityFlag = { city: mentionedCity, term: topicPreview.matchedTerm };
            }
          } else {
            console.log(`CITY FILTER (all-regions): "${mentionedCity}" → ${cityFiltered.length}/${knownOnly.length} institutions`);
            knownOnly = cityFiltered;
            knownOnly._cityFilterApplied = mentionedCity;
          }
        }
      }
      // ── פרונטלי filter: כשמבקשים פרונטלי, הסר מוסדות שמציעים רק למידה מרחוק ──
      const wantsFrontal = /פרונטל|פנים אל פנים|לא מרחוק|לא מקוון/.test(msgForFieldMatch);
      if (wantsFrontal && knownOnly.length > 1) {
        const frontalFiltered = knownOnly.filter(ki => {
          const locs = (ki.locations || []);
          if (locs.length === 0) return true; // אין מידע → לא מסנן
          const onlyRemote = locs.every(l => l.includes('למידה מרחוק') || l.includes('מקוון') || l.includes('אונליין') || l === 'online');
          return !onlyRemote;
        });
        if (frontalFiltered.length > 0) {
          console.log(`FRONTAL FILTER: ${frontalFiltered.length}/${knownOnly.length} (removed remote-only)`);
          knownOnly = frontalFiltered;
        }
      }
      // ── סינון לפי אזור (keyword) כשלא צוינה עיר ספציפית ──
      // "גרה באזור הצפון" → מסנן מוסדות לפי ערי האזור, גם בלי שם עיר מפורש
      if (knownOnly && !knownOnly._cityFilterApplied) {
        const sfReg2 = loadJSON('regions.json');
        const mL2 = msgForFieldMatch.toLowerCase();
        if (sfReg2) {
          for (const rg of sfReg2.regions) {
            if (rg.slug === 'online') continue;
            const kwMatch = (rg.keywords || []).find(k => {
              const kl = k.toLowerCase();
              return k.length <= 4 ? wordBoundaryIncludes(mL2, kl) : mL2.includes(kl);
            });
            if (kwMatch) {
              const rgCities = (rg.cities || []).map(c => c.toLowerCase());
              const normLoc = loc => loc.toLowerCase().replace(/-/g, ' '); // נרמול מקף→רווח ("תל-אביב"→"תל אביב")
              const rgFiltered = knownOnly.filter(ki =>
                (ki.locations || []).some(loc => rgCities.some(c => c.length >= 4 && normLoc(loc).includes(c)))
              );
              if (rgFiltered.length > 0 && rgFiltered.length < knownOnly.length) {
                console.log(`REGION KEYWORD FILTER: "${kwMatch}" (${rg.name}) → ${rgFiltered.length}/${knownOnly.length}`);
                knownOnly = rgFiltered;
                knownOnly._cityFilterApplied = kwMatch;
              }
              break;
            }
          }
        }
      }
      // ─────────────────────────────────────────────────────
    }

    // ── סינון-אזור "רך" למקרה של שילוב רב-שדות (wasCombined) ──
    // בניגוד לסינון המדויק למעלה (שמוחלט לגמרי כי הוא היה מצמצם כמעט לאפס),
    // כאן משאירים מוסד אם: (א) יש לו location שתואם לאזור המבוקש, או
    // (ב) הוא מוצע מרחוק/מקוון/בזום (תמיד רלוונטי בלי קשר לאזור), או
    // (ג) אין לו בכלל מידע location (המצב הנפוץ במוסדות מהשדות המשלימים) —
    // בלי מידע, לא פוסלים. כך גם מכבדים בקשת אזור מפורשת, וגם לא הורסים
    // את השילוב הרב-נושאי שהמשתמשת ביקשה.
    if (knownOnly && wasCombined) {
      const sfRegionsC = loadJSON('regions.json');
      const msgLowerC = msgForFieldMatch.toLowerCase();
      const allRegionCitiesC = sfRegionsC ? sfRegionsC.regions.flatMap(r => r.cities || []) : [];
      const mentionedCityC = allRegionCitiesC.find(c =>
        c.length >= 4 && wordBoundaryIncludes(msgLowerC, c.toLowerCase())
      );
      let regionCitiesC = null, regionLabelC = null;
      if (mentionedCityC && sfRegionsC) {
        // עיר ספציפית זוהתה — משתמשים בכל ערי *האזור* שהיא שייכת אליו
        // (למשל "קריות" -> "חיפה והצפון"), לא רק בעיר הבודדת. כך ערים
        // סמוכות (כמו חיפה עצמה) גם נחשבות תואמות, לא רק "קריות" מילולית.
        const parentRegion = sfRegionsC.regions.find(rg =>
          (rg.cities || []).some(c => c.toLowerCase() === mentionedCityC.toLowerCase())
        );
        regionCitiesC = parentRegion ? (parentRegion.cities || []).map(c => c.toLowerCase()) : [mentionedCityC.toLowerCase()];
        regionLabelC = mentionedCityC;
      } else if (sfRegionsC) {
        for (const rg of sfRegionsC.regions) {
          if (rg.slug === 'online') continue;
          const kwMatch = (rg.keywords || []).find(k => {
            const kl = k.toLowerCase();
            return k.length <= 4 ? wordBoundaryIncludes(msgLowerC, kl) : msgLowerC.includes(kl);
          });
          if (kwMatch) {
            regionCitiesC = (rg.cities || []).map(c => c.toLowerCase());
            regionLabelC = kwMatch;
            break;
          }
        }
      }
      if (regionCitiesC && regionCitiesC.length > 0) {
        const isRemoteKI = (ki) =>
          /מרחוק|מקוון|אונליין|בזום|online|פריסה ארצית|ארצי/i.test(ki.description || '') ||
          (ki.locations || []).some(l => /מרחוק|מקוון|אונליין|online|פריסה ארצית|ארצי/i.test(l));
        const matchesRegionKI = (ki) => (ki.locations || []).some(loc => {
          const locL = loc.toLowerCase().replace(/-/g, ' ');
          return regionCitiesC.some(c => c.length >= 4 && locL.includes(c));
        });
        const smartFiltered = knownOnly.filter(ki => {
          if (!ki.locations || ki.locations.length === 0) return true; // אין מידע — לא פוסלים
          if (matchesRegionKI(ki)) return true;
          if (isRemoteKI(ki)) return true;
          return false; // יש location מפורש, לא תואם לאזור, ולא מרחוק
        });
        if (smartFiltered.length > 0 && smartFiltered.length < knownOnly.length) {
          console.log(`SMART REGION FILTER (combined): "${regionLabelC}" → ${smartFiltered.length}/${knownOnly.length}`);
          knownOnly = smartFiltered;
        }
      }
    }
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
    let fallbackInstitutionApplied = false;

    // ── שלב מקדים: בדיקת סינון ספציפי לפני הכל ──
    // אם קיים מונח ספציפי מאוד (כמו "נגרות", "מוזיאון") שמצמצם ל-≤5 מוסדות —
    // מציגים אותם ישירות, ומדלגים גם על Jina וגם על ה-regular filter.
    // ── סינון לפי אזור (keyword) כשלא צוינה עיר ספציפית ──
    // "אני גרה באזור הצפון" → מסנן מוסדות לפי ערי הצפון, גם בלי שם עיר מפורש
    // דילוג כש-wasCombined מאותה סיבה כמו הבלוק הראשון למעלה.
    if (knownOnly && !knownOnly._cityFilterApplied && !wasCombined) {
      const sfRegions2 = loadJSON('regions.json');
      const msgLower2 = msgForFieldMatch.toLowerCase();
      if (sfRegions2) {
        for (const rg of sfRegions2.regions) {
          if (rg.slug === 'online') continue;
          const kwMatch = (rg.keywords || []).find(k => {
            const kl = k.toLowerCase();
            return k.length <= 4 ? wordBoundaryIncludes(msgLower2, kl) : msgLower2.includes(kl);
          });
          if (kwMatch) {
            const rgCities = (rg.cities || []).map(c => c.toLowerCase());
            const rgFiltered = knownOnly.filter(ki =>
              (ki.locations || []).some(loc => rgCities.some(c => c.length >= 4 && loc.toLowerCase().includes(c)))
            );
            if (rgFiltered.length > 0 && rgFiltered.length < knownOnly.length) {
              console.log(`REGION KEYWORD FILTER: "${kwMatch}" (${rg.name}) → ${rgFiltered.length}/${knownOnly.length}`);
              knownOnly = rgFiltered;
              knownOnly._cityFilterApplied = kwMatch;
            }
            break;
          }
        }
      }
    }

    let preSpecificFilterDone = false;    if (!wasCombined) {
      const preFilterRes = filterInstitutionsBySpecificTerm(validKI, msgForNarrowing, matchedFieldKeywords);
      // הגנה: כש-candidates.length===0 (שאילתה ששקולה לשם-השדה עצמו, כמו
      // "איפור" לבד), filterInstitutionsBySpecificTerm מחזירה את כל הרשימה
      // הלא-מסוננת עם noMatchForSpecificTerm:false — ואם השדה קטן (≤5), זה
      // נראה בטעות כמו "צומצם בהצלחה לתוצאה ספציפית קטנה". לשדות עם
      // noMatchMessage (שכבר קבענו שאף מוסד בהם לא באמת משרת את מטרת השדה)
      // זה קריטי לא לתת לקיצור-הדרך הזה "לבלוע" את המקרה — רק matchedTerm
      // אמיתי (מונח ספציפי שבאמת נבדק והתאים) מצדיק דילוג ישיר.
      if (!preFilterRes.noMatchForSpecificTerm && preFilterRes.result.length > 0 && preFilterRes.result.length <= 5 &&
          (preFilterRes.matchedTerm || !matchedFieldObj.noMatchMessage)) {
        validKI = preFilterRes.result;
        fallbackInstitutionApplied = true;
        preSpecificFilterDone = true;
        console.log('PRE-SPECIFIC FILTER: showing', validKI.length, 'specific institutions, skip Jina+regular filter');
        // ── Niche Fallback (bigram) ──
        // כש-bigram נותן תוצאה אחת בלבד (לא 2!): מרחיב לכל השדה ומחפש מילה בודדת מתאימה.
        // התאמה של 2 מוסדות עצמאיים לאותו צירוף דו-מילתי היא סימן טוב וממוקד,
        // לא "נישה" שצריך להרחיב ממנה — לכן הסף כאן הוא 1 בלבד, לא 2.
        const matchedTerm = preFilterRes?.matchedTerm || '';
        if (validKI.length === 1 && matchedTerm.includes(' ') && matchedFieldObj) {
          const allKI = (matchedFieldObj.known_institutions || []).filter(ki =>
            (ki.url||'').match(/shabaton\.online|morim\.boutique/)
          );
          if (allKI.length > validKI.length) {
            // מחפש את הword הספציפית הטובה ביותר (לא bigram) שנותנת 3-20 תוצאות
            const msgWords = msgForFieldMatch.toLowerCase()
              .match(/[\u05D0-\u05EA]{4,}|[a-zA-Z]{3,}/g) || [];
            const stopW2 = new Set(['מחפש','מחפשת','רוצה','רוצים','לרצות','קורס','קורסי','קורסים','לימוד','לימודי','שבתון','ללמוד','ולמוד']);
            const termAliasesLocal = { 'אומנות':['אומנות','אמנות'], 'אמנות':['אמנות','אומנות'],
              'טיפולי':['טיפולי','טיפול','טיפולית'], 'טיפולית':['טיפולית','טיפול','טיפולי'] };
            const bigramWords = new Set(matchedTerm.toLowerCase().split(/\s+/));
            let bestSingle = null;
            for (const w of msgWords) {
              if (stopW2.has(w) || matchedFieldKeywords.includes(w) || bigramWords.has(w)) continue;
              const toCheck = termAliasesLocal[w] || [w];
              const singleMatched = allKI.filter(ki => {
                const txt = ((ki.title||'')+(ki.description||'')).toLowerCase();
                return toCheck.some(a => txt.includes(a));
              });
              if (singleMatched.length > 2 && singleMatched.length <= 20) {
                if (!bestSingle || singleMatched.length < bestSingle.length) {
                  bestSingle = singleMatched;
                }
              }
            }
            if (bestSingle) {
              console.log(`NICHE RE-FILTER (single word): ${bestSingle.length} institutions`);
              validKI = bestSingle;
            } else {
              // אין מילה בודדת חלופית טובה יותר (3-20 תוצאות) — זה לא אומר
              // שההתאמה המקורית של ה-bigram שגויה! להפך: אם אף מילה בודדת
              // לא נותנת התאמה רחבה יותר, סימן שההתאמה הממוקדת ל-1 מוסד
              // (למשל "קלפים טיפוליים"→ מכון פרסונה, "קונסטלציה משפחתית")
              // היא כנראה נכונה ומדויקת — לא "רעש" מקרי שצריך "לתקן" בהצגת
              // כל השדה הלא-ממוין. משאירים את ההתאמה הממוקדת המקורית.
              console.log(`NICHE FALLBACK: no better single-word alt — keeping original ${validKI.length}-institution bigram match (not expanding to full field of ${allKI.length})`);
            }
          }
        }
      }
    }

    // regular filter — רק אם לא עשינו pre-filter ספציפי
    const filterRes = (wasCombined || preSpecificFilterDone)
      ? { result: validKI, noMatchForSpecificTerm: false }
      : filterInstitutionsBySpecificTerm(validKI, msgForNarrowing, matchedFieldKeywords);
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
        fallbackInstitutionApplied = true;
      }
    } else if (!wasCombined && !preSpecificFilterDone && matchedFieldObj && matchedFieldObj.noMatchMessage) {
      // נושא-משנה ספציפי נשאל ולא נמצא לו מוסד תואם, ואין fallbackInstitution
      // סביר (למשל: "איפור, טיפוח אישי וסטיילינג" מכיל כרגע רק 2 מוסדות
      // תפירה/עיצוב בגדים, בלי שום מוסד שבאמת מלמד איפור) — לתחום כזה יש
      // הודעת-מחסור מפורשת ב-noMatchMessage. עדיף להגיד את זה בכנות במקום
      // להציג רשימה לא-קשורה כאילו היא מענה לבקשה.
      // בכוונה *לא* תלוי ב-filterRes.noMatchForSpecificTerm: שאילתה שהיא
      // בדיוק שם-השדה עצמו (למשל "איפור" לבד) לעולם לא מייצרת מונח-ספציפי
      // לבדיקה בכלל (שם-השדה מוחרג מ-candidates), כך שהדגל הזה תמיד false
      // בדיוק במקרה שה-noMatchMessage נועד לתפוס. אם הוגדר noMatchMessage
      // לשדה, המשמעות היא שאף מוסד בו לא באמת משרת את מטרת השדה — בלי קשר
      // לניסוח השאלה.
      console.log('NO MATCH MESSAGE (field-level):', matchedFieldObj.name);
      return {
        context: '=== מידע על שבתון ===\n' + matchedFieldObj.noMatchMessage,
        isInfo: true, courseCount: 0, urlToTitle: {}
      };
    }
    if (validKI.length === 0) { /* אין מוסדות תקניים — המשך לחיפוש */ }
    else {

    const fieldSlug2 = getFieldSlug(message);
    const regionForKI = detectRegion(message);

    // בדיקת "ציון אזור מפורש" — בדיקה שכבר נדרשת לכניסה ל-Jina.
    // שמורה כדגל כי נצטרך אותה גם ב-requestedRegionName ב-return.
    const regionExplicitlyMentioned = regionForKI && (
      (regionForKI.keywords || []).some(k => {
        const kL = k.toLowerCase(); const msgL2 = msgForFieldMatch.toLowerCase();
        return k.length <= 4 ? wordBoundaryIncludes(msgL2, kL) : msgL2.includes(kL);
      }) || (regionForKI.cities || []).some(c =>
        c.length >= 4 && wordBoundaryIncludes(msgForFieldMatch.toLowerCase(), c.toLowerCase())
      )
    );

    // אם יש אזור מזוהה (ולא "למידה מרחוק" — אין לו דף results נפרד) —
    // ננסה קודם את דף האזור האמיתי באינדקס (מסונן באמת לאזור, כולל למידה מרחוק
    // שמוצגת תמיד גם היא בדפי ה-results-X של הפורטל).
    // חריג: אם כבר בוצע סינון לפי עיר ספציפית מ-known_institutions (cityFilterApplied),
    // אין צורך ב-Jina — יש לנו כבר בדיוק את המוסדות הנכונים.
    if (regionForKI && regionForKI.slug !== 'online' && fieldSlug2 && !knownOnly._cityFilterApplied &&
        !preSpecificFilterDone && regionExplicitlyMentioned && !wasCombined) {
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

      // מסננים מוסדות שהמשתמשת ביקשה במפורש להחריג ("חוץ ממרכז החומר...")
      regionInst = filterExcludedResults(regionInst, extractExclusionTerms(message));

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
      // הדף האזורי ריק (Wix/JS דינמי, Jina לא מצליח לסרוק) —
      // מפנים ישירות לדף החי באתר, שהגולש יכול לגלוש אליו ולראות את הקורסים שם.
      console.log('Region-specific page truly empty (index + live) — giving direct link');
      const liveLinkUrl = buildRegionCategoryUrl(regionForKI.slug, fieldSlug2.slug);
      const directLinkMsg =
        `📍 [לחצו כאן](${liveLinkUrl}) לרשימת המוסדות באזור ${regionForKI.name}, ` +
        `ופנו ישירות ליועצי הלימודים שלהם למידע ולייעוץ אישי עבורכם.`;
      return { context: '=== מידע על שבתון ===\n' + directLinkMsg, isInfo: true, courseCount: 0, urlToTitle: {} };
    }

    // הגרלת סדר — מוסדות שונים בכל פנייה
    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // פורמט coursesForClaude — מפעיל את COURSE LIST BYPASS
    // מחלצים מונחים ספציפיים מההודעה כדי להציג תחת כל מוסד רק את הקורס/ים
    // הרלוונטיים לחיפוש (ולא את כל רשימת הקורסים של המוסד בתחום). באיחוד
    // שדות (wasCombined) השאלה כללית מטבעה — לא מסננים.
    const specificTermsForDesc = wasCombined ? [] : extractSpecificTerms(msgForNarrowing, matchedFieldKeywords);
    // ── לא מציעים מסלולי תואר (שני/ראשון/שלישי/דוקטורט) אם לא ביקשו זאת ──
    // בפירוש. תיאור מוסד רב-שורות (קורס אחד לכל שורה) עשוי לכלול גם מסלולי
    // תואר וגם מסלולים לא-אקדמיים (תעודה/הכשרה) — filterDescriptionLinesByTerms
    // כבר מסנן לפי רלוונטיות-נושאית, אבל לא לפי "האם זה תואר", כי שדות טיפוליים
    // (כמו "דרמה טיפולית") מתארים כמעט כל מסלול-תואר וגם כל תעודה כ"טיפול ב-X" —
    // אז הסינון הנושאי משאיר את שתי הקטגוריות יחד. זה אותו wantsDegree שכבר
    // קיים בנתיב-החיפוש השני (סינון לפי כותרת-קורס באינדקס) — כאן מיושם ברמת
    // שורה בתוך תיאור-מוסד, כי זה המבנה הרלוונטי לנתיב הזה (KNOWN_ONLY).
    // נצפה בפרודקשן: "קורסי דרמה טיפולית" הציג בלוקים שלמים של תואר שני
    // (סמינר הקיבוצים, אונו) במקום המסלולים הלא-אקדמיים שהמוסדות האלה גם
    // מציעים — ב-2026-08.
    const wantsDegreeKI = /תואר שני|תואר ראשון|תואר שלישי|תואר אקדמי|דוקטורט|\bMA\b|\bBA\b|\bMSC\b/i.test(message);
    const stripDegreeLines = (text) => {
      if (wantsDegreeKI || !text) return text;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return text;
      const degreeRe = /תואר שני|תואר ראשון|תואר שלישי|תואר אקדמי|דוקטורט/;
      const nonDegree = lines.filter(l => !degreeRe.test(l));
      if (nonDegree.length === lines.length) return text; // אין שורות-תואר בכלל, לא נוגעים
      return nonDegree.join('\n'); // עשוי להיות '' אם הכל תואר — מטופל ב-formatKI
    };
    const formatKI = (ki) => {
      const relevantDesc = filterDescriptionLinesByTerms(ki.description, specificTermsForDesc);
      const degreeFiltered = stripDegreeLines(relevantDesc);
      if (relevantDesc && relevantDesc.trim() && !degreeFiltered.trim()) {
        // היה תוכן רלוונטי-נושאית, אבל כולו מסלולי-תואר שלא ביקשו — לא
        // מציגים את המוסד הזה בכלל (עדיף לדלג עליו מאשר "לכפות" תואר שלא
        // התבקש, או להציג כותרת-מוסד ריקה בלי שום תוכן).
        return null;
      }
      const cleanDesc = smartTruncate(cleanDescription(degreeFiltered), 800).trim();
      return `**[${ki.title}](${ki.url})**\n${cleanDesc ? cleanDesc + '\n' : ''}[פנו למידע ולייעוץ אישי](${ki.url})`;
    };

    // מקבצים לפי שדה-מקור רק אם זה בכלל חיפוש רב-שדות ויש יותר משדה אחד בפועל
    // ברשימה הסופית (ייתכן ש-wasCombined=true אך כל המוסדות המשלימים כבר
    // נבלעו כ-duplicates של השדה הראשי, ואז אין טעם/צורך בכותרות).
    const distinctFields = wasCombined ? [...new Set(validKI.map(ki => fieldByUrl.get(ki.url)).filter(Boolean))] : [];
    let shuffledKI, kiForClaude;
    if (distinctFields.length > 1) {
      shuffledKI = [];
      kiForClaude = [];
      const MAX_PER_FIELD = 5;
      for (const fieldName of distinctFields) {
        const fullGroup = shuffle(validKI.filter(ki => fieldByUrl.get(ki.url) === fieldName));
        if (fullGroup.length === 0) continue;
        const group = fullGroup.slice(0, MAX_PER_FIELD);
        shuffledKI.push(...group);
        kiForClaude.push(`###FIELD_HEADER###${fieldName}`);
        kiForClaude.push(...group.map(formatKI).filter(Boolean));
        // קישור-קטגוריה שקט (לא כפתור-קריאה-לפעולה) לכל שדה בנפרד — לא רק
        // לשדה המשלים היחיד כמו קודם — כדי שמי שביקש כמה תחומים באותה שאלה
        // יוכל להגיע לרשימה המלאה של כל תחום בנפרד, לא רק לתחום אחד מצורף.
        const fieldObjForSlug = sfForKI.studyFields.find(f => f.name === fieldName);
        if (fieldObjForSlug && fieldObjForSlug.slug) {
          const fieldCatUrl = `https://www.shabaton.online/results-all/${encodeURIComponent(fieldObjForSlug.slug)}`;
          kiForClaude.push(`📚 [למוסדות נוספים המציעים ${fieldName}](${fieldCatUrl})`);
        }
      }
    } else {
      shuffledKI = shuffle(validKI);
      kiForClaude = shuffledKI.map(formatKI).filter(Boolean);
    }
    const catUrl2 = (() => {
      if (!fieldSlug2) return null;
      // URL אזורי — כשיש region keyword filter (ירושלים, צפון וכד') שהשתמש בו
      const rg = detectRegion(msgForFieldMatch);
      if (rg && rg.slug !== 'online' && knownOnly._cityFilterApplied && regionExplicitlyMentioned) {
        return `https://www.shabaton.online/${rg.slug}/${fieldSlug2.slug}`;
      }
      return `https://www.shabaton.online/results-all/${fieldSlug2.slug}`;
    })();
    const catName2 = distinctFields.length > 1 ? distinctFields.join(' ו') : (fieldSlug2 ? fieldSlug2.name : null);
    // קישור "כל הקורסים" גם לתחום המשלים, כשהיה איחוד שדות — לא רק לתחום הראשי
    if (wasCombined && combinedFieldInfo) {
      const catUrl3 = `https://www.shabaton.online/results-all/${encodeURIComponent(combinedFieldInfo.slug)}`;
      const extraLink = `📚 [כל קורסי ${combinedFieldInfo.name}](${catUrl3})`;
      combinedNote = combinedNote ? combinedNote + '\n' + extraLink : extraLink;
    }
    // ⚠️ רשימה לאומית — אין לטעון שהיא מסוננת לאזור, אבל נזכיר שביקשת אזור זה
    console.log('KNOWN_ONLY path (national list):', validKI.length, 'institutions → coursesForClaude');
    const finalNote = [
      (!END_OF_SABBATICAL_RE.test(message) && ((/מתי|מועד|נפתח|פתיחה|תאריך|חודש|מאיזה|בקרוב/.test(message)) ||
       (/(^|\s)[בלמכ]?(יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|ינואר|פברואר|מרץ|אפריל|מאי|יוני)(\s|$|\?)/.test(message)) ||
       isSummerQuery(message))) ? getCourseDates(message) : null,
      combinedNote,
      summerNote
    ].filter(Boolean).join('\n\n') || null;
    return { context: '', isInfo: false, courseCount: kiForClaude.length, urlToTitle: {}, coursesForClaude: kiForClaude, categoryUrl: catUrl2, fieldName: catName2, regionName: null,
      requestedRegionName: (fallbackInstitutionApplied || !fieldSlug2 || !regionExplicitlyMentioned) ? null : (regionForKI ? regionForKI.name : null),
      usedFallbackInstitution: false, combinedNote: finalNote,
      topicOverrodeCity: topicOverrodeCityFlag,
      cityRegionCategoryUrl: (topicOverrodeCityFlag && regionForKI && fieldSlug2) ? buildRegionCategoryUrl(regionForKI.slug, fieldSlug2.slug) : null };
    } // end else validKI
  }

  const courses = searchCourses(message, region);
  const fieldKeywords = getFieldKeywords(message);
  const genericWords2 = new Set(['קורס','קורסי','קורסים','למורים','לגננות','בשבתון','מורים','גננות','שבתון','לימוד','לימודים']);
  const qLower2 = message.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !genericWords2.has(w));

  const qaGeneral = searchQA(message);
  if (qaGeneral && !hasInstQ && !datesCtx) {
    console.log('QA general match:', qaGeneral.id || qaGeneral.question);
    return { context: '=== מידע על שבתון ===\n' + formatQAAnswer(qaGeneral) + '\n\n📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)', isInfo: true, courseCount: 0, urlToTitle, qaId: qaGeneral.id };
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
      const institutions = filterExcludedResults(
        parseInstitutionsFromCategoryText(categoryData.text, fieldInfo.name, 15),
        extractExclusionTerms(message)
      );
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
  // בודקים על ההודעה אחרי הסרת תיאורי-רקע ("אני עם תואר שני" וכו') —
  // אחרת מי שכבר מחזיק/ה בתואר שני ומבקש/ת משהו אחר לגמרי מקבל/ת בכל
  // זאת קישור "חובה" לתחום התואר השני, כי המילים "תואר שני" הופיעו
  // בהודעה המקורית בהקשר של רקע קיים ולא של בקשה בפועל.
  if (/תואר שני|MA|M\.A/.test(msgForFieldMatch)) {
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
      // אזור מזוהה אבל ללא תחום לימוד ספציפי.
      // שלב 1: חיפוש מוסדות שיש להם locations תואמת לעיר שהוזכרה.
      const regionUrl = region.slug === 'online'
        ? 'https://www.shabaton.online/results-all/'
        : `https://www.shabaton.online/${region.slug}/`;
      const footer = '\n\n📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
        '💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n' +
        '👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)';

      // חיפוש עיר ספציפית בהודעה
      const regionCitiesAll = (region.cities || []).map(c => c.toLowerCase());
      const mentionedCityForNoField = regionCitiesAll.find(c =>
        c.length >= 4 && wordBoundaryIncludes(msgForFieldMatch.toLowerCase(), c)
      ) || (region.keywords || []).map(k=>k.toLowerCase()).find(k =>
        k.length >= 4 && wordBoundaryIncludes(msgForFieldMatch.toLowerCase(), k)
      );

      // חיפוש מוסדות שמציעים קורסים בעיר הספציפית (מכל התחומים)
      let cityInstitutions = [];
      if (mentionedCityForNoField) {
        const sfAll = loadJSON('study-fields.json');
        const seenUrls = new Set();
        for (const sfItem of (sfAll ? sfAll.studyFields || [] : [])) {
          for (const ki of (sfItem.known_institutions || [])) {
            if (!seenUrls.has(ki.url) &&
                (ki.url || '').match(/shabaton\.online|morim\.boutique/) &&
                (ki.locations || []).some(loc => loc.toLowerCase().includes(mentionedCityForNoField))) {
              cityInstitutions.push({ ...ki, fieldName: sfItem.name });
              seenUrls.add(ki.url);
            }
          }
        }
        console.log(`CITY-NO-FIELD institutions in "${mentionedCityForNoField}":`, cityInstitutions.length);
      }

      let directReply;
      if (cityInstitutions.length > 0) {
        // נמצאו מוסדות עם קורסים בעיר הספציפית
        const cityName = mentionedCityForNoField;
        let kiText = cityInstitutions.map(ki => {
          const cleanDesc = smartTruncate(cleanDescription(ki.description), 400).trim();
          return `**[${ki.title}](${ki.url})**\n${cleanDesc ? cleanDesc + '\n' : ''}[פנו למידע ולייעוץ אישי](${ki.url})`;
        }).join('\n\n');
        directReply = `פה תוכלו למצוא מידע על קורסים ב${cityName}, ולפנות ישירות למוסדות לשאלות ולייעוץ אישי:\n\n` +
          kiText + '\n\n' +
          `📚 [לכל הקורסים — חיפוש לפי אזור ותחום](https://www.shabaton.online/search-courses)` + footer;
      } else {
        // לא נמצאו מוסדות ספציפיים לעיר — מפנים לדף חיפוש כללי
        directReply = `הפורטל של שבתון מציג קורסים לפי אזורים. ` +
          `הישוב שציינת נמצא באזור **${region.name}**.\n\n` +
          `📚 [חפשו קורסים לפי אזור ותחום](https://www.shabaton.online/search-courses)\n\n` +
          `בדף החיפוש תוכלו לסנן לפי אזור, תחום לימוד, ומועד פתיחה.` + footer;
      }
      console.log('CITY-NO-FIELD direct reply:', region.name, regionUrl);
      return { context: '=== מידע על שבתון ===\n' + directReply, isInfo: true, courseCount: 0, urlToTitle: {} };
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
        return { context: '=== מידע על שבתון ===\n' + formatQAAnswer(fallbackQA) + qaFooterFB, isInfo: true, courseCount: 0, urlToTitle, qaId: fallbackQA.id };
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
      // אם עדיין אין שום תוכן משמעותי (לא QA, לא תואר-שני, לא קטגוריה) —
      // שאלה כללית מדי כדי להתאים לאף מנגנון ספציפי. במקום תשובה ריקה או
      // מבולבלת, מפנים לדף שאלות-ותשובות-נפוצות הכללי.
      const stillEmpty = !parts.some(p => p.length > 200 && (p.includes('===') || p.includes('**[')));
      if (stillEmpty) {
        console.log('Zero-results fallback: pointing to general FAQ page');
        parts.push('לא מצאתי מידע ספציפי לשאלה הזו, אבל יכול להיות שהתשובה נמצאת במדור השאלות והתשובות הנפוצות:\n📚 [שאלות ותשובות נפוצות בשבתון](https://www.shabaton.online/shabaton-qa)');
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

    // ── מחשבון המרת שעות קורס לש"ש — עדיפות ראשונה, לפני כל עיבוד אחר ──
    const shaShReply = tryCalculateShaShFromMessage(message);
    if (shaShReply) {
      console.log('SHASH CALCULATOR — direct reply');
      return res.json({ reply: shaShReply });
    }

    // ── שאלה על תאריך פתיחה של קורס ספציפי ──
    const courseDateReply = tryFindCourseOpeningDate(message);
    if (courseDateReply) {
      console.log('COURSE OPENING DATE LOOKUP — direct reply');
      return res.json({ reply: courseDateReply });
    }

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
      // אם השאלה עסקה בחובה/רשות — מוסיפים את משפט ההבהרה הסטנדרטי גם כאן,
      // כי הנתיב הזה עוקף לגמרי את buildContext (ואת ה-fieldName שממנו הכלל
      // הרגיל נשען). בלי זה, שאלת חובה/רשות על מוסד ספציפי הייתה מקבלת רק
      // כרטיס מוסד יבש בלי שום התייחסות לשאלה בפועל.
      const isChovaQ = /חובה|רשות|חובה או רשות|חובה ורשות|נחשב חובה|נחשב קורס חובה/.test(message);
      const chovaPrefix = isChovaQ
        ? 'יש קורסים שמוכרים כחובה ויש שמוכרים כרשות — תלוי במוסד הספציפי ובפרופיל האישי. מומלץ לוודא ישירות מול המוסד ומול קרן ההשתלמות:\n\n'
        : '';
      // מציגים גם את פירוט הקורסים בפועל (לא רק כרטיס-קישור יבש) — מאותרים
      // ומאוחדים מכל השדות שהמוסד מופיע בהם, ומסוננים לפי מונח ספציפי
      // מההודעה אם יש כזה (למשל "סמינרים" יציג רק את שורות הסמינרים).
      const instDesc = getInstitutionDescriptionByUrl(instLookup.url, message);
      const directInstReply =
        chovaPrefix +
        `**[${instLookup.title}](${instLookup.url})**\n${instDesc ? instDesc + '\n' : ''}` +
        `[פנו למידע ולייעוץ אישי](${instLookup.url})${FOOTER_DIRECT}`;
      console.log('INSTITUTION DIRECT MATCH (pre-buildContext):', instLookup.matchedKey, '→', instLookup.url, '| desc chars:', instDesc.length);
      await logToZapierEarly(message, directInstReply, 'institution-direct');
      return res.json({ reply: directInstReply });
    }

    // ── QA fallback: אם ההתאמה הדטרמיניסטית (searchQA) לא מצאה כלום, נותנים
    // ל-Claude (מודל קל) הזדמנות לזהות התאמה סמנטית לפני שממשיכים לחיפוש-
    // מוסדות/דף-מידע-גולמי. נקרא רק כשצריך, כדי לא להוסיף latency לרוב
    // הבקשות שכבר נתפסות דטרמיניסטית.
    let precomputedQA = null;
    if (!searchQA(message)) {
      // ── לא מפעילים את שכבת-הסיווג הסמנטית כשההודעה כבר תואמת keyword
      // ספציפי של תחום-לימוד קיים (למשל "פסיכודרמה") ──
      // אם היה QA באמת רלוונטי, ההודעה כמעט תמיד הייתה מכילה גם את
      // ה-keyword המפורש שלו — וה-searchQA הדטרמיניסטי למעלה כבר היה
      // תופס אותו. קריאה סמנטית במצב הזה חושפת לסיכון "כפיית התאמה"
      // לנושא לא-קשור. נצפה בפרודקשן: "קורסי פסיכודרמה" סווג בטעות
      // ל-sport_recognition_general_1 (כללי הכרה לספורט), והתשובה שילבה
      // את מוסדות הדרמה/פסיכודרמה (נכון) יחד עם כללי-ספורט לא-קשורים
      // (שגוי) — ב-2026-08.
      const hasSpecificFieldMatch = getFieldKeywords(message) && getFieldKeywords(message).length > 0;
      if (!hasSpecificFieldMatch) {
        precomputedQA = await classifyQAWithClaude(message, ANTHROPIC_API_KEY);
      } else {
        console.log('QA CLASSIFY SKIPPED: message already matches a specific study-field keyword');
      }
    }
    const { context, isInfo, courseCount, urlToTitle, coursesForClaude, categoryUrl, fieldName, regionName, requestedRegionName, qaId, usedFallbackInstitution, combinedNote, topicOverrodeCity, cityRegionCategoryUrl } = await buildContext(message, history, precomputedQA, ANTHROPIC_API_KEY);
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
      // אם coursesForClaude כבר מקובץ לפי שדה (יש בו סמני ###FIELD_HEADER###) —
      // הקיבוץ נעשה בכוונה ב-buildContext; אסור לערבב מחדש כי זה יפזר שוב
      // מוסדות ממוצא שדות שונים אקראית, ויאבד את ההפרדה הברורה בין התחומים.
      const hasFieldHeaders = coursesForClaude.some(c => c.startsWith('###FIELD_HEADER###'));
      let shuffled;
      if (hasFieldHeaders) {
        shuffled = coursesForClaude.map(c =>
          c.startsWith('###FIELD_HEADER###') ? `**${c.replace('###FIELD_HEADER###', '')}:**` : c
        );
      } else {
        // הגרלה — כל שאלה מציגה מוסדות בסדר שונה
        shuffled = [...coursesForClaude];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
      }
      const courseListText = shuffled.join('\n\n') + (combinedNote ? '\n\n' + combinedNote : '');
      let intro;
      if (!END_OF_SABBATICAL_RE.test(message) && getCourseDates(message) && courseCount <= 3 &&
          (/מתי|מועד|נפתח|פתיחה|תאריך|חודש|מאיזה|בקרוב/.test(message) ||
           /(^|\s)[בלמכ]?(יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|ינואר|פברואר|מרץ|אפריל|מאי|יוני)(\s|$|\?)/.test(message) ||
           isSummerQuery(message))) {
        // שאלת תזמון + מוסד ספציפי נמצא עם מועדים — פתיח ממוקד
        intro = `מצאנו מועדי פתיחה לקורס המבוקש, ולהלן פרטי המוסד ופרטי הפתיחה:`;
      } else if (/חובה|רשות|חובה או רשות|חובה ורשות|נחשב חובה|נחשב קורס חובה/.test(message) && fieldName) {
        // שאלת חובה/רשות — אין תשובה חד-משמעית, מפנים למוסדות לבירור ישיר
        intro = `בתחום **${fieldName}** יש קורסים שמוכרים כחובה ויש שמוכרים כרשות — תלוי במוסד הספציפי ובפרופיל האישי. מומלץ לפנות לכל מוסד ולוודא מול קרן ההשתלמות:`;
      } else if (usedFallbackInstitution && fieldName) {
        // לא נמצא מוסד שמלמד בפועל את הנושא הספציפי שנשאל — מציגים מוסד מומלץ
        // לכל תחום ה-${fieldName}, בכנות, ולא כתוצאה מסוננת מדויקת.
        intro = `לא מצאנו במאגר שלנו מוסד שמתמחה ספציפית בנושא שביקשת, אך בתחום ${fieldName} מומלץ לפנות למוסד הבא לבדוק זמינות, ובנוסף ניתן לעיין בכל הקורסים בתחום:`;
      } else if (topicOverrodeCity && fieldName) {
        // נצפה בפרודקשן: "קורס פסיפס בירושלים" — יש 7 מוסדות פסיפס אמיתיים
        // בארץ, אבל אף אחד מהם לא בירושלים. חייבים לפתוח בכנות שלא נמצא
        // התאמה מקומית ל-topicOverrodeCity.city, לפני שמציגים את הרשימה
        // הארצית — אחרת המשתמש חושב בטעות שאלה מוסדות מקומיים.
        intro = `לא מצאנו קורס ${topicOverrodeCity.term} ספציפית באזור ${topicOverrodeCity.city} — הנה קורסי ${fieldName} רלוונטיים באזורים אחרים בארץ:`;
      } else if (fieldName && regionName) {
        // אזור מאומת — דף האזור האמיתי נמצא והרשימה באמת מסוננת אליו
        intro = `פה תוכלו למצוא מידע על ${fieldName} באזור ${regionName} ובלמידה מרחוק, ולפנות ישירות למוסדות לשאלות ולייעוץ אישי:`;
      } else if (fieldName && requestedRegionName) {
        if (requestedRegionName === 'למידה מרחוק') {
          intro = `פה תוכלו למצוא מידע על ${fieldName} בלמידה מרחוק (קורסים מקוונים ואונליין), ולפנות ישירות למוסדות לשאלות ולייעוץ אישי:`;
        } else if (courseCount > 0) {
          // מצאנו מוסדות בסינון האזורי — פתיח חיובי (לא "לא הצלחנו")
          const isSportField = /ספורט|מחול|תנועה|פילאטיס|יוגה|שחייה|אירובי|כושר/.test(fieldName);
          if (isSportField) {
            intro = `פה תוכלו למצוא מוסדות ${fieldName} באזור ${requestedRegionName}.\n\n💡 **טיפ:** ניתן לקחת קורס ספורט קרוב לבית ולהגיש בקשה לאישורו מול קרן ההשתלמות — גם אם המוסד אינו ברשימה זו.\n📚 [קורסי ספורט מוכרים לשבתון](https://www.shabaton.online/sport)\n\nמוסדות ידועים בתחום באזורכם:`;
          } else {
            intro = `פה תוכלו למצוא מוסדות ${fieldName} באזור ${requestedRegionName}, ולפנות ישירות לשאלות ולייעוץ אישי:`;
          }
        } else {
          // Jina נכשל ואין מוסדות מסוננים — מציגים רשימה ארצית בכנות
          intro = `ביקשת מידע על ${fieldName} באזור ${requestedRegionName}. כרגע לא הצלחנו לאתר מידע מסונן ספציפית לאזור זה, כך שלהלן רשימה ארצית של מוסדות (חלקם מציעים גם למידה מרחוק) — מומלץ לבדוק זמינות באזור ${requestedRegionName} ישירות מול כל מוסד:`;
        }
      } else if (fieldName && categoryUrl && !categoryUrl.includes('results-all') && courseCount > 0) {
        // categoryUrl אזורי (results-jerusalem, results-Zafon וכו') — מוסדות מסוננים לפי אזור
        // גם אם requestedRegionName לא הגיע, הURL מעיד על סינון אזורי
        const regionLabel = requestedRegionName || (categoryUrl.match(/results-([^/]+)\//) || [])[1] || '';
        const regionDisplay = regionLabel ? ` באזור ${regionLabel.replace(/results-/i,'').replace(/-/g,' ')}` : '';
        intro = `פה תוכלו למצוא מוסדות ${fieldName}${regionDisplay}, ולפנות ישירות לשאלות ולייעוץ אישי:`;
      } else if (/ספורט|מחול|תנועה|פילאטיס|יוגה|שחייה|אירובי|כושר/.test(fieldName || '') && fieldName) {
        // שדה ספורט — מוסיפים טיפ על קורסי ספורט קרוב לבית + קישור לדף כללי הספורט
        intro = `פה תוכלו למצוא מידע על ${fieldName} מכל הארץ.\n\n💡 **טיפ:** ניתן לקחת קורס ספורט קרוב לבית ולהגיש בקשה לאישורו בתוכנית הלימודים מול קרן ההשתלמות — גם אם המוסד אינו ברשימה זו.\n📚 [קורסי ספורט מוכרים לשבתון](https://www.shabaton.online/sport)\n\nמוסדות שיש עליהם מידע בפורטל:`;
      } else if (fieldName) {
        intro = `פה תוכלו למצוא מידע על ${fieldName} מכל הארץ, כולל אפשרויות בלמידה מרחוק. ניתן לפנות ישירות למוסדות שלהלן לשאלות ולייעוץ אישי:`;
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
      // ── הזמנה לעיין בקורסי-אותו-תחום אחרים, בעיר שביקשו בפועל ──
      // כשהצגנו רשימה ארצית כי אין התאמה-נושאית בעיר המבוקשת (topicOverrodeCity),
      // הגולש עדיין עשוי להתעניין בקורסים אחרים באותו תחום שכן קיימים בעירו.
      const cityInviteLink = (topicOverrodeCity && cityRegionCategoryUrl)
        ? `\n📚 [מוזמנים למצוא קורסי ${fieldName || 'התחום'} אחרים ב${topicOverrodeCity.city}](${cityRegionCategoryUrl})`
        : '';
      const reply = intro + '\n\n' + courseListText + catLink + cityInviteLink + FOOTER_DIRECT;
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
