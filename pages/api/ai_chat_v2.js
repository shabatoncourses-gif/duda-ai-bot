// שַׁבִּיבּוֹט - עוזר שבתון AI v5
// ESM format - package.json has "type": "module"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

// ── System Prompt ──────────────────────────────────────
const SYSTEM_PROMPT =
  'שמך שַׁבִּיבּוֹט, העוזר החכם של שבתון.\n' +
  'ענה בעברית תקנית, ידידותית ומקצועית. אל תשתמש בניסוחים מוגזמים.\n' +
  'כללי עברית — חובה: (1) זהה מין לפי השאלה: "אני עובדת" = נקבה, "אני עובד" = זכר. (2) אסור לערבב: "את צריכה" או "אתה צריך" — לא "אתה צריכה". (3) אם לא ברור — לשון ניטרלית ללא כינוי אישי.\n' +
  'לעולם אל תאמר שאין קורסים, שאתה מצטער, אינך יכול לענות, או שהמידע לא קיים.\n' +
  'אסור להשתמש בתווים שאינם עברית, אנגלית, מספרים או פיסוק סטנדרטי. אסור אמוג\'יים זרים, סימנים אסיאתיים או תווים מיוחדים כגון 멋진.\n' +
  'אסור: להמציא מידע, לתת עצות, להמליץ על פעולות, או לפרט "מה כדאי לעשות" — אלא אם זה כתוב מפורשות ב-context או ב-QA. ענה רק על מה שנשאלת.\n' +
  'כלל ברזל: אל תמציא מידע. אל תתן עצות, המלצות, או מה "כדאי לעשות" שאינם כתובים במפורש ב-context או ב-QA. אם אין מידע — הפנה לקבוצת הווטסאפ.\n' +

  '=== שאלות קורסים ===\n' +
  'הצג 10-15 מוסדות מהרשימה בcontext. הצג כמה שיותר — אל תקצץ.\n' +
  'כלל תיאורים: כתוב תיאור קצר ורלוונטי לשאלה. אם הגולש ביקש למידה מרחוק — ציין במפורש אם הקורס מוצע מרחוק/אונליין. אסור להמציא. עברית תקנית.\n' +
  'אל תציג תואר שני אלא אם ביקשו.\n' +
  'בנושא טיולים: הצג רק סמינרים וסיורים שמורים הולכים אליהם — לא קורסי הכשרת מורי דרך.\n\n' +

  'הקורסים מסופקים כ-markdown מוכן. העתק אותם בדיוק — אסור לשנות שם, קישור או תיאור.\n\n' +
  'הקורסים מסופקים כ-markdown מוכן. העתק אותם בדיוק.\n\n' +
  'פורמט לכל מוסד — בדיוק כך, ללא שינויים:\n' +
  '**[שם המוסד](URL)**\n' +
  'תיאור\n' +
  '[פנו למידע ולייעוץ אישי](URL)\n\n' +
  'חשוב: אחרי התיאור — רק הכפתור [פנו למידע]. אסור לחזור על שם המוסד לפני הכפתור.\n\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  'לשאלות קורסים: הוסף 📚 [כל קורסי [שם התחום]](URL מה-context — קישור לתחום). אם אין URL — השמט.\n' +
  '💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n' +
  '👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)\n\n' +

  '=== כללי אזור ===\n' +
  'אם הגולש לא ציין אזור — אל תוסיף אזור לכותרת ולא ב-footer.\n' +
  'השתמש ב-results-all (כל הארץ) כשאין אזור ספציפי.\n\n' +
  '=== שאלות מידע ===\n' +
  'ענה אך ורק על פי המידע ב-context (שורות === מידע מ-URL ===). אסור להמציא.\n' +
  'ה-URL לקישור: השתמש בשורה "קישור לדף: URL" שמופיעה בסוף ה-context. חובה לכלול [לפירוט ולמידע נוסף](URL) בסוף התשובה.\n' +
  'ה-URL: הכתובת שמופיעה אחרי === מידע מ- ב-context.\n' +
  'כותרות — **bold** לנושאים. אסור להוסיף שמות מוסדות, קישורי מוסדות, או **[שם](URL)** בתשובות מידע.\n' +
  'סיים תמיד עם: [לפירוט ולמידע נוסף](URL) ואחריו footer: 📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton) 💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME) 👥 [הצטרפו לקבוצת הפייסבוק שלנו](https://www.facebook.com/groups/shabaton.online)\n';
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
        return { name: f.name, slug: encodeURIComponent(f.slug), fetchFromUrl: f.fetchFromUrl || false, categoryUrl: f.categoryUrl || null };
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
      if (url.includes('/results-')) continue;
      // עברית ב-URL = דף קטגוריה (לגימלאים, ספורט וכו')
      if (/%[Dd][0-9A-Fa-f]/.test(url) || /[\u0590-\u05FF]/.test(url)) continue;
      // סנן סמינרים וטיולים - לא קורסים
      const titleLower = (page.title || '').toLowerCase();
      if (/סמינר|טיול|סיור|אירוע/.test(titleLower)) continue;
      // סנן דפי קטגוריה כלליים (העשרה, פנאי, העצמה)
      if (/קורסי העשרה|קורסי העצמה|קורסי פנאי|קורסי העצמה אישית/.test(titleLower)) continue;
      // סנן תוארי שני (אלא אם הגולש ביקש)
      if (/^תואר שני/.test(titleLower) && !message.includes('תואר שני')) continue;
      // סנן הכשרת מורי דרך/תיירות כשמחפשים קורסי טיולים רגילים
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
          // סנן אם החודש כבר עבר
          if (pageYear < curYear || (pageYear === curYear && pageMonth < curMonth)) continue;
        }
      }
      // סנן דפי קטגוריה כלליים
      if (/^קורסי |^קורסים ל|^שבתון - קורסים|^לימודי |^ספורט,|^בריאות ו|^גיל רך|^חינוך גופני/.test(titleLower)) continue;
      // סנן דפי URL עם חודשים
      if (/\/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-_]/.test(url.toLowerCase())) continue;
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
        if (wrongRegion && !cityMatchCorrect && region.slug !== 'online') { seen.add(url); continue; }

        // אין קשר לאזור כלל — סנן (אלא אם למידה מרחוק)
        if (!cityMatchCorrect && !wrongRegion) {
          const isOnline = tdOnly.match(/מרחוק|זום|zoom|אונליין|online|מקוון/i) ||
            (page.text||'').match(/מרחוק|זום|zoom|אונליין|online|מקוון/i);
          if (region.slug === 'online') {
            // חיפוש מרחוק: אל תסנן — live scan יבדוק Jina ויסמן _isOnline
            if (isOnline) score += 3; // bonus למי שיש מרחוק ב-index
          } else {
            if (!isOnline) { seen.add(url); continue; }
            score = Math.max(1, score - 3);
          }
        }
      }
      if (url.includes('shlomit') || url.includes('idit-link')) {
        const tdOnly = (page.title + ' ' + (page.description||'')).toLowerCase();
        console.log('TRACE:', url.split('/').pop(), 'score:', score, 'region_check:', region ? region.name : 'none');
      }
      seen.add(url);
      // חלץ snippet רלוונטי מה-text אם המונח נמצא בו
      let snippet = page.description || '';
      if (text) {
        const qLower = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (const qw of qLower) {
          const tidx = text.indexOf(qw);
          if (tidx >= 0) {
            snippet = text.substring(Math.max(0, tidx - 30), tidx + 300).trim();
            score = Math.max(score, 2); // וודא שלא נסוּנן
            break;
          }
        }
      }
      results.push({ title: page.title, url, description: snippet, score, _text: text });
    }
  }
  const sorted = results.sort((a,b) => b.score - a.score).slice(0, 25);
  return sorted;
}

