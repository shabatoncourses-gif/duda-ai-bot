// ================================================================
// 🎯 chat.js v110 - COMPLETE VERSION
// ================================================================
// VERSION: FEB_18_v110_FIX_DIRECT_MATCH_KEYWORD_AND_CATEGORY_FALLBACK
// Created: 2026-02-18
//
// תיקונים בגרסה זו:
// v107: בדיקת אזור על תוכן מנוקה
// v108: שמירת specificKeyword כשתחום נמצא סמנטית
// v109: תיקון URLs מקבצי data בלבד + fallback לווטסאפ
// v110: תיקון קריטי - כשתחום נמצא בהתאמה ישירה לשם, 
//       specificKeyword מקבל את שם התחום כדי שבדיקת האזור תהיה מקלה.
//       כשאין תוצאות באזור - מציג את דף קטגוריה האזור כפתרון.
// ================================================================

import fs from 'fs';
import path from 'path';

// ================================================================
// 📦 GLOBAL DATA STORES
// ================================================================
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
// 🔄 DATA LOADING
// ================================================================

function loadConfigs() {
  try {
    if (!REGIONS) {
      const regionsPath = path.join(process.cwd(), 'data', 'regions.json');
      REGIONS = JSON.parse(fs.readFileSync(regionsPath, 'utf8')).regions;
      console.log(`✅ נטען regions.json: ${REGIONS.length} אזורים`);
    }
    if (!STUDY_FIELDS) {
      const fieldsPath = path.join(process.cwd(), 'data', 'study-fields.json');
      STUDY_FIELDS = JSON.parse(fs.readFileSync(fieldsPath, 'utf8')).studyFields;
      console.log(`✅ נטען study-fields.json: ${STUDY_FIELDS.length} תחומים`);
    }
    if (!REQUIRED_PHRASES) {
      const phrasesPath = path.join(process.cwd(), 'data', 'required-phrases.json');
      REQUIRED_PHRASES = JSON.parse(fs.readFileSync(phrasesPath, 'utf8')).requiredPhrases || [];
      console.log(`✅ נטען required-phrases.json: ${REQUIRED_PHRASES.length} ביטויים`);
    }
    if (!COURSES_QA) {
      const coursesQaPath = path.join(process.cwd(), 'data', 'courses-qa.json');
      COURSES_QA = JSON.parse(fs.readFileSync(coursesQaPath, 'utf8'));
      console.log(`✅ נטען courses-qa.json: ${COURSES_QA.questions?.length || 0} שאלות`);
    }
    if (!PAYMENTS_QA) {
      const paymentsQaPath = path.join(process.cwd(), 'data', 'payments-qa.json');
      PAYMENTS_QA = JSON.parse(fs.readFileSync(paymentsQaPath, 'utf8'));
      console.log(`✅ נטען payments-qa.json`);
    }
  } catch (error) {
    console.error('[loadConfigs] ERROR:', error.message);
  }
}

function loadSemanticData() {
  if (SEMANTIC_DATA) return SEMANTIC_DATA;
  try {
    const semanticPath = path.join(process.cwd(), 'data', 'semantic-mappings.json');
    SEMANTIC_DATA = JSON.parse(fs.readFileSync(semanticPath, 'utf8'));
    console.log(`✅ [Semantic] Loaded: ${Object.keys(SEMANTIC_DATA.synonyms || {}).length} synonyms`);
    return SEMANTIC_DATA;
  } catch (error) {
    console.error('⚠️ [Semantic] Failed to load semantic-mappings.json:', error.message);
    SEMANTIC_DATA = { synonyms: {}, intentPatterns: {}, genericTerms: [] };
    return SEMANTIC_DATA;
  }
}

function loadAllPages() {
  if (ALL_PAGES) return ALL_PAGES;
  console.log('🔍 [loadAllPages] Loading index files...');
  const pages = [];
  const indexFiles = [
    'shabaton_index_part1.json',
    'shabaton_index_part2.json',
    'morim_index_part1.json',
    'shabaton_index.json'
  ];
  for (const filename of indexFiles) {
    try {
      const filePath = path.join(process.cwd(), 'data', filename);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const pagesArray = Array.isArray(data) ? data : (data.pages || []);
      pages.push(...pagesArray);
      console.log(`✅ Loaded ${pagesArray.length} pages from ${filename}`);
    } catch (error) {
      console.log(`⚠️ Could not load ${filename}: ${error.message}`);
    }
  }
  const uniquePages = [];
  const seenUrls = new Set();
  for (const page of pages) {
    const url = page.url || page.link || '';
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniquePages.push(page);
    }
  }
  console.log(`✅ Final unique pages: ${uniquePages.length}`);
  ALL_PAGES = uniquePages;
  return ALL_PAGES;
}

