// ================================================================
// chat.js v111
// VERSION: FEB_18_v111_URL_REGION_TEXT_ANALYSIS
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
let PAYMENTS_QA = null;
let SEMANTIC_DATA = null;
let WORD_GRAPH = null;

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
      console.log(`✅ courses-qa.json: ${COURSES_QA.questions?.length || 0} questions`);
    }
    if (!PAYMENTS_QA) {
      PAYMENTS_QA = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'payments-qa.json'), 'utf8'));
      console.log(`✅ payments-qa.json`);
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
function findFieldInPage(page, searchTerm) {
  const sl = searchTerm.toLowerCase();
  const title = (page.title || page.h1 || '').toLowerCase();
  const description = (page.description || '').toLowerCase();
  const text = (page.text || '').toLowerCase();
  const h2 = ((page.h2 || []).join(' ')).toLowerCase();
  const h3 = ((page.h3 || []).join(' ')).toLowerCase();

  if (title.includes(sl)) return { found: true, location: 'title', score: 150 };
  if (description.includes(sl)) return { found: true, location: 'description', score: 80 };
  if (h2.includes(sl) || h3.includes(sl)) return { found: true, location: 'headers', score: 60 };
  if (text.includes(sl)) return { found: true, location: 'text', score: 50 };

  return { found: false, location: null, score: 0 };
}

/**
 * בדוק אם הדף רלוונטי לתחום המבוקש
 */
function pageMatchesField(page, studyField) {
  if (!studyField) return { found: true, score: 0 }; // אין סינון תחום

  // אם יש specificKeyword - חפש אותו
  if (studyField.specificKeyword) {
    const result = findFieldInPage(page, studyField.specificKeyword);
    if (result.found) {
      console.log(`    [FIELD] "${studyField.specificKeyword}" found in ${result.location} (+${result.score})`);
      return result;
    }
  }

  // חפש שם תחום
  const nameResult = findFieldInPage(page, studyField.name);
  if (nameResult.found) {
    console.log(`    [FIELD] "${studyField.name}" found in ${nameResult.location} (+${nameResult.score})`);
    return nameResult;
  }

  return { found: false, location: null, score: 0 };
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
        // v108: חיפוש מילה מקורית מהמסר
        const words = lm.split(/\s+/);
        for (const et of expanded) {
          if (et.toLowerCase() === fl || et === message) continue;
          for (const w of words) {
            const cw = w.replace(/[,\.!\?;:]/g, '');
            if (cw.length > 2 && (cw.includes(et.toLowerCase()) || et.toLowerCase().includes(cw))) {
              specificKeyword = cw;
              console.log(`  🎯 Semantic keyword preserved: "${specificKeyword}"`);
              break;
            }
          }
          if (specificKeyword) break;
        }
        // fallback לkeywords
        if (!specificKeyword) {
          for (const kw of (field.keywords || [])) {
            for (const w of lm.split(/\s+/)) {
              const cw = w.replace(/[,\.!\?;:]/g, '');
              if (cw.length > 2 && (cw.includes(kw.toLowerCase()) || kw.toLowerCase().includes(cw))) {
                specificKeyword = cw;
                console.log(`  🎯 Keyword fallback: "${specificKeyword}"`);
                break;
              }
            }
            if (specificKeyword) break;
          }
        }
      } else {
        // v110: גם direct match מקבל specificKeyword = שם התחום
        specificKeyword = fl;
        console.log(`  🎯 Direct match → specificKeyword: "${specificKeyword}"`);
      }

      return [{ ...field, specificKeyword }];
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
    // מצא את המילה המקורית מהמסר
    let fullWord = best.keyword;
    for (const w of lm.split(/\s+/)) {
      const cw = w.replace(/[,\.!\?;:]/g, '');
      if (cw.length > 2 && cw.includes(best.keyword.toLowerCase())) { fullWord = cw; break; }
    }
    return [{ ...best.field, specificKeyword: fullWord }];
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