// ── זיהוי דפי מידע ────────────────────────────────────
function detectInfoPages(question) {
  const q = question.toLowerCase();
  const pages = [

    // רשימת משימות / איך מתחילים
    { kw: ['רשימת משימות','צ\'קליסט','כיצד מתחילים','איך מתחילים','תהליך יציאה','איך יוצאים לשבתון','מה לעשות לפני שבתון'],
      url: 'https://www.shabaton.online/shabaton_checklist' },

    // תכנון תוכנית לימודים / טבלת עזר
    { kw: ['תכנון','תוכנית לימודים','תכנית לימודים','טבלת עזר','הרכבת תוכנית','מתכנן','מתכננים','לתכנן','איך מרכיב','בניית תוכנית','תכנון לימודים','להרכיב תוכנית','מה ללמוד בשבתון','כמה שעות ללמוד','לימוד בשבתון','לימודי חובה ורשות','לימודי רשות','מוסדות מאושרים ללמוד','חובות לימודים','שעות חובה','שעות השלמה','שעות רשות','לימודי חובה','לימודי השלמה','ספורט בשבתון','שינוי תוכנית','אופק חדש בשבתון','גמול השתלמות','מסלול אישי','פרויקט אישי','לימודים בחו"ל'],
      urls: ['https://www.shabaton.online/shabaton-plan','https://www.shabaton.online/learning_programs_shabaton'] },

    // חובות לימודים / חלוקת שעות / מוסדות מאושרים / נושאים מאושרים
    { kw: ['חובות לימודים','שעות חובה','שעות השלמה','שעות רשות','לימודי חובה','לימודי השלמה','מוסדות מאושרים','נושאי השתלמות','ספורט בשבתון','שינוי תוכנית','אופק חדש','תואר שלישי','דוקטורט','גמול השתלמות','מסלול אישי','פרויקט אישי','ישיבה','לימודים בחו"ל','לימודים בחול','תוכנית לימודים','להרכיב תוכנית','הרכבת תוכנית','בניית תוכנית','מה ללמוד','כמה שעות','תכנית לימודים','לימוד בשבתון','לימודי רשות','לימודי חובה ורשות','מוסדות ללמוד'],
      url: 'https://www.shabaton.online/learning_programs_shabaton' },

    // לוח זמנים / בקשת שבתון / טפסים לקרן
    { kw: ['לוח זמנים','מועדים','בקשת שבתון','אישור זכאות','מתי מגישים','מתי להגיש','מערכת הגשה'],
      url: 'https://www.shabaton.online/luz_shabaton' },

    // תיאום מס / מס הכנסה
    { kw: ['תיאום מס','מס הכנסה','טופס 101 מס','החזר מס','פטור ממס'],
      url: 'https://www.shabaton.online/Payments_shabaton' },

    // תיאום מס / מס הכנסה
    { kw: ['תיאום מס','מס הכנסה','טופס 101 מס','החזר מס','פטור ממס'],
      url: 'https://www.shabaton.online/Payments_shabaton#1989197642' },

    // ביטוח לאומי
    { kw: ['ביטוח לאומי','דמי ביטוח','תשלום ביטוח','ביטוח לאומי בשבתון'],
      url: 'https://www.shabaton.online/btl_shabaton' },

    // קבלות להחזר שכר לימוד
    { kw: ['קבלות','קבלה להחזר','קבלות שכר לימוד'],
      url: 'https://www.shabaton.online/kabalot_shabaton' },

    // החזר שכר לימוד
    { kw: ['החזר שכר לימוד','החזר שכ"ל','החזר שכל','כמה מחזירים','החזר לימודים'],
      url: 'https://www.shabaton.online/tuition_reimbursement' },

    // מענק חודשי / גובה מענק
    { kw: ['מענק','כמה מענק','גובה מענק','מענק חודשי','חישוב מענק','כמה מקבלים','כמה מרוויחים'],
      url: 'https://www.shabaton.online/shabaton-maanak' },

    // לידה / דמי לידה / חופשת לידה
    { kw: ['לידה','דמי לידה','חופשת לידה','הריון בשבתון','ילד בשבתון'],
      url: 'https://www.shabaton.online/birth_shabatgon' },

    // קרן פנסיה
    { kw: ['פנסיה','קרן פנסיה','הפרשה לפנסיה'],
      url: 'https://www.shabaton.online/pension_shabaton' },

    // קרן מקוצרת / מקור / מישור
    { kw: ['קרן מקוצרת','מקור','מישור','קרן מקור','קרן מישור','הפרשה לקרן'],
      url: 'https://www.shabaton.online/keren_makor_mishor' },

    // טופס 101
    { kw: ['טופס 101','101','ניכוי מס במקור'],
      url: 'https://www.shabaton.online/tofes_101' },

    // טפסים ומסמכים
    { kw: ['טפסים','טופס','מסמכים','חל"ת','הצהרה על עבודה','הודעה על חזרה','אישור סיום'],
      url: 'https://www.shabaton.online/forms_shabaton' },

    // שבתון מלא או חצי
    { kw: ['שבתון מלא','חצי שבתון','מלא או חצי','הבדל בין שבתון','שבתון שלם'],
      url: 'https://www.shabaton.online/halforfull_shabaton' },

    // מלגות לימודים
    { kw: ['מלגה','מלגות','מלגת לימודים','השתתפות בשכר לימוד'],
      url: 'https://www.morim.online/milgot-morim' },

    // סרטוני הדרכה
    { kw: ['סרטון','וידאו','הסבר מצולם','סרטוני הדרכה'],
      url: 'https://www.shabaton.online/shabaton-video' },
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
  // חפש גם ב-c.questions (nested) וגם ישירות ב-categories
  const allQ = (qa.categories || []).flatMap(c => {
    const nested = c.questions || [];
    // אם לitem יש answer ישירות — זה entry ישיר
    const direct = (c.answer && c.keywords) ? [c] : [];
    return [...nested, ...direct];
  });
  return allQ.find(q => (q.keywords || []).some(k => qL.includes(k.toLowerCase()))) || null;
}


// ── דפי מוסדות לסריקה בזמן אמת כש-text חסר ──────────
function getInstitutionPagesForField(question) {
  // מחזיר דפי מוסדות לסריקה — כולל כל האינדקסים, ממוין לפי רלוונטיות
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
      // ניקוד: דפים שtitle/desc קרוב לשאלה — קודם בתור
      const titleScore = qWords.filter(w => title.includes(w)).length * 2;
      const descScore  = qWords.filter(w => desc.includes(w)).length;
      // עברית ב-URL = דף קטגוריה
      if (/%[Dd][0-9A-Fa-f]/.test(url) || /[\u0590-\u05FF]/.test(url)) continue;
      seen.add(url);
      results.push({ title: page.title, url, description: page.description || '', _score: titleScore + descScore, _text: (page.text||'').toLowerCase() });
    }
  }
  // הוסף known_institutions מ-study-fields — מוסדות סמכותיים לתחום
  try {
    const sfD = loadJSON('study-fields.json');
    if (sfD) {
      const qLL = question.toLowerCase();
      for (const sf of (sfD.studyFields || [])) {
        const kws = sf.keywords || [];
        if (kws.some(k => qLL.includes(k.toLowerCase())) && sf.known_institutions) {
          for (const ki of sf.known_institutions) {
            const existing = results.find(r => r.url === ki.url);
            if (existing) {
              existing._score = 200; // קדם לראש
              if (ki.title) existing.title = ki.title;
            } else {
              results.unshift({ title: ki.title, url: ki.url, description: ki.description || '', _score: 200, _text: '' });
            }
          }
          break;
        }
      }
    }
  } catch(e) {}
  // מיין: קדם דפים שה-text שלהם כבר מכיל מונחים ספציפיים
  // מיין: דפים שה-text שלהם מכיל את המונח הספציפי → ראשונים (כנראה מוסדות רלוונטיים)
  results.sort((a, b) => {
    const aText = qWords.some(w => (a._text||'').includes(w)) ? 20 : 0;
    const bText = qWords.some(w => (b._text||'').includes(w)) ? 20 : 0;
    return (b._score + bText) - (a._score + aText);
  });
  // החזר רק דפים שיש להם text match ראשונים, עד 20
  const withTextMatch = results.filter(r => qWords.some(w => (r._text||'').includes(w)));
  const withoutText   = results.filter(r => !qWords.some(w => (r._text||'').includes(w)));
  return [...withTextMatch.slice(0, 20), ...withoutText.slice(0, 20)]; // עד 40 דפים
}