// ================================================================
// 🧠 SMART CONTENT CLEANING
// ================================================================

function cleanContentFromNavigation(content, title = '', description = '') {
  if (!content || typeof content !== 'string') return '';
  let cleaned = content.toLowerCase();
  const originalLength = cleaned.length;

  const navigationPatterns = [
    /close carousel/gi, /carousel/gi, /navigation/gi, /menu/gi,
    /תפריט/gi, /ניווט/gi, /next/gi, /prev/gi, /previous/gi
  ];
  navigationPatterns.forEach(p => { cleaned = cleaned.replace(p, ' '); });

  const categoryTerms = [
    'צילום', 'פוטותרפיה', 'פסיכולוגיה', 'טכנולוגיה', 'רפואה משלימה',
    'אמנות', 'אומנויות', 'חינוך', 'הוראה', 'תרפיה', 'טיפול',
    'גיל רך', 'הנחיית קבוצות', 'תקשורת', 'העצמה', 'לקויות למידה',
    'פיתוח מקצועי', 'למידה מרחוק', 'תואר שני', 'השתלמות'
  ];

  const words = cleaned.split(/\s+/);
  let categoryCount = 0, consecutiveCategories = 0, maxConsecutive = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length < 3) continue;
    const isCategory = categoryTerms.some(cat => {
      const catWords = cat.toLowerCase().split(/\s+/);
      if (catWords.length === 1) return word.includes(catWords[0]) || catWords[0].includes(word);
      const wordsAround = words.slice(Math.max(0, i - 1), i + 2).join(' ');
      return wordsAround.includes(cat.toLowerCase());
    });
    if (isCategory) { consecutiveCategories++; categoryCount++; maxConsecutive = Math.max(maxConsecutive, consecutiveCategories); }
    else { consecutiveCategories = 0; }
  }

  const isNavigationHeavy = categoryCount > 6 || maxConsecutive > 4;
  if (isNavigationHeavy) {
    console.log(`  🧹 [CleanContent] "${title.substring(0, 50)}..." - Heavy navigation: ${categoryCount} categories, max ${maxConsecutive} consecutive`);
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const descWords = (description || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const uniqueWords = [...new Set([...titleWords, ...descWords])];
    const sentences = cleaned.split(/[.!?]+/);
    const relevantSentences = sentences.filter(sentence => {
      if (sentence.length < 30) return false;
      const sentenceWords = sentence.split(/\s+/);
      const catInSentence = sentenceWords.filter(w => categoryTerms.some(cat => w.includes(cat.toLowerCase()) || cat.toLowerCase().includes(w))).length;
      const uniqueInSentence = sentenceWords.filter(w => uniqueWords.some(u => w.includes(u) || u.includes(w))).length;
      return uniqueInSentence > 0 && catInSentence <= 3;
    });
    if (relevantSentences.length > 0) {
      cleaned = relevantSentences.join('. ');
      console.log(`  🎯 [CleanContent] Kept ${relevantSentences.length}/${sentences.length} sentences (${Math.round(cleaned.length / originalLength * 100)}% kept)`);
    } else {
      cleaned = (title + ' ' + description).toLowerCase();
      console.log(`  ⚠️ [CleanContent] No relevant sentences, using title+description only`);
    }
  }

  const commonRepeatedText = [
    'שבתון קורסים והשתלמויות למורים', 'למורים לגננות ולקהל הרחב',
    'קורסים מוכרים משרד החינוך', 'בהשתתפות משרד החינוך', 'עוז לתמורה', 'אופק חדש'
  ];
  commonRepeatedText.forEach(r => {
    const p = new RegExp(r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleaned = cleaned.replace(p, ' ');
  });

  return cleaned.replace(/\s+/g, ' ').trim();
}

// ================================================================
// 🧠 SEMANTIC ANALYSIS
// ================================================================

function buildWordGraph() {
  if (WORD_GRAPH) return WORD_GRAPH;
  loadSemanticData();
  loadConfigs();
  const wordGraph = new Map();

  if (SEMANTIC_DATA && SEMANTIC_DATA.synonyms) {
    for (const [mainTerm, data] of Object.entries(SEMANTIC_DATA.synonyms)) {
      const allTerms = [mainTerm, ...(data.variations || [])];
      for (const term of allTerms) {
        const tl = term.toLowerCase();
        if (!wordGraph.has(tl)) wordGraph.set(tl, new Set());
        allTerms.forEach(t => { if (t.toLowerCase() !== tl) wordGraph.get(tl).add(t); });
        wordGraph.get(tl).add(mainTerm);
      }
    }
  }
  if (REQUIRED_PHRASES) {
    for (const pe of REQUIRED_PHRASES) {
      const allPhrases = [pe.phrase, ...(pe.variations || [])];
      for (const phrase of allPhrases) {
        const pl = phrase.toLowerCase();
        if (!wordGraph.has(pl)) wordGraph.set(pl, new Set());
        allPhrases.forEach(p => { if (p.toLowerCase() !== pl) wordGraph.get(pl).add(p); });
        wordGraph.get(pl).add(pe.phrase);
      }
    }
  }
  if (STUDY_FIELDS) {
    for (const field of STUDY_FIELDS) {
      const allTerms = [field.name, ...(field.keywords || [])];
      for (const term of allTerms) {
        const tl = term.toLowerCase();
        if (!wordGraph.has(tl)) wordGraph.set(tl, new Set());
        wordGraph.get(tl).add(field.name);
      }
    }
  }

  WORD_GRAPH = wordGraph;
  console.log(`🧠 [buildWordGraph] Built unified graph with ${wordGraph.size} terms`);
  return wordGraph;
}

function expandQuerySemantically(query) {
  if (!WORD_GRAPH) buildWordGraph();
  loadSemanticData();
  const expanded = new Set([query]);
  const queryLower = query.toLowerCase();
  for (const [term, relatedTerms] of WORD_GRAPH.entries()) {
    if (queryLower.includes(term)) relatedTerms.forEach(rt => expanded.add(rt));
  }
  if (SEMANTIC_DATA && SEMANTIC_DATA.intentPatterns) {
    for (const [, intentData] of Object.entries(SEMANTIC_DATA.intentPatterns)) {
      const hasPattern = (intentData.patterns || []).some(p => queryLower.includes(p.toLowerCase()));
      if (hasPattern && intentData.problemToSolution) {
        for (const [problem, solutions] of Object.entries(intentData.problemToSolution)) {
          if (queryLower.includes(problem.toLowerCase())) solutions.forEach(s => expanded.add(s));
        }
      }
    }
  }
  const result = Array.from(expanded);
  console.log(`  🧠 [Semantic] "${query}" → [${result.slice(0, 6).join(', ')}${result.length > 6 ? '...' : ''}]`);
  return result;
}

function isGenericTerm(term) {
  loadSemanticData();
  const defaults = ['סטודיו', 'studio', 'לימוד', 'קורס', 'טיפול', 'תרפיה'];
  if (!SEMANTIC_DATA || !SEMANTIC_DATA.genericTerms) return defaults.includes(term.toLowerCase());
  return SEMANTIC_DATA.genericTerms.includes(term.toLowerCase()) || defaults.includes(term.toLowerCase());
}

// ================================================================
// 🔗 URL BUILDER - רק מנתוני data
// ================================================================

function buildCategoryUrl(region, studyField) {
  if (!studyField || !studyField.slug) return null;
  if (region && region.slug) return `${SITE_BASE}/${region.slug}/${studyField.slug}`;
  return `${SITE_BASE}/${studyField.slug}`;
}

// ================================================================
// 🔍 DETECTION FUNCTIONS
// ================================================================

function detectStudyField(message) {
  loadConfigs();
  console.log('\n🔍 [detectStudyField] START');
  console.log(`📝 Message: "${message}"`);

  if (!STUDY_FIELDS || !Array.isArray(STUDY_FIELDS)) {
    console.error('❌ STUDY_FIELDS is not an array');
    return [];
  }

  const lowerMessage = message.toLowerCase();
  const expandedTerms = expandQuerySemantically(message);

  // ================================================================
  // חיפוש התאמה לשם תחום - ישירה או סמנטית
  // v110: גם בהתאמה ישירה, specificKeyword מקבל ערך כדי שבדיקת האזור תהיה מקלה
  // ================================================================
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    const fieldNameLower = field.name.toLowerCase();
    const directMatch = lowerMessage.includes(fieldNameLower);
    const semanticMatch = !directMatch && expandedTerms.some(term => fieldNameLower.includes(term.toLowerCase()));

    if (directMatch || semanticMatch) {
      console.log(`✅ Found field name: "${field.name}" (via: ${directMatch ? 'direct' : 'semantic'})`);

      let specificKeyword = null;

      if (semanticMatch) {
        // v108: חיפוש המילה המקורית מהמסר
        const words = lowerMessage.split(/\s+/);
        for (const expandedTerm of expandedTerms) {
          if (expandedTerm.toLowerCase() === fieldNameLower) continue;
          if (expandedTerm === message) continue;
          for (const word of words) {
            const cleanWord = word.replace(/[,\.!\?;:]/g, '');
            if (cleanWord.length > 2 &&
              (cleanWord.includes(expandedTerm.toLowerCase()) || expandedTerm.toLowerCase().includes(cleanWord))) {
              specificKeyword = cleanWord;
              console.log(`  🎯 [SemanticField] Original keyword preserved: "${specificKeyword}"`);
              break;
            }
          }
          if (specificKeyword) break;
        }
        // fallback לkeywords של התחום
        if (!specificKeyword) {
          for (const keyword of (field.keywords || [])) {
            const kl = keyword.toLowerCase();
            for (const word of lowerMessage.split(/\s+/)) {
              const cw = word.replace(/[,\.!\?;:]/g, '');
              if (cw.length > 2 && (cw.includes(kl) || kl.includes(cw))) {
                specificKeyword = cw;
                console.log(`  🎯 [SemanticField] Keyword from field: "${specificKeyword}"`);
                break;
              }
            }
            if (specificKeyword) break;
          }
        }
      } else {
        // ✅ v110 תיקון: גם בהתאמה ישירה - specificKeyword = שם התחום
        // זה מאפשר לבדיקת האזור להיות מקלה (כמו כשיש specificKeyword)
        specificKeyword = fieldNameLower;
        console.log(`  🎯 [DirectMatch] specificKeyword set to field name: "${specificKeyword}"`);
      }

      return [{ ...field, specificKeyword }];
    }
  }

  // חיפוש לפי keywords
  let bestMatch = null;
  const tooGeneric = ['למידה', 'לימוד', 'קורס', 'קורסים', 'השתלמות', 'תואר'];

  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    if (!field.keywords || !Array.isArray(field.keywords)) continue;
    for (const keyword of field.keywords) {
      if (!keyword || tooGeneric.includes(keyword.toLowerCase())) continue;
      const kl = keyword.toLowerCase();
      const foundInMessage = lowerMessage.includes(kl);
      const foundInExpanded = expandedTerms.some(t => t.toLowerCase().includes(kl) || kl.includes(t.toLowerCase()));
      if (foundInMessage || foundInExpanded) {
        if (!bestMatch || kl.length > bestMatch.length) {
          bestMatch = { field, keyword, length: kl.length, foundVia: foundInMessage ? 'direct' : 'semantic' };
        }
      }
    }
  }

  if (bestMatch) {
    console.log(`✅ Found keyword: "${bestMatch.keyword}" in field: "${bestMatch.field.name}" (via: ${bestMatch.foundVia})`);
    const words = lowerMessage.split(/\s+/);
    let fullWord = bestMatch.keyword;
    const kl = bestMatch.keyword.toLowerCase();
    if (bestMatch.foundVia === 'semantic') {
      for (const et of expandedTerms) {
        for (const word of words) {
          const cw = word.replace(/[,\.!\?;:]/g, '');
          if (cw.includes(et.toLowerCase()) || et.toLowerCase().includes(cw)) {
            fullWord = cw;
            console.log(`  🔍 [Semantic] Found original term: "${fullWord}"`);
            break;
          }
        }
        if (fullWord !== bestMatch.keyword) break;
      }
    } else {
      for (const word of words) {
        const cw = word.replace(/[,\.!\?;:]/g, '');
        if (cw.includes(kl)) { fullWord = cw; break; }
      }
    }
    return [{ ...bestMatch.field, specificKeyword: fullWord }];
  }

  console.log('❌ No study field detected');
  return [];
}

