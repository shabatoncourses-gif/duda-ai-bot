// ================================================================
// chat.js v111
// VERSION: MAR_02_v249_MUSIC_URL
// ================================================================
//
// ארכיטקטורה חדשה:
// ─────────────────────────────────────────────────────────────────
// 1. זיהוי אזור לפי URL (מדויק!):
//    - URL מכיל slug של האזור המבוקש → +100 (דף אזורי)
//    - URL מכיל slug של אזור אחר    → דחייה מוחלטת
//    - URL ללא slug אזורי             → +10 (תוכן ארצי/כללי)
//
// 2. זיהוי תחום לימוד:
//    - בכותרת (title/h1)   → +150
//    - בתיאור (description) → +80
//    - בטקסט (text field)  → +50
//
// 3. תמיד בסוף התשובה: קישור לדף קטגוריה אזורי
// ================================================================

import fs from 'fs';
import path from 'path';

let ALL_PAGES = null;
let REGIONS = null;
let STUDY_FIELDS = null;
let REQUIRED_PHRASES = null;
let COURSES_QA = null;
let SHABATON_QA = null;   // מחליף את payments-qa.json + btl-qa.json
let SEMANTIC_DATA = null;
let WORD_GRAPH = null;
let SHABATON_INFO = null;
let INTENT_MAPPINGS = null;

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME';
const SITE_BASE = 'https://www.shabaton.online';

// ================================================================
// DATA LOADING
// ================================================================

function loadConfigs() {
  try {
    if (!REGIONS) {
      REGIONS = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'regions.json'), 'utf8')).regions;
      console.log(`✅ regions.json: ${REGIONS.length} regions`);
    }
    if (!STUDY_FIELDS) {
      STUDY_FIELDS = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'study-fields.json'), 'utf8')).studyFields;
      console.log(`✅ study-fields.json: ${STUDY_FIELDS.length} fields`);
    }
    if (!REQUIRED_PHRASES) {
      REQUIRED_PHRASES = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'required-phrases.json'), 'utf8')).requiredPhrases || [];
      console.log(`✅ required-phrases.json: ${REQUIRED_PHRASES.length} phrases`);
    }
    if (!COURSES_QA) {
      COURSES_QA = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'courses-qa.json'), 'utf8'));
      const qCount = COURSES_QA.categories
        ? COURSES_QA.categories.reduce((s, c) => s + (c.questions?.length || 0), 0)
        : (COURSES_QA.questions?.length || 0);
      console.log(`✅ courses-qa.json: ${qCount} questions`);
    }
    if (!SHABATON_QA) {
      SHABATON_QA = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'shabaton-qa.json'), 'utf8'));
      const qCount = (SHABATON_QA.categories || []).reduce((s, c) => s + (c.questions?.length || 0), 0);
      console.log(`✅ shabaton-qa.json: ${qCount} questions`);
    }
    if (!SHABATON_INFO) {
      SHABATON_INFO = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'shabaton-info.json'), 'utf8')).infoPages;
      console.log(`✅ shabaton-info.json: ${SHABATON_INFO.length} info pages`);
    }
    if (!INTENT_MAPPINGS) {
      INTENT_MAPPINGS = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'intent-mappings.json'), 'utf8')).intentMappings;
      console.log(`✅ intent-mappings.json: ${INTENT_MAPPINGS.length} intents`);
    }
  } catch (e) {
    console.error('[loadConfigs] ERROR:', e.message);
  }
}

function loadSemanticData() {
  if (SEMANTIC_DATA) return SEMANTIC_DATA;
  try {
    SEMANTIC_DATA = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'semantic-mappings.json'), 'utf8'));
    console.log(`✅ semantic: ${Object.keys(SEMANTIC_DATA.synonyms || {}).length} synonyms`);
  } catch (e) {
    console.error('⚠️ semantic-mappings.json not found:', e.message);
    SEMANTIC_DATA = { synonyms: {}, intentPatterns: {}, genericTerms: [] };
  }
  return SEMANTIC_DATA;
}

function loadAllPages() {
  if (ALL_PAGES) return ALL_PAGES;
  const pages = [];
  for (const fn of ['shabaton_index_part1.json', 'shabaton_index_part2.json', 'morim_index_part1.json', 'shabaton_index.json']) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', fn), 'utf8'));
      const arr = Array.isArray(data) ? data : (data.pages || []);
      pages.push(...arr);
      console.log(`✅ ${arr.length} pages from ${fn}`);
    } catch (e) {
      console.log(`⚠️ ${fn}: ${e.message}`);
    }
  }
  const unique = [];
  const seen = new Set();
  for (const p of pages) {
    const url = p.url || p.link || '';
    if (url && !seen.has(url)) { seen.add(url); unique.push(p); }
  }
  console.log(`✅ Unique pages: ${unique.length}`);
  ALL_PAGES = unique;
  return ALL_PAGES;
}

// ================================================================
// SEMANTIC ANALYSIS
// ================================================================

function buildWordGraph() {
  if (WORD_GRAPH) return WORD_GRAPH;
  loadSemanticData(); loadConfigs();
  const g = new Map();
  const add = (terms, main) => {
    for (const t of terms) {
      const tl = t.toLowerCase();
      if (!g.has(tl)) g.set(tl, new Set());
      terms.forEach(x => { if (x.toLowerCase() !== tl) g.get(tl).add(x); });
      g.get(tl).add(main);
    }
  };
  if (SEMANTIC_DATA?.synonyms)
    for (const [m, d] of Object.entries(SEMANTIC_DATA.synonyms)) add([m, ...(d.variations || [])], m);
  if (REQUIRED_PHRASES)
    for (const p of REQUIRED_PHRASES) add([p.phrase, ...(p.variations || [])], p.phrase);
  if (STUDY_FIELDS)
    for (const f of STUDY_FIELDS) add([f.name, ...(f.keywords || [])], f.name);
  WORD_GRAPH = g;
  console.log(`🧠 WordGraph: ${g.size} terms`);
  return g;
}

function expandQuerySemantically(query) {
  if (!WORD_GRAPH) buildWordGraph();
  loadSemanticData();
  const exp = new Set([query]);
  const ql = query.toLowerCase();
  for (const [t, rel] of WORD_GRAPH.entries()) if (ql.includes(t)) rel.forEach(r => exp.add(r));
  if (SEMANTIC_DATA?.intentPatterns) {
    for (const [, d] of Object.entries(SEMANTIC_DATA.intentPatterns)) {
      if ((d.patterns || []).some(p => ql.includes(p.toLowerCase())) && d.problemToSolution)
        for (const [prob, sols] of Object.entries(d.problemToSolution))
          if (ql.includes(prob.toLowerCase())) sols.forEach(s => exp.add(s));
    }
  }
  const result = Array.from(exp);
  console.log(`  🧠 "${query}" → [${result.slice(0, 5).join(', ')}${result.length > 5 ? '...' : ''}]`);
  return result;
}

// ================================================================
// REGION DETECTION FROM URL  ← הלב החדש של v111
// ================================================================

/**
 * בדוק האם URL שייך לאזור מסוים לפי slug.
 * מחזיר: { match: 'exact'|'other'|'none', region: ... }
 */
function detectRegionFromUrl(pageUrl, requestedRegion) {
  if (!REGIONS || !pageUrl) return { match: 'none', region: null };
  const urlLower = pageUrl.toLowerCase();

  // בדוק תחילה אם מכיל slug של האזור המבוקש
  if (requestedRegion?.slug && urlLower.includes(requestedRegion.slug.toLowerCase())) {
    console.log(`    [URL] ✅ URL contains requested region slug "${requestedRegion.slug}"`);
    return { match: 'exact', region: requestedRegion };
  }

  // בדוק אם מכיל slug של אזור אחר
  for (const r of REGIONS) {
    if (!r.slug) continue;
    if (r.slug === requestedRegion?.slug) continue;
    if (urlLower.includes(r.slug.toLowerCase())) {
      console.log(`    [URL] ❌ URL contains OTHER region slug "${r.slug}" → reject`);
      return { match: 'other', region: r };
    }
  }

  // אין slug אזורי בURL → תוכן ארצי/כללי
  console.log(`    [URL] ℹ️ No region slug in URL → national content`);
  return { match: 'none', region: null };
}

// ================================================================
// FIELD DETECTION IN PAGE
// ================================================================

/**
 * חיפוש תחום בכל שדות הדף.
 * חוזר: { found: bool, location: string, score: number }
 * חשוב: searchTerm הוא מה שמחפשים (שם תחום או keyword)
 */
function findFieldInPage(page, searchTerm, allowTextSearch = false) {
  const sl = searchTerm.toLowerCase();
  const title = (page.title || page.h1 || '').toLowerCase();
  const description = (page.description || '').toLowerCase();
  const h2 = ((page.h2 || []).join(' ')).toLowerCase();
  const h3 = ((page.h3 || []).join(' ')).toLowerCase();

  if (title.includes(sl)) return { found: true, location: 'title', score: 150 };
  if (description.includes(sl)) return { found: true, location: 'description', score: 80 };
  if (h2.includes(sl) || h3.includes(sl)) return { found: true, location: 'headers', score: 60 };

  // text — רק אם מותר (intent-based) ורק לביטויים ארוכים (>4 תווים)
  if (allowTextSearch && sl.length > 4) {
    const text = (page.text || '').toLowerCase();
    if (text.includes(sl)) return { found: true, location: 'text', score: 40 };
  }

  return { found: false, location: null, score: 0 };
}

/**
 * בדוק אם הדף רלוונטי לתחום המבוקש
 *
 * STRICT MODE — ביטוי מרובה מילים ("הוראה מתקנת", "הדרכת הורים"):
 *   הביטוי חייב להיות בכותרת או ב-description בלבד
 *   (מוסדות גדולים כמו "האוניברסיטה הפתוחה" מציעים כל תחום — ה-text שלהם עשיר מדי)
 *
 * NORMAL MODE — מילה בודדת ("ציור", "NLP"):
 *   כרגיל — title / desc / headers / text
 */