// ── buildContext ──────────────────────────────────────

async function fetchPageContent(url) {
  try {
    // Jina AI reader — מרנדר JavaScript ומחזיר טקסט נקי
    const jinaUrl = 'https://r.jina.ai/' + url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const jinaHeaders = {
      'Accept': 'text/plain',
      'X-Return-Format': 'text',
      'User-Agent': 'shabaton-bot/1.0'
    };
    if (process.env.JINA_API_KEY) jinaHeaders['Authorization'] = 'Bearer ' + process.env.JINA_API_KEY;
    const res = await fetch(jinaUrl, {
      headers: jinaHeaders,
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      let text = await res.text();
      // הסר meta headers של jina
      text = text.replace(/^Title:.*\n/gm,'').replace(/^URL Source:.*\n/gm,'')
                 .replace(/^Markdown Content:/gm,'').replace(/^={3,}.*\n/gm,'');
      // דלג על nav — מצא תוכן רלוונטי
      const markers = ['תשלומים ותקבולים בשנת שבתון','ביטוח לאומי בשנת שבתון','מי חייב',
                       'המענק החודשי','החזר שכר לימוד','חישוב המענק','שבתון מלא או חצי',
                       'תוכניות הלימודים בשבתון','חובות הלימודים','שעות חובה',
                       'מה לומדים','בניית התוכנית','תכנית הלימוד','לוח הזמנים',
                       'רשימת משימות','צ\u0027קליסט','איך מתחילים','זכאות לשבתון',
                       'קבלות','החזר שכ\u0022ל','פנסיה בשבתון','לידה בשבתון',
                       'טופס 101','תיאום מס','מלגות לימודים','סרטוני הדרכה'];
      // מצא שורה ראשונה עם תוכן ממשי — לא nav link קצר
      // nav links הם שורות קצרות (< 60 תווים), תוכן אמיתי ארוך יותר
      const lines2 = text.split('\n');
      let contentStart = -1;
      // חפש: שורה עם 60+ תווים עבריים שאינה nav
      const navPhrases = ['קרן ארגון','קרן הסתדרות','לוח הזמנים - סוף','החזר שכר לימוד לקרן','קבלות החזר','הודעה על חזרה'];
      for (let li = 0; li < lines2.length; li++) {
        const l = lines2[li].trim();
        const isNav = navPhrases.some(p => l.includes(p)) || (l.length < 60 && /^[\[*]/.test(l));
        if (!isNav && l.length > 60 && /[א-ת]{15,}/.test(l)) {
          contentStart = li;
          break;
        }
      }
      if (contentStart > 0) {
        text = lines2.slice(contentStart).join('\n');
      } else {
        // fallback: דלג על 30% הראשון (nav)
        text = text.substring(Math.floor(text.length * 0.3));
      }
      text = text.replace(/\s{3,}/g,'\n\n').trim();
      console.log('Jina OK:', url.split('/').pop(), 'len:', text.length);
      return text.substring(0, 5000);
    }
    console.log('Jina failed status:', res.status);
  } catch(e) {
    console.log('Jina error:', e.message);
  }
  // fallback: fetch ישיר
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


async function buildContext(message) {
  const region = detectRegion(message);
  const _reqPhrases = ['הנחיית קבוצות','הנחיה קבוצתית','הדרכת הורים','הדרכה הורית',
    'הוראה מתואמת','הוראה מתקנת','ניהול כיתה','עיצוב גרפי','בישול בריא','אפייה בריאה',
    'טיפול זוגי','טיפול משפחתי','פוטו תרפיה','פוטותרפיה','ארומתרפיה','דרמה תרפיה',
    'תנועה טיפולית','מוזיקה טיפולית','טיפול בבעלי חיים'];
  const requiredPhrase = _reqPhrases.find(p => message.toLowerCase().includes(p)) || null;
  console.log('region:', region ? region.name : 'none', '| msg:', message.substring(0,30));
  const parts = [];
  const urlToTitle = {}; // מפת URL→שם לpost-processing

  // קורסים לציבור הדתי — fetch מדף ייעודי
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
        // חלץ: שם מוסד + URL + תיאור
        const instPattern = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{5,80})<\/a>/g;
        const insts = [];
        let m;
        const seen = new Set();
        while ((m = instPattern.exec(rawHtml)) !== null) {
          const url = m[1], name = m[2].trim();
          if (!seen.has(url) && !url.includes('results-all') && !url.includes('shabaton.online/#') && name.length > 5) {
            seen.add(url);
            insts.push({ url, name });
          }
        }
        // בנה context ב-markdown מוכן
        if (insts.length > 0) {
          // סנן לפי אזור אם צוין
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
            // חלץ תיאור קצר אחרי ה-link
            const pos = rawHtml.indexOf(i.url);
            const snippet = rawHtml.substring(pos + i.url.length + 50, pos + i.url.length + 400)
              .replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, 200);
            urlToTitle[i.url] = i.name;
            return '**[' + i.name + '](' + i.url + ')**\n' + snippet + '\n[פנו למידע ולייעוץ אישי](' + i.url + ')';
          });
          parts.push('=== קורסים שנמצאו ===\n\n' + mdLines.join('\n\n'));
          parts.push('קישור לכל קורסי ציבור הדתי: ' + datiUrl);
          console.log('Dati institutions found:', filtered.length);
          return { context: parts.join('\n\n'), isInfo: false, courseCount: filtered.length, urlToTitle };
        }
      }
    } catch(e) { console.log('Dati fetch error:', e.message); }
  }

  const infoUrls = detectInfoPages(message) || [];
  if (infoUrls.length > 0) {
    let gotContent = false;
    // 0. בדוק info-pages.json (תוכן מהדפים — הכי מדויק)
    const infoPageDB = loadJSON('info-pages.json') || {};
    for (const url of infoUrls.slice(0, 3)) {
      const baseUrl = url.split('#')[0];
      const entry = infoPageDB[url] || infoPageDB[baseUrl] ||
        Object.values(infoPageDB).find((v, idx) => Object.keys(infoPageDB)[idx].startsWith(baseUrl));
      if (entry && entry.content && entry.content !== '<<CONTENT_FROM_PAGE>>') {
        console.log('INFO from static DB:', url);
        parts.push('=== מידע מ-' + url + ' ===\n' + entry.content);
        gotContent = true; break;
      }
    }
    // תחילה: חפש באינדקסים (מהיר)
    const indexes2 = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json'];
    for (const url of infoUrls.slice(0, 2)) {
      const slug = url.split('/').pop().replace('#', '_');
      for (const fname of indexes2) {
        const data = loadJSON(fname);
        if (!data) continue;
        const pages = Array.isArray(data) ? data : (data.pages || []);
        const found = pages.find(p => p.url && (p.url.includes(slug) || p.url === url));
        if (found && found._text && found._text.length > 100) {
          console.log('INFO from index:', url, 'len:', found._text.length);
          parts.push('=== מידע מ-' + url + ' ===\n' + found._text.substring(0, 5000));
          gotContent = true;
          break;
        }
      }
      if (gotContent) break;
    }
    // fallback: סרוק מהאינטרנט
    if (!gotContent) {
      const contents = await Promise.all(infoUrls.slice(0, 2).map(url => fetchPageContent(url)));
      contents.forEach((content, i) => {
        if (content) {
          console.log('INFO page fetched:', infoUrls[i], 'len:', content.length);
        console.log('INFO CONTENT:', content.substring(0, 500).replace(/[\n\r]/g,' '));
          // נקה links מJina כדי שClaude לא יכלול מוסדות
          const cleanContent = content
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // הסר markdown links
            .replace(/https?:\/\/[^\s]+/g, '')          // הסר URLs גולמיים
            .replace(/🏫[^\n]*/g, '')                   // הסר institution emojis
            .trim();
          parts.push('=== מידע מ-' + infoUrls[i] + ' ===\n' + cleanContent + '\n\nקישור לדף: ' + infoUrls[i]);
          gotContent = true;
        } else {
          console.log('INFO page FAILED:', infoUrls[i]);
        }
      });
    }
    if (!gotContent) {
      const qaMatch = searchQA(message);
      if (qaMatch) {
        // QA match — החזר ישירות ללא scan נוסף
        return { context: '=== מידע על שבתון ===\n' + qaMatch.answer, isInfo: true, courseCount: 0, urlToTitle: {} };
      }
      if (false && qaMatch) { // dead code
        parts.push('=== מידע על שבתון ===\n' + qaMatch.answer);
      } else {
        parts.push('=== דפי מידע רלוונטיים ===\n' + infoUrls.map(u => '- ' + u).join('\n'));
      }
    }
    // שאלת מידע — אל תמשיך ל-institution scan
    if (gotContent) return { context: parts.join('\n\n'), isInfo: true, courseCount: 0, urlToTitle };
  }

  // אם יש known_institutions לתחום — השתמש בהם ישירות וחזור
  const sfForKI = loadJSON('study-fields.json');
  let knownOnly = null;
  if (sfForKI) {
    const msgLKI2 = message.toLowerCase();
    for (const sfItem of (sfForKI.studyFields || [])) {
      const kws = sfItem.keywords || [];
      if (kws.some(k => msgLKI2.includes(k.toLowerCase())) && sfItem.known_institutions && sfItem.known_institutions.length > 0) {
        knownOnly = sfItem.known_institutions;
        break;
      }
    }
  }

  // shortcut: אם known_institutions — סרוק אותם ישירות וחזור
  if (knownOnly) {
    const kiParts = [];
    // השתמש בtיאור המוכן מה-JSON — מהיר ומדויק
    const kiResults = knownOnly.map(ki => ({
      title: ki.title,
      url: ki.url,
      desc: ki.description || ''
    }));
    for (const r of kiResults) {
      kiParts.push(`שם: ${r.title}\nקישור: ${r.url}${r.desc ? '\nתיאור: ' + r.desc : ''}`);
    }
    // footer
    const fieldSlug2 = getFieldSlug(message);
    const footerUrl2 = fieldSlug2 ? `https://www.shabaton.online/results-all/${encodeURIComponent(fieldSlug2)}` : 'https://www.shabaton.online/search-courses';
    const footerName2 = fieldSlug2 || 'הנושא';
    kiParts.push(`\nקישור לכל קורסי ${footerName2}: ${footerUrl2}`);
    kiParts.push('קישור לעלון שבתון: https://www.shabaton.online/shabaton');
    kiParts.push('קישור לווטסאפ: https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME');
    // הוסף קישור 📚 לכל קורסי התחום
    const kiFieldInfo = getFieldSlug(message);
    if (kiFieldInfo) kiParts.push('קישור לכל קורסי התחום: https://www.shabaton.online/results-all/' + encodeURIComponent(kiFieldInfo.name || kiFieldInfo));
    return { context: kiParts.join('\n'), isInfo: false, courseCount: kiResults.length, urlToTitle: {} };
  }

  const courses = searchCourses(message, region);
  const fieldKeywords = getFieldKeywords(message);
  const genericWords2 = new Set(['קורס','קורסי','קורסים','למורים','לגננות','בשבתון','מורים','גננות','שבתון','לימוד','לימודים']);
  const qLower2 = message.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !genericWords2.has(w));

  // סרוק דפי מוסדות בזמן אמת לפי תחום
  // בדוק QA לפני institution scan — גם לשאלות מידע כלליות
  const qaGeneral = searchQA(message);
  if (qaGeneral) {
    console.log('QA general match:', qaGeneral.id || qaGeneral.question);
    return { context: '=== מידע על שבתון ===\n' + qaGeneral.answer, isInfo: true, courseCount: 0, urlToTitle };
  }

  if (fieldKeywords && fieldKeywords.length > 0) {
    const institutionPages = getInstitutionPagesForField(message);
    // פצל מילות חיפוש מורכבות (כמו פוטותרפיה → פוטו + תרפיה)
    const expandedQ = [...qLower2];
    qLower2.forEach(function(w) {
      if (w.length > 6) {
        // נסה לפצל: 3 תווים + שאר
        for (var si = 3; si <= w.length-3; si++) {
          var p1 = w.substring(0, si), p2 = w.substring(si);
          if (p1.length >= 3 && p2.length >= 3 && !expandedQ.includes(p1)) {
            expandedQ.push(p1, p2);
          }
        }
      }
    });
    const instWithText = institutionPages.filter(p => {
      const pt = (p._text||'');
      if (requiredPhrase) return pt.includes(requiredPhrase) ||
        (p.title||'').toLowerCase().includes(requiredPhrase) ||
        (p.description||'').toLowerCase().includes(requiredPhrase);
      return expandedQ.length > 0 && expandedQ.some(w => pt.includes(w));
    });
    console.log('instWithText count:', instWithText.length, instWithText.slice(0,8).map(p => p.url.split('/').pop()).join(' | '));

    const dyellIn = institutionPages.find(p => p.url.includes('dyellin'));
    if (institutionPages.length > 0) {
      const existingUrls = new Set();
      // הרחב את החיפוש: qLower2 + fieldKeywords ייחודיים של התחום
      const sfDataInst = loadJSON('study-fields.json');
      const fieldKwsExtra = [];
      if (sfDataInst) {
        const msgL = message.toLowerCase();
        for (const sf of (sfDataInst.studyFields || [])) {
          const kws = sf.keywords || [];
          const fieldMatch = kws.some(k => msgL.includes(k.toLowerCase()));
          if (fieldMatch) {
            // הוסף keywords ייחודיים (length>2, לא גנריים)
            const generic = new Set(['קורס','קורסי','קורסים','מורים','גננות','שבתון','למורים','לגננות']);
            kws.filter(k => k.length > 2 && !generic.has(k)).forEach(k => {
              if (!fieldKwsExtra.includes(k.toLowerCase())) fieldKwsExtra.push(k.toLowerCase());
            });
            break;
          }
        }
      }
      const qSpecific2 = [...new Set([...qLower2, ...fieldKwsExtra])];
      const msgLower2 = message.toLowerCase();
      console.log('qSpecific2:', qSpecific2.slice(0,8).join(' | '));
      for (const name of ['hemdat','igud_arim','washington','foodprof']) {
        const found = name === 'washington'
        ? institutionPages.find(p => p.url.toLowerCase().includes('washington-morim')) || institutionPages.find(p => p.url.toLowerCase().includes('washington'))
        : institutionPages.find(p => p.url.toLowerCase().includes(name));
        if (found) {
          const txt = (found._text || '');
          const hasM = qSpecific2.some(w => txt.includes(w));
          console.log('CHECK:', name, '| hasMatch:', hasM, '| preview:', txt.substring(0, 150).replace(/[\r\n]+/g, ' '));
        } else { console.log('NOT IN INDEX:', name); }
      }

      // שלב א: דפים שה-text באינדקס כבר מכיל התאמה — הוסף ישירות בלי fetchPageContent
      const textIndexPages = institutionPages.filter(p => {
        if (existingUrls.has(p.url)) return false;
        const pt = (p._text||'');
        // אם יש צירוף מחייב — דרוש אותו
        if (requiredPhrase) return pt.includes(requiredPhrase) ||
          (p.title||'').toLowerCase().includes(requiredPhrase) ||
          (p.description||'').toLowerCase().includes(requiredPhrase);
        return qSpecific2.some(w => pt.includes(w));
      });
      console.log('textIndex pages:', textIndexPages.map(p => p.url.split('/').pop()).join(' | '));
      textIndexPages.forEach(p => {
        // מצא snippet מה-text
        let instSnippet = p.description;
        for (const qw of qSpecific2) {
          const tidx = (p._text||'').indexOf(qw);
          if (tidx >= 0) {
            instSnippet = p._text.substring(Math.max(0, tidx - 30), tidx + 400).trim();
            break;
          }
        }
        // תסמן כrelvant רק אם ה-snippet מכיל את המונח
        const snippetHasQ = qSpecific2.some(w => instSnippet.toLowerCase().includes(w));
        const shortU = p.url.split('/').pop();
        if (['hemdat','igud_arim','foodprof'].includes(shortU)) {
          console.log('textIndex snippet:', shortU, 'hasQ='+snippetHasQ, instSnippet.substring(0,80));
        }
        // region filter לtextIndex
        let skipPage = false;
        if (region) {
          const tdCheck = (p.title + ' ' + instSnippet + ' ' + (p.description||'')).toLowerCase();
          const regD2 = loadJSON('regions.json');
          if (regD2) {
            let wrongR = false, rightC = false;
            for (const orr of (regD2.regions || [])) {
              if (orr.slug === region.slug) {
                rightC = (orr.cities || []).some(c => c.length > 2 && tdCheck.includes(c.toLowerCase()));
              } else {
                if ((orr.cities || []).some(c => c.length > 3 && tdCheck.includes(c.toLowerCase()))) wrongR = true;
              }
            }
            if (wrongR && !rightC) skipPage = true;
          }
        }
        if (!skipPage) courses.push({ title: p.title, url: p.url, description: instSnippet, score: 3, _liveRelevant: snippetHasQ });
        existingUrls.add(p.url);
      });

      // וודא שכל known_institutions נסרקים (גם אם כבר ב-existingUrls)
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

      // שלב ב: סרוק עד 5 דפים נוספים ללא text match
      // סרוק: כל דפי textMatch (שה-_text מכיל מונח) + עד 8 נוספים
      const remainingInst = institutionPages.filter(p => !existingUrls.has(p.url));
      const withTextMatch2 = remainingInst.filter(p => qSpecific2.some(w => (p._text||'').includes(w)));
      const withoutText2   = remainingInst.filter(p => !qSpecific2.some(w => (p._text||'').includes(w)));
      const toScan5 = [...withTextMatch2, ...withoutText2]; // סרוק את כולם
      const scanned = await Promise.all(
        toScan5.map(async p => {
          const content = await fetchPageContent(p.url);
          if (!content) return null;
          // רק מילים ספציפיות (לא "קורסי", "קורס", "למורים")
          // אם הדף כבר התאים ב-_text (withTextMatch2) — תמיד רלוונטי
          const isAlreadyTextMatch = withTextMatch2.some(tm => tm.url === p.url);
          const contentLower3 = content.toLowerCase();
          const onlineKeywords = /מרחוק|זום|zoom|אונליין|online|מקוון|מתוקשב/;
          // בדוק מרחוק גם ב-index (title/desc/_text) — לא רק בJina
          const pageOnline = onlineKeywords.test((p.title||'') + ' ' + (p.description||'') + ' ' + (p._text||''));
          // בדוק רלוונטיות לנושא
          const topicMatch = requiredPhrase
            ? contentLower3.includes(requiredPhrase)
            : (isAlreadyTextMatch || qSpecific2.some(w => contentLower3.includes(w)));
          // עבור חיפוש מרחוק: דרוש התאמה לנושא, online = bonus score
          const relevant = topicMatch;
          if (relevant && region && region.slug === 'online') {
            p._isOnline = onlineKeywords.test(contentLower3) || pageOnline;
          }
          // סנן לפי אזור — אם יש region ואם הדף שייך לאזור אחר
          if (relevant && region) {
            const regD = loadJSON('regions.json');
            if (regD) {
              const contentLower = content.toLowerCase();
              let wrongReg = false, rightCity = false;
              for (const or2 of (regD.regions || [])) {
                if (or2.slug === region.slug) {
                  rightCity = or2.cities.some(c => c.length > 2 && contentLower.includes(c.toLowerCase()));
                } else {
                  if (or2.cities.some(c => c.length > 3 && contentLower.includes(c.toLowerCase()))) wrongReg = true;
                }
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

  if (courses.length > 0) {
    parts.push('\n=== קורסים שנמצאו ===');
    // ערבב את הקורסים לסדר אקראי שונה בכל פעם
  for (let i = courses.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [courses[i], courses[j]] = [courses[j], courses[i]];
  }
  // הסר כפילויות לפי URL
  const seenUrls = new Set();
  const uniqueCourses = courses.filter(c => {
    if (seenUrls.has(c.url)) return false;
    seenUrls.add(c.url);
    return true;
  });
  const coursesForClaude = [];
  uniqueCourses.forEach(c => {
    // השתמש ב-description המקורי מהאינדקס
    let desc = (c.description || '').trim(); // תיאור מלא ללא קיצוץ

    // אם הקורס הספציפי לא מוזכר ב-description — הוסף רק את שמו מה-text
    const descHasQ = qLower2.some(w => desc.toLowerCase().includes(w));
    if (!descHasQ && c._text) {
      for (const qw of qLower2) {
        const ti = c._text.indexOf(qw);
        if (ti >= 0) {
          // חלץ רק שם הקורס (משפט קצר שמכיל את המונח)
          const raw = c._text.substring(Math.max(0, ti - 5), ti + qw.length + 5).trim();
          desc = desc + (desc ? ' | ' : '') + 'כולל קורס: ' + raw;
          break;
        }
      }
    }

    // שלח ל-Claude רק קורסים שהתיאור או הכותרת מכילים את המונח
    const titleC = (c.title || '').toLowerCase();
    const isGenericPage = /^קורסי העשרה|^קורסי העצמה|^קורסי פנאי/.test(titleC) ||
      /^שבתון - קורסים והשתלמויות/.test(titleC) ||
      (c.url||'').includes('/kenes/');
    const wantsDegree = /תואר שני|תואר ראשון|תואר שלישי|דוקטורט|MA|BA|MSC/.test(message);
    const isMaDegree = /תואר שני|MA |M\.A|תואר \|מסלול תואר/.test(titleC) && !wantsDegree;
    const wantsTours2 = /טיול|סיור/.test(message.toLowerCase());
    const wantsTraining2 = /מורי דרך|מדריך טיולים|הכשרת מדריך|תיירות/.test(message.toLowerCase());
    const isTrainingCourse = /מורי דרך|הכשרת מדריכ|תיירות, פנאי ואתגר|לימודי תיירות/.test(titleC);
    const filterTraining = isTrainingCourse && wantsTours2 && !wantsTraining2;
    // qWords כולל מילות מפתח מורחבות
    const titleDescLower = (desc + ' ' + (c.title||'')).toLowerCase();
    const textHasQ = requiredPhrase
      ? (c._text||'').includes(requiredPhrase) ||
        (c.description||'').toLowerCase().includes(requiredPhrase) ||
        (c.title||'').toLowerCase().includes(requiredPhrase)
      : qLower2.some(w => (c._text||'').includes(w));
    const hasQword = requiredPhrase
      ? titleDescLower.includes(requiredPhrase)
      : qLower2.some(w => titleDescLower.includes(w));
                     // textHasQ מטופל למעלה
                     (c._score && c._score >= 3); // דפים שנמצאו בחיפוש ישיר
    const finalHasQ = !filterTraining && !isGenericPage && !isMaDegree && (c._liveRelevant || hasQword || textHasQ);
    if (finalHasQ) console.log('PASS TO CLAUDE:', (c.title||'').substring(0,30), '| url:', (c.url||'').split('/').pop());
    if ((c.url||'').includes('idit-link')) console.log('idit-link finalHasQ:', finalHasQ, '_liveRelevant:', c._liveRelevant, 'desc:', (desc||'').substring(0,50));
    if (finalHasQ) {
       // חלץ snippet רלוונטי: עדיפות לJina content, אחר כך _text
       let descFull = (desc || '').trim();
       // מצא את המונח הרלוונטי ביותר (requiredPhrase > qLower2)
       const searchTerms = requiredPhrase ? [requiredPhrase, ...qLower2] : qLower2;
       // נסה ב-Jina content קודם (מדויק יותר)
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
       // markdown מוכן — Claude רק מעתיק
       const md = '**[' + c.title + '](' + c.url + ')**\n' +
                  descFull + '\n' +
                  '[פנו למידע ולייעוץ אישי](' + c.url + ')\n';
       coursesForClaude.push(md);
       urlToTitle[c.url] = c.title;
    }
  });
  // אם יש known_institutions — שדרס את coursesForClaude
  if (knownOnly && knownOnly.length > 0 && coursesForClaude.length === 0) {
    // fallback: scan known_institutions live
    const kiScanned = await Promise.all(knownOnly.map(async ki => {
      const content = await fetchPageContent(ki.url);
      if (!content) return `**[${ki.title}](${ki.url})**\n${ki.description || ''}`;
      const excerpt = content.substring(0, 400).trim();
      return `**[${ki.title}](${ki.url})**\n${excerpt}\n[פנו למידע ולייעוץ אישי](${ki.url})`;
    }));
    parts.push(kiScanned.join('\n'));
  } else if (knownOnly && knownOnly.length > 0) {
    // ערבב ושדרס: known first + מה שנמצא
    const knownUrls = new Set(knownOnly.map(k => k.url));
    const knownInClaude = coursesForClaude.filter(c => knownOnly.some(k => c.includes(k.url)));
    const otherInClaude = coursesForClaude.filter(c => !knownOnly.some(k => c.includes(k.url)));
    const claudeFinal = [...knownInClaude, ...otherInClaude].slice(0, 10);
    if (claudeFinal.length > 0) parts.push(claudeFinal.join('\n'));
  } else {
    // ערבב וצמצם ל-10 מקסימום
    for (let i = coursesForClaude.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [coursesForClaude[i], coursesForClaude[j]] = [coursesForClaude[j], coursesForClaude[i]];
    }
    const claudeFinal = coursesForClaude.slice(0, 15);
    if (claudeFinal.length > 0) parts.push(claudeFinal.join('\n'));
  }
  }

  const fieldInfo = getFieldSlug(message);

  // אם ה-field מסומן fetchFromUrl — סרוק דף הקטגוריה
  if (fieldInfo && fieldInfo.fetchFromUrl && fieldInfo.categoryUrl && courses.length < 3) {
    try {
      const catContent = await fetchPageContent(fieldInfo.categoryUrl);
      if (catContent) {
        console.log('Category page fetched:', fieldInfo.categoryUrl.substring(0,60), 'len:', catContent.length);
        parts.push(`=== קורסים לציבור הדתי (מדף הקטגוריה) ===\n${catContent}`);
      }
    } catch(e) {}
  }

  // שלח URL אזורי רק אם השאלה מכילה מפורשות מילת אזור
  const msgL = message.toLowerCase();
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

  return { context: parts.join('\n\n'), isInfo: infoUrls.length > 0, courseCount: courses.length, urlToTitle };
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

    const { context, isInfo, courseCount, urlToTitle } = await buildContext(message);
    if (courseCount > 0) {
      const courseLines = context.split('\n').filter(l => l.startsWith('שם:'));
    }
    const isCourseQ = ['קורס','קורסים','לימוד','לימודים','מוסד','מכללה','אוניברסיטה','השתלמות'].some(k => message.includes(k));
    const isInfoQuestion = !!(isInfo && !isCourseQ);
    const model = chooseModel(message);

    const userContent = context
      ? `${context}\n\n---\nשאלת הגולש: ${message}`
      : message;

    console.log('CONTEXT SAMPLE:', (context||'').substring(0, 400));
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model, max_tokens: 3000, system: SYSTEM_PROMPT,
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
    // נקה תווים זרים (לא עברית/אנגלית/מספרים/פיסוק)
    reply = reply.replace(/[^\u0020-\u007E\u00A0-\u00FF\u0590-\u05FF\u200F\u200E\n\r\t]/g, '');
    console.log('REPLY:', reply.substring(0, 300).replace(/\n/g, '|'));


    // post-process: הוסף כותרות מוסדות אם Claude לא כתב **[שם](URL)**
    if (typeof urlToTitle !== 'undefined') {
      for (const [url, title] of Object.entries(urlToTitle)) {
        const btnPattern = '\u05E4\u05E0\u05D5 \u05DC\u05DE\u05D9\u05D3\u05E2 \u05D5\u05DC\u05D9\u05D9\u05E2\u05D5\u05E5 \u05D0\u05D9\u05E9\u05D9'; // פנו למידע ולייעוץ אישי
        const urlEsc = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // בדוק: אם [פנו](URL) קיים אבל **[שם](URL)** לא קיים — הוסף כותרת
        if (reply.includes('[' + btnPattern + '](' + url + ')') && !reply.includes('**[' + title)) {
          reply = reply.replace(
            new RegExp('(' + urlEsc.replace(/\//g, '\\/') + ')', 'g'),
            url
          );
          reply = reply.replace(
            '[' + btnPattern + '](' + url + ')',
            '**[' + title + '](' + url + ')**\n[' + btnPattern + '](' + url + ')'
          );
        }
      }
    }
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

    // המר | separator ל-newline לתצוגה נכונה
    // נרמל פורמט
    reply = reply.replace(/^#+\s*/gm, '');           // הסר # כותרות
    reply = reply.replace(/\)\*\*\|+/g, ')**\n');   // | → newline אחרי שם מוסד
    reply = reply.replace(/\|\|/g, '\n\n');         // || → שורה ריקה
    reply = reply.replace(/^---+$/gm, '');             // הסר ---
    return res.status(200).json({ reply, model });

  } catch(e) {
    console.error('ERROR:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