function detectRegion(message) {
  loadConfigs();
  if (!REGIONS || !Array.isArray(REGIONS)) return null;
  const lm = message.toLowerCase().replace(/-/g, ' ');
  for (const region of REGIONS) {
    if (lm.includes(region.name.toLowerCase())) {
      console.log(`✅ [detectRegion] Found by name: "${region.name}"`);
      return region;
    }
    if (region.keywords) {
      for (const kw of region.keywords) {
        if (lm.includes(kw.toLowerCase())) {
          console.log(`✅ [detectRegion] Found by keyword: "${kw}" → "${region.name}"`);
          return region;
        }
      }
    }
    if (region.cities) {
      for (const city of region.cities) {
        if (lm.includes(city.toLowerCase().replace(/-/g, ' '))) {
          console.log(`✅ [detectRegion] Found by city: "${city}" → "${region.name}"`);
          return region;
        }
      }
    }
  }
  console.log('❌ [detectRegion] No region detected');
  return null;
}

function detectSpecificCity(query, region) {
  if (!region || !region.cities) return null;
  const ql = query.toLowerCase().replace(/-/g, ' ');
  for (const city of region.cities) {
    if (ql.includes(city.toLowerCase().replace(/-/g, ' '))) {
      console.log(`✅ [detectSpecificCity] Found: "${city}" in "${region.name}"`);
      return city;
    }
  }
  return null;
}