async function searchPages(query, region = null, studyField = null) {
  console.log('\n========== [searchPages] START ==========');
  console.log(`🚀 VERSION: FEB_18_v111_URL_REGION_TEXT_ANALYSIS`);
  console.log(`Query: "${query}" | Region: ${region?.name || 'any'} | Field: ${studyField?.name || 'any'} | Keyword: "${studyField?.specificKeyword || 'none'}"`);
  console.log('==========================================');

  const pages = loadAllPages();
  const results = [];
  const specificCity = detectSpecificCity(query, region);

  for (const page of pages) {
    const url = page.url || page.link || '';
    const rawTitle = page.title || page.h1 || '';

    // ── בסיסי: חייב URL ──
    if (!url || url.length < 10) continue;

    // ── ניקוי כותרת ──
    const junkPatterns = ['close carousel', 'carousel', 'next', 'prev', 'previous', 'menu', 'navigation',
      'ינואר 2', 'פברואר 2', 'מרץ 2', 'אפריל 2', 'מאי 2', 'יוני 2',
      'יולי 2', 'אוגוסט 2', 'ספטמבר 2', 'אוקטובר 2', 'נובמבר 2', 'דצמבר 2'];
    let cleanTitle = rawTitle;
    for (const j of junkPatterns) cleanTitle = cleanTitle.replace(new RegExp(j, 'gi'), '').trim();
    if (cleanTitle.length < 3) { console.log(`  ❌ JUNK: "${rawTitle}"`); continue; }
    if (cleanTitle.length < 10 && !page.description && !page.text) continue;

    console.log(`  📄 "${cleanTitle}" | ${url}`);

    // ── שלב 1: בדיקת תחום לימוד בתוכן הדף ──
    if (studyField) {
      const fieldMatch = pageMatchesField(page, studyField);
      if (!fieldMatch.found) {
        console.log(`    [FIELD] ❌ Not found`);
        continue;
      }

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
            // בדוק אם מוזכרת עיר מאזור אחר (ייתכן שהדף שייך לאזור אחר)
            for (const otherR of (REGIONS || [])) {
              if (otherR.name === region.name) continue;
              for (const city of (otherR.cities || [])) {
                const cl = city.toLowerCase().replace(/-/g, ' ');
                if (cl.length > 3 && combined.includes(cl)) {
                  // בדוק שלא מופיעה גם עיר מהאזור המבוקש
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
        console.log(`    ✅ ADDED (no region filter) | score:${fieldMatch.score}`);
        results.push({
          ...page,
          title: cleanTitle,
          score: fieldMatch.score,
          regionMatch: 'none',
          fieldLocation: fieldMatch.location
        });
      }
    }
  }

  // מיון: קודם exact region, אחר כך לפי score
  results.sort((a, b) => {
    const regionOrder = { exact: 0, none: 1, other: 2 };
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

function findQAAnswer(message) {
  loadConfigs();
  const lm = message.toLowerCase();
  if (COURSES_QA?.questions) {
    for (const q of COURSES_QA.questions) {
      if (q.question && lm.includes(q.question.toLowerCase())) return { answer: q.answer };
      for (const v of (q.variations || [])) if (lm.includes(v.toLowerCase())) return { answer: q.answer };
      if (q.keywords) {
        const hits = q.keywords.filter(k => lm.includes(k.toLowerCase()));
        if (hits.length >= 2) return { answer: q.answer };
      }
    }
  }
  if (PAYMENTS_QA?.categories) {
    for (const cat of PAYMENTS_QA.categories) {
      for (const q of (cat.questions || [])) {
        if (q.question && lm.includes(q.question.toLowerCase())) return { answer: q.answer };
        for (const v of (q.variations || [])) if (lm.includes(v.toLowerCase())) return { answer: q.answer };
      }
    }
  }
  return null;
}

function classifyIntent(message) {
  const lm = message.toLowerCase();
  const qaKw = ['כמה', 'מתי', 'איך', 'מה זה', 'האם', 'מי', 'למה', 'איפה', 'מה'];
  if (qaKw.some(k => lm.includes(k))) {
    const qa = findQAAnswer(message);
    if (qa) return { intent: 'qa', data: qa };
  }
  const searchKw = ['קורס', 'לימוד', 'השתלמות', 'תואר', 'מכללה', 'לימודים'];
  if (searchKw.some(k => lm.includes(k))) return { intent: 'search' };
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

/**
 * בנה תיאור קצר לדף על פי ניתוח ה-text field
 */
function buildPageSummary(page, studyField) {
  const desc = page.description || '';
  const text = page.text || '';
  const keyword = studyField?.specificKeyword || studyField?.name || '';

  // אם יש description קצר וספציפי - השתמש בו
  if (desc && desc.length > 10 && desc.length < 200) return desc;

  // נסה לחלץ משפט רלוונטי מה-text
  if (text && keyword) {
    const kl = keyword.toLowerCase();
    const sentences = text.split(/[.!?\n]+/);
    for (const s of sentences) {
      const sl = s.toLowerCase().trim();
      if (sl.includes(kl) && sl.length > 20 && sl.length < 200) {
        return s.trim();
      }
    }
  }

  // fallback
  if (desc) return desc.substring(0, 150) + (desc.length > 150 ? '...' : '');
  return '';
}

function formatResults(results, studyField, region) {
  const fieldName = studyField?.name || 'הקורסים';
  const regionName = region?.name || 'כל הארץ';

  // מקסימום 3 exact region + 3 national
  const exactResults = results.filter(r => r.regionMatch === 'exact').slice(0, 4);
  const nationalResults = results.filter(r => r.regionMatch === 'none').slice(0, 3);
  const toShow = [...exactResults, ...nationalResults].slice(0, 6);

  if (toShow.length === 0) return '';

  let response = `מצאתי ${toShow.length} אפשרויות ל${fieldName}`;
  if (region) response += ` ב${regionName}`;
  response += `:\n\n`;

  for (const result of toShow) {
    const url = result.url || result.link;
    if (!url) continue;

    const title = result.title || 'ללא שם';
    const summary = buildPageSummary(result, studyField);
    const isExact = result.regionMatch === 'exact';
    const icon = isExact ? '📍' : '🌐';
    const regionLabel = isExact ? '' : ' (כלל-ארצי / ללא הגבלה)';

    response += `${icon} **${title}**${regionLabel}\n`;
    if (summary) response += `${summary}\n`;
    response += `[למידע מלא ורישום](${url})\n\n`;
  }

  // ── תמיד: קישור לדף קטגוריה ──
  const categoryUrl = buildCategoryUrl(region, studyField);
  if (categoryUrl) {
    response += `---\n`;
    response += `🔍 **לכל הקורסים ב${fieldName}`;
    if (region) response += ` ב${regionName}`;
    response += `:** [לדף הקטגוריה](${categoryUrl})\n`;
  }

  return response;
}

// ================================================================
// MAIN RESPONSE GENERATOR
// ================================================================

async function generateSmartResponse(message) {
  console.log('\n========================================');
  console.log('🚀 VERSION: FEB_18_v111_URL_REGION_TEXT_ANALYSIS');
  console.log(`📝 "${message}"`);
  console.log('========================================');
  loadConfigs();

  // QA קודם
  const qa = findQAAnswer(message);
  if (qa) { console.log('✅ QA answer'); return qa.answer; }

  const detectedFields = detectStudyField(message);
  const studyField = detectedFields[0] || null;
  const region = detectRegion(message);

  console.log(`📊 Field: ${studyField ? `"${studyField.name}" kw:"${studyField.specificKeyword}"` : 'none'} | Region: ${region?.name || 'none'}`);

  const intent = classifyIntent(message);
  console.log(`🎯 Intent: ${intent.intent}`);

  if (intent.intent === 'search') {
    const results = await searchPages(message, region, studyField);
    console.log(`📊 ${results.length} results`);

    if (results.length > 0) {
      return formatResults(results, studyField, region);
    }

    // ── Fallback: אין תוצאות ──
    const fieldName = studyField?.name || '';
    const regionName = region?.name || '';
    let response = `מצטערת, לא מצאתי מוסדות`;
    if (regionName) response += ` ב${regionName}`;
    if (fieldName) response += ` ל${fieldName}`;
    response += `.\n\n`;

    // קישור לדף קטגוריה של האזור - תמיד
    const categoryUrl = buildCategoryUrl(region, studyField);
    if (categoryUrl) {
      response += `🔍 **חפש עוד אפשרויות ב${fieldName}`;
      if (regionName) response += ` ב${regionName}`;
      response += `:**\n[לדף הקטגוריה](${categoryUrl})\n\n`;
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
  return `היי! 👋\n\nאני כאן לעזור לך למצוא קורסים והשתלמויות למורים בשבתון.\n\n**לדוגמה:**\n• "קורס הנחיית קבוצות במרכז"\n• "קורס צילום בצפון"\n• "כמה עולה קורס?"\n\n💬 [קבוצת ווטסאפ שבתון](${WHATSAPP_LINK})`;
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
    return res.status(200).json({ reply: response, processingTime: ms, version: 'FEB_18_v111_URL_REGION_TEXT_ANALYSIS' });
  } catch (e) {
    console.error('❌ ERROR:', e);
    return res.status(500).json({ error: 'Internal server error', message: e.message, version: 'FEB_18_v111_URL_REGION_TEXT_ANALYSIS' });
  }
}
