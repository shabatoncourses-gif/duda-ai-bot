// שַׁבִּיבּוֹט - עוזר שבתון AI v5
// ESM format - package.json has "type": "module"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

// ── System Prompt ──────────────────────────────────────
const SYSTEM_PROMPT =
  'שמך שַׁבִּיבּוֹט, העוזרת החכמה והנעימה של שבתון.\n' +
  'ענה תמיד בעברית בחום ובידידותיות.\n' +
  'כל שאלה מגולש שבתון היא בהקשר שנת שבתון — ביטוח לאומי = ביטוח לאומי בשבתון.\n' +
  'כלל ברזל: תן תשובה עניינית מהמידע שסופק. לעולם אל תאמר שאינך יכול לענות.\n' +
  'לעולם אל תאמר "לא מצאתי", "מצטער", "אין קורסים" — זה אסור לחלוטין.\n' +
  'אם לא נמצאו קורסים מדויקים — הפנה לקישור "כל קורסי [תחום]" בחיובי.\n' +
  'ענה תמיד בעברית בלבד — אסור לכתוב אפילו משפט אחד באנגלית.\n' +
  'לעולם אל תפנה לגורמים חיצוניים ואל תתן טלפונים/אתרים חיצוניים.\n\n' +
  'לשאלות מידע: פתח חיובי, הצג את המידע מה-context, הפנה לדפי שבתון.\n' +
  'לשאלות קורסים: הצג עד 10 מוסדות מהרשימה, בסדר אקראי שונה בכל פעם — לא תמיד אותם מוסדות.\n' +
  'כלל ברזל מוחלט לתיאורים: העתק בדיוק את שדה "תיאור" מה-context. אסור לשנות מילה. אסור להוסיף מידע. אסור להסיק.\\n' +
  'דוגמה: אם בcontext כתוב "קורסי פעילות גופנית במים ברחובות" — כתוב בדיוק "קורסי פעילות גופנית במים ברחובות". לא פחות, לא יותר.\\n' +
  'אם מוסד מציע למידה מרחוק/זום ולא באזור שנשאל — ציין זאת מפורשות בתיאור.\n' +
  'הצג את התיאור המלא — אל תקצץ באמצע משפט. אם התיאור ארוך, סיים במשפט שלם.\n' +
  'אל תציג לימודי תואר שני אלא אם הגולש ביקש תואר שני במפורש.\n' +
  'הצג רק מוסדות שהתיאור שלהם מזכיר את הנושא המבוקש ישירות. אם הנושא מוזכר בדרך אגב בין נושאים אחרים רבים — דלג על המוסד.\n' +
  'אם בתיאור יש ציטוט מתוך רשימת הקורסים — השתמש בו להסביר מה המוסד מציע.\n' +
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
  'לקורסים: 📚 [כל קורסי [שם-התחום] ב[שם-האזור]](URL מה-context)\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '💬 [אפשר לשאול בקבוצת הווטסאפ שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
  '"מידע וטיפים חשובים" — תמיד אחרון ברשימת מידע\n' +
  'אם הגולש לא ציין אזור — אל תוסיף אזור לכותרת. כתוב "קורסי [תחום]" בלבד.\n' +
  'בנושא טיולים: הפרד בין (1) קורסי טיולים לימודיים וסמינרים שמורים הולכים אליהם (2) קורסי הכשרת מדריכי טיולים ומורי דרך. הצג את שתי הקטגוריות בנפרד אם שתיהן קיימות.\n' +
  'כללי ניסוח: פתח בעברית תקינה. לא "מצוינו" — כתוב "מצאנו" או "הנה". ללא ניסוחים אישיים כמו "אני כאן בשבילך".\n' +
  'שאלת סיום: קצרה וענינית — "יש שאלות נוספות?" / "האם חיפשת אזור ספציפי?".\n' +
  'בקישור "כל קורסי..." — שמור על הטקסט המקורי מה-context. אל תפרט תחומים שאינם קשורים.\n' +
  'אל תשתמש ב"בהחלט", "בוודאי", "כמובן" בתחילת משפט. ללא כוכביות בשאלת הסיום';

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
        if (wrongRegion && !cityMatchCorrect) { seen.add(url); continue; }

        // אין קשר לאזור כלל — סנן (אלא אם למידה מרחוק)
        if (!cityMatchCorrect && !wrongRegion) {
          const isOnline = tdOnly.match(/מרחוק|זום|zoom|אונליין|online|מקוון/i);
          if (!isOnline) { seen.add(url); continue; }
          score = Math.max(1, score - 3);
        }
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
    // תכנון ורשימת משימות
    { kw: ['רשימת משימות','כיצד מתחילים','איך מתחילים','תהליך יציאה','צ\'קליסט'], url: 'https://www.shabaton.online/shabaton_checklist' },
    { kw: ['תכנון','טבלת עזר','תוכנית לימודים','הרכבת תוכנית','תכנית לימודים'], url: 'https://www.shabaton.online/shabaton-plan' },

    // לימודים
    { kw: ['חובות לימודים','שעות חובה','שעות השלמה','שעות רשות','לימודי חובה','חלוקת שעות'], url: 'https://www.shabaton.online/learning_programs_shabaton' },
    { kw: ['מוסדות מאושרים','נושאי השתלמות','ספורט בשבתון','שינוי תוכנית','אופק חדש','תואר שלישי','גמול השתלמות','פרויקט אישי','לימודים בישיבה','לימודים בחו"ל','לימוד בחו'], url: 'https://www.shabaton.online/learning_programs_shabaton' },

    // לוחות זמנים ובקשות
    { kw: ['לוח זמנים','מועדים','תאריכים','מתי להגיש','קרן השתלמות','אישור זכאות'], url: 'https://www.shabaton.online/luz_shabaton' },
    { kw: ['בקשת שבתון','איך מבקשים','יציאה לשבתון'], url: 'https://www.shabaton.online/shabaton_request' },

    // תשלומים
    { kw: ['ביטוח לאומי','ביטל','תשלום ביטוח','דמי ביטוח'], url: 'https://www.shabaton.online/btl_shabaton' },
    { kw: ['קבלות','החזר שכר לימוד','קבלה','שכר לימוד'], url: 'https://www.shabaton.online/kabalot_shabaton' },
    { kw: ['החזר שכ"ל','tuition','החזר שכר'], url: 'https://www.shabaton.online/tuition_reimbursement' },
    { kw: ['מענק','גובה המענק','חישוב מענק','תלוש מענק','כמה מקבלים','כמה כסף'], url: 'https://www.shabaton.online/shabaton-maanak' },
    { kw: ['לידה','מענק לידה','דמי לידה','חופשת לידה','הריון'], url: 'https://www.shabaton.online/birth_shabatgon' },
    { kw: ['פנסיה','קרן פנסיה'], url: 'https://www.shabaton.online/pension_shabaton' },
    { kw: ['קרן מקוצרת','מקור','מישור','הפרשה לקרן'], url: 'https://www.shabaton.online/keren_makor_mishor' },
    { kw: ['טופס 101','101'], url: 'https://www.shabaton.online/tofes_101' },

    // טפסים
    { kw: ['טפסים','מסמכים','חל"ת','הצהרה על עבודה','חזרה משבתון','בקשה לשעות'], url: 'https://www.shabaton.online/forms_shabaton' },

    // חצי/מלא
    { kw: ['חצי שבתון','שבתון מלא','שבתון חלקי','הבדל שבתון'], url: 'https://www.shabaton.online/halforfull_shabaton' },

    // חזרה מהשבתון
    { kw: ['חזרה משבתון','סיום שבתון','חזרה לעבודה'], url: 'https://www.shabaton.online/end_shabaton' },

    // זכויות כלליות
    { kw: ['זכויות','זכאות','מי זכאי','תנאים לשבתון'], url: 'https://www.shabaton.online/important' },

    // מלגות
    { kw: ['מלגה','מלגות','מלגת לימודים'], url: 'https://www.morim.online/milgot-morim' },

    // סרטוני הדרכה
    { kw: ['סרטון','סרטוני הדרכה','וידאו','להדרכה'], url: 'https://www.shabaton.online/shabaton-video' },

    // טלפונים וכתובות — QA
    { kw: ['טלפון','כתובת','יצירת קשר','פורטל עובדי הוראה'], url: 'qa:phones' },
  ];
  return [...new Set(pages.filter(p => p.kw.some(k => q.includes(k))).map(p => p.url).filter(u => !u.startsWith('qa:')))];
}