// ================================================================
// 🔍 MAIN SEARCH FUNCTION
// ================================================================

async function searchPages(query, region = null, studyField = null) {
  console.log('========== [searchPages] START ==========');
  console.log(`🚀🚀🚀 CODE VERSION: FEB_18_v110_FIX_DIRECT_MATCH_KEYWORD_AND_CATEGORY_FALLBACK 🚀🚀🚀`);
  console.log(`Query: "${query}" | Region: ${region?.name || 'כל הארץ'} | Field: ${studyField?.name || 'כללי'} | Keyword: ${studyField?.specificKeyword || 'none'}`);
  console.log('========================================');

  const pages = loadAllPages();
  const results = [];

  const JUNK_TITLE_PATTERNS = [
    'close carousel', 'carousel', 'next', 'prev', 'previous', 'menu', 'navigation',
    'ינואר 2', 'פברואר 2', 'מרץ 2', 'אפריל 2', 'מאי 2', 'יוני 2',
    'יולי 2', 'אוגוסט 2', 'ספטמבר 2', 'אוקטובר 2', 'נובמבר 2', 'דצמבר 2'
  ];

  for (const page of pages) {
    const pageType = page.pageType || 'unknown';
    const isStaticPage = pageType === 'static';
    const isInfoPage = pageType === 'info';

    const rawTitle = page.title || page.h1 || '';
    let cleanedRawTitle = rawTitle;
    let cleanedTitle = rawTitle.toLowerCase();

    for (const pattern of JUNK_TITLE_PATTERNS) {
      const re = new RegExp(pattern, 'gi');
      cleanedRawTitle = cleanedRawTitle.replace(re, '').trim();
      cleanedTitle = cleanedTitle.replace(re, '').trim();
    }

    if (cleanedTitle.length === 0 || cleanedRawTitle.length < 3) continue;
    const url = (page.url || page.link || '').toLowerCase();
    if (!url || url.length < 10) continue;
    if (cleanedRawTitle.length < 10 && !page.description && !page.text) continue;

    const finalTitle = cleanedTitle;
    const finalRawTitle = cleanedRawTitle;
    const description = (page.description || '').toLowerCase();
    const allHeadersText = ((page.h2 || []).join(' ') + ' ' + (page.h3 || []).join(' ')).toLowerCase();
    const cleanedContent = cleanContentFromNavigation(page.text || '', finalRawTitle, page.description || '');

    console.log(`  🧼 "${rawTitle}" → "${finalRawTitle}" (cleaned)`);

    // ── סינון לפי תחום ──────────────────────────────────────────
    if (studyField) {
      const fieldNameLower = studyField.name.toLowerCase();
      const specificLower = studyField.specificKeyword ? studyField.specificKeyword.toLowerCase() : null;

      // מה לחפש: specificKeyword אם יש, אחרת שם התחום
      const searchTerm = specificLower || fieldNameLower;

      let fieldFound = false;
      let searchLocation = '';

      if (finalTitle.includes(searchTerm)) { fieldFound = true; searchLocation = 'title'; }
      else if (description.includes(searchTerm)) { fieldFound = true; searchLocation = 'description'; }
      else if (allHeadersText.includes(searchTerm)) { fieldFound = true; searchLocation = 'headers'; }
      else if (!isGenericTerm(searchTerm) && cleanedContent.toLowerCase().includes(searchTerm)) {
        fieldFound = true; searchLocation = 'clean_content';
      }

      if (!fieldFound) continue;
      console.log(`  ✅ "${finalRawTitle}" - "${searchTerm}" found in ${searchLocation}`);
    }

    // ── חישוב Score ──────────────────────────────────────────────
    let matchScore = 0;
    if (studyField) {
      const specificLower = studyField.specificKeyword ? studyField.specificKeyword.toLowerCase() : null;
      const searchTerm = specificLower || studyField.name.toLowerCase();
      if (finalTitle.includes(searchTerm)) { matchScore += 150; console.log(`    [SCORE] +150 in title`); }
      else if (description.includes(searchTerm)) { matchScore += 100; console.log(`    [SCORE] +100 in description`); }
      else if (allHeadersText.includes(searchTerm)) { matchScore += 50; console.log(`    [SCORE] +50 in headers`); }
      else { matchScore += 30; console.log(`    [SCORE] +30 in content`); }
    }

    // ── בדיקת עיר ספציפית ────────────────────────────────────────
    const specificCity = detectSpecificCity(query, region);
    let isInSpecificCity = false;
    if (specificCity && isStaticPage) {
      const location = (page.location || '').toLowerCase();
      const titleAndDesc = (finalTitle + ' ' + description + ' ' + url).toLowerCase();
      const cityLower = specificCity.toLowerCase().replace(/-/g, ' ');
      if (location.includes(cityLower) || titleAndDesc.includes(cityLower)) {
        isInSpecificCity = true; matchScore += 100;
        console.log(`    [SCORE] +100 for city "${specificCity}"`);
      }
    }

    // ── בדיקת אזור ───────────────────────────────────────────────
    let regionBonus = 0;
    if (region && region.cities && !isInSpecificCity) {
      const location = (page.location || '').toLowerCase();
      const titleDescContent = (finalTitle + ' ' + description + ' ' + cleanedContent).toLowerCase().replace(/-/g, ' ');

      const hasRegionCityInLocation = region.cities.some(city =>
        location.includes(city.toLowerCase().replace(/-/g, ' '))
      );

      if (location && location.trim() !== '') {
        if (!hasRegionCityInLocation) {
          const isRemote = location.includes('למידה מרחוק') || location.includes('מקוון') || location.includes('אונליין');
          if (isRemote) {
            let hasOtherRegion = false;
            if (REGIONS) {
              for (const otherRegion of REGIONS) {
                if (otherRegion.name === region.name) continue;
                for (const otherCity of otherRegion.cities || []) {
                  if (titleDescContent.includes(otherCity.toLowerCase().replace(/-/g, ' '))) {
                    hasOtherRegion = true;
                    console.log(`    [REGION] Other region city found - rejecting`);
                    break;
                  }
                }
                if (hasOtherRegion) break;
              }
            }
            if (hasOtherRegion) continue;
            regionBonus = 10;
            console.log(`    [SCORE] +10 for remote learning`);
          } else {
            console.log(`    [REGION] Not in region "${region.name}" - rejecting`);
            continue;
          }
        } else {
          regionBonus = isStaticPage ? 50 : 30;
          console.log(`    [SCORE] +${regionBonus} for being in region`);
        }
      } else {
        // אין location - בודקים לפי תוכן
        let cityMentioned = null, cityRegion = null, otherRegionMentioned = null;
        if (REGIONS) {
          for (const r of REGIONS) {
            for (const city of r.cities) {
              if (titleDescContent.includes(city.toLowerCase().replace(/-/g, ' '))) {
                cityMentioned = city; cityRegion = r.name;
                console.log(`    [REGION] Found city "${city}" from region "${r.name}"`);
                break;
              }
            }
            if (cityMentioned) break;
          }
          if (!cityMentioned) {
            for (const r of REGIONS) {
              if (r.name === region.name) continue;
              if (titleDescContent.includes(r.name.toLowerCase())) {
                otherRegionMentioned = r.name;
                console.log(`    [REGION] Found other region "${r.name}"`);
                break;
              }
            }
          }
        }

        if (cityMentioned) {
          if (cityRegion === region.name) { regionBonus = 30; console.log(`    [SCORE] +30 for city in region`); }
          else { console.log(`    [REGION] City from different region - rejecting`); continue; }
        } else if (otherRegionMentioned) {
          console.log(`    [REGION] Different region mentioned - rejecting`); continue;
        } else {
          const regionMentioned = titleDescContent.includes(region.name.toLowerCase()) ||
            (region.keywords && region.keywords.some(k => titleDescContent.includes(k.toLowerCase())));
          if (regionMentioned) {
            regionBonus = 20; console.log(`    [SCORE] +20 for mentioning region`);
          } else {
            // ✅ v110: specificKeyword תמיד יש (שם התחום לפחות) → דפים ללא location מתקבלים עם +0
            regionBonus = 0;
            console.log(`    [SCORE] +0 no region mention but kept (specificKeyword: "${studyField?.specificKeyword}")`);
          }
        }
      }
      matchScore += regionBonus;
    }

    if (matchScore > 0 || isInfoPage) {
      console.log(`  ✅ ADDED: "${finalRawTitle}" | Score: ${matchScore} | Location: "${page.location || 'N/A'}"`);
      results.push({
        ...page,
        title: finalRawTitle,
        isStatic: isStaticPage,
        isInfo: isInfoPage,
        isInSpecificCity,
        specificCity: isInSpecificCity ? specificCity : null,
        score: matchScore
      });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isStatic && !b.isStatic) return -1;
    if (!a.isStatic && b.isStatic) return 1;
    if (a.isInSpecificCity && !b.isInSpecificCity) return -1;
    if (!a.isInSpecificCity && b.isInSpecificCity) return 1;
    return 0;
  });

  console.log(`[searchPages] RESULTS: ${results.length} found (Static: ${results.filter(r => r.isStatic).length}, Info: ${results.filter(r => r.isInfo).length})`);
  return results;
}