function pageMatchesField(page, studyField, allowTextSearch = false) {
  if (!studyField) return { found: true, score: 0 };

  const titleLower = (page.title || page.h1 || '').toLowerCase();
  const descLower = (page.description || '').toLowerCase();
  const h2h3Lower = ((page.h2 || []).concat(page.h3 || []).join(' ')).toLowerCase();
  // text = תוכן הדף: שמות קורסים, תיאורים, רשימות — ללא חיתוך
  const textLower = (page.text || '').toLowerCase();

  // בדיקת גבולות מילה + phrase match
  const matches = (text, term) => {
    const t = term.toLowerCase().trim();
    if (!t || t.length < 2 || !text.includes(t)) return false;
    if (t.includes(' ')) return true; // ביטוי — חייב להיות כרצף
    // מילה בודדת — גבולות מילה
    const idx = text.indexOf(t);
    const isBound = (c) => !c || /[\s,.\-\/()[\]"'!?:;]/.test(c);
    return isBound(text[idx - 1]) && isBound(text[idx + t.length]);
  };

  // חיפוש בכל השדות — title / desc / h2h3 / text
  const search = (term) => {
    if (!term) return { found: false };
    if (matches(titleLower, term)) return { found: true, location: 'title', score: 150 };
    if (matches(descLower, term)) return { found: true, location: 'description', score: 80 };
    if (matches(h2h3Lower, term)) return { found: true, location: 'headers', score: 60 };
    if (allowTextSearch && term.length > 4 && matches(textLower, term))
      return { found: true, location: 'text', score: 40 };
    return { found: false };
  };

  // ── requiredKeywords: הדף חייב להכיל אחד מהביטויים ──
  if (studyField.requiredKeywords?.length) {
    const synonyms = studyField.requiredKeywords;

    // מצב תואר שני: הדף חייב להכיל "תואר שני" + צירוף ההתמחות (כביטוי שלם)
    // ההתמחות חייבת להיות בkותרת/תיאור/h2 בלבד (לא text — רועש מדי)
    if (studyField.maSpecialization) {
      // (1) סינון דפי קטגוריה אזוריים לפי כותרת
      const maRegionPatterns = [
        /^תואר שני ב/, /^לימודי תואר שני/, /^אקדמי - תואר/,
        /תואר שני.*(בחיפה|בצפון|במרכז|בשרון|בירושלים|בדרום|בשפלה|באזור|הצפון)/,
        /תואר שני.*וב[א-ת]/,
      ];
      if (maRegionPatterns.some(p => p.test(titleLower))) {
        console.log(`    [MA] ❌ MA category page → skip: "${page.title}"`);
        return { found: false, location: null, score: 0 };
      }
      // כותרת קצרה (≤3 מילים) ללא שם מוסד — דף קטגוריה
      const titleWords = titleLower.trim().split(/\s+/);
      const hasInstitutionMarker = /מכללת|אוניברסיטת|מכון|סמינר|המכללה|האוניברסיטה|בית.?ספר|הקריה|אקדמית/.test(titleLower);
      if (titleWords.length <= 3 && !titleLower.includes('-') && !hasInstitutionMarker) {
        console.log(`    [MA] ❌ Short generic title → skip: "${page.title}"`);
        return { found: false, location: null, score: 0 };
      }

      // (2) "תואר שני" חייב להיות בדף
      if (!search('תואר שני').found) {
        console.log(`    [MA] ❌ No "תואר שני" → skip: "${page.title}"`);
        return { found: false, location: null, score: 0 };
      }

      // (3) חיפוש הצירוף — תמיד כצירוף שלם, לא מילים נפרדות
      // phrase variants = כל הvariant שגדולים מ-1 מילה
      // single variants = רק מילה יחידה ממש ייחודית (כגון "מתמטיקה")
      const synonyms = studyField.requiredKeywords || [];
      const phraseVars = synonyms.filter(v => v.trim().split(/\s+/).length >= 2);
      const singleVars = synonyms.filter(v => v.trim().split(/\s+/).length === 1 && v.length >= 5);

      const searchNoText = (term) => term && (matches(titleLower, term) || matches(descLower, term) || matches(h2h3Lower, term));

      // (א) חיפוש בכותרת/תיאור/h2 — כל הvariant
      const inMain = synonyms.some(v => searchNoText(v));
      // (ב) חיפוש ב-text כרצף — רק phrases (לא מילים בודדות)
      const inText = !inMain && allowTextSearch && phraseVars.some(v => matches(textLower, v) || matches(h2h3Lower, v));
      // (ג) מילה בודדת ייחודית ב-title/desc בלבד
      const inSingleMain = !inMain && !inText && singleVars.some(v => matches(titleLower, v) || matches(descLower, v));

      if (!inMain && !inText && !inSingleMain) {
        const specNormStr = studyField.maSpecNorm || (studyField.requiredKeywords?.[0] ?? '');
        console.log(`    [MA] ❌ Spec not found for "${specNormStr}" → skip: "${page.title}"`);
        return { found: false, location: null, score: 0 };
      }

      const scoreVal = inMain ? 80 : inText ? 60 : 42;
      const loc = inMain ? 'main' : inText ? 'text-phrase' : 'title-single';
      const matched = synonyms.find(v => searchNoText(v) || matches(textLower, v));
      console.log(`    [MA] ✅ "${matched}" (${loc}, score=${scoreVal}) → "${page.title}"`);
      return { found: true, location: loc, score: scoreVal };
    }

    // מצב רגיל: מספיק אחד מהביטויים
    // אבל אם specificKeyword הוא list-format (כגון "בינה מלאכותית") — הדף חייב להכיל אותו ספציפית
    const LIST_FORMAT_KWS_PRE = ["בינה מלאכותית","ai","chatgpt","canva","קאנבה",
      "משחקולוגיה","גיימיפיקציה","מציאות מדומה","מציאות רבודה",
      "פודקאסט","מיינדפולנס","מדיטציה","יוגה","nlp","נלפ","cbt","emdr"];
    const spKwLPre = (studyField.specificKeyword || "").toLowerCase();
    const isListKwPre = LIST_FORMAT_KWS_PRE.some(k => spKwLPre.includes(k));

    if (isListKwPre && studyField.specificKeyword) {
      const r = search(studyField.specificKeyword);
      if (r.found) {
        console.log(`    [REQUIRED] ✅ list-kw "${studyField.specificKeyword}" found (${r.location})`);
        return r;
      }
      console.log(`    [REQUIRED] ❌ list-kw "${studyField.specificKeyword}" not found → skip`);
      return { found: false, location: null, score: 0 };
    }

    const found = synonyms.some(kw => search(kw).found);
    if (!found) {
      console.log(`    [REQUIRED] ❌ None of [${synonyms.join(", ")}] found → skip`);
      return { found: false, location: null, score: 0 };
    }
    const matched = synonyms.find(kw => search(kw).found);
    console.log(`    [REQUIRED] ✅ "${matched}" found`);
    return search(matched);
  }

  // ── שלב 1: requiredKeywords (כשיש — OR על כל הרשימה) ──
  if (studyField.requiredKeywords?.length && !studyField.maSpecialization) {
    const rKws = studyField.requiredKeywords;

    // כשה-specificKeyword הוא list-format keyword (כגון "בינה מלאכותית") —
    // הדף חייב להכיל אותו ספציפית, לא סתם phrase אחר מהשדה
    const LIST_FORMAT_KWS = ['בינה מלאכותית','ai','chatgpt','chat gpt','canva','קאנבה',
      'משחקולוגיה','גיימיפיקציה','מציאות מדומה','מציאות רבודה',
      'פודקאסט','מיינדפולנס','מדיטציה','יוגה','nlp','נלפ','cbt','emdr'];
    const spKwL = (studyField.specificKeyword || '').toLowerCase();
    const isListKw = LIST_FORMAT_KWS.some(k => spKwL.includes(k));

    if (isListKw && studyField.specificKeyword) {
      const r = search(studyField.specificKeyword);
      if (r.found) {
        console.log(`    [FIELD] list-kw "${studyField.specificKeyword}" in ${r.location} (+${r.score})`);
        return r;
      }
      console.log(`    [FIELD] ❌ list-kw "${studyField.specificKeyword}" not found → skip`);
      return { found: false, location: null, score: 0 };
    }

    // עבור קורסים רגילים: אחד מהkeywords צריך להיות בדף
    // phrases ≥2 מילים → מחפש כרצף; מילה בודדת → חייב title/desc
    const phraseRKws = rKws.filter(k => k.trim().split(/\s+/).length >= 2);
    const singleRKws = rKws.filter(k => k.trim().split(/\s+/).length === 1 && k.length >= 4);
    const foundPhrase = phraseRKws.some(k => search(k).found);
    const foundSingle = !foundPhrase && singleRKws.some(k => {
      const r = search(k);
      return r.found && r.location !== 'text'; // מילה בודדת: רק title/desc/h2
    });
    if (foundPhrase || foundSingle) {
      const matched = rKws.find(k => search(k).found);
      const r = search(matched);
      console.log(`    [FIELD] requiredKw "${matched}" in ${r.location} (+${r.score})`);
      return r;
    }
    // אם specificKeyword עצמו נמצא — עובר
    if (studyField.specificKeyword) {
      const r = search(studyField.specificKeyword);
      if (r.found) {
        console.log(`    [FIELD] specificKw "${studyField.specificKeyword}" in ${r.location} (+${r.score})`);
        return r;
      }
    }
    // אף keyword לא נמצא → דף לא רלוונטי
    console.log(`    [FIELD] ❌ None of requiredKeywords found → skip`);
    return { found: false, location: null, score: 0 };
  }

  // ── שלב 2: specificKeyword (כשאין requiredKeywords) ──
  if (studyField.specificKeyword) {
    const r = search(studyField.specificKeyword);
    if (r.found) { console.log(`    [FIELD] "${studyField.specificKeyword}" in ${r.location} (+${r.score})`); return r; }

    // אם specificKeyword הוא מונח ספציפי (לא שם התחום עצמו) — הדף חייב להכיל אותו
    const isSpecificTerm = studyField.specificKeyword !== studyField.name &&
      !studyField.name.toLowerCase().includes(studyField.specificKeyword.toLowerCase());
    if (isSpecificTerm) {
      console.log(`    [FIELD] ❌ Specific term "${studyField.specificKeyword}" not found → skip`);
      return { found: false, location: null, score: 0 };
    }
  }

  // ── שלב 2: שם תחום וחלקים שלו (לפני מקף) ──
  const nameParts = [studyField.name, ...studyField.name.split(/\s*[-–—]\s*/).map(p => p.trim())].filter(Boolean);
  for (const part of nameParts) {
    const r = search(part);
    if (r.found) { console.log(`    [FIELD] name-part "${part}" in ${r.location} (+${r.score})`); return r; }
  }

  // ── שלב 3: keywords ──
  const tooGeneric = new Set(['למידה', 'לימוד', 'קורס', 'קורסים', 'השתלמות', 'תואר', 'חינוך', 'הוראה', 'טיפול', 'ניהול']);
  const keywords = (studyField.keywords || []).filter(kw => {
    if (!kw || nameParts.includes(kw) || kw === studyField.specificKeyword) return false;
    if (tooGeneric.has(kw.toLowerCase())) return false;
    return kw.includes(' ') || kw.length > 8;
  });
  for (const kw of keywords) {
    const r = search(kw);
    if (r.found) { console.log(`    [FIELD] keyword "${kw}" in ${r.location} (+${r.score})`); return r; }
  }

  return { found: false, location: null, score: 0 };
}

// ================================================================
// INTENT RESOLUTION — שאלות מורכבות עם כוונה
// ================================================================

function resolveIntentToField(message) {
  if (!INTENT_MAPPINGS?.length || !STUDY_FIELDS?.length) return null;
  const lm = message.toLowerCase();

  for (const intent of INTENT_MAPPINGS) {
    if (intent.patterns.some(p => lm.includes(p.toLowerCase()))) {
      // מצא את ה-field המתאים
      const field = STUDY_FIELDS.find(f => f.name === intent.field);
      if (field) {
        console.log(`🎯 Intent match: "${intent.id}" → field:"${field.name}"`);
        return { ...field, _intentMatch: intent.id };
      }
    }
  }
  return null;
}

// ================================================================
// STUDY FIELD DETECTION
// ================================================================

function detectStudyField(message) {
  loadConfigs();
  console.log(`\n🔍 [detectStudyField] "${message}"`);
  if (!STUDY_FIELDS?.length) return [];

  const lm = message.toLowerCase();
  const expanded = expandQuerySemantically(message);

  // ── עדיפות עליונה: צמדי מילים של תרפיה/טיפול ──
  // כל אחד מהצמדים מחייב חיפוש ספציפי — "טיפול" לבד לא מספיק
  // ── מוזיקה / קול / שירה — אין שדה ספציפי → מניעת זיהוי שגוי של שדה טכנולוגיה ──
  // ("פיתוח קול" אינו "פיתוח" טכנולוגי — חזור ריק → fallback לוואטסאפ)
  const MUSIC_VOICE_TERMS = ['פיתוח קול', 'שירה', 'קול ושירה', 'מוזיקה', 'כלי נגינה',
    'פסנתר', 'גיטרה', 'חליל', 'כינור', 'תופים', 'חצוצרה', 'ויולינה', 'מקהלה',
    'ניצוח', 'תזמורת', 'אופרה', 'ג"ז', 'jazz'];
  if (MUSIC_VOICE_TERMS.some(t => lm.includes(t)) && !/טכנולוג|דיגיטל|מחשב|AI|בינה מלאכותית/.test(lm)) {
    const detectedMusicTerm = MUSIC_VOICE_TERMS.find(t => lm.includes(t)) || 'מוסיקה';
    console.log('🎵 Music/voice query → synthetic music field, term: "' + detectedMusicTerm + '"');
    return [{ 
      name: 'מוסיקה',
      slug: 'מוסיקה',
      specificKeyword: detectedMusicTerm,
      requiredKeywords: [detectedMusicTerm],
      keywords: ['מוסיקה','שירה','פיתוח קול','כלי נגינה','גיטרה','פסנתר','קונצרט'],
      _musicQuery: true
    }];
  }

  const THERAPY_CLUSTERS = [
    { triggers: ['פוטותרפיה', 'טיפול בצילום', 'תרפיה בצילום', 'צילום טיפולי', 'צילום ככלי טיפולי'],
      requiredKeywords: ['פוטותרפיה', 'טיפול בצילום', 'תרפיה בצילום', 'צילום טיפולי', 'צילום ככלי טיפולי'] },
    { triggers: ['טיפול באמנות', 'טיפול באומנות', 'תרפיה באמנות', 'תרפיה באומנות', 'אמנות טיפולית'],
      requiredKeywords: ['טיפול באמנות', 'טיפול באומנות', 'תרפיה באמנות', 'תרפיה באומנות', 'אמנות טיפולית'] },
    { triggers: ['ביבליותרפיה', 'טיפול בספרות', 'ספרות טיפולית'],
      requiredKeywords: ['ביבליותרפיה', 'טיפול בספרות', 'ספרות טיפולית'] },
    { triggers: ['טיפול בבעלי חיים', 'טיפול בכלבים', 'טיפול עם בעלי חיים'],
      requiredKeywords: ['טיפול בבעלי חיים', 'טיפול בכלבים', 'טיפול עם בעלי חיים'] },
    { triggers: ['ריפוי בעיסוק', 'occupational therapy'],
      requiredKeywords: ['ריפוי בעיסוק', 'occupational therapy'] },
    { triggers: ['קלינאות תקשורת', 'speech therapy'],
      requiredKeywords: ['קלינאות תקשורת', 'speech therapy'] },
    { triggers: ['טיפול דיאדי'],
      requiredKeywords: ['טיפול דיאדי'] },
    { triggers: ['גינון טיפולי', 'הורטיתרפיה'],
      requiredKeywords: ['גינון טיפולי', 'הורטיתרפיה'] },
  ];

  const matchedCluster = THERAPY_CLUSTERS.find(c => c.triggers.some(t => lm.includes(t)));
  if (matchedCluster) {
    const therapyField = STUDY_FIELDS.find(f => f.name.includes('תרפיה') || f.name.includes('טיפול'));
    if (therapyField) {
      const matchedTrigger = matchedCluster.triggers.find(t => lm.includes(t));
      console.log(`✅ Priority field: "${therapyField.name}" (therapy cluster: "${matchedTrigger}")`);
      return [{ ...therapyField,
        specificKeyword: matchedTrigger,
        requiredKeywords: matchedCluster.requiredKeywords }];
    }
  }

  // ── עדיפות עליונה: "תואר שני ב..." או "תואר שני X" — חיפוש התמחות ──
  const masterMatch = lm.match(/תואר שני\s+ב?([\u05d0-\u05ea"'\-\s]{2,30})/);
  // וידוא: המילה שאחרי "תואר שני" לא תהיה מילת קישור בלבד
  const masterSpec = masterMatch?.[1]?.trim();
  const isMeaningfulSpec = masterSpec && masterSpec.length >= 2 &&
    !['ב','ל','מ','ה','ו','כ','של','על','עם','את'].includes(masterSpec);
  if (masterMatch && isMeaningfulSpec) {
    const fullPhrase = masterMatch[0].trim();
    const specialization = masterMatch[1].trim();
    const normalizeQ = (s) => s.replace(/['"״"]/g, '').replace(/\s+/g, ' ').trim();
    const specNorm = normalizeQ(specialization);
    const maField = STUDY_FIELDS.find(f => f.name.includes('תואר שני'));
    if (maField) {
      // ── גנרציית variants שיטתית ──
      const variantSet = new Set();

      // (א) וריאנטים בסיסיים של הצירוף עצמו
      const addPhrase = (s) => {
        if (!s || s.length < 2) return;
        const n = normalizeQ(s);
        variantSet.add(n);
        // עם ה' ידיעה על המילה האחרונה
        const w = n.split(/\s+/);
        if (w.length >= 1) {
          const withHe = [...w.slice(0,-1), 'ה'+w[w.length-1]].join(' ');
          variantSet.add(withHe);
          // בלי ה' על המילה האחרונה
          if (w[w.length-1].startsWith('ה') && w[w.length-1].length > 2) {
            variantSet.add([...w.slice(0,-1), w[w.length-1].slice(1)].join(' '));
          }
        }
        // וריאנטים של מילת יחס ראשונה (ל/ב/של)
        const prepMatch = n.match(/^([\u05d0-\u05ea]+)\s+(ל|ב|של|ה)([\u05d0-\u05ea].*)$/);
        if (prepMatch) {
          const [,word,,rest] = prepMatch;
          for (const p of ['ל','ב','של']) variantSet.add(`${word} ${p}${rest}`);
          variantSet.add(`${word} ${rest}`); // בלי מילת יחס
        }
        // גרסת מקף
        variantSet.add(n.replace(/\s+/g,'-'));
      };
      addPhrase(specialization);
      addPhrase(specNorm);

      // (ב) חיפוש בכל שדות הלימוד — מציאת התחום התואם + keywords שלו
      const specLower = specNorm.toLowerCase();
      const STOP_WORDS = new Set(['הוראת','לימוד','לימודי','למידה','מחקר','תחום','קורסי','לימודים','קורס']);
      const specCoreWords = specLower.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));

      for (const field of STUDY_FIELDS) {
        if (field.name === 'תואר שני בחינוך ובהוראה') continue; // שדה ה-MA עצמו
        const fieldNameNorm = normalizeQ(field.name).toLowerCase();
        const fieldKws = (field.keywords || []).map(k => normalizeQ(k).toLowerCase());

        // מילות תוכן של השדה (בלי stop words וסיומות)
        const STOP_FIELD = new Set(['קורסי','לימודי','לימודים','קורס','קורסים','וטיפול','ואבחון','ומדעים']);
        const fieldCore = fieldNameNorm.split(/[\s,\-ו]+/).filter(w => w.length >= 4 && !STOP_FIELD.has(w));

        // התאמה חזקה: לפחות מילת תוכן אחת מהspec חייבת להתאים לfield CONTENT (לא stop word)
        const strongMatch = fieldCore.some(fw =>
          specCoreWords.some(sw => (sw === fw || sw.includes(fw) || fw.includes(sw)) && fw.length >= 4)
        );
        // התאמה לפי keyword מלא שנמצא ב-spec
        const kwMatch = fieldKws.some(kw =>
          kw.split(/\s+/).length >= 2 && kw.length >= 6 && (specLower.includes(kw) || kw.includes(specLower))
        );

        if (strongMatch || kwMatch) {
          // הוסף כל keyword מרובה-מילים של השדה כvariant (כצירוף שלם)
          for (const kw of (field.keywords || [])) {
            const kwNorm = normalizeQ(kw);
            if (kwNorm.split(/\s+/).length >= 2) {
              addPhrase(kwNorm);
            }
          }
          // הוסף את שם השדה
          addPhrase(field.name);
          console.log(`  [MA-VARIANTS] Matched field: "${field.name}" (core: ${fieldCore.filter(fw=>specCoreWords.some(sw=>sw.includes(fw)||fw.includes(sw))).join(',')})`);
        }
      }

      const finalVariants = [...variantSet].filter(v => v.length >= 2);

      // (ג) זיהוי שדה מתחרה — לסינון בהמשך
      // שדה הנמצא ב-STUDY_FIELDS ששמו מכיל מילים של specNorm אבל מצד שני שונה ממנו
      const competingFields = STUDY_FIELDS
        .filter(f => f.name !== 'תואר שני בחינוך ובהוראה')
        .filter(f => {
          const fn = normalizeQ(f.name).toLowerCase();
          const specWords2 = specLower.split(/\s+/).filter(w => w.length >= 3);
          const fieldWords2 = fn.split(/[\s,\-]+/).filter(w => w.length >= 3);
          // שדה מתחרה: יש חפיפה חלקית אבל לא מלאה
          const overlap = fieldWords2.filter(fw => specWords2.some(sw => sw.includes(fw) || fw.includes(sw)));
          const fullMatch = specLower.includes(fn) || fn.includes(specLower);
          return overlap.length > 0 && !fullMatch;
        })
        .map(f => normalizeQ(f.name));

      console.log(`✅ MA: "${specNorm}" | variants(${finalVariants.length}) | competing: [${competingFields.slice(0,3).join(', ')}]`);
      return [{ ...maField,
        specificKeyword: fullPhrase,
        requiredKeywords: finalVariants,
        maSpecialization: true,
        maSpecNorm: specNorm,
        maCompetingFields: competingFields,
      }];
    }
  }
  const isRemedial = /הוראה מתקנת|הוראה מותאמת|מתקנת|מותאמת/.test(lm) &&
                     !/כתיבה יוצרת|סיפורי חיים/.test(lm);
  if (isRemedial) {
    const remedialField = STUDY_FIELDS.find(f =>
      f.name.includes('הוראה מתקנת') || f.name.includes('הוראה מותאמת')
    ) || { name: 'הוראה מתקנת', slug: 'הוראה-מתקנת', specificKeyword: 'הוראה מתקנת' };
    console.log(`✅ Priority field: "${remedialField.name}" (remedial teaching)`);
    return [{ ...remedialField, specificKeyword: 'הוראה מתקנת' }];
  }

  // חיפוש התאמה לשם תחום
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    const fl = field.name.toLowerCase();
    const direct = lm.includes(fl);
    const semantic = !direct && expanded.some(t => fl.includes(t.toLowerCase()));

    if (direct || semantic) {
      console.log(`✅ Field: "${field.name}" (via: ${direct ? 'direct' : 'semantic'})`);
      let specificKeyword = null;

      if (semantic) {
        const words = lm.split(/\s+/);
        for (const et of expanded) {
          if (et.toLowerCase() === fl || et === message) continue;
          const etL = et.toLowerCase();
          for (const w of words) {
            const cw = w.replace(/[,\.!\?;:]/g, '');
            if (cw.length > 2 && (cw.includes(etL) || etL.includes(cw))) {
              // אם ה-expanded term הוא phrase (מרובה מילים) שמכיל את המילה מהשאילתה —
              // העדף את ה-phrase המלא כ-specificKeyword, לא את המילה הבודדת
              if (etL.includes(cw) && etL.includes(' ') && lm.includes(etL)) {
                specificKeyword = etL;
                console.log(`  🎯 Semantic phrase preserved: "${specificKeyword}"`);
              } else {
                specificKeyword = cw;
                console.log(`  🎯 Semantic keyword preserved: "${specificKeyword}"`);
              }
              break;
            }
          }
          if (specificKeyword) break;
        }
        if (!specificKeyword) {
          // חפש phrase מלא מה-keywords של השדה שנמצא בהודעה
          for (const kw of (field.keywords || [])) {
            const kwL = kw.toLowerCase();
            if (kwL.includes(' ') && lm.includes(kwL)) {
              specificKeyword = kwL;
              console.log(`  🎯 Keyword phrase fallback: "${specificKeyword}"`);
              break;
            }
          }
        }
        if (!specificKeyword) {
          for (const kw of (field.keywords || [])) {
            for (const w of lm.split(/\s+/)) {
              const cw = w.replace(/[,\.!\?;:]/g, '');
              if (cw.length > 2 && !["פיתוח","ניהול","לימוד","לימודי","קורס","שיפור","עבודה","הכשרה","תהליך","יצירה"].includes(cw) && (cw.includes(kw.toLowerCase()) || kw.toLowerCase().includes(cw))) {
                specificKeyword = cw;
                console.log(`  🎯 Keyword fallback: "${specificKeyword}"`);
                break;
              }
            }
            if (specificKeyword) break;
          }
        }
      } else {
        specificKeyword = fl;
        console.log(`  🎯 Direct match → specificKeyword: "${specificKeyword}"`);
      }

      // בנה requiredKeywords מ-keywords של השדה (phrases ≥2 מילים) + synonyms מהשאילתה
      const fieldPhraseKws = (field.keywords || []).filter(k => k.trim().split(/\s+/).length >= 2 && k.length >= 4);
      const semanticPhrases = expanded.filter(t => t.trim().split(/\s+/).length >= 2 && t.length >= 4);
      const requiredKeywords = fieldPhraseKws.length > 0
        ? [...new Set([...(specificKeyword ? [specificKeyword] : []), ...fieldPhraseKws, ...semanticPhrases])]
        : null;
      console.log(`  📋 requiredKeywords: ${requiredKeywords ? requiredKeywords.slice(0,4).join(', ') : 'none'}`);

      return [{ ...field, specificKeyword, requiredKeywords }];
    }
  }

  // חיפוש לפי keywords
  let best = null;
  const tooGeneric = ['למידה', 'לימוד', 'קורס', 'קורסים', 'השתלמות', 'תואר'];
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    for (const kw of (field.keywords || [])) {
      if (!kw || tooGeneric.includes(kw.toLowerCase())) continue;
      const kl = kw.toLowerCase();
      const inMsg = lm.includes(kl);
      const inExp = expanded.some(t => t.toLowerCase().includes(kl) || kl.includes(t.toLowerCase()));
      if ((inMsg || inExp) && (!best || kl.length > best.length)) {
        best = { field, keyword: kw, length: kl.length, via: inMsg ? 'direct' : 'semantic' };
      }
    }
  }

  if (best) {
    console.log(`✅ Keyword: "${best.keyword}" → "${best.field.name}" (via: ${best.via})`);
    let fullWord = best.keyword;
    for (const w of lm.split(/\s+/)) {
      const cw = w.replace(/[,\.!\?;:]/g, '');
      if (cw.length > 2 && cw.includes(best.keyword.toLowerCase())) { fullWord = cw; break; }
    }
    // requiredKeywords: הmatch keyword + phrases מהשדה + semanticPhrases
    const field = best.field;
    const fieldPhraseKws = (field.keywords || []).filter(k => k.trim().split(/\s+/).length >= 2 && k.length >= 4);
    const semanticPhrases = expanded.filter(t => t.trim().split(/\s+/).length >= 2 && t.length >= 4);
    const requiredKeywords = fieldPhraseKws.length > 0
      ? [...new Set([fullWord, ...fieldPhraseKws, ...semanticPhrases])]
      : null;
    console.log(`  📋 requiredKeywords: ${requiredKeywords ? requiredKeywords.slice(0,4).join(', ') : 'none'}`);
    return [{ ...field, specificKeyword: fullWord, requiredKeywords }];
  }

  console.log('❌ No field detected');
  return [];
}

function detectRegion(message) {
  loadConfigs();
  if (!REGIONS?.length) return null;
  const lm = message.toLowerCase().replace(/-/g, ' ');
  for (const r of REGIONS) {
    if (lm.includes(r.name.toLowerCase())) {
      console.log(`✅ Region: "${r.name}" (by name)`);
      return r;
    }
    for (const kw of (r.keywords || [])) {
      if (lm.includes(kw.toLowerCase())) {
        console.log(`✅ Region: "${r.name}" (by keyword "${kw}")`);
        return r;
      }
    }
    for (const city of (r.cities || [])) {
      if (lm.includes(city.toLowerCase().replace(/-/g, ' '))) {
        console.log(`✅ Region: "${r.name}" (by city "${city}")`);
        return r;
      }
    }
  }
  console.log('❌ No region detected');
  return null;
}

function detectSpecificCity(query, region) {
  if (!region?.cities) return null;
  const ql = query.toLowerCase().replace(/-/g, ' ');
  for (const city of region.cities) {
    if (ql.includes(city.toLowerCase().replace(/-/g, ' '))) {
      console.log(`✅ City: "${city}"`);
      return city;
    }
  }
  return null;
}

// ================================================================
// MAIN SEARCH - לוגיקה חדשה עם URL כמקור אמת לאזור
// ================================================================

async function searchPages(query, region = null, studyField = null, allowTextSearch = false) {
  console.log('\n========== [searchPages] START ==========');
  console.log(`🚀 VERSION: MAR_02_v249_MUSIC_URL`);
  console.log(`Query: "${query}" | Region: ${region?.name || 'any'} | Field: ${studyField?.name || 'any'} | Keyword: "${studyField?.specificKeyword || 'none'}"`);
  console.log('==========================================');

  // ── URL Blocklist: דפים שמופיעים בתחום הלא נכון ──
  const URL_BLOCKLIST = {
    // תחום → רשימת URL slugs שיש לחסום
    'הוראה מתקנת - הוראה מותאמת': ['kishurei-lemida', 'trump-institute', 'beit-issie-shapiro'],
    'תרפיה וטיפול':                ['kishurei-lemida'],
    'פסיכולוגיה וייעוץ':           ['kishurei-lemida'],
  };

  // כותרות חסומות לפי תחום
  const TITLE_BLOCKLIST = {
    'הוראה מתקנת - הוראה מותאמת': [
      'פסיכותרפיה הומניסטית',
      'נכויות התפתחותיות',
      'לימודי המשך בנכויות',
      'מכון טראמפ',
      'בית איזי שפירא',
    ],
  };

  const pages = loadAllPages();
  const results = [];
  const specificCity = detectSpecificCity(query, region);

  // slugs וכותרות חסומות לתחום הנוכחי
  const blockedSlugs  = studyField ? (URL_BLOCKLIST[studyField.name]  || []) : [];
  const blockedTitles = studyField ? (TITLE_BLOCKLIST[studyField.name] || []) : [];

  for (const page of pages) {
    const url = page.url || page.link || '';
    const rawTitle = page.title || page.h1 || '';

    // ── URL Blocklist ──
    if (blockedSlugs.some(slug => url.includes(slug))) {
      console.log(`  🚫 BLOCKED URL: "${url}"`);
      continue;
    }

    // ── Title Blocklist ──
    if (blockedTitles.some(t => rawTitle.includes(t))) {
      console.log(`  🚫 BLOCKED TITLE: "${rawTitle}"`);
      continue;
    }

    // ── ניקוי כותרת ──
    // פטרני זבל: מחקו רק כשהם כותרת עצמאית (פריטי carousel/ניווט)
    // תאריכים: רק כשהם כותרת בפני עצמה כגון "ינואר 2026" - לא כחלק מטקסט אמיתי
    const junkExactPatterns = ['close carousel', 'carousel', 'next', 'prev', 'previous', 'menu', 'navigation'];
    const monthPatterns = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    let cleanTitle = rawTitle;
    for (const j of junkExactPatterns) cleanTitle = cleanTitle.replace(new RegExp(j, 'gi'), '').trim();
    // תאריך בפני עצמו: "מרץ 2026" כשאין לפניו מילים משמעותיות
    for (const m of monthPatterns) {
      // מחק רק אם הכותרת *היא* תאריך בלבד (שם חודש + שנה)
      cleanTitle = cleanTitle.replace(new RegExp('^' + m + '\\s+20\\d\\d$', 'i'), '').trim();
    }
    if (cleanTitle.length < 3) { console.log(`  ❌ JUNK: "${rawTitle}"`); continue; }
    if (cleanTitle.length < 10 && !page.description && !page.text) continue;

    console.log(`  📄 "${cleanTitle}" | ${url}`);

    // ── שלב 1: בדיקת תחום לימוד בתוכן הדף ──
    if (studyField) {
      const fieldMatch = pageMatchesField(page, studyField, allowTextSearch);
      if (!fieldMatch.found) {
        console.log(`    [FIELD] ❌ Not found`);
        continue;
      }

  // ── ציון מינימלי לפי סוג השאילתה ──
      // title=150, desc=80, h2h3=60, text=40
      // מילות מפתח שמופיעות ברשימות קורסים (לא ככותרת דף) — מספיק text
      const LIST_FORMAT_KEYWORDS = new Set([
        'בינה מלאכותית', 'ai', 'chatgpt', 'chat gpt', 'canva', 'קאנבה',
        'משחקולוגיה', 'גיימיפיקציה', 'מציאות מדומה', 'מציאות רבודה',
        'פודקאסט', 'יוטיוב', 'youtube', 'tikto', 'tiktok',
        'מיינדפולנס', 'מדיטציה', 'יוגה', 'מיינד',
        'NLP', 'nlp', 'נלפ', 'CBT', 'cbt', 'EMDR', 'emdr',
      ]);
      const kwLower = (studyField.specificKeyword || '').toLowerCase();
      const isListFormat = [...LIST_FORMAT_KEYWORDS].some(k => kwLower.includes(k.toLowerCase()));

      // עבור list-format: שומר על requiredKeywords — "בינה מלאכותית" חייב להופיע בדף
      // ההבדל היחיד: מספיק ב-text (minScore=40) ולא חייב בכותרת/h2

      const minScore = (() => {
        if (studyField.maSpecialization) return 42;
        if (isListFormat) return 40;                            // מילות רשימה — text מספיק
        if (studyField.requiredKeywords?.length) return 80;    // חייב בכותרת/תיאור — לא רק H2 ניווט
        if (studyField.specificKeyword?.includes(' ')) return 60; // צירוף רב-מילי כללי
        return 40;
      })();

      if (fieldMatch.score < minScore) {
        console.log(`    [SCORE] ❌ Score ${fieldMatch.score} < min ${minScore} (${fieldMatch.location}) → skip: "${cleanTitle}"`);
        continue;
      }
      console.log(`    [SCORE] ✅ Score ${fieldMatch.score} >= min ${minScore} (${fieldMatch.location})`);

      // ── שלב 2: בדיקת אזור לפי URL ──
      let regionScore = 0;

      if (region) {
        const urlRegion = detectRegionFromUrl(url, region);

        if (urlRegion.match === 'exact') {
          // URL מכיל את slug האזור המבוקש - דף אזורי מדויק
          regionScore = 100;
          console.log(`    [REGION] ✅ Exact region match (+100)`);

          // בונוס לעיר ספציפית
          if (specificCity) {
            const text = (page.text || '').toLowerCase();
            const desc = (page.description || '').toLowerCase();
            const title = cleanTitle.toLowerCase();
            const cityLower = specificCity.toLowerCase().replace(/-/g, ' ');
            if (title.includes(cityLower) || desc.includes(cityLower) || text.includes(cityLower)) {
              regionScore += 50;
              console.log(`    [REGION] 🏙️ Specific city "${specificCity}" found (+50)`);
            }
          }

        } else if (urlRegion.match === 'other') {
          // URL שייך לאזור אחר - דחייה
          console.log(`    [REGION] ❌ Wrong region in URL → skip`);
          continue;

        } else {
          // URL ללא slug אזורי - תוכן ארצי/כללי
          // בדוק גם בtext אם מוזכרת עיר מהאזור
          const text = (page.text || '').toLowerCase().replace(/-/g, ' ');
          const desc = (page.description || '').toLowerCase();
          const titleLower = cleanTitle.toLowerCase();
          const combined = titleLower + ' ' + desc + ' ' + text;

          // האם מוזכרת עיר מהאזור המבוקש?
          let regionCityFound = false;
          let otherRegionCityFound = false;

          if (specificCity) {
            const cityLower = specificCity.toLowerCase().replace(/-/g, ' ');
            if (combined.includes(cityLower)) {
              regionCityFound = true;
              regionScore = 80;
              console.log(`    [REGION] 🏙️ Specific city "${specificCity}" in text (+80)`);
            }
          }

          if (!regionCityFound) {
            for (const city of (region.cities || [])) {
              const cl = city.toLowerCase().replace(/-/g, ' ');
              if (cl.length > 3 && combined.includes(cl)) {
                regionCityFound = true;
                regionScore = 40;
                console.log(`    [REGION] 🏙️ Region city "${city}" in text (+40)`);
                break;
              }
            }
          }

          if (!regionCityFound) {
            // בדוק אם מוזכרת עיר מהאזור המבוקש (גם ברמת כל ערי האזור)
            const hasAnyRequestedCity = (region.cities || []).some(rc =>
              rc.length > 3 && combined.includes(rc.toLowerCase().replace(/-/g, ' '))
            );
            if (hasAnyRequestedCity) {
              regionCityFound = true;
              regionScore = 30;
              console.log(`    [REGION] 🏙️ Region city found in combined text (+30) — multi-city institution`);
            }
          }

          if (!regionCityFound) {
            // בדוק אם מוזכרת עיר מאזור אחר (ייתכן שהדף שייך לאזור אחר)
            for (const otherR of (REGIONS || [])) {
              if (otherR.name === region.name) continue;
              for (const city of (otherR.cities || [])) {
                const cl = city.toLowerCase().replace(/-/g, ' ');
                if (cl.length > 3 && combined.includes(cl)) {
                  // בדוק שלא מופיעה גם עיר מהאזור המבוקש — מוסד רב-עירוני
                  const hasRequestedCity = (region.cities || []).some(rc =>
                    rc.length > 3 && combined.includes(rc.toLowerCase().replace(/-/g, ' '))
                  );
                  if (!hasRequestedCity) {
                    otherRegionCityFound = true;
                    console.log(`    [REGION] ❌ Only other-region city "${city}" found → skip`);
                    break;
                  }
                }
              }
              if (otherRegionCityFound) break;
            }
          }

          if (otherRegionCityFound) continue;

          if (!regionCityFound) {
            // אין ציון אזורי - תוכן ארצי כללי
            regionScore = 10;
            console.log(`    [REGION] ℹ️ National content (+10)`);
          }
        }

        const totalScore = fieldMatch.score + regionScore;
        console.log(`    ✅ ADDED | field:+${fieldMatch.score} region:+${regionScore} = total:${totalScore}`);
        results.push({
          ...page,
          title: cleanTitle,
          score: totalScore,
          regionMatch: urlRegion.match,
          fieldLocation: fieldMatch.location
        });

      } else {
        // אין אזור מבוקש - הוסף את כל הדפים עם הניקוד של התחום
        let empowerBonus = 0;
        if ((studyField?.name || '').includes('העצמה')) {
          const preferred = [
            'nlp', 'נלפ', 'אימון עצמי', 'אימון אישי', 'coaching', 'קואצ\'ינג',
            'יומן ויזואלי', 'פסיכולוגיה חיובית', 'מיינדפולנס', 'mindfulness',
            'חוסן', 'חוסן נפשי', 'חוסן רגשי', 'ביטחון עצמי', 'מודעות עצמית',
            'שחרור רגשי', 'התפתחות אישית', 'עוצמה אישית', 'העצמה אישית',
            'חשיבה חיובית', 'רגש', 'ויסות רגשי', 'גוף נפש'
          ];
          const combined = ((page.title || '') + ' ' + (page.description || '')).toLowerCase();
          if (preferred.some(p => combined.includes(p))) { empowerBonus = 30; }
        }
        const finalScore = fieldMatch.score + empowerBonus;
        if (empowerBonus) console.log(`    [EMPOWER] ✨ Preferred content boost (+${empowerBonus})`);
        console.log(`    ✅ ADDED (no region filter) | score:${finalScore}`);
        results.push({
          ...page,
          title: cleanTitle,
          score: finalScore,
          regionMatch: 'none',
          fieldLocation: fieldMatch.location
        });
      }
    }
  }

  // מיון: קודם exact region, אחר כך לפי score
  const regionOrder = { exact: 0, none: 1, other: 2 };
  results.sort((a, b) => {
    const rA = regionOrder[a.regionMatch] ?? 1;
    const rB = regionOrder[b.regionMatch] ?? 1;
    if (rA !== rB) return rA - rB;
    return b.score - a.score;
  });

  console.log(`\n[searchPages] DONE: ${results.length} results`);
  console.log(`  Exact region: ${results.filter(r => r.regionMatch === 'exact').length}`);
  console.log(`  National: ${results.filter(r => r.regionMatch === 'none').length}`);
  return results;
}

// ================================================================
// QA SYSTEM
// ================================================================

// חלץ כל השאלות מ-QA file בכל פורמט
function extractAllQuestions(qaData) {
  if (!qaData) return [];
  const questions = [];
  // פורמט: categories[].questions[]
  if (qaData.categories) {
    for (const cat of qaData.categories) {
      for (const q of (cat.questions || [])) {
        questions.push({ ...q, _category: cat.name, _fallback: qaData.fallbackMessage });
      }
    }
  }
  // פורמט: questions[] ישירות
  if (qaData.questions) {
    for (const q of qaData.questions) {
      questions.push({ ...q, _fallback: qaData.fallbackMessage });
    }
  }
  return questions;
}

function findQAAnswer(message) {
  loadConfigs();
  const lm = message.toLowerCase();

  // כל מאגרי ה-QA
  const allQASources = [
    { name: 'courses-qa',  data: COURSES_QA,  topKeywords: COURSES_QA?.keywords  || [] },
    { name: 'shabaton-qa', data: SHABATON_QA, topKeywords: SHABATON_QA?.keywords || [] },
  ];

  let bestMatch = null;
  let bestScore = 0;

  for (const source of allQASources) {
    if (!source.data) continue;

    // בדוק קודם אם השאלה בכלל רלוונטית למאגר (top-level keywords)
    const topHits = source.topKeywords.filter(k => lm.includes(k.toLowerCase())).length;
    if (source.topKeywords.length > 0 && topHits === 0) continue; // מאגר לא רלוונטי

    const questions = extractAllQuestions(source.data);
    for (const q of questions) {
      let score = 0;

      // התאמה מדויקת לשאלה
      if (q.question && lm.includes(q.question.toLowerCase())) score = 100;
      // התאמה לגרסה
      else if ((q.variations || []).some(v => lm.includes(v.toLowerCase()))) score = 90;
      else {
        // ניקוד לפי keywords של השאלה
        const hits = (q.keywords || []).filter(k => lm.includes(k.toLowerCase()));
        if (hits.length >= 2) score = 50 + hits.length * 5;
        else if (hits.length === 1 && hits[0].length > 5) score = 30; // מילת מפתח ארוכה אחת
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { answer: q.answer, relatedLinks: q.relatedLinks, fallback: q._fallback, score };
      }
    }
  }

  if (bestScore >= 30) {
    console.log(`✅ QA match (score=${bestScore}): "${message.substring(0, 40)}"`);
    // הוסף relatedLinks לתשובה — רק אם ה-URL עוד לא מופיע בתשובה
    let answer = bestMatch.answer;
    if (bestMatch.relatedLinks?.length) {
      const extraLinks = bestMatch.relatedLinks.filter(link => !answer.includes(link.url));
      if (extraLinks.length) {
        answer += '\n\n';
        for (const link of extraLinks) {
          answer += `📎 [${link.text}](${link.url})\n`;
        }
      }
    }
    return { answer };
  }

  return null;
}

// ================================================================
// SHABATON PAGE FALLBACK — כשאין תשובה ב-QA, מסרוקים דף רלוונטי
// ================================================================

// מיפוי נושאים לדפים רלוונטיים
const SHABATON_PAGE_MAP = [
  { keywords: ['ביטוח לאומי','בטל','ביטוח'],          url: '/btl_shabaton',                 name: 'ביטוח לאומי בשבתון' },
  { keywords: ['מענק','כמה מקבלים','תשלום','שכר'],     url: '/shabaton-maanak',               name: 'מענק שבתון' },
  { keywords: ['תשלומים','פנסיה','קרן'],                url: '/Payments_shabaton',             name: 'תשלומים בשנת שבתון' },
  { keywords: ['לידה','יולדת','הריון','דמי לידה'],      url: '/birth_shabatgon',               name: 'לידה בשבתון' },
  { keywords: ['תוכנית לימודים','מה ללמוד','שעות'],     url: '/learning_programs_shabaton',    name: 'תוכניות לימודים' },
  { keywords: ['חובת לימודים','לימודי חובה','השלמה'],   url: '/shabaton-hova-hashlama',        name: 'לימודי חובה' },
  { keywords: ['לוח זמנים','מועדים','מתי להגיש'],       url: '/luz_shabaton',                  name: 'לוח הזמנים' },
  { keywords: ['סוף שבתון','חזרה','סיום'],               url: '/end_shabaton',                  name: 'סוף שבתון' },
  { keywords: ['טפסים','מסמכים'],                        url: '/forms_shabaton',                name: 'טפסים ומסמכים' },
  { keywords: ['בקשת שבתון','הגשת בקשה'],               url: '/shabaton_request',              name: 'בקשת שבתון' },
  { keywords: ['חצי שבתון','שבתון מלא'],                 url: '/halforfull_shabaton',           name: 'שבתון מלא או חצי' },
  { keywords: ['טלפון','לפנות','כתובת'],                 url: '/phones_shabaton',               name: 'טלפונים וכתובות' },
  { keywords: ['קבלות','החזר שכר לימוד','ארגון המורים'], url: '/shabaton-kabalot-irgun',       name: 'קבלות - ארגון המורים' },
  { keywords: ['קבלות','החזר שכר לימוד','הסתדרות'],     url: '/shabaton-kabalot-histadrut',    name: 'קבלות - הסתדרות' },
  { keywords: ['תלוש','תלושים'],                          url: '/tlush_maanak_shabaton',         name: 'תלושי מענק' },
  { keywords: ['דוקטורט','תואר שלישי','phd'],            url: '/toar_shlishi_edu',              name: 'דוקטורט בשבתון' },
  { keywords: ['שינוי תוכנית','לשנות'],                  url: '/change_prog_shabaton',          name: 'שינוי תוכנית לימודים' },
  { keywords: ['רשימת משימות','checklist'],               url: '/shabaton_checklist',            name: 'רשימת משימות' },
];

async function fetchShabatonPage(url) {
  try {
    const https = await import('https');
    const fullUrl = `https://www.shabaton.online${url}`;
    return new Promise((resolve) => {
      const req = https.get(fullUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShabatonBot/1.0)' },
        timeout: 8000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // חלץ טקסט נקי
          let text = data
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
          // חלץ 2000 תווים רלוונטיים (דלג על תפריט)
          const idx = Math.min(800, Math.floor(text.length * 0.15));
          resolve(text.substring(idx, idx + 2500));
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  } catch(e) { return null; }
}

async function findShabatonPageFallback(message) {
  const lm = message.toLowerCase();
  // מצא דף רלוונטי
  let best = null;
  let bestScore = 0;
  for (const page of SHABATON_PAGE_MAP) {
    const hits = page.keywords.filter(k => lm.includes(k)).length;
    if (hits > bestScore) { bestScore = hits; best = page; }
  }
  if (!best || bestScore === 0) return null;

  console.log(`🔍 Shabaton fallback: fetching ${best.url} for "${message.substring(0,30)}"`);
  const content = await fetchShabatonPage(best.url);
  if (!content || content.length < 100) return null;

  return {
    answer: `המידע מדף **${best.name}** באתר שבתון:\n\n${content.substring(0, 800)}\n\n📎 [לכל המידע: ${best.name}](https://www.shabaton.online${best.url})\n💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)`,
    _fromFallback: true
  };
}

function classifyIntent(message) {
  const lm = message.toLowerCase();
  const qaKw = ['כמה', 'מתי', 'איך', 'מה זה', 'האם', 'מי', 'למה', 'איפה', 'מה'];
  if (qaKw.some(k => lm.includes(k))) {
    const qa = findQAAnswer(message);
    if (qa) return { intent: 'qa', data: qa };
    // בדוק אם שאלה על שבתון — סמן לfallback
    const shabatonKw = ['שבתון','ביטוח לאומי','מענק','לידה','תוכנית לימודים','קרן','טפסים','מסמכים','חצי שבתון'];
    if (shabatonKw.some(k => lm.includes(k))) return { intent: 'qa_fallback' };
  }
  const searchKw = ['קורס', 'לימוד', 'השתלמות', 'תואר', 'מכללה', 'לימודים'];
  if (searchKw.some(k => lm.includes(k))) return { intent: 'search' };

  // אם יש זיהוי כוונה (intent) — גם זה חיפוש
  if (INTENT_MAPPINGS?.length) {
    for (const mapping of INTENT_MAPPINGS) {
      if (mapping.patterns.some(p => lm.includes(p.toLowerCase()))) {
        console.log(`🎯 Intent keyword detected: "${mapping.intent}" → treating as search`);
        return { intent: 'search' };
      }
    }
  }

  return { intent: 'general' };
}

// ================================================================
// RESPONSE FORMATTING
// ================================================================

function buildCategoryUrl(region, studyField) {
  if (!studyField?.slug) return null;
  if (region?.slug) return `${SITE_BASE}/${region.slug}/${studyField.slug}`;
  return `${SITE_BASE}/${studyField.slug}`;
}

// מחלץ שם מוסד מכותרת הדף (לדדופ לפי מוסד)
function extractInstitutionName(title) {
  const parts = title.replace(/[-–—|]/g, '|').split('|').map(p => p.trim()).filter(p => p.length > 2);
  const institutionMarkers = ['מכללת', 'אוניברסיטת', 'מכון', 'המכללה', 'האקדמית', 'הקריה', 'בית-הספר', 'מרכז'];

  // עדיפות לחלק שמכיל מילת מוסד
  for (const part of parts.slice().reverse()) {
    if (institutionMarkers.some(m => part.includes(m))) return part.substring(0, 50);
  }

  // הכותרת מתחילה בתיאור גנרי ("השתלמויות מורים", "קורסים", "לימודי תעודה") —
  // העדף את החלקים הלא-גנריים מחוברים כשם המוסד הספציפי
  const genericPrefixes = ['השתלמויות מורים', 'השתלמויות', 'קורסים', 'קורסי', 'לימודי תעודה',
    'לימודי', 'פיתוח מקצועי', 'לימודים לתואר', 'תואר שני'];
  if (parts.length >= 2 && genericPrefixes.some(p => parts[0].includes(p))) {
    const nonGeneric = parts.filter(p => !genericPrefixes.some(g => p === g || p.startsWith(g)));
    if (nonGeneric.length > 0) return nonGeneric.join(' ').substring(0, 60);
  }

  // fallback — החלק הראשון
  return parts[0]?.replace(/^(קורס|קורסי|לימודי|השתלמות|תואר שני ב)\s+/i, '').substring(0, 40) || title.substring(0, 40);
}

/**
 * בנה תיאור קצר לדף על פי ניתוח ה-text field
 */
function buildPageSummary(page) {
  const desc = page.description || '';
  // השתמש רק ב-description - קצר ומדויק
  if (desc && desc.length > 10) return desc.substring(0, 180) + (desc.length > 180 ? '...' : '');
  return '';
}

function formatResults(results, studyField, region, query = '') {
  const fieldName = studyField?.name || 'הקורסים';
  const regionName = region?.name || 'כל הארץ';
  const queryLower = query.toLowerCase();

  // זיהוי בקשת תואר שני מפורשת
  const isDegreeRequest = /תואר שני|תואר ב|מ\.א|M\.A|אקדמי|דוקטורט|תואר שלישי/.test(query);

  // ── זיהוי דפי קטגוריה לפי URL ──
  // דף קטגוריה אמיתי: 2 חלקי נתיב, slug אזורי ידוע, ושם הדף תואם שם תחום לימוד
  // FIELD_NAMES_SET — כולל שמות מלאים, חלקים לפני/אחרי מקף, ו-slugs
  const FIELD_NAMES_SET = new Set((STUDY_FIELDS || []).flatMap(f => {
    const name = (f.name || '').toLowerCase();
    const slug = (f.slug || '').toLowerCase();
    const parts = name.split(/\s*[-–—]\s*/).map(p => p.trim()).filter(p => p.length > 2);
    const stripped = name.replace(/^(קורסי|לימודי|קורסים ב|קורסים ל)\s+/i, '').trim();
    return [name, slug, stripped, ...parts];
  }).filter(Boolean));

  const isCategoryPage = (r) => {
    const url = (r.url || r.link || '');
    const path = url.replace(/^https?:\/\/[^\/]+\//, '');
    const parts = path.split('/').filter(p => p.length > 0);
    if (parts.length !== 2) return false;
    const firstPart = decodeURIComponent(parts[0]).toLowerCase();
    if (!(REGIONS || []).some(reg => reg.slug && firstPart === reg.slug.toLowerCase())) return false;

    const secondPart = decodeURIComponent(parts[1]).toLowerCase()
      .replace(/^(קורסי|לימודי|קורסים ב|קורסים ל)\s+/i, '').trim();
    const titleRaw = (r.title || r.h1 || '').toLowerCase()
      .replace(/^(קורסי|לימודי|קורסים ב|קורסים ל)\s+/i, '').trim();

    // בדיקה ישירה
    if (FIELD_NAMES_SET.has(secondPart) || FIELD_NAMES_SET.has(titleRaw)) return true;

    // בדיקה: האם secondPart מכיל שם תחום מה-set (כולל חלקים)
    for (const fn of FIELD_NAMES_SET) {
      if (fn.length < 4) continue; // דלג על ערכים קצרים מדי
      if (secondPart.includes(fn) || titleRaw.includes(fn)) return true;
    }
    return false;
  };

  // ── URLs קבועים לתחומים מיוחדים ──
  const ONLINE_LEARNING_URL = 'https://www.shabaton.online/results-all/למידה מרחוק';
  const OFEK_CHADASH_URL = 'https://www.shabaton.online/results-all/קורסי אופק חדש - עוז לתמורה';
  const ART_URL = 'https://www.shabaton.online/results-all/קורסי אמנות ואומנויות';

  const FIXED_CATEGORY_URLS = {
    'למידה מרחוק': ONLINE_LEARNING_URL,
    'אופק חדש - עוז לתמורה': OFEK_CHADASH_URL,
    'אופק חדש': OFEK_CHADASH_URL,
    'עוז לתמורה': OFEK_CHADASH_URL,
    'אמנות ואומנויות': ART_URL,
    'אמנות': ART_URL,
    'תואר שני': 'https://www.shabaton.online/results-all/לימודי תואר שני',
    'מוסיקה': 'https://www.shabaton.online/results-all/קורסי מוסיקה - קונצרטים מודרכים',
  };

  const findCategoryUrlFromResults = () => {
    // בדוק URL קבוע לתחומים מיוחדים
    const fieldName = studyField?.name || '';
    for (const [key, url] of Object.entries(FIXED_CATEGORY_URLS)) {
      if (fieldName.includes(key)) return url;
    }
    if (!studyField) return null;
    // קודם דף אזורי מהאינדקס
    const regionalCat = results.find(r => isCategoryPage(r) && r.regionMatch === 'exact');
    if (regionalCat) return regionalCat.url || regionalCat.link;
    // אחר כך דף ארצי מהאינדקס
    const nationalCat = results.find(r => isCategoryPage(r));
    if (nationalCat) return nationalCat.url || nationalCat.link;
    // fallback: בנה מ-slug
    if (studyField?.slug) {
      if (region?.slug) return `${SITE_BASE}/${region.slug}/${studyField.slug}`;
      return `${SITE_BASE}/${studyField.slug}`;
    }
    return null;
  };

  // ── סינון מוסדות ספציפיים ──
  const isOfekChadash = ['אופק חדש', 'עוז לתמורה'].some(t => (studyField?.name || '').includes(t));

  const isRelevantInstitution = (r) => {
    const title = (r.title || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    const url = (r.url || r.link || '').toLowerCase();
    const cleanUrl = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

    // סינון דפי אירועים/כנסים/יצירת קשר/חודשי
    const eventPatterns = ['/kenes/', '/event/', '/sde-yom/', '/yom-iyun/', '/workshop/',
      '/contact', '/knassim', '/contact-us', '/courses-per-month-',
      '/מחפשים-משרות', '/משרות-הוראה', '/drushim', '/הוספת-משרה', '/הוספת-מודעה'];
    if (eventPatterns.some(p => url.includes(p))) {
      console.log(`    [FILTER] ❌ Event/contact/monthly → skip: "${r.title}"`);
      return false;
    }

    // סינון עמוד הבית של שבתון
    if (cleanUrl === 'shabaton.online') {
      console.log(`    [FILTER] ❌ Homepage → skip`);
      return false;
    }

    // סינון דפי נחיתה אזוריים כלליים (path אחד בלבד)
    const blockedSinglePaths = [
      'shabaton.online/heifa', 'shabaton.online/sharon', 'shabaton.online/tel-aviv',
      'shabaton.online/darom', 'shabaton.online/jerusalm', 'shabaton.online/jerusalem',
      'shabaton.online/merkaz', 'shabaton.online/zafon', 'shabaton.online/north',
      'shabaton.online/south', 'shabaton.online/courses-next-2weeks',
    ];
    if (blockedSinglePaths.some(p => cleanUrl === p)) {
      console.log(`    [FILTER] ❌ Region landing → skip`);
      return false;
    }

    // סינון דפי תואר שני כלליים (קטגוריות וסיכומים)
    const blockedMAPaths = [
      'shabaton.online/master-degree',
      'shabaton.online/master-degree-by-area',
      'shabaton.online/ma_edu_merkaz',
      'shabaton.online/ma_edu_jerusalem',
      'shabaton.online/ma_edu_sharon',
      'shabaton.online/ma_edu_north',
      'shabaton.online/ma_edu_darom',
    ];
    if (blockedMAPaths.some(p => cleanUrl.toLowerCase() === p)) {
      console.log(`    [FILTER] ❌ MA category page → skip`);
      return false;
    }

    // סינון דפי תואר שני אזוריים/כלליים לפי כותרת — כשחיפוש הוא MA עם התמחות
    if (studyField?.maSpecialization) {
      const maGenericTitlePatterns = [
        /^תואר שני ב/, /^לימודי תואר שני/, /^אקדמי - תואר שני/, /^אקדמי - תואר/,
        /תואר שני.*בחיפה/, /תואר שני.*בצפון/, /תואר שני.*במרכז/,
        /תואר שני.*בשרון/, /תואר שני.*בירושלים/, /תואר שני.*בדרום/,
        /תואר שני.*בשפלה/, /תואר שני.*באזור/, /תואר שני.*וב/,
        /תואר שני.*כל המכללות/, /תואר שני.*כל הארץ/,
      ];
      if (maGenericTitlePatterns.some(p => p.test(title))) {
        console.log(`    [FILTER] ❌ MA regional/generic title → skip: "${r.title}"`);
        return false;
      }
      // חסימה לפי URL — דפי אזור+תואר שני
      const maRegionalUrlPatterns = [
        /\/(results-heifa|results-merkaz|results-sharon|results-darom|results-jerusalem|results-zafon|heifa|merkaz|sharon|darom|jerusalm|jerusalem|zafon|north|south|tel-aviv)\/(ma|master|תואר)/i,
        /\/(ma|master)-degree/,
      ];
      if (maRegionalUrlPatterns.some(p => p.test(url))) {
        console.log(`    [FILTER] ❌ MA regional URL → skip: "${r.title}"`);
        return false;
      }
    }

    // סינון דפי תואר שני כשיש "תואר שני" רק כדרישת קבלה (לא כמה שמציע)
    if (studyField?.maSpecialization) {
      const admissionPhrases = ['בעלי תואר שני', 'בעל תואר שני', 'בעלות תואר שני',
        'מחייב תואר שני', 'נדרש תואר שני', 'דרישות קבלה', 'תנאי קבלה'];
      const titleAndDesc = title + ' ' + desc;
      const hasAdmissionOnly = admissionPhrases.some(p => titleAndDesc.includes(p)) &&
        !title.includes('תואר שני ב') && !title.includes('לימודי תואר שני');
      if (hasAdmissionOnly) {
        console.log(`    [FILTER] ❌ תואר שני as admission req only → skip: "${r.title}"`);
        return false;
      }

      // סינון conflict: אם כותרת הדף מציינת התמחות אחרת מהמבוקשת
      if (studyField?.maSpecialization && studyField?.maCompetingFields?.length) {
        const competingInTitle = studyField.maCompetingFields.some(cf => title.includes(cf.toLowerCase()));
        if (competingInTitle) {
          console.log(`    [FILTER] ❌ Competing specialization in title → skip: "${r.title}"`);
          return false;
        }
      }
    }

    // סינון דפי גמלאים/גימלאים כלליים (אלא אם חיפשו גמלאים)
    const isGimalaiQuery = /גמלא|גימלא|פנסיה|פנסיונר/.test(query);
    if (!isGimalaiQuery) {
      const gimalaiTitles = ['לגמלאים', 'לגימלאים', 'קורסים לגמלאים', 'קורסים לגימלאים', 'חוגים לגמלאים'];
      if (gimalaiTitles.some(g => title.trim() === g || title.trim().startsWith(g))) {
        console.log(`    [FILTER] ❌ Gimalai general page → skip: "${r.title}"`);
        return false;
      }
    }

    // סינון דפי קטגוריה כלליים ב-isCategoryPage
    const morimBlocked = ['/fashion', '/art', '/cooking', '/trips', '/empowering',
      '/health', '/courses-jewelry', '/mosaic', '/קורסי-נגרות', '/קורסי נגרות'];
    if (url.includes('morim.boutique') && (
      morimBlocked.some(p => url.includes(p)) ||
      cleanUrl === 'www.morim.boutique' || cleanUrl === 'morim.boutique'
    )) {
      console.log(`    [FILTER] ❌ morim.boutique general → skip`);
      return false;
    }

    // סינון תואר שני — רק אם הגולש לא ביקש תואר שני במפורש
    if (!isDegreeRequest) {
      const degreeKeywords = ['תואר שני', 'תואר שלישי', 'דוקטורט'];
      if (degreeKeywords.some(k => title.includes(k))) {
        console.log(`    [FILTER] ❌ Degree page (no degree request) → skip: "${r.title}"`);
        return false;
      }
    }

    // סינון לתחום "אמנות" — whitelist מחמיר
    const isArtField = (studyField?.name || '').includes('אמנות') || (studyField?.name || '').includes('אומנות');
    if (isArtField) {
      const titleLower = (r.title || '').toLowerCase();
      const descLower = (r.description || '').toLowerCase();
      const textFull = (r.text || '').toLowerCase();

      // אם המשתמש חיפש תת-תחום ספציפי (ציור, פיסול, קרמיקה...) — חייב להופיע בכותרת/תיאור
      const artSubFields = ['ציור', 'פיסול', 'קרמיקה', 'קדרות', 'חימר', 'פסיפס', 'ויטראז', 'רקמה',
        'סריגה', 'צורפות', 'תכשיטנות', 'מנדלה', 'נגרות', 'גילוף', 'הדפס', 'טקסטיל'];
      const spKwArt = (studyField?.specificKeyword || '').toLowerCase();
      const isArtSubSearch = artSubFields.some(sf => spKwArt.includes(sf));
      if (isArtSubSearch) {
        if (!titleLower.includes(spKwArt) && !descLower.includes(spKwArt)) {
          console.log(`    [ART_SUB] ❌ "${spKwArt}" not in title/desc → skip: "${r.title}"`);
          return false;
        }
      }

      // חסימה לפי כותרת/תיאור — תחומים לא-אמנותיים
      const nonArtTitles = [
        'עיצוב הסביבה', 'עיצוב פנים', 'עיצוב אופנה', 'עיצוב גרפי',
        'home styling', 'הום סטיילינג', 'קולנוע', 'צילום', 'תיאטרון',
        'לקויות למידה', 'חינוך מיוחד', 'nlp', 'coaching', 'אימון',
        'טיולים', 'סיורים', 'ספורט', 'כושר', 'בישול', 'קולינאריה',
        'השתלמויות מורים', 'לימודי חוץ', 'פיתוח מקצועי',
        'ריקודים', 'מחול', 'תנועה', 'פלייבק', 'תרפיה', 'טיפול',
        'מוגבלות', 'נכויות', 'שיקום', 'פסיכותרפיה', 'ייעוץ',
        'רהיטים', 'עיצוב הבית', 'חידוש רהיטים'
      ];
      if (nonArtTitles.some(p => titleLower.includes(p) || descLower.includes(p))) {
        console.log(`    [ART] ❌ Non-art content → skip: "${r.title}"`);
        return false;
      }

      // whitelist בכותרת/description — מילות אמנות חזותית ספציפיות
      // הוסר "יצירה" — גנרי מדי (יצירת קשר, יצירה חינוכית...)
      const artInTitleDesc = [
        'ציור', 'פיסול', 'קרמיקה', 'פסיפס', 'ויטראז', 'אמנות', 'אומנות',
        'יומן ויזואלי', 'עיסת נייר', 'מנדלה', 'נגרות', 'גילוף', 'חימר', 'קדרות',
        'ליבוד', 'רקמה', 'סריגה', 'מקרמה', 'רישום', 'פיוזינג', 'טקסטיל',
        'צורפות', 'תכשיטנות', 'בובנאות', 'הדפס', 'מוזאיקה', 'שילוב אמנויות', 'שילוב אומנויות'
      ];
      if (artInTitleDesc.some(k => titleLower.includes(k) || descLower.includes(k))) {
        return true; // ✅ נמצאה מילת אמנות בכותרת/תיאור
      }

      // whitelist ב-text — רק ביטויים ספציפיים (מונע false positive ממניע)
      const artInTextPhrases = [
        'קורס ציור', 'קורס פיסול', 'קורס קרמיקה', 'קורס אמנות', 'קורס אומנות',
        'סדנאות ציור', 'סדנאות פסיפס', 'סדנאות ויטראז', 'סדנאות פיסול',
        'יצירה בחומר', 'יצירה בנייר', 'עבודות טקסטיל', 'שילוב אומנויות',
        'קורס מנדלה', 'יומן ויזואלי', 'קורס נגרות', 'קורס צורפות'
      ];
      if (artInTextPhrases.some(k => textFull.includes(k))) {
        return true; // ✅ נמצא ביטוי אמנות ספציפי ב-text
      }

      console.log(`    [ART] ❌ No art content → skip: "${r.title}"`);
      return false;
    }

    // סינון לתחום "העצמה" — הוצא דפי אומנות/סטודיו ותארים אקדמיים
    const isEmpowermentField = (studyField?.name || '').includes('העצמה');
    if (isEmpowermentField) {
      const artPatterns = ['סטודיו', 'קרמיקה', 'פיסול', 'ציור', 'אריגה', 'רקמה', 'נגרות',
        'קדרות', 'חימר', 'פסיפס', 'גילוף', 'ויטראז', 'תכשיטנות', 'צורפות',
        'studio', 'ceramics', 'pottery'];
      const degreePatterns = ['תואר שני', 'תואר שלישי', 'דוקטורט', 'אקדמי', 'מ.א', 'M.A',
        'אוניברסיטת', 'אקדמית', 'הקריה האקדמית', 'מכללה אקדמית'];
      const titleLower = (r.title || '').toLowerCase();
      const descLower = (r.description || '').toLowerCase();
      if (artPatterns.some(p => titleLower.includes(p) || descLower.startsWith(p))) {
        console.log(`    [EMPOWER] ❌ Art studio → skip: "${r.title}"`);
        return false;
      }
      if (degreePatterns.some(p => titleLower.includes(p.toLowerCase()))) {
        console.log(`    [EMPOWER] ❌ Degree program → skip: "${r.title}"`);
        return false;
      }
    }
    if (isOfekChadash && (title.includes('למידה מרחוק') || title.includes('לימוד מרחוק'))) return false;
    // דף "שנת שבתון מורים" הכללי — לא מוסד
    if (isOfekChadash && title === 'שנת שבתון מורים') return false;
    if (!isOfekChadash) {
      // ── סינון גנרי לכל תחום: specificKeyword חייב להופיע בכותרת או תיאור ──
      // מונע מוסדות שמזכירים את הנושא רק בטקסט הארוך (לא רלוונטיים)
      const spKw = (studyField?.specificKeyword || '').toLowerCase();
      if (spKw && spKw.length >= 3) {
        const titleDescText = (title + ' ' + desc).toLowerCase();
        if (!titleDescText.includes(spKw)) {
          console.log(`    [SPECIFIC_KW] ❌ "${spKw}" not in title/desc → skip: "${r.title}"`);
          return false;
        }
      }
      return true;
    }
    // לאופק חדש: חייב להזכיר "אופק חדש" או "עוז לתמורה" ב-description או ב-text המלא
    const fullText = (r.text || '').toLowerCase();
    const mentionsOfek = ['אופק חדש', 'עוז לתמורה'].some(k =>
      desc.includes(k) || fullText.includes(k)
    );
    if (!mentionsOfek) {
      console.log(`    [OFEK] ❌ No explicit mention → skip: "${r.title}"`);
      return false;
    }
    return true;
  };

  const exactResults = results.filter(r => r.regionMatch === 'exact');
  const nationalResults = results.filter(r => r.regionMatch === 'none');
  const otherRegionResults = results.filter(r => r.regionMatch === 'other');

  // מילות אזור סותרות — לפי שם האזור המבוקש
  const getConflictingKeywords = (rName) => {
    const n = rName.toLowerCase();
    if (n.includes('מרכז') || n.includes('תל אביב')) return ['צפון', 'גליל', 'עמקים', 'חיפה', 'ירושלים', 'דרום', 'נגב', 'באר שבע', 'אילת', 'מסד', 'גליל תחתון', 'גליל עליון'];
    if (n.includes('שרון'))    return ['צפון', 'גליל', 'עמקים', 'חיפה', 'ירושלים', 'דרום', 'נגב', 'באר שבע'];
    if (n.includes('חיפה'))    return ['ירושלים', 'דרום', 'נגב', 'באר שבע', 'תל אביב', 'מרכז', 'שרון', 'רחובות', 'נס ציונה', 'ראשון לציון', 'פתח תקווה', 'בני ברק', 'גבעתיים', 'הרצליה', 'נתניה', 'רעננה', 'כפר סבא'];
    if (n.includes('צפון'))    return ['ירושלים', 'דרום', 'נגב', 'באר שבע', 'תל אביב', 'מרכז', 'שרון', 'רחובות', 'נס ציונה', 'ראשון לציון', 'פתח תקווה', 'בני ברק', 'גבעתיים', 'הרצליה', 'נתניה', 'רעננה', 'כפר סבא'];
    if (n.includes('ירושלים')) return ['צפון', 'גליל', 'חיפה', 'תל אביב', 'מרכז', 'דרום', 'באר שבע'];
    if (n.includes('דרום') || n.includes('שפלה')) return ['צפון', 'גליל', 'חיפה', 'תל אביב', 'מרכז', 'ירושלים'];
    return [];
  };
  const conflictingKeywords = region ? getConflictingKeywords(regionName) : [];
  // ערים של האזור המבוקש — דף national שמזכיר עיר של האזור → עדיפות גבוהה
  const regionCities = (region?.cities || []).map(c => c.toLowerCase());
  console.log(`  🗺️ Region: "${regionName}" | conflicting: [${conflictingKeywords.join(', ')}]`);

  const hasConflictingRegion = (r) => {
    if (!conflictingKeywords.length) return false;
    // בדיקה רק בכותרת ו-H1 — לא H2 שמכיל תפריט ניווט עם ערים מכל האזורים
    const searchText = [
      r.title || '',
      r.h1 || ''
    ].join(' ').toLowerCase();
    // מוסד רב-עירוני: אם עיר האזור המבוקש מופיעה בטקסט המלא — לא לסנן
    const fullText = ((r.text || '') + ' ' + (r.description || '')).toLowerCase();
    if (regionCities.some(city => city.length > 3 && (searchText.includes(city) || fullText.includes(city)))) return false;
    // אחרת — בדוק סתירה רק בכותרת/H1
    return conflictingKeywords.some(kw => {
      const idx = searchText.indexOf(kw.toLowerCase());
      if (idx === -1) return false;
      const isBound = (c) => !c || /[\s,.\-\/()[\]"'!?:;]/.test(c);
      return isBound(searchText[idx - 1]) && isBound(searchText[idx + kw.length]);
    });
  };

  const allowCatPages = !!(studyField && studyField._musicQuery);
  const isMusicCatPage = (r) => {
    if (!allowCatPages) return false;
    const t = (r.title || r.h1 || '').toLowerCase();
    const u = (r.url || r.link || '').toLowerCase();
    return t.includes('מוסיקה') || u.includes('%d7%9e%d7%95%d7%a1%d7%99%d7%a7%d7%94') || u.includes('מוסיקה');
  };
  let allInstitutions = [
    ...exactResults.filter(r => (isMusicCatPage(r) || !isCategoryPage(r)) && isRelevantInstitution(r)),
    ...nationalResults.filter(r => (isMusicCatPage(r) || !isCategoryPage(r)) && !hasConflictingRegion(r) && isRelevantInstitution(r))
  ];
  const onlineCount = nationalResults.filter(r => (r.url||r.link||'').includes('results-all')).length;
  console.log(`  📊 exact:${exactResults.length} national:${nationalResults.length} (online:${onlineCount}) other:${otherRegionResults.length}`);

  // מיפוי אזורים סמוכים — fallback חכם
  const NEARBY_REGIONS = {
    'results-merkaz':   ['results-sharon'],          // מרכז → שרון
    'results-sharon':   ['results-merkaz'],          // שרון → מרכז
    'results-heifa':    ['results-sharon'],          // חיפה → שרון
    'results-zafon':    ['results-heifa'],           // צפון → חיפה
    'results-darom':    [],                          // דרום → אין סמוכים
    'results-jerusalem': [],                         // ירושלים → אין סמוכים
    'results-shfea-darom': [],
  };

  const regionSlug = region?.slug || '';
  const allowedNearby = NEARBY_REGIONS[regionSlug] || [];

  const isNearbyOrOnline = (r) => {
    const url = (r.url || r.link || '').toLowerCase();
    // למידה מרחוק — תמיד מותר
    if (url.includes('results-all') || (r.title || '').includes('למידה מרחוק')) return true;
    // אזורים סמוכים בלבד
    return allowedNearby.some(slug => url.includes(slug));
  };

  // fallback: אם פחות מ-10 תוצאות — הוסף אזורים סמוכים ולמידה מרחוק (לא צפון/דרום/ירושלים)
  if (allInstitutions.length < 10 && region) {
    const nearbyFiltered = otherRegionResults
      .filter(r => isNearbyOrOnline(r) && !isCategoryPage(r) && isRelevantInstitution(r));
    allInstitutions = [...allInstitutions, ...nearbyFiltered];
    console.log(`  📍 Fallback nearby: +${nearbyFiltered.length} (total: ${allInstitutions.length})`);
  }

  // רוטציה אקראית
  for (let i = allInstitutions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allInstitutions[i], allInstitutions[j]] = [allInstitutions[j], allInstitutions[i]];
  }

  // dedup לפי מוסד — מקסימום דף אחד לכל מוסד
  // dedup לפי מוסד — מקסימום דף אחד, עדיפות לדף שמכיל specificKeyword בכותרת/תיאור
  const specificKw = (studyField?.specificKeyword || '').toLowerCase()
    .replace(/^תואר שני\s+ב?/, '').trim(); // הסר "תואר שני ב" לחיפוש ב-title

  const seenInstitutions = new Map(); // institution → best result
  for (const r of allInstitutions) {
    const institution = extractInstitutionName(r.title || r.h1 || '');
    const titleDesc = ((r.title || '') + ' ' + (r.description || '')).toLowerCase();
    const isSpecific = specificKw && titleDesc.includes(specificKw);

    if (!seenInstitutions.has(institution)) {
      seenInstitutions.set(institution, { result: r, isSpecific });
    } else {
      // החלף אם הדף הנוכחי יותר ספציפי
      const existing = seenInstitutions.get(institution);
      if (isSpecific && !existing.isSpecific) {
        seenInstitutions.set(institution, { result: r, isSpecific });
      }
    }
  }

  const dedupedInstitutions = [...seenInstitutions.values()]
    .map(v => v.result)
    .slice(0, 20);

  const specificInstitutions = dedupedInstitutions;

  if (specificInstitutions.length === 0 && exactResults.length === 0 && nationalResults.length === 0) return '';

  // כשאין מוסדות ספציפיים אחרי סינון — הצג הודעה ידידותית (חל על כל תחום ואזור)
  if (specificInstitutions.length === 0) {
    const subField = studyField?.specificKeyword || fieldName;
    const regionStr = region ? ` ב${regionName}` : '';
    const catLink = categoryUrl ? `\n\n🔍 [לכל הקורסים ב${fieldName}${regionStr}](${categoryUrl})` : '';
    return `מוזמן/ת למצוא קורס **${subField}** מתאים${regionStr} במגוון הקורסים באתר שבתון:${catLink}\n💬 יש שאלות? [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME) תשמח לעזור!\n📩 [הרשמו לעלון שבתון](https://www.shabaton.online/shabaton)`;
  }

  const isIntentBased = !!studyField?._intentLabel;
  const displayTitle = isIntentBased ? fieldName : fieldName;
  let response = ``;

  // כותרת מודגשת
  if (studyField?.maSpecialization && studyField?.specificKeyword) {
    // תואר שני עם התמחות — כותרת ספציפית
    const maTitle = studyField.specificKeyword.replace(/^תואר שני ב/, 'תואר שני ב');
    response += `**${maTitle} ניתן למצוא במוסדות הבאים - פנו ליועצי הלימודים:**\n\n`;
  } else if (region) {
    response += `**קורסים ב${displayTitle} ב${regionName}:**\n\n`;
  } else {
    response += `**קורסים ב${displayTitle}:**\n\n`;
  }

  for (const result of specificInstitutions) {
    let url = result.url || result.link;
    if (!url) continue;
    const title = result.title || 'ללא שם';
    // דף למידה מרחוק גנרי (לא דף מוסד ספציפי) — URL קבוע
    // מוסד ספציפי שמלמד מרחוק שומר על ה-URL המקורי שלו
    const isGenericOnlinePage = (title.includes('למידה מרחוק') || title.includes('לימוד מרחוק'))
      && !url.includes('shabaton.co.il/')   // דף מוסד אמיתי
      && !url.includes('shabaton.online/') // דף שבתון אמיתי (לא results-all)
      && (url.includes('results-all') || url === ONLINE_LEARNING_URL);
    if (isGenericOnlinePage) {
      url = 'https://www.shabaton.online/results-all/למידה מרחוק';
    }
    const summary = buildPageSummary(result);
    response += `📚 **${title}**\n`;
    if (summary) response += `${summary}\n`;
    response += `[פנו למידע ולייעוץ אישי](${url})\n\n`;
  }

  // ── דף קטגוריה ──
  const intentCategoryUrl = studyField?._intentCategoryUrl || null;
  const onlineSynonyms = [
    'מרחוק', 'למידה מרחוק', 'למידה מהבית',
    'זום', 'zoom', 'בזום', 'in zoom', 'by zoom',
    'אונליין', 'online',
    'מקוון', 'מתוקשב', 'מתוקשבים',
    'וירטואלי',
    'distance learning', 'e-learning',
    'א-סינכרוני', 'אסינכרוני', 'א-סינכרוניים', 'סינכרוני',
    'דיגיטלי'
  ];
  const isOnlineQuery = onlineSynonyms.some(s => (query || '').toLowerCase().includes(s));

  let categoryUrl;
  if (isOnlineQuery) {
    // למידה מרחוק — תמיד results-all עם שם התחום
    categoryUrl = `https://www.shabaton.online/results-all/${encodeURIComponent(studyField?.slug || fieldName)}`;
  } else {
    categoryUrl = intentCategoryUrl || (!isIntentBased ? findCategoryUrlFromResults() : null);
  }

  if (categoryUrl) {
    const noInstitutionsFound = specificInstitutions.length === 0;
    response += `\n🔍 **לכל הקורסים ב${fieldName}`;
    if (!isOnlineQuery && region) response += ` ב${regionName}`;
    if (noInstitutionsFound && !isOnlineQuery) response += ` ובלמידה מרחוק`;
    response += `:** [לכל הקורסים](${categoryUrl})\n`;
    // כשאין מוסדות — הוסף קישור ללמידה מרחוק בנפרד
    if (noInstitutionsFound && !isOnlineQuery && studyField?.slug) {
      const onlineUrl = `https://www.shabaton.online/results-all/${encodeURIComponent(studyField.slug)}`;
      response += `🌐 **למידה מרחוק ב${fieldName}:** [לכל הקורסים](${onlineUrl})\n`;
    }
  }

  // ── קישור "כל הקורסים בלמידה מרחוק" — בסוף, תמיד כשמבקשים מרחוק ──
  if (isOnlineQuery) {
    response += `\n🌐 **כל הקורסים בלמידה מרחוק:** [לכל הקורסים](https://www.shabaton.online/results-all)\n`;
  }

  return response;
}

// ================================================================
// INTENT-BASED FIELD DETECTION — שאלות מורכבות עם כוונה
// ================================================================

function detectIntentField(message) {
  if (!INTENT_MAPPINGS?.length || !STUDY_FIELDS?.length) return null;
  const lm = message.toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const mapping of INTENT_MAPPINGS) {
    let score = 0;
    for (const pattern of mapping.patterns) {
      if (lm.includes(pattern.toLowerCase())) score += pattern.length;
    }
    if (score > bestScore) { bestScore = score; bestMatch = mapping; }
  }

  if (!bestMatch || bestScore < 3) return null;

  // החזר את כל התחומים הרלוונטיים (לא רק הראשון)
  const matchedFields = bestMatch.fields
    .map(fieldName => STUDY_FIELDS.find(f => f.name === fieldName))
    .filter(Boolean);

  if (matchedFields.length === 0) return null;
  console.log(`✅ Intent: "${bestMatch.intent}" → fields: ${matchedFields.map(f => f.name).join(', ')} (score:${bestScore})`);
  // שמור את שם ה-intent על התחום הראשון לשימוש בכותרת
  matchedFields[0] = { ...matchedFields[0], _intentLabel: bestMatch.intent, _intentCategoryUrl: bestMatch.categoryUrl || null };
  return matchedFields;
}

function findInfoPageAnswer(message) {
  if (!SHABATON_INFO?.length) return null;
  const lm = message.toLowerCase();

  // ── רמה 1: הרחבה סמנטית של השאלה ──
  const expandedTerms = expandQuerySemantically(message);
  const allTerms = [lm, ...expandedTerms.map(t => t.toLowerCase())];

  // ── רמה 2: מילות מפתח נרדפות לתחומי מידע נפוצים ──
  const SYNONYMS = {
    'דמי לידה': ['לידה', 'יולדת', 'היריון', 'לאחר לידה', 'חופשת לידה'],
    'ביטוח לאומי': ['ביטל', 'בטל', 'ביטוח', 'קצבה', 'גמלה', 'אבטלה', 'מחלה', 'נכות'],
    'מענק חודשי': ['מענק', 'משכורת', 'כמה מקבלים', 'כמה משלמים', 'שכר', 'תשלום חודשי'],
    'החזר שכ"ל': ['שכר לימוד', 'שכ"ל', 'קבלות', 'החזר', 'קרן', 'להחזיר'],
    'תלוש': ['תלוש שכר', 'תלוש מענק', 'סליפ', 'פירוט תשלום'],
    'טופס 101': ['101', 'מס הכנסה', 'ניכוי מס', 'זיכוי מס'],
    'לוח זמנים': ['מתי', 'תאריך', 'דדליין', 'מועד', 'מתי צריך', 'עד מתי'],
    'בקשת שבתון': ['איך מבקשים', 'איך יוצאים', 'איך מגישים', 'הגשת בקשה'],
    'חצי שבתון': ['חצי', 'שנה', 'שנת שבתון מלאה', 'כמה זמן'],
    'מוסדות מאושרים': ['אילו מוסדות', 'מוסד מוכר', 'מוסד מאושר', 'איפה ללמוד'],
    'חובות לימודים': ['כמה שעות', 'שעות לימוד', 'חייב ללמוד', 'מינימום שעות'],
    'תוכנית לימודים': ['בונים תוכנית', 'בניית תוכנית', 'תכנית לימודים', 'תכנית שבתון', 'תוכנית שבתון', 'אישור תוכנית', 'לאשר תוכנית'],
    'לימודים בחו"ל': ['חו"ל', 'לימוד בחוץ לארץ', 'אוניברסיטה בחו"ל'],
  };

  // הרחב את allTerms עם נרדפות
  const expandedAll = new Set(allTerms);
  for (const term of allTerms) {
    for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
      if (synonyms.some(s => term.includes(s)) || term.includes(canonical.toLowerCase())) {
        expandedAll.add(canonical.toLowerCase());
        synonyms.forEach(s => expandedAll.add(s.toLowerCase()));
      }
    }
  }

  // ── התאמה לדפי מידע ──
  const matches = [];
  for (const page of SHABATON_INFO) {
    let score = 0;
    let matchedKeyword = null;
    for (const kw of page.keywords) {
      const kwl = kw.toLowerCase();
      for (const term of expandedAll) {
        if (term.includes(kwl) || kwl.includes(term) || term === kwl) {
          const kwScore = kwl.length; // מפתח ארוך = ניקוד גבוה יותר
          if (kwScore > score) { score = kwScore; matchedKeyword = kw; }
        }
      }
    }
    if (score > 2) { // סף מינימלי — מונע התאמות שגויות
      matches.push({ page, score, matchedKeyword });
    }
  }

  if (matches.length === 0) return null;

  // מיין לפי ניקוד
  matches.sort((a, b) => b.score - a.score);
  console.log(`✅ Info pages found: ${matches.map(m => `${m.page.id}(${m.score})`).join(', ')}`);

  // החזר עד 2 דפים הכי רלוונטיים
  const topMatches = matches.slice(0, 2);

  if (topMatches.length === 1) {
    const { page } = topMatches[0];
    return `📋 **${page.title}**\n[למידע מלא באתר שבתון](${page.url})\n`;
  }

  let response = `מצאתי מידע רלוונטי:\n\n`;
  for (const { page } of topMatches) {
    response += `📋 **${page.title}**\n[לפרטים](${page.url})\n\n`;
  }
  return response;
}

// ================================================================
// MAIN RESPONSE GENERATOR
// ================================================================


// ================================================================
// חיפוש קורסים לפי ש"ש (שעות שבועיות)
// ================================================================

function findByShaashot(message) {
  const msg = message.toLowerCase().trim();

  // זיהוי שאילתות ש"ש
  const shaashPatterns = [
    /([0-9]+(?:[.,][05])?)\s*ש["']ש/,
    /ש["']ש\s+([0-9]+(?:[.,][05])?)/,
    /([0-9]+(?:[.,][05])?)\s*שעות\s*שבועיות/,
  ];

  const generalShaash = /כמה\s*ש["']ש|ש["']ש.*קורס|קורס.*ש["']ש|רשימת.*ש["']ש|היקף.*ש["']ש|שעות.*שבועיות/i;

  let requestedHours = null;
  for (const pat of shaashPatterns) {
    const m = msg.match(pat);
    if (m && m[1]) {
      requestedHours = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(requestedHours)) break;
    }
  }

  const isGeneralShaash = generalShaash.test(message);
  if (!requestedHours && !isGeneralShaash) return null;

  console.log(`🕐 ש"ש query | requested: ${requestedHours ?? 'general'}`);

  const region = detectRegion(message);
  const fields = detectStudyField(message);
  const studyField = fields.length > 0 ? fields[0] : null;

  const pages = loadAllPages();
  const results = [];

  for (const page of pages) {
    const url = (page.url || page.link || '');
    const urlLower = url.toLowerCase();
    const title = (page.title || page.h1 || '');
    const desc = (page.description || '');
    const text = (page.text || '');
    const combined = (title + ' ' + desc + ' ' + text);

    // ── רק דפי מוסדות אמיתיים מ-shabaton.online ──
    // URL חייב להכיל slug של מוסד — לא דפי קטגוריה/ניווט/מידע כללי
    if (!urlLower.includes('shabaton.online/')) continue;

    // חסימת דפי קטגוריה ותוכן כללי
    const blockedPaths = [
      '/important', '/luz_', '/forms_', '/Payments_', '/shabaton-video',
      '/learning_programs', '/halforfull', '/phones_', '/master-degree',
      '/results-', '/search-courses', '/knassim', '/bekarov',
      '/tel-aviv', '/heifa', '/sharon', '/darom', '/jerusalm',
      '/shabaton_checklist', '/shabaton-maanak', '/btl_shabaton',
      '/back_from_shabaton', '/end_shabaton', '/change_prog',
      '/tlush_maanak', '/shabaton-kabalot', '/shabaton_request',
      '/toar_shlishi', '/shabaton-plan', '/shabaton-hova',
      '/luz_shabaton', '/shabaton_schedule',
    ];
    if (blockedPaths.some(p => urlLower.includes(p))) continue;

    // חסימת דפי results-all (קטגוריות כלליות)
    if (urlLower.includes('/results-all')) continue;

    // חייב שם מוסד בכותרת (לא "ינואר 2026", לא "close carousel")
    const junkTitle = /^(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+20\d\d$/i;
    const navigationTitle = /^(close carousel|carousel|next|prev|menu|navigation|שבתון - קורסים)$/i;
    if (junkTitle.test(title.trim()) || navigationTitle.test(title.trim())) continue;

    // חייב תיאור אמיתי (לא ריק)
    if (!desc || desc.length < 30) continue;

    // חיפוש ש"ש בתוכן
    let shaashFound = false;
    if (requestedHours) {
      // חיפוש מספר ספציפי
      const hStr = String(requestedHours);
      const patterns = [
        hStr + ' ש"ש', hStr + 'ש"ש',
        hStr + " ש'ש", hStr + " ש''ש",
        hStr + ' שעות שבועיות',
      ];
      shaashFound = patterns.some(p => combined.includes(p));
    } else {
      // חיפוש כללי — דף שמזכיר ש"ש בכלל
      shaashFound = combined.includes('ש"ש') || combined.includes("ש'ש") || combined.includes('שעות שבועיות');
    }
    if (!shaashFound) continue;

    // סינון אזור
    if (region) {
      const urlRegion = detectRegionFromUrl(urlLower, region);
      const hasRegionCity = (region.cities || []).some(c => c.length > 3 && combined.toLowerCase().includes(c.toLowerCase()));
      if (urlRegion.match === 'other' && !hasRegionCity) continue;
    }

    // סינון תחום
    if (studyField) {
      const fieldMatch = pageMatchesField(page, studyField, true);
      if (!fieldMatch.found) continue;
    }

    results.push({ title, url, desc, text });
    if (results.length >= 15) break;
  }

  console.log(`🕐 ש"ש results: ${results.length}`);

  // רוטציה אקראית — סדר שונה בכל שאילתה
  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [results[i], results[j]] = [results[j], results[i]];
  }

  if (results.length === 0) {
    const hoursStr = requestedHours ? `${requestedHours} ש"ש` : 'ש"ש';
    const suffix = studyField ? ` ב${studyField.name}` : '';
    const regionStr = region ? ` ב${region.name}` : '';
    return `לא נמצאו קורסים של ${hoursStr}${suffix}${regionStr} באינדקס כרגע.

📎 [חיפוש קורסים באתר שבתון](https://www.shabaton.co.il/items_list.asp)
💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)`;
  }

  const hoursTitle = requestedHours ? `${requestedHours} ש"ש` : 'ש"ש';
  const fieldTitle = studyField ? ` ב${studyField.name}` : '';
  const regionTitle = region ? ` ב${region.name}` : '';
  let response = `**קורסים של ${hoursTitle}${fieldTitle}${regionTitle}:**

`;

  const seen = new Set();
  let shown = 0;
  for (const r of results) {
    const inst = extractInstitutionName(r.title);
    if (seen.has(inst)) continue;
    seen.add(inst);
    response += `📚 **${r.title}**
`;
    if (r.desc) response += `${r.desc.substring(0, 130)}
`;
    response += `[פנו למידע ולייעוץ אישי](${r.url})

`;
    if (++shown >= 15) break;
  }

  response += `
🔍 [לכל הקורסים באתר שבתון](https://www.shabaton.co.il/items_list.asp)`;
  response += `
📩 [הרשמו לעלון שבתון](https://www.shabaton.online/shabaton)`;
  response += `
💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)`;
  return response;
}

async function generateSmartResponse(message) {
  console.log('\n========================================');
  console.log('🚀 VERSION: MAR_02_v249_MUSIC_URL');
  console.log(`📝 "${message}"`);
  console.log('========================================');
  loadConfigs();

  // QA קודם
  const qa = findQAAnswer(message);
  if (qa) { console.log('✅ QA answer'); return qa.answer; }

  // ── חיפוש לפי ש"ש ──
  const shaashAnswer = findByShaashot(message);
  if (shaashAnswer) { console.log('✅ ש"ש answer'); return shaashAnswer; }

  // ── "קורס רשות/חובה" ── 
  const hasReshutOrHova = /קורס רשות|קורסי רשות|קורס חובה|קורסי חובה/.test(message);
  if (hasReshutOrHova) {
    const detectedFieldsEarly = detectStudyField(message);
    const hasSubject = detectedFieldsEarly.length > 0;
    if (!hasSubject) {
      // בדוק אם זו שאלת מידע ("מה זה", "מה הם", "הסבר") — הפנה לדף מידע
      const isInfoQuestion = /מה זה|מה הם|מה ה|הסבר|הגדר|מה ההבדל|מה המשמעות|מה כולל|כמה/.test(message);
      if (isInfoQuestion) {
        console.log('📋 רשות/חובה info question → info page');
        return `קורסי **רשות** וקורסי **חובה** הם מושגים מתוכנית הלימודים של שנת שבתון.\n\n📋 [לדף מידע על תוכניות הלימודים](https://www.shabaton.online/shabaton-program)\n\n💬 לשאלות נוספות: [קבוצת ווטסאפ שבתון](https://chat.whatsapp.com/GlI6mVGJFql9lBZEFGnRy6)`;
      }
      // בקשת חיפוש ללא תחום — שאל באיזה תחום
      console.log('📋 רשות/חובה search without subject → ask for field');
      return `באיזה תחום לימודים אתה מחפש קורס? 😊\n\nלדוגמה: ציור, מיינדפולנס, הדרכת הורים, NLP, טכנולוגיה דיגיטלית...`;
    }
    // יש תחום — המשך חיפוש רגיל (מילות רשות/חובה מתעלמות)
    console.log('🔍 רשות/חובה with subject → search for subject');
  }

  // ── דפי מידע על שנת שבתון ── רק אם זו שאלת מידע, לא חיפוש קורסים
  const isInfoQuestion = /^(איך|כיצד|מה|האם|מתי|כמה|מי|למה|מדוע|מה זה|הסבר|ספר)/.test(message.trim());
  const isCourseQuery = !isInfoQuestion && /קורס|לימוד|השתלמות|תואר|מכללה|לימודים/.test(message);
  if (!isCourseQuery) {
    const infoAnswer = findInfoPageAnswer(message);
    if (infoAnswer) { console.log('✅ Info page answer'); return infoAnswer; }
  }

  // ── זיהוי תשובה לשאלת הבהרה מסבב קודם ──
  // אם הגולש ענה "1" / "2" / "כתיבה יוצרת" / "הוראה מתקנת"
  const DISAMBIGUATION_ANSWERS = [
    // תשובות ל"קורסי כתיבה" — כתיבה יוצרת
    { patterns: ['^1$', '^1\\.', '^אפשרות 1$', '^כתיבה יוצרת$', '^יוצרת$', '^סיפורי חיים$', '^סיפורים$'],
      field: 'כתיבה יוצרת', strictFilter: null },
    // תשובות ל"קורסי כתיבה" — הוראה מתקנת
    { patterns: ['^2$', '^2\\.', '^אפשרות 2$', '^הוראה מתקנת$', '^הוראה מותאמת$', '^מתקנת$'],
      field: 'הוראה מתקנת', strictFilter: 'הוראה מתקנת|הוראה מותאמת' },
  ];

  const lmCheck = message.trim().toLowerCase();
  const isShortReply = lmCheck.split(/\s+/).length <= 4;
  if (isShortReply) {
    for (const ans of DISAMBIGUATION_ANSWERS) {
      if (ans.patterns.some(p => new RegExp(p, 'i').test(lmCheck))) {
        if (ans.strictFilter) {
          console.log(`✅ Disambiguation answer → field:"${ans.field}"`);
          const sf = STUDY_FIELDS?.find(f => f.name === ans.field) || { name: ans.field, specificKeyword: ans.field };
          sf._strictFilter = ans.strictFilter;
          const results2 = await searchPages(message, null, sf);
          const filtered = results2.filter(r => {
            const content = ((r.description || '') + ' ' + (r.text || '')).toLowerCase();
            if (ans.strictFilter === 'הוראה מתקנת|הוראה מותאמת') {
              if (!/הוראה מתקנת|הוראה מותאמת/.test(content)) return false;
              const matches = [...content.matchAll(/הוראה מ[תו][קכ][נת]ת/g)];
              return matches.some(m => {
                const snippet = content.substring(Math.max(0, m.index - 60), m.index + 80);
                return snippet.includes('כתיבה');
              });
            }
            return new RegExp(ans.strictFilter, 'i').test(content);
          });
          if (filtered.length > 0) return formatResults(filtered, sf, null, message);
        }
        break;
      }
    }
  }

  const detectedFields = detectStudyField(message);
  const intentFields = !detectedFields[0] ? detectIntentField(message) : null;
  const studyField = detectedFields[0] || (Array.isArray(intentFields) ? intentFields[0] : intentFields) || null;
  const extraIntentFields = Array.isArray(intentFields) && intentFields.length > 1 ? intentFields.slice(1) : [];
  const region = detectRegion(message);

  console.log(`📊 Field: ${studyField ? `"${studyField.name}" kw:"${studyField.specificKeyword}"` : 'none'} | Region: ${region?.name || 'none'}`);

  const intent = classifyIntent(message);
  console.log(`🎯 Intent: ${intent.intent}`);

  // ── QA: תשובה ממאגר ──
  if (intent.intent === 'qa') {
    return intent.data.answer;
  }

  // ── QA Fallback: סריקת דף שבתון חיה ──
  if (intent.intent === 'qa_fallback') {
    const fallback = await findShabatonPageFallback(message);
    if (fallback) return fallback.answer;
    // אם גם fallback נכשל — הפנה ל-important
    return `למידע על שאלה זו:\n\n📎 [חשוב בשבתון - כל המידע](https://www.shabaton.online/important)\n\n💬 [קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)`;
  }

  // ── אם יש תחום אבל אין אזור — חפש בכל הארץ (אין זיכרון בין הודעות) ──
  // לא שואלים על אזור כי הבוט שוכח את התחום בהודעה הבאה

  if (intent.intent === 'search') {
    const lm = message.toLowerCase();
    const isOnlineLearning = lm.includes('למידה מרחוק') || lm.includes('קורסים מרחוק') || lm.includes('אונליין') || lm.includes('מתוקשב');

    // ── Disambiguation: מונחים עם אי-וודאות ──
    const AMBIGUOUS_TERMS = {
      'כתיבה': {
        detect: (msg) => /כתיב/.test(msg) && !/כתיבה יוצרת|כתיבת סיפור|סיפורי חיים|הוראה מתקנת|הוראה מותאמת/.test(msg),
        question: 'למה התכוונת בקורסי כתיבה?',
        options: [
          { label: '✍️ כתיבה יוצרת / סיפורי חיים', keyword: 'כתיבה יוצרת' },
          { label: '📖 הוראת כתיבה מתקנת / מותאמת', keyword: 'הוראה מתקנת כתיבה', strictFilter: 'הוראה מתקנת|הוראה מותאמת' }
        ]
      }
    };

    // בדוק אם השאלה עמומה
    for (const [term, config] of Object.entries(AMBIGUOUS_TERMS)) {
      if (config.detect(lm)) {
        console.log(`❓ Ambiguous term detected: "${term}"`);
        let clarifyMsg = `${config.question}\n\n`;
        config.options.forEach((opt, i) => {
          clarifyMsg += `${i + 1}. ${opt.label}\n`;
        });
        clarifyMsg += `\nאנא בחר/י מספר או כתב/י את סוג הקורס שמעניין אותך.`;
        return clarifyMsg;
      }
    }

    // בקשה ישירה ללמידה מרחוק ללא תחום ספציפי
    if (isOnlineLearning && !studyField) {
      return `🔍 **כל הקורסים בלמידה מרחוק:**\n[לכל הקורסים בלמידה מרחוק](https://www.shabaton.online/results-all/למידה מרחוק)\n`;
    }

    const isIntentSearch = !!studyField?._intentLabel;
    // אפשר text search כשיש תחום (intent או ישיר) — הביטוי ארוך מספיק למניעת שגיאות
    const useTextSearch = !!(studyField?.name && studyField.name.length > 5);
    const results = await searchPages(message, region, studyField, useTextSearch);

    // אם יש תחומי intent נוספים — חפש לפי שם התחום
    let allResults = [...results];
    console.log(`🔎 Extra intent fields: ${extraIntentFields.length} → [${extraIntentFields.map(f=>f.name).join(', ')}]`);
    for (const extraField of extraIntentFields) {
      const extraResults = await searchPages(extraField.name, region, extraField, true);
      console.log(`🔎 Extra field "${extraField.name}": ${extraResults.length} results`);
      const existingUrls = new Set(allResults.map(r => r.url || r.link || r.pageUrl));
      extraResults.forEach(r => {
        if (!existingUrls.has(r.url || r.link || r.pageUrl)) allResults.push(r);
      });
    }
    const mergedResults = allResults;
    console.log(`📊 ${results.length} primary + ${allResults.length - results.length} extra = ${allResults.length} total`);

    if (mergedResults.length > 0) {
      // תמיד העבר את studyField כמו שהוא — שם התחום האמיתי יוצג
      return formatResults(mergedResults, studyField, region, message);
    }

    // ── Fallback: אין תוצאות ──
    const fieldName = studyField?.name || '';
    const regionName = region?.name || '';
    let response = `מצטערת, לא מצאתי מוסדות`;
    if (regionName) response += ` ב${regionName}`;
    if (fieldName) response += ` ל${fieldName}`;
    response += `.\n\n`;

    // קישור לדף קטגוריה — עם תמיכה ב-FIXED_CATEGORY_URLS
    const fixedUrls = {
      'תואר שני': 'https://www.shabaton.online/results-all/לימודי תואר שני',
      'אמנות ואומנויות': 'https://www.shabaton.online/results-all/קורסי אמנות ואומנויות',
      'אופק חדש': 'https://www.shabaton.online/results-all/קורסי אופק חדש - עוז לתמורה',
    };
    const fixedKey = Object.keys(fixedUrls).find(k => fieldName.includes(k));
    const categoryUrl = fixedKey ? fixedUrls[fixedKey] : buildCategoryUrl(region, studyField);
    if (categoryUrl) {
      response += `🔍 **חפש עוד אפשרויות ב${fieldName}`;
      if (regionName) response += ` ב${regionName}`;
      response += `:** [לכל הקורסים](${categoryUrl})\n\n`;
    }

    // למידה מרחוק כאלטרנטיבה
    const onlineField = STUDY_FIELDS?.find(f => f.name === 'למידה מרחוק');
    if (onlineField?.slug && region && fieldName) {
      response += `🌐 **אפשר גם לחפש קורסי ${fieldName} בלמידה מרחוק:**\n`;
      response += `[קורסי ${fieldName} אונליין](${SITE_BASE}/${onlineField.slug})\n\n`;
    }

    response += `💬 **לא מצאת מה שחיפשת?**\n`;
    response += `שאל בקבוצת הווטסאפ של שבתון:\n`;
    response += `[קבוצת ווטסאפ שבתון](${WHATSAPP_LINK})`;

    return response;
  }

  // General
  return `היי! 👋\n\nאני כאן לעזור לך למצוא קורסים והשתלמויות למורים בשבתון.\n\n**לדוגמה:**\n• "קורס הנחיית קבוצות במרכז"\n• "קורס צילום בצפון"\n• "כמה עולה קורס?"\n\n💬 [קבוצת ווטסאפ שבתון](${WHATSAPP_LINK})\n\n---\n_הצ'אט מבוסס AI ומספק מידע כללי בלבד. אין לראות בתשובות תחליף לייעוץ מקצועי._`;
}

// ================================================================
// ================================================================
// ZAPIER WEBHOOK — צבירת שאלות ב-Google Sheets
// ================================================================

// 🔧 הגדר כאן את ה-URL מ-Zapier (Webhooks by Zapier → Catch Hook)
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';

/**
 * שולח את השאלה והתשובה ל-Zapier — ב-background, לא חוסם את התשובה לגולש
 * נרשם ב-Google Sheets: תאריך, שאלה, תשובה, האם נמצאה תשובה ✅/❌
 */
async function logToZapier(message, response, answered) {
  console.log('🔔 logToZapier called | URL:', ZAPIER_WEBHOOK_URL ? 'SET ✅' : 'MISSING ❌');
  if (!ZAPIER_WEBHOOK_URL) {
    console.warn('⚠️ ZAPIER_WEBHOOK_URL is empty — skipping');
    return;
  }
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const timeStr = now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });

    // רץ על שרת Vercel — אין CORS, שולח JSON מלא
    const payload = JSON.stringify({
      date: dateStr,
      time: timeStr,
      question: message,
      answer: response, // תשובה מלאה
      answered: answered ? 'כן' : 'לא',
      answer_length: String(response.length)
    });
    console.log('📤 Sending to Zapier:', ZAPIER_WEBHOOK_URL.substring(0,50) + '...');
    console.log('📦 Payload:', payload.substring(0, 200));
    fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    })
    .then(r => console.log('✅ Zapier response:', r.status))
    .catch(err => console.warn('⚠️ Zapier log failed:', err.message));
  } catch (e) {
    console.warn('⚠️ Zapier log error:', e.message);
  }
}

// ================================================================
// VERCEL HANDLER
// ================================================================

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — מחזיר מידע כללי כולל disclaimer
  if (req.method === 'GET') {
    return res.status(200).json({
      disclaimer: 'הצ\'אט מבוסס AI ומספק מידע כללי בלבד. אין לראות בתשובות תחליף לייעוץ מקצועי.',
      version: 'MAR_02_v249_MUSIC_URL'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Invalid message' });
  if (message.length > 500) return res.status(400).json({ error: 'Message too long' });

  console.log(`📨 POST | "${message}"`);

  try {
    const start = Date.now();
    const response = await generateSmartResponse(message);
    const ms = Date.now() - start;
    console.log(`✅ ${response.length} chars | ${ms}ms`);

    // שליחה ל-Zapier — background, לא מעכב את התשובה לגולש
    console.log('🔔 About to call logToZapier...');
    const isFallback = response.includes('חשוב בשבתון') && response.length < 300;
    logToZapier(message, response, !isFallback);
    console.log('🔔 logToZapier called (async, not awaited)');

    return res.status(200).json({ reply: response, processingTime: ms, version: 'MAR_02_v249_MUSIC_URL' });
  } catch (e) {
    console.error('❌ ERROR:', e);
    return res.status(500).json({ error: 'Internal server error', message: e.message, version: 'MAR_02_v249_MUSIC_URL' });
  }
}