// ── סריקת דף ──────────────────────────────────────────
async function fetchPageContent(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShabatonBot/1.0)' },
      signal: AbortSignal.timeout(8000)
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
            if (!results.find(r => r.url === ki.url)) {
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
  return [...withTextMatch, ...withoutText]; // כל הדפים
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
  const fieldKeywords = getFieldKeywords(message);
  const genericWords2 = new Set(['קורס','קורסי','קורסים','למורים','לגננות','בשבתון','מורים','גננות','שבתון','לימוד','לימודים']);
  const qLower2 = message.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !genericWords2.has(w));

  // סרוק דפי מוסדות בזמן אמת לפי תחום
  if (fieldKeywords && fieldKeywords.length > 0) {
    const institutionPages = getInstitutionPagesForField(message);
    const instWithText = institutionPages.filter(p => qLower2.length > 0 && qLower2.some(w => (p._text||'').includes(w)));
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
      const textIndexPages = institutionPages.filter(p => !existingUrls.has(p.url) && qSpecific2.some(w => (p._text||'').includes(w)));
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
        courses.push({ title: p.title, url: p.url, description: instSnippet, score: 3, _liveRelevant: snippetHasQ });
        existingUrls.add(p.url);
      });

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
          const relevant = isAlreadyTextMatch || (qSpecific2.length > 0 && qSpecific2.some(w => content.toLowerCase().includes(w)));
          const shortName = p.url.split('/').pop();
          if (['hemdat','igud_arim','washington-morim','foodprof'].includes(shortName)) {
            console.log('LIVE SCAN:', shortName, 'relevant='+relevant, 'content_len='+(content||'').length);
          }
          if (!relevant) return null;
          return { title: p.title, url: p.url, description: p.description, score: 2, _liveRelevant: true };
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
    const isGenericPage = /^קורסי העשרה|^קורסי העצמה|^קורסי פנאי/.test(titleC);
    const isMaDegree = /^תואר שני/.test(titleC) && !message.includes('תואר שני');
    const finalHasQ = c._liveRelevant || (!isGenericPage && !isMaDegree && qLower2.some(w => (desc + ' ' + c.title).toLowerCase().includes(w)));
    if (finalHasQ) {
      const descFull = desc; // תיאור מלא — ללא קיצוץ
      coursesForClaude.push(`שם: ${c.title}\nקישור: ${c.url}${descFull ? '\nתיאור: ' + descFull : ''}`);
    }
  });
  if (coursesForClaude.length > 0) {
    parts.push(coursesForClaude.join('\n'));
  }
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

  return { context: parts.join('\n\n'), isInfo: infoUrls.length > 0, courseCount: courses.length };
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

    const { context, isInfo, courseCount } = await buildContext(message);
    if (courseCount > 0) {
      const courseLines = context.split('\n').filter(l => l.startsWith('שם:'));
    }
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