// ================================================================
// 💬 QA SYSTEM
// ================================================================

function findQAAnswer(message) {
  loadConfigs();
  console.log(`🔍 [findQAAnswer] "${message}"`);
  const lm = message.toLowerCase();

  if (COURSES_QA && COURSES_QA.questions) {
    for (const q of COURSES_QA.questions) {
      if (q.question && lm.includes(q.question.toLowerCase())) return { answer: q.answer, source: 'courses' };
      if (q.variations) {
        for (const v of q.variations) { if (lm.includes(v.toLowerCase())) return { answer: q.answer, source: 'courses' }; }
      }
      if (q.keywords) {
        const matches = q.keywords.filter(k => lm.includes(k.toLowerCase()));
        if (matches.length >= 2) return { answer: q.answer, source: 'courses' };
      }
    }
  }

  if (PAYMENTS_QA && PAYMENTS_QA.categories) {
    for (const category of PAYMENTS_QA.categories) {
      if (category.questions) {
        for (const q of category.questions) {
          if (q.question && lm.includes(q.question.toLowerCase())) return { answer: q.answer, source: 'payments' };
          if (q.variations) {
            for (const v of q.variations) { if (lm.includes(v.toLowerCase())) return { answer: q.answer, source: 'payments' }; }
          }
        }
      }
    }
  }

  console.log('  ❌ No QA answer found');
  return null;
}

function classifyIntent(message) {
  const lm = message.toLowerCase();
  console.log(`🎯 [classifyIntent] "${message}"`);
  const qaKw = ['כמה', 'מתי', 'איך', 'מה זה', 'האם', 'מי', 'למה', 'איפה', 'מה'];
  if (qaKw.some(k => lm.includes(k))) {
    const qa = findQAAnswer(message);
    if (qa) return { intent: 'qa', data: qa };
  }
  const searchKw = ['קורס', 'לימוד', 'השתלמות', 'תואר', 'מכללה', 'לימודים'];
  if (searchKw.some(k => lm.includes(k))) return { intent: 'search', data: null };
  return { intent: 'general', data: null };
}

// ================================================================
// 🎨 RESPONSE FORMATTING
// ================================================================

function formatResults(results, studyField, region) {
  if (results.length === 0) return '';
  const fieldName = studyField?.name || 'הקורסים';
  const regionName = region?.name || 'כל הארץ';

  let response = `מצאתי ${results.length} מוסדות`;
  if (region) response += ` ב${regionName}`;
  response += ` ל${fieldName}:\n\n`;

  let added = 0;
  for (const result of results) {
    if (added >= 6) break;
    const url = result.url || result.link || null;
    if (!url) continue; // לא ממציאים URL

    const title = result.title || result.h1 || 'ללא שם';
    const desc = result.description || '';
    const location = result.location || '';
    const icon = result.isInSpecificCity ? '📍' : '🏢';

    response += `${icon} **${title}**\n`;
    if (location) response += `📍 ${location}\n`;
    if (desc) response += `${desc.length > 150 ? desc.substring(0, 150) + '...' : desc}\n`;
    response += `[למידע מלא וייעוץ אישי](${url})\n\n`;
    added++;
  }

  // קישור לדף קטגוריה - מ-data בלבד
  const categoryUrl = buildCategoryUrl(region, studyField);
  if (categoryUrl) {
    response += `💡 **לכל ${fieldName}`;
    if (region) response += ` ב${regionName}`;
    response += `:** [לחץ כאן](${categoryUrl})\n`;
  }

  return response;
}

// ================================================================
// 🎯 MAIN RESPONSE GENERATOR
// ================================================================

async function generateSmartResponse(message) {
  console.log('========================================');
  console.log('🚀🚀🚀 CODE VERSION: FEB_18_v110_FIX_DIRECT_MATCH_KEYWORD_AND_CATEGORY_FALLBACK 🚀🚀🚀');
  console.log(`📝 Input: "${message}"`);
  console.log('========================================');

  loadConfigs();

  // QA קודם
  const qaAnswer = findQAAnswer(message);
  if (qaAnswer) {
    console.log('✅ QA answer found');
    return qaAnswer.answer;
  }

  const detectedFields = detectStudyField(message);
  const studyField = detectedFields[0] || null;
  const region = detectRegion(message);

  console.log(`📊 Field: ${studyField ? `${studyField.name} (keyword: "${studyField.specificKeyword}")` : 'None'} | Region: ${region?.name || 'None'}`);

  const intentInfo = classifyIntent(message);
  console.log(`🎯 Intent: ${intentInfo.intent}`);

  if (intentInfo.intent === 'search') {
    const results = await searchPages(message, region, studyField);
    console.log(`📊 Results: ${results.length} found`);

    if (results.length > 0) {
      return formatResults(results.slice(0, 6), studyField, region);
    }

    // ── Fallback: אין תוצאות ──────────────────────────────────
    console.log('❌ No results - building fallback response');
    const fieldName = studyField?.name || '';
    const regionName = region?.name || '';

    let response = `מצטערת, לא מצאתי מוסדות`;
    if (regionName) response += ` ב${regionName}`;
    if (fieldName) response += ` ל${fieldName}`;
    response += `.\n\n`;

    // ✅ v110: הצג דף קטגוריה של האזור הספציפי
    const categoryUrl = buildCategoryUrl(region, studyField);
    if (categoryUrl) {
      response += `🔍 **אפשר לחפש קורסים נוספים`;
      if (fieldName) response += ` ב${fieldName}`;
      if (regionName) response += ` ב${regionName}`;
      response += `:**\n[לכל הקורסים](${categoryUrl})\n\n`;
    }

    // הצע למידה מרחוק אם חיפשו באזור
    if (region && studyField) {
      const onlineField = STUDY_FIELDS?.find(f => f.name === 'למידה מרחוק');
      if (onlineField?.slug) {
        const onlineUrl = `${SITE_BASE}/${onlineField.slug}`;
        response += `🌐 **אפשר גם לחפש קורסי ${fieldName} בלמידה מרחוק:**\n`;
        response += `[קורסי ${fieldName} אונליין](${onlineUrl})\n\n`;
      }
    }

    // ווטסאפ - תמיד
    response += `💬 **לא מצאת מה שחיפשת?**\n`;
    response += `שאל בקבוצת הווטסאפ של שבתון:\n`;
    response += `[קבוצת ווטסאפ שבתון](${WHATSAPP_LINK})`;

    return response;
  }

  // General
  return `היי! 👋\n\nאני כאן לעזור לך למצוא קורסים והשתלמויות למורים בשבתון.\n\n**אפשר לשאול אותי על:**\n• קורסים ספציפיים (צילום, פסיכולוגיה, טכנולוגיה...)\n• קורסים באזור שלך (צפון, דרום, מרכז...)\n• שאלות על התשלומים והרישום\n\n**דוגמאות:**\n• "קורס פסיכולוגיה בצפון"\n• "קורס הנחיית קבוצות במרכז"\n• "כמה עולה קורס?"\n\n💬 **שאלה שלא מצאת תשובה לה?** [קבוצת ווטסאפ שבתון](${WHATSAPP_LINK})`;
}

// ================================================================
// 🌐 VERCEL HANDLER
// ================================================================

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};
  console.log(`📨 [handler] ${req.method} | Body: ${JSON.stringify(body).substring(0, 200)}`);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['POST', 'OPTIONS'] });
  }

  const { message } = body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid message - string required' });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: 'Message too long - maximum 500 characters' });
  }

  try {
    const startTime = Date.now();
    const response = await generateSmartResponse(message);
    const processingTime = Date.now() - startTime;

    console.log(`✅ Response length: ${response.length} chars | Time: ${processingTime}ms`);

    return res.status(200).json({
      reply: response,
      timestamp: new Date().toISOString(),
      processingTime,
      version: 'FEB_18_v110_FIX_DIRECT_MATCH_KEYWORD_AND_CATEGORY_FALLBACK'
    });
  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error);
    return res.status(500).json({
      error: 'Internal server error - please try again',
      message: error.message,
      timestamp: new Date().toISOString(),
      version: 'FEB_18_v110_FIX_DIRECT_MATCH_KEYWORD_AND_CATEGORY_FALLBACK'
    });
  }
}
