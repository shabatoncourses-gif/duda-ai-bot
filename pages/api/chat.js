// ================================================================
// 🎯 chat.js v106 - SMART JUNK FILTERING FIX
// ================================================================
// VERSION: FEB_17_v106_SMART_JUNK_FILTERING_FIX
// Created: 2026-02-17
// 
// תיקון קריטי: במקום לדחות דפים עם "close carousel"
// נקה את הטקסט ותמשיך עם החיפוש
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

// ================================================================
// 🔄 DATA LOADING FUNCTIONS
// ================================================================

function loadConfigs() {
  try {
    if (!REGIONS) {
      const regionsPath = path.join(process.cwd(), 'data', 'regions.json');
      const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
      REGIONS = regionsData.regions;
      console.log(`✅ נטען regions.json: ${REGIONS.length} אזורים`);
    }
    
    if (!STUDY_FIELDS) {
      const fieldsPath = path.join(process.cwd(), 'data', 'study-fields.json');
      const fieldsData = JSON.parse(fs.readFileSync(fieldsPath, 'utf8'));
      STUDY_FIELDS = fieldsData.studyFields;
      console.log(`✅ נטען study-fields.json: ${STUDY_FIELDS.length} תחומים`);
    }
    
    if (!REQUIRED_PHRASES) {
      const phrasesPath = path.join(process.cwd(), 'data', 'required-phrases.json');
      const phrasesData = JSON.parse(fs.readFileSync(phrasesPath, 'utf8'));
      REQUIRED_PHRASES = phrasesData.requiredPhrases || [];
      console.log(`✅ נטען required-phrases.json: ${REQUIRED_PHRASES.length} ביטויים`);
    }
    
    if (!COURSES_QA) {
      const coursesQaPath = path.join(process.cwd(), 'data', 'courses-qa.json');
      const coursesQaData = JSON.parse(fs.readFileSync(coursesQaPath, 'utf8'));
      COURSES_QA = coursesQaData;
      console.log(`✅ נטען courses-qa.json: ${coursesQaData.questions?.length || 0} שאלות`);
    }
    
    if (!PAYMENTS_QA) {
      const paymentsQaPath = path.join(process.cwd(), 'data', 'payments-qa.json');
      const paymentsQaData = JSON.parse(fs.readFileSync(paymentsQaPath, 'utf8'));
      PAYMENTS_QA = paymentsQaData;
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
    const semanticJson = JSON.parse(fs.readFileSync(semanticPath, 'utf8'));
    SEMANTIC_DATA = semanticJson;
    console.log(`✅ [Semantic] Loaded: ${Object.keys(semanticJson.synonyms || {}).length} synonyms`);
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
  console.log(`📁 Working directory: ${process.cwd()}`);
  
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
      console.log(`Trying to load: ${filePath}`);
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const pagesArray = Array.isArray(data) ? data : (data.pages || []);
      
      pages.push(...pagesArray);
      console.log(`✅ Loaded ${pagesArray.length} pages from ${filename}`);
    } catch (error) {
      console.log(`⚠️ Could not load ${filename}: ${error.message}`);
    }
  }
  
  console.log(`✅ Total loaded: ${pages.length} pages`);
  
  // הסר כפילויות
  const uniquePages = [];
  const seenUrls = new Set();
  
  for (const page of pages) {
    const url = page.url || page.link || '';
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniquePages.push(page);
    }
  }
  
  console.log(`⚠️ Removed ${pages.length - uniquePages.length} duplicates`);
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
  
  // 1. הסר דפטרנים ברורים של ניווט/carousel
  const navigationPatterns = [
    /close carousel/gi,
    /carousel/gi,
    /navigation/gi,
    /menu/gi,
    /תפריט/gi,
    /ניווט/gi,
    /next/gi,
    /prev/gi,
    /previous/gi,
    
    // דפטרנים של תאריכים שחוזרים בניווט
    /(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{4}/gi,
    
    // דפטרנים של רשימות קטגוריות ארוכות
    /צילום\s+(פסיכולוגיה|טכנולוגיה|רפואה|אמנות|חינוך|תרפיה|גיל\s+רך)/gi,
    /פסיכולוגיה\s+(צילום|טכנולוגיה|רפואה|אמנות|חינוך|תרפיה|גיל\s+רך)/gi,
    /טכנולוגיה\s+(צילום|פסיכולוגיה|רפואה|אמנות|חינוך|תרפיה|גיל\s+רך)/gi,
  ];
  
  // הסר דפטרנים בסיסיים
  navigationPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, ' ');
  });
  
  // 2. זיהוי וסינון רשימות קטגוריות ארוכות
  const categoryTerms = [
    'צילום', 'פוטותרפיה', 'פסיכולוגיה', 'טכנולוגיה', 'רפואה משלימה', 
    'אמנות', 'אומנויות', 'חינוך', 'הוראה', 'תרפיה', 'טיפול',
    'גיל רך', 'הנחיית קבוצות', 'תקשורת', 'העצמה', 'לקויות למידה',
    'פיתוח מקצועי', 'למידה מרחוק', 'תואר שני', 'השתלמות'
  ];
  
  // ספור קטגוריות ברצף
  const words = cleaned.split(/\s+/);
  let categoryCount = 0;
  let consecutiveCategories = 0;
  let maxConsecutive = 0;
  let categoryPositions = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length < 3) continue;
    
    const isCategory = categoryTerms.some(cat => {
      const catWords = cat.toLowerCase().split(/\s+/);
      if (catWords.length === 1) {
        return word.includes(catWords[0]) || catWords[0].includes(word);
      } else {
        // מונח מרובה מילים כמו "גיל רך"
        const wordsAround = words.slice(Math.max(0, i-1), i+2).join(' ');
        return wordsAround.includes(cat.toLowerCase());
      }
    });
    
    if (isCategory) {
      consecutiveCategories++;
      categoryCount++;
      categoryPositions.push(i);
      maxConsecutive = Math.max(maxConsecutive, consecutiveCategories);
    } else {
      consecutiveCategories = 0;
    }
  }
  
  // אם יש הרבה קטגוריות ברצף - זה כנראה ניווט
  const isNavigationHeavy = categoryCount > 6 || maxConsecutive > 4;
  
  if (isNavigationHeavy) {
    console.log(`  🧹 [CleanContent] "${title.substring(0, 50)}..." - Heavy navigation detected: ${categoryCount} categories, max ${maxConsecutive} consecutive`);
    
    // מצא מילים ייחודיות לדף הזה
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const descWords = (description || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const uniqueWords = [...new Set([...titleWords, ...descWords])];
    
    // חלק את התוכן למשפטים ושמור רק את הרלוונטיים
    const sentences = cleaned.split(/[.!?]+/);
    const relevantSentences = sentences.filter(sentence => {
      if (sentence.length < 30) return false; // משפטים קצרים מדי
      
      const sentenceWords = sentence.split(/\s+/);
      
      // ספור קטגוריות במשפט
      const categoryInSentence = sentenceWords.filter(w => 
        categoryTerms.some(cat => w.includes(cat.toLowerCase()) || cat.toLowerCase().includes(w))
      ).length;
      
      // ספור מילים ייחודיות במשפט
      const uniqueInSentence = sentenceWords.filter(w =>
        uniqueWords.some(unique => w.includes(unique) || unique.includes(w))
      ).length;
      
      // שמור משפט אם:
      // - יש בו מילים ייחודיות (מהכותרת/תיאור)
      // - אין יותר מ-3 קטגוריות (כנראה לא ניווט)
      return uniqueInSentence > 0 && categoryInSentence <= 3;
    });
    
    if (relevantSentences.length > 0) {
      cleaned = relevantSentences.join('. ');
      console.log(`  🎯 [CleanContent] Filtered to ${relevantSentences.length}/${sentences.length} sentences (${Math.round(cleaned.length/originalLength*100)}% kept)`);
    } else {
      // אם לא נמצא כלום רלוונטי, שמור את הכותרת והתיאור בלבד
      cleaned = (title + ' ' + description).toLowerCase();
      console.log(`  ⚠️ [CleanContent] No relevant sentences found, using title+description only`);
    }
  }
  
  // 3. הסר טקסט חוזר שמופיע בכל הדפים
  const commonRepeatedText = [
    'שבתון קורסים והשתלמויות למורים',
    'למורים לגננות ולקהל הרחב',
    'קורסים מוכרים משרד החינוך',
    'בהשתתפות משרד החינוך',
    'עוז לתמורה',
    'אופק חדש',
    'כל הזכויות שמורות'
  ];
  
  commonRepeatedText.forEach(repeated => {
    const pattern = new RegExp(repeated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleaned = cleaned.replace(pattern, ' ');
  });
  
  // 4. נקה רווחים מרובים
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// ================================================================
// 🧠 SEMANTIC ANALYSIS SYSTEM v2.0
// ================================================================

function buildWordGraph() {
  if (WORD_GRAPH) return WORD_GRAPH;
  
  loadSemanticData();
  loadConfigs();
  
  const wordGraph = new Map();
  
  // 1. הוסף מ-semantic-mappings.json
  if (SEMANTIC_DATA && SEMANTIC_DATA.synonyms) {
    for (const [mainTerm, data] of Object.entries(SEMANTIC_DATA.synonyms)) {
      const allTerms = [mainTerm, ...(data.variations || [])];
      
      for (const term of allTerms) {
        const termLower = term.toLowerCase();
        if (!wordGraph.has(termLower)) {
          wordGraph.set(termLower, new Set());
        }
        
        // הוסף כל הוריאציות
        allTerms.forEach(t => {
          if (t.toLowerCase() !== termLower) {
            wordGraph.get(termLower).add(t);
          }
        });
        
        // הוסף את המונח הראשי
        wordGraph.get(termLower).add(mainTerm);
      }
    }
  }
  
  // 2. הוסף מ-required-phrases.json
  if (REQUIRED_PHRASES) {
    for (const phraseEntry of REQUIRED_PHRASES) {
      const mainPhrase = phraseEntry.phrase;
      const variations = phraseEntry.variations || [];
      const allPhrases = [mainPhrase, ...variations];
      
      for (const phrase of allPhrases) {
        const phraseLower = phrase.toLowerCase();
        if (!wordGraph.has(phraseLower)) {
          wordGraph.set(phraseLower, new Set());
        }
        
        allPhrases.forEach(p => {
          if (p.toLowerCase() !== phraseLower) {
            wordGraph.get(phraseLower).add(p);
          }
        });
        
        wordGraph.get(phraseLower).add(mainPhrase);
      }
    }
  }
  
  // 3. הוסף מ-study-fields.json
  if (STUDY_FIELDS) {
    for (const field of STUDY_FIELDS) {
      const keywords = field.keywords || [];
      const allTerms = [field.name, ...keywords];
      
      for (const term of allTerms) {
        const termLower = term.toLowerCase();
        if (!wordGraph.has(termLower)) {
          wordGraph.set(termLower, new Set());
        }
        
        wordGraph.get(termLower).add(field.name);
      }
    }
  }
  
  WORD_GRAPH = wordGraph;
  console.log(`🧠 [buildWordGraph] Built unified graph with ${wordGraph.size} terms`);
  return wordGraph;
}

function expandQuerySemantically(query) {
  if (!WORD_GRAPH) {
    buildWordGraph();
  }
  
  loadSemanticData();
  
  const expanded = new Set([query]);
  const queryLower = query.toLowerCase();
  
  // שלב 1: הרחב מהגרף המאוחד
  for (const [term, relatedTerms] of WORD_GRAPH.entries()) {
    if (queryLower.includes(term)) {
      relatedTerms.forEach(rt => expanded.add(rt));
    }
  }
  
  // שלב 2: זיהוי כוונות מ-intentPatterns
  if (SEMANTIC_DATA && SEMANTIC_DATA.intentPatterns) {
    for (const [intentType, intentData] of Object.entries(SEMANTIC_DATA.intentPatterns)) {
      const patterns = intentData.patterns || [];
      
      const hasPattern = patterns.some(pattern => 
        queryLower.includes(pattern.toLowerCase())
      );
      
      if (hasPattern && intentData.problemToSolution) {
        for (const [problem, solutions] of Object.entries(intentData.problemToSolution)) {
          if (queryLower.includes(problem.toLowerCase())) {
            console.log(`  🎯 [Intent] Detected: "${problem}" → [${solutions.join(', ')}]`);
            solutions.forEach(sol => expanded.add(sol));
          }
        }
      }
    }
  }
  
  const result = Array.from(expanded);
  console.log(`  🧠 [Semantic Expansion] "${query}" → [${result.slice(0, 6).join(', ')}${result.length > 6 ? '...' : ''}]`);
  
  return result;
}

function isGenericTerm(term) {
  loadSemanticData();
  
  // רשימת מונחים גנריים מוגדרת מראש
  const defaultGenericTerms = ['סטודיו', 'studio', 'לימוד', 'קורס', 'טיפול', 'תרפיה'];
  
  if (!SEMANTIC_DATA || !SEMANTIC_DATA.genericTerms) {
    return defaultGenericTerms.includes(term.toLowerCase());
  }
  
  return SEMANTIC_DATA.genericTerms.includes(term.toLowerCase()) || 
         defaultGenericTerms.includes(term.toLowerCase());
}

// ================================================================
// 🔍 SEARCH & DETECTION FUNCTIONS
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
  
  // שלב 1: חפש התאמה מדויקת לשם תחום
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue; // דלג על למידה מרחוק
    
    const fieldNameLower = field.name.toLowerCase();
    
    if (lowerMessage.includes(fieldNameLower) || 
        expandedTerms.some(term => fieldNameLower.includes(term.toLowerCase()))) {
      console.log(`✅ Found exact field name: "${field.name}"`);
      return [{ ...field, specificKeyword: null }];
    }
  }
  
  // שלב 2: חפש keywords עם ניקוד חכם
  let bestMatch = null;
  const tooGenericKeywords = ['למידה', 'לימוד', 'קורס', 'קורסים', 'השתלמות', 'תואר'];
  
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    if (!field.keywords || !Array.isArray(field.keywords)) continue;
    
    for (const keyword of field.keywords) {
      if (!keyword || tooGenericKeywords.includes(keyword.toLowerCase())) continue;
      
      const keywordLower = keyword.toLowerCase();
      const foundInMessage = lowerMessage.includes(keywordLower);
      const foundInExpanded = expandedTerms.some(term => 
        term.toLowerCase().includes(keywordLower) || 
        keywordLower.includes(term.toLowerCase())
      );
      
      if (foundInMessage || foundInExpanded) {
        const keywordLength = keywordLower.length;
        
        if (!bestMatch || keywordLength > bestMatch.length) {
          bestMatch = {
            field: field,
            keyword: keyword,
            length: keywordLength,
            foundVia: foundInMessage ? 'direct' : 'semantic'
          };
        }
      }
    }
  }
  
  if (bestMatch) {
    console.log(`✅ Found keyword: "${bestMatch.keyword}" in field: "${bestMatch.field.name}" (via: ${bestMatch.foundVia})`);
    
    // מצא את המילה המלאה ב-query
    const words = lowerMessage.split(/\s+/);
    const keywordLower = bestMatch.keyword.toLowerCase();
    let fullWord = bestMatch.keyword;
    
    if (bestMatch.foundVia === 'semantic') {
      // אם נמצא דרך הרחבה סמנטית, חפש את המילה המקורית
      for (const expandedTerm of expandedTerms) {
        for (const word of words) {
          const cleanWord = word.replace(/[,\.!\?;:]/g, '');
          if (cleanWord.includes(expandedTerm.toLowerCase()) || 
              expandedTerm.toLowerCase().includes(cleanWord)) {
            fullWord = cleanWord;
            console.log(`  🔍 [Semantic] Found original term: "${fullWord}"`);
            break;
          }
        }
        if (fullWord !== bestMatch.keyword) break;
      }
    } else {
      // נמצא ישירות, חפש את המילה המלאה
      for (const word of words) {
        const cleanWord = word.replace(/[,\.!\?;:]/g, '');
        if (cleanWord.includes(keywordLower)) {
          fullWord = cleanWord;
          console.log(`  🔍 Found full word: "${fullWord}"`);
          break;
        }
      }
    }
    
    return [{ 
      ...bestMatch.field, 
      specificKeyword: fullWord
    }];
  }
  
  console.log('❌ No study field detected');
  return [];
}

function detectRegion(message) {
  loadConfigs();
  
  if (!REGIONS || !Array.isArray(REGIONS)) return null;
  
  const lowerMessage = message.toLowerCase().replace(/-/g, ' ');
  
  // חפש לפי שם אזור
  for (const region of REGIONS) {
    if (lowerMessage.includes(region.name.toLowerCase())) {
      console.log(`✅ [detectRegion] Found region by name: "${region.name}"`);
      return region;
    }
    
    // חפש לפי keywords
    if (region.keywords) {
      for (const keyword of region.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          console.log(`✅ [detectRegion] Found region by keyword: "${keyword}" → "${region.name}"`);
          return region;
        }
      }
    }
    
    // חפש לפי ערים
    if (region.cities) {
      for (const city of region.cities) {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        if (lowerMessage.includes(cityLower)) {
          console.log(`✅ [detectRegion] Found region by city: "${city}" → "${region.name}"`);
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
  
  const queryLower = query.toLowerCase().replace(/-/g, ' ');
  
  for (const city of region.cities) {
    const cityLower = city.toLowerCase().replace(/-/g, ' ');
    if (queryLower.includes(cityLower)) {
      console.log(`✅ [detectSpecificCity] Found specific city: "${city}" in region "${region.name}"`);
      return city;
    }
  }
  
  return null;
}

// ================================================================
// 📅 DATE & TIME UTILITIES
// ================================================================

function findUpcomingDateInSchedule(page, fieldName) {
  if (!page.text || !fieldName) return null;
  
  const text = page.text.toLowerCase();
  const fieldLower = fieldName.toLowerCase();
  
  // חפש דפטרנים של תאריכים
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
    /(\d{1,2}\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{2,4})/g
  ];
  
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const matchIndex = text.indexOf(match);
        const contextBefore = text.substring(Math.max(0, matchIndex - 100), matchIndex);
        const contextAfter = text.substring(matchIndex, matchIndex + 100);
        
        if (contextBefore.includes(fieldLower) || contextAfter.includes(fieldLower)) {
          console.log(`  📅 Found upcoming date: "${match}" for field "${fieldName}"`);
          return match;
        }
      }
    }
  }
  
  return null;
}

function isUpcomingDate(dateString) {
  if (!dateString) return false;
  
  const today = new Date();
  const twoMonthsFromNow = new Date();
  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
  
  let parsedDate;
  
  // דפטרן DD/MM/YYYY או DD-MM-YYYY
  const dateMatch = dateString.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    let year = parseInt(dateMatch[3]);
    if (year < 100) year += 2000;
    
    parsedDate = new Date(year, month, day);
  }
  
  // דפטרן עברי
  const hebrewMonths = {
    'ינואר': 0, 'פברואר': 1, 'מרץ': 2, 'אפריל': 3,
    'מאי': 4, 'יוני': 5, 'יולי': 6, 'אוגוסט': 7,
    'ספטמבר': 8, 'אוקטובר': 9, 'נובמבר': 10, 'דצמבר': 11
  };
  
  const hebrewMatch = dateString.match(/(\d{1,2})\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(\d{2,4})/);
  if (hebrewMatch && !parsedDate) {
    const day = parseInt(hebrewMatch[1]);
    const month = hebrewMonths[hebrewMatch[2]];
    let year = parseInt(hebrewMatch[3]);
    if (year < 100) year += 2000;
    
    parsedDate = new Date(year, month, day);
  }
  
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    return false;
  }
  
  const isUpcoming = parsedDate >= today && parsedDate <= twoMonthsFromNow;
  if (isUpcoming) {
    console.log(`  ✅ Date ${dateString} is upcoming (${parsedDate.toLocaleDateString('he-IL')})`);
  }
  
  return isUpcoming;
}

function isCourseRemote(page) {
  if (!page) return false;
  
  const location = (page.location || '').toLowerCase();
  const title = (page.title || page.h1 || '').toLowerCase();
  const description = (page.description || '').toLowerCase();
  
  const remoteKeywords = [
    'למידה מרחוק', 'מקוון', 'אונליין', 'online', 'zoom', 'דיגיטלי',
    'מרחוק', 'וירטואלי', 'אינטרנט'
  ];
  
  return remoteKeywords.some(keyword => 
    location.includes(keyword) || title.includes(keyword) || description.includes(keyword)
  );
}

// ================================================================
// 🔍 MAIN SEARCH FUNCTION - עם תיקון חכם לסינון דפי זבל
// ================================================================

async function searchPages(query, region = null, studyField = null) {
  console.log('========== [searchPages] START ==========');
  console.log(`🚀🚀🚀 CODE VERSION: FEB_17_v106_SMART_JUNK_FILTERING_FIX 🚀🚀🚀`);
  console.log('========================================');
  console.log(`Query: "${query}"`);
  console.log(`Region: ${region?.name || 'כל הארץ'}`);
  console.log(`Study Field: ${studyField?.name || 'כללי'}`);
  console.log('🎯 Query type: COURSES (חיפוש קורסים)');
  console.log('========================================');
  
  const pages = loadAllPages();
  const results = [];
  
  // דפטרנים לזיהוי דפי זבל - אלה יוסרו מהכותרת במקום לדחות את הדף
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
    const title = rawTitle.toLowerCase();
    const description = (page.description || '').toLowerCase();
    const rawContent = (page.text || '');
    const allHeadersText = ((page.h2 || []).join(' ') + ' ' + (page.h3 || []).join(' ')).toLowerCase();
    const url = (page.url || page.link || '').toLowerCase();
    
    // 🧹 נקה דפטרני זבל מהכותרת במקום לדחות את הדף
    let cleanedRawTitle = rawTitle;
    let cleanedTitle = title;
    
    // הסר דפטרנים של carousel/navigation מהכותרת
    for (const pattern of JUNK_TITLE_PATTERNS) {
      cleanedRawTitle = cleanedRawTitle.replace(new RegExp(pattern, 'gi'), '').trim();
      cleanedTitle = cleanedTitle.replace(new RegExp(pattern, 'gi'), '').trim();
    }
    
    // עכשיו בדוק אם זה באמת זבל אחרי הניקוי
    if (cleanedTitle.length === 0 || cleanedRawTitle.length < 3) {
      console.log(`  ❌ JUNK: "${rawTitle}" - no content after cleaning junk patterns`);
      continue;
    }
    if (!url || url.length < 10) {
      console.log(`  ❌ JUNK: "${rawTitle}" - invalid URL`);
      continue;
    }
    if (cleanedRawTitle.length < 10 && !description && !rawContent) {
      console.log(`  ❌ JUNK: "${rawTitle}" - no meaningful content after cleaning`);
      continue;
    }
    
    // השתמש בכותרת המנוקה לחיפוש
    const finalTitle = cleanedTitle;
    const finalRawTitle = cleanedRawTitle;
    
    console.log(`  🧼 "${rawTitle}" → "${finalRawTitle}" (cleaned)`);
    
    // 🧠 השתמש בחיפוש חכם עם ניקוי ניווט!
    const cleanedContent = cleanContentFromNavigation(rawContent, finalRawTitle, page.description || '');
    
    // סינון לפי תחום לימוד - משופר עם חיפוש חכם
    if (studyField) {
      const fieldNameLower = studyField.name.toLowerCase();
      const headerAndDesc = finalTitle + ' ' + description + ' ' + allHeadersText;
      
      let fieldFound = false;
      let searchLocation = '';
      
      if (studyField.specificKeyword) {
        // יש specificKeyword - חפש אותו בכל מקום
        const specificLower = studyField.specificKeyword.toLowerCase();
        
        if (finalTitle.includes(specificLower)) {
          fieldFound = true;
          searchLocation = 'title';
        } else if (description.includes(specificLower)) {
          fieldFound = true;
          searchLocation = 'description';
        } else if (allHeadersText.includes(specificLower)) {
          fieldFound = true;
          searchLocation = 'headers';
        } else if (cleanedContent.toLowerCase().includes(specificLower)) {
          fieldFound = true;
          searchLocation = 'clean_content';
        }
        
        if (!fieldFound) continue;
        
      } else {
        // אין specificKeyword - חפש את שם התחום
        const isGeneric = isGenericTerm(fieldNameLower);
        
        if (finalTitle.includes(fieldNameLower)) {
          fieldFound = true;
          searchLocation = 'title';
        } else if (description.includes(fieldNameLower)) {
          fieldFound = true;
          searchLocation = 'description'; 
        } else if (allHeadersText.includes(fieldNameLower)) {
          fieldFound = true;
          searchLocation = 'headers';
        } else if (!isGeneric && cleanedContent.toLowerCase().includes(fieldNameLower)) {
          fieldFound = true;
          searchLocation = 'clean_content';
          console.log(`  ℹ️ "${finalRawTitle}" - field found in cleaned content only`);
        } else {
          // אם זה גנרי ולא נמצא בכותרת/תיאור/headers - דחה
          if (isGeneric) continue;
          // אם זה לא גנרי ולא נמצא גם בתוכן המנוקה - דחה
          continue;
        }
      }
      
      console.log(`  ✅ "${finalRawTitle}" - field "${fieldNameLower}" found in ${searchLocation}`);
    }
    
    // חישוב Score מפורט ומדויק
    let matchScore = 0;
    
    if (studyField && studyField.specificKeyword) {
      const specificLower = studyField.specificKeyword.toLowerCase();
      if (finalTitle.includes(specificLower)) {
        matchScore += 150;
        console.log(`    [SCORE] +150 for specificKeyword "${studyField.specificKeyword}" in title`);
      } else if (description.includes(specificLower)) {
        matchScore += 100;
        console.log(`    [SCORE] +100 for specificKeyword "${studyField.specificKeyword}" in description`);
      } else {
        matchScore += 80;
        console.log(`    [SCORE] +80 for specificKeyword "${studyField.specificKeyword}"`);
      }
    } else if (studyField) {
      const fieldNameLower = studyField.name.toLowerCase();
      if (finalTitle.includes(fieldNameLower)) {
        matchScore += 100;
        console.log(`    [SCORE] +100 for field "${studyField.name}" in title`);
      } else if (description.includes(fieldNameLower)) {
        matchScore += 70;
        console.log(`    [SCORE] +70 for field "${studyField.name}" in description`);
      } else if (allHeadersText.includes(fieldNameLower)) {
        matchScore += 50;
        console.log(`    [SCORE] +50 for field "${studyField.name}" in headers`);
      } else {
        matchScore += 30;
        console.log(`    [SCORE] +30 for field "${studyField.name}" in content`);
      }
    }
    
    // זיהוי עיר ספציפית
    const specificCity = detectSpecificCity(query, region);
    let isInSpecificCity = false;
    
    if (specificCity && isStaticPage) {
      const location = (page.location || '').toLowerCase();
      const titleAndDesc = (finalTitle + ' ' + description + ' ' + url).toLowerCase();
      const cityLower = specificCity.toLowerCase().replace(/-/g, ' ');
      
      const inLocation = location.includes(cityLower);
      const inTitleOrDesc = titleAndDesc.includes(cityLower);
      
      if (inLocation || inTitleOrDesc) {
        isInSpecificCity = true;
        matchScore += 100;
        console.log(`    [SCORE] +100 for specific city "${specificCity}"`);
      }
    }
    
    let regionBonus = 0;
    
    // סינון לפי אזור - מדויק ומשופר
    if (region && region.cities && !isInSpecificCity) {
      const location = (page.location || '').toLowerCase();
      const fullText = cleanedContent; // השתמש בתוכן המנוקה
      const titleAndDesc = (finalTitle + ' ' + description + ' ' + fullText).toLowerCase().replace(/-/g, ' ');
      
      // בדיקה 1: האם ה-location מכיל עיר מהאזור?
      const hasRegionCityInLocation = region.cities.some(city => {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        return location.includes(cityLower);
      });
      
      if (location && location.trim() !== '') {
        // יש location - חייב להיות מהאזור הנכון או מרחוק
        if (!hasRegionCityInLocation) {
          const isRemote = isCourseRemote(page);
          
          if (isRemote) {
            // זה למידה מרחוק - בדוק שאין אזכור של אזור אחר
            let hasOtherRegion = false;
            
            if (REGIONS && Array.isArray(REGIONS)) {
              for (const otherRegion of REGIONS) {
                if (otherRegion.name === region.name) continue;
                
                for (const otherCity of otherRegion.cities || []) {
                  const otherCityLower = otherCity.toLowerCase().replace(/-/g, ' ');
                  if (titleAndDesc.includes(otherCityLower)) {
                    hasOtherRegion = true;
                    console.log(`    [REGION] Found other region city "${otherCity}" - rejecting`);
                    break;
                  }
                }
                
                if (hasOtherRegion) break;
              }
            }
            
            if (hasOtherRegion) {
              continue; // דף עם אזור אחר - נדחה!
            }
            
            // למידה מרחוק ללא אזור אחר - בדוק אזכור האזור המבוקש
            if (studyField && studyField.specificKeyword) {
              regionBonus = 10; // בונוס קטן למרחוק עם specific keyword
              console.log(`    [SCORE] +10 for remote learning with specific keyword`);
            } else {
              const mentionsRegion = titleAndDesc.includes(region.name.toLowerCase()) ||
                                     (region.keywords && region.keywords.some(k => titleAndDesc.includes(k.toLowerCase())));
              
              if (mentionsRegion) {
                regionBonus = 10;
                console.log(`    [SCORE] +10 for remote learning mentioning region`);
              } else {
                continue; // מרחוק בלי אזכור - דחה
              }
            }
          } else {
            console.log(`    [REGION] Not in region "${region.name}" and not remote - rejecting`);
            continue;
          }
        } else {
          regionBonus = isStaticPage ? 50 : 30;
          console.log(`    [SCORE] +${regionBonus} for being in region "${region.name}"`);
        }
      } else {
        // אין location - בדוק אזכור עיר או אזור בתוכן
        let cityMentioned = null;
        let cityRegion = null;
        let otherRegionMentioned = null;
        
        if (REGIONS && Array.isArray(REGIONS)) {
          // בדוק אזכור ערים
          for (const r of REGIONS) {
            for (const city of r.cities) {
              const cityLower = city.toLowerCase().replace(/-/g, ' ');
              if (titleAndDesc.includes(cityLower)) {
                cityMentioned = city;
                cityRegion = r.name;
                console.log(`    [REGION] Found city mention "${city}" from region "${r.name}"`);
                break;
              }
            }
            if (cityMentioned) break;
          }
          
          // בדוק אזכור אזורים אחרים
          if (!cityMentioned) {
            for (const r of REGIONS) {
              if (r.name === region.name) continue;
              
              const otherRegionName = r.name.toLowerCase();
              if (titleAndDesc.includes(otherRegionName)) {
                otherRegionMentioned = r.name;
                console.log(`    [REGION] Found other region mention "${r.name}"`);
                break;
              }
            }
          }
        }
        
        if (cityMentioned) {
          if (cityRegion === region.name) {
            regionBonus = 30;
            console.log(`    [SCORE] +30 for mentioning city "${cityMentioned}" in region`);
          } else {
            console.log(`    [REGION] City "${cityMentioned}" is from different region "${cityRegion}" - rejecting`);
            continue;
          }
        } else if (otherRegionMentioned) {
          console.log(`    [REGION] Mentions different region "${otherRegionMentioned}" - rejecting`);
          continue;
        } else {
          // אין אזכור עיר או אזור אחר - בדוק אזכור האזור המבוקש
          const regionMentioned = titleAndDesc.includes(region.name.toLowerCase()) ||
                                  (region.keywords && region.keywords.some(k => titleAndDesc.includes(k.toLowerCase())));
          
          if (regionMentioned) {
            regionBonus = 20;
            console.log(`    [SCORE] +20 for mentioning requested region`);
          } else {
            // אין אזכור של האזור המבוקש
            if (studyField && studyField.specificKeyword) {
              regionBonus = 0;
              console.log(`    [SCORE] +0 for no region mention but has specific keyword`);
            } else if (isStaticPage) {
              // בדוק אם המשתמש ביקש אזור ספציפי
              const queryLower = query.toLowerCase();
              const userRequestedSpecificRegion = 
                queryLower.includes('בצפון') || queryLower.includes('בדרום') ||
                queryLower.includes('במרכז') || queryLower.includes('בירושלים') ||
                queryLower.includes('בשפלה') || queryLower.includes('בשרון') ||
                queryLower.includes('בחיפה') || queryLower.includes('בגליל');
              
              if (userRequestedSpecificRegion) {
                console.log(`    [REGION] User requested specific region "${region.name}", no mention - REJECTED`);
                continue;
              } else {
                regionBonus = -10;
                console.log(`    [SCORE] -10 for static page without region mention`);
              }
            } else {
              console.log(`    [REGION] Info page without region mention - rejecting`);
              continue;
            }
          }
        }
      }
      
      matchScore += regionBonus;
    }
    
    // בדיקת תאריכים קרובים
    if (matchScore > 0 || isInfoPage) {
      let upcomingDate = page.upcomingDate || null;
      
      if (!upcomingDate && studyField) {
        const foundDate = findUpcomingDateInSchedule(page, studyField.name);
        if (foundDate) {
          upcomingDate = foundDate;
        }
      }
      
      let dateBonus = 0;
      if (upcomingDate && isUpcomingDate(upcomingDate)) {
        dateBonus = 200;
        matchScore += dateBonus;
        console.log(`    [SCORE] +200 for upcoming date: ${upcomingDate}`);
      }
      
      // בונוס לקורסים מרחוק כשמבוקש אזור
      if (region && isCourseRemote(page)) {
        const remoteBonus = 5;
        matchScore += remoteBonus;
        console.log(`    [SCORE] +${remoteBonus} for remote course when region requested`);
      }
      
      console.log(`  ✅ ADDED: "${finalRawTitle}"`);
      console.log(`     Final Score: ${matchScore} | Static: ${isStaticPage} | Location: "${page.location || 'N/A'}" | Remote: ${isCourseRemote(page)}`);
      
      results.push({
        ...page,
        title: finalRawTitle, // השתמש בכותרת המנוקה
        isStatic: isStaticPage,
        isInfo: isInfoPage,
        isInSpecificCity: isInSpecificCity,
        specificCity: isInSpecificCity ? specificCity : null,
        upcomingDate: upcomingDate,
        isRemote: isCourseRemote(page),
        score: matchScore
      });
    }
  }
  
  // מיון תוצאות - חכם ומדויק
  results.sort((a, b) => {
    // קודם כל - תאריכים קרובים
    const aHasUpcoming = a.upcomingDate && isUpcomingDate(a.upcomingDate);
    const bHasUpcoming = b.upcomingDate && isUpcomingDate(b.upcomingDate);
    
    if (aHasUpcoming && !bHasUpcoming) return -1;
    if (!aHasUpcoming && bHasUpcoming) return 1;
    
    // אחר כך לפי score
    if (b.score !== a.score) return b.score - a.score;
    
    // אחר כך static pages קודם
    if (a.isStatic && !b.isStatic) return -1;
    if (!a.isStatic && b.isStatic) return 1;
    
    // אחר כך עיר ספציפית
    if (a.isInSpecificCity && !b.isInSpecificCity) return -1;
    if (!a.isInSpecificCity && b.isInSpecificCity) return 1;
    
    // לבסוף - קורסים לא מרחוק קודם (אם יש אזור)
    if (region) {
      if (!a.isRemote && b.isRemote) return -1;
      if (a.isRemote && !b.isRemote) return 1;
    }
    
    return 0;
  });
  
  console.log(`[searchPages] ========== RESULTS ==========`);
  console.log(`Total: ${results.length} results found`);
  console.log(`Static: ${results.filter(r => r.isStatic).length}, Info: ${results.filter(r => r.isInfo).length}, Remote: ${results.filter(r => r.isRemote).length}`);
  console.log(`With upcoming dates: ${results.filter(r => r.upcomingDate && isUpcomingDate(r.upcomingDate)).length}`);
  console.log(`In specific city: ${results.filter(r => r.isInSpecificCity).length}`);
  console.log('[searchPages] ========== END ==========');
  
  return results;
}

// ================================================================
// 🌐 REMOTE LEARNING SEARCH - משופר ומלא
// ================================================================

async function searchRemoteLearning(studyField) {
  console.log('\n🌐 [searchRemoteLearning] START - Searching for remote learning alternatives...');
  
  if (!studyField) {
    console.log('  ⚠️ No study field provided');
    return [];
  }
  
  console.log(`  🔍 Looking for remote learning in field: "${studyField.name}"`);
  
  const pages = loadAllPages();
  const results = [];
  
  // דפטרנים לזיהוי דפי זבל - אותם דפטרנים שבחיפוש הראשי
  const JUNK_TITLE_PATTERNS = [
    'close carousel', 'carousel', 'next', 'prev', 'menu', 'navigation',
    'ינואר 2', 'פברואר 2', 'מרץ 2', 'אפריל 2', 'מאי 2', 'יוני 2',
    'יולי 2', 'אוגוסט 2', 'ספטמבר 2', 'אוקטובר 2', 'נובמבר 2', 'דצמבר 2'
  ];
  
  for (const page of pages) {
    const rawTitle = page.title || page.h1 || '';
    const title = rawTitle.toLowerCase().trim();
    const location = (page.location || '').toLowerCase();
    const description = (page.description || '').toLowerCase();
    const rawContent = (page.text || '');
    const url = (page.url || page.link || '').toLowerCase();
    
    // 🧹 נקה דפטרני זבל מהכותרת כמו בחיפוש הראשי
    let cleanedRawTitle = rawTitle;
    let cleanedTitle = title;
    
    for (const pattern of JUNK_TITLE_PATTERNS) {
      cleanedRawTitle = cleanedRawTitle.replace(new RegExp(pattern, 'gi'), '').trim();
      cleanedTitle = cleanedTitle.replace(new RegExp(pattern, 'gi'), '').trim();
    }
    
    // בדוק אם זה באמת זבל אחרי הניקוי
    if (cleanedTitle.length === 0 || cleanedRawTitle.length < 3) continue;
    if (!url || url.length < 10) continue;
    
    // בדוק אם זה למידה מרחוק
    const isRemote = isCourseRemote(page);
    if (!isRemote) continue;
    
    // 🧠 השתמש בחיפוש חכם עם ניקוי ניווט!
    const cleanedContent = cleanContentFromNavigation(rawContent, cleanedRawTitle, page.description || '');
    
    // בדוק אם יש את התחום
    const fieldLower = studyField.name.toLowerCase();
    const headerAndDesc = cleanedTitle + ' ' + description;
    
    let hasField = false;
    
    if (studyField.specificKeyword) {
      const specificLower = studyField.specificKeyword.toLowerCase();
      hasField = headerAndDesc.includes(specificLower) || 
                 cleanedContent.toLowerCase().includes(specificLower);
      
      if (hasField) {
        console.log(`  ✅ Remote course found: "${cleanedRawTitle}" - contains specificKeyword "${studyField.specificKeyword}"`);
      }
    } else {
      hasField = headerAndDesc.includes(fieldLower) || 
                 cleanedContent.toLowerCase().includes(fieldLower);
      
      if (hasField) {
        console.log(`  ✅ Remote course found: "${cleanedRawTitle}" - contains field "${studyField.name}"`);
      }
    }
    
    if (hasField) {
      // חישוב score לקורסים מרחוק
      let remoteScore = 50; // base score
      
      if (cleanedTitle.includes(fieldLower) || (studyField.specificKeyword && cleanedTitle.includes(studyField.specificKeyword.toLowerCase()))) {
        remoteScore += 30;
      } else if (description.includes(fieldLower) || (studyField.specificKeyword && description.includes(studyField.specificKeyword.toLowerCase()))) {
        remoteScore += 20;
      }
      
      // בונוס לתאריכים קרובים
      const upcomingDate = findUpcomingDateInSchedule(page, studyField.name);
      if (upcomingDate && isUpcomingDate(upcomingDate)) {
        remoteScore += 100;
        console.log(`    [REMOTE] +100 for upcoming date: ${upcomingDate}`);
      }
      
      results.push({
        ...page,
        title: cleanedRawTitle, // השתמש בכותרת המנוקה
        isRemote: true,
        upcomingDate: upcomingDate,
        score: remoteScore
      });
    }
  }
  
  // מיון תוצאות מרחוק
  results.sort((a, b) => {
    // תאריכים קרובים קודם
    const aHasUpcoming = a.upcomingDate && isUpcomingDate(a.upcomingDate);
    const bHasUpcoming = b.upcomingDate && isUpcomingDate(b.upcomingDate);
    
    if (aHasUpcoming && !bHasUpcoming) return -1;
    if (!aHasUpcoming && bHasUpcoming) return 1;
    
    // אחר כך לפי score
    return b.score - a.score;
  });
  
  const finalResults = results.slice(0, 3); // מקסימום 3
  
  console.log(`  📊 Found ${results.length} remote learning options, returning top ${finalResults.length}`);
  finalResults.forEach((result, index) => {
    console.log(`    ${index + 1}. "${result.title || result.h1}" (score: ${result.score})`);
  });
  
  console.log('[searchRemoteLearning] ========== END ==========');
  return finalResults;
}

// ================================================================
// 💬 QA SYSTEM
// ================================================================

function findQAAnswer(message) {
  loadConfigs();
  
  console.log(`🔍 [findQAAnswer] Searching for QA answer: "${message}"`);
  
  const lowerMessage = message.toLowerCase();
  
  // חפש ב-courses QA
  if (COURSES_QA && COURSES_QA.questions) {
    console.log(`  📚 Searching in ${COURSES_QA.questions.length} courses QA entries...`);
    
    for (const q of COURSES_QA.questions) {
      // חיפוש לפי שאלה ישירה
      if (q.question && lowerMessage.includes(q.question.toLowerCase())) {
        console.log(`  ✅ Found by question: "${q.question}"`);
        return { answer: q.answer, source: 'courses' };
      }
      
      // חיפוש לפי variations
      if (q.variations) {
        for (const variation of q.variations) {
          if (lowerMessage.includes(variation.toLowerCase())) {
            console.log(`  ✅ Found by variation: "${variation}"`);
            return { answer: q.answer, source: 'courses' };
          }
        }
      }
      
      // חיפוש לפי keywords (צריך לפחות 2 keywords)
      if (q.keywords) {
        const keywordMatches = q.keywords.filter(k => lowerMessage.includes(k.toLowerCase()));
        if (keywordMatches.length >= 2) {
          console.log(`  ✅ Found by keywords: [${keywordMatches.join(', ')}]`);
          return { answer: q.answer, source: 'courses' };
        }
      }
    }
  }
  
  // חפש ב-payments QA
  if (PAYMENTS_QA && PAYMENTS_QA.categories) {
    console.log(`  💰 Searching in ${PAYMENTS_QA.categories.length} payments QA categories...`);
    
    for (const category of PAYMENTS_QA.categories) {
      if (category.questions) {
        for (const q of category.questions) {
          // חיפוש לפי שאלה ישירה
          if (q.question && lowerMessage.includes(q.question.toLowerCase())) {
            console.log(`  ✅ Found in payments by question: "${q.question}"`);
            return { answer: q.answer, source: 'payments', category: category.category };
          }
          
          // חיפוש לפי variations
          if (q.variations) {
            for (const variation of q.variations) {
              if (lowerMessage.includes(variation.toLowerCase())) {
                console.log(`  ✅ Found in payments by variation: "${variation}"`);
                return { answer: q.answer, source: 'payments', category: category.category };
              }
            }
          }
        }
      }
    }
  }
  
  console.log('  ❌ No QA answer found');
  return null;
}

function classifyIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  console.log(`🎯 [classifyIntent] Analyzing: "${message}"`);
  
  // שאלות ספציפיות - QA
  const qaKeywords = ['כמה', 'מתי', 'איך', 'מה זה', 'האם', 'מי', 'למה', 'איפה', 'מה'];
  const hasQAKeyword = qaKeywords.some(k => lowerMessage.includes(k));
  
  if (hasQAKeyword) {
    console.log(`  🤔 Contains QA keyword, checking for answer...`);
    const qaAnswer = findQAAnswer(message);
    if (qaAnswer) {
      console.log(`  ✅ Found QA answer from ${qaAnswer.source}`);
      return { intent: 'qa', data: qaAnswer };
    }
  }
  
  // חיפוש קורסים
  const searchKeywords = ['קורס', 'לימוד', 'השתלמות', 'תואר', 'מכללה', 'לימודים'];
  if (searchKeywords.some(k => lowerMessage.includes(k))) {
    console.log(`  🔍 Classified as search intent`);
    return { intent: 'search', data: null };
  }
  
  console.log(`  🗣️ Classified as general intent`);
  return { intent: 'general', data: null };
}

// ================================================================
// 🎨 RESPONSE FORMATTING
// ================================================================

function formatResults(results, studyField, region) {
  if (results.length === 0) return '';
  
  let response = '';
  const fieldName = studyField?.specificKeyword || studyField?.name || 'הקורסים';
  const regionName = region?.name || 'כל הארץ';
  
  // כותרת ראשית
  response += `מצאתי ${results.length} מוסדות`;
  if (region) response += ` ב${regionName}`;
  response += ` ל${fieldName}:\n\n`;
  
  // הוסף תוצאות
  let addedResults = 0;
  for (const result of results) {
    if (addedResults >= 6) break; // מקסימום 6 תוצאות
    
    const title = result.title || result.h1 || 'ללא שם';
    const desc = result.description || 'אין תיאור זמין';
    const url = result.url || result.link || '#';
    const location = result.location || '';
    
    // אייקון לפי סוג
    let icon = '🏢';
    if (result.isRemote) icon = '🌐';
    else if (result.upcomingDate && isUpcomingDate(result.upcomingDate)) icon = '📅';
    else if (result.isInSpecificCity) icon = '📍';
    
    response += `${icon} **${title}**\n`;
    
    // הוסף מיקום אם קיים
    if (location) {
      response += `📍 ${location}\n`;
    }
    
    // הוסף תאריך קרוב אם קיים
    if (result.upcomingDate && isUpcomingDate(result.upcomingDate)) {
      response += `📅 תאריך קרוב: ${result.upcomingDate}\n`;
    }
    
    // תיאור קצר
    const shortDesc = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;
    response += `${shortDesc}\n`;
    
    response += `[למידע מלא וייעוץ אישי](${url})\n\n`;
    
    addedResults++;
  }
  
  // קישורים נוספים
  const slug = studyField?.slug || 'courses';
  response += `💡 **קישורים נוספים:**\n`;
  response += `[לכל הקורסים ב${fieldName}](https://www.shabaton.online/${slug})`;
  
  if (region && region.slug) {
    response += ` | [קורסים ב${regionName}](https://www.shabaton.online/${region.slug})`;
  }
  
  return response;
}

function formatRemoteResults(results, studyField) {
  if (results.length === 0) return '';
  
  const fieldName = studyField?.specificKeyword || studyField?.name || 'התחום';
  
  let response = `\n\n🌐 **למידה מרחוק ב${fieldName}:**\n\n`;
  response += `מצאתי אפשרויות למידה מרחוק שיכולות להתאים לך:\n\n`;
  
  for (const result of results) {
    const title = result.title || result.h1 || 'ללא שם';
    const desc = result.description || '';
    const url = result.url || result.link || '#';
    
    response += `📚 **${title}**\n`;
    
    // הוסף תאריך קרוב אם קיים
    if (result.upcomingDate && isUpcomingDate(result.upcomingDate)) {
      response += `📅 תאריך קרוב: ${result.upcomingDate}\n`;
    }
    
    if (desc) {
      const shortDesc = desc.length > 120 ? desc.substring(0, 120) + '...' : desc;
      response += `${shortDesc}\n`;
    }
    
    response += `[למידע נוסף והרשמה](${url})\n\n`;
  }
  
  return response;
}

// ================================================================
// 🎯 MAIN HANDLER
// ================================================================

async function generateSmartResponse(message) {
  console.log('========================================');
  console.log('🚀 [generateSmartResponse] START');
  console.log('🚀🚀🚀 CODE VERSION: FEB_17_v106_SMART_JUNK_FILTERING_FIX 🚀🚀🚀');
  console.log('========================================');
  console.log(`📝 Input message: "${message}"`);
  
  loadConfigs();
  
  // בדוק QA ראשון
  const qaAnswer = findQAAnswer(message);
  if (qaAnswer) {
    console.log('✅ שאלה ספציפית נמצאה - מחזיר תשובה מ-QA');
    return qaAnswer.answer;
  }
  
  console.log('⚠️ לא שאלה ספציפית - ממשיך לחיפוש קורסים');
  
  // זהה תחום ואזור
  const detectedFields = detectStudyField(message);
  const studyField = detectedFields[0] || null;
  const region = detectRegion(message);
  
  console.log(`📊 Detection Results:`);
  console.log(`   Study Field: ${studyField ? studyField.name + (studyField.specificKeyword ? ` (${studyField.specificKeyword})` : '') : 'None'}`);
  console.log(`   Region: ${region ? region.name : 'None'}`);
  
  const intentInfo = classifyIntent(message);
  console.log(`🎯 [Intent Classification] Result: ${intentInfo.intent}`);
  
  if (intentInfo.intent === 'search') {
    console.log('🔍 === התחלת תהליך חיפוש קורסים ===');
    
    if (studyField) {
      console.log(`✅ תחום זוהה: "${studyField.name}"`);
      if (studyField.specificKeyword) {
        console.log(`   🎯 Specific keyword: "${studyField.specificKeyword}"`);
      }
    } else {
      console.log('⚠️ לא זוהה תחום ספציפי');
    }
    
    if (region) {
      console.log(`🌍 אזור זוהה: "${region.name}"`);
      console.log(`🔍 מחפש מוסדות עבור:`);
      console.log(`   תחום: ${studyField?.name || 'כללי'}`);
      console.log(`   אזור: ${region.name}`);
    } else {
      console.log('🌍 חיפוש בכל הארץ');
    }
    
    // בצע חיפוש
    const results = await searchPages(message, region, studyField);
    
    console.log(`📊 תוצאות חיפוש: ${results.length} מוסדות נמצאו`);
    
    if (results.length > 0) {
      // יש תוצאות!
      console.log('✅ נמצאו תוצאות - מכין תגובה');
      const topResults = results.slice(0, 6); // מקסימום 6
      return formatResults(topResults, studyField, region);
      
    } else {
      // אין תוצאות - נסה למידה מרחוק
      console.log('⚠️ אין תוצאות ישירות - בודק למידה מרחוק...');
      
      if (studyField) {
        const remoteResults = await searchRemoteLearning(studyField);
        
        if (remoteResults.length > 0) {
          // יש למידה מרחוק!
          console.log(`✅ נמצאו ${remoteResults.length} אפשרויות למידה מרחוק`);
          
          let response = `לא מצאתי מוסדות`;
          if (region) response += ` ב${region.name}`;
          response += ` ל${studyField.specificKeyword || studyField.name}.\n`;
          
          response += formatRemoteResults(remoteResults, studyField);
          
          return response;
        }
      }
      
      // אין כלום
      console.log('❌ לא נמצא כלום - מחזיר הודעת "לא נמצא"');
      
      let response = `מצטער, לא מצאתי מוסדות`;
      if (region) response += ` ב${region.name}`;
      if (studyField) response += ` ל${studyField.specificKeyword || studyField.name}`;
      response += `.\n\n`;
      
      response += `💡 **הצעות:**\n`;
      response += `• נסה לחפש באזור אחר\n`;
      response += `• חפש קורסים דומים או קרובים\n`;
      response += `• בדוק את [כל הקורסים בשבתון](https://www.shabaton.online/courses)\n`;
      response += `• ליצור קשר ישיר עם המוסדות\n\n`;
      response += `📞 **צריך עזרה?** [צור קשר איתנו](https://www.shabaton.online/contact)`;
      
      return response;
    }
  }
  
  // תגובה כללית
  console.log('💬 מחזיר תגובה כללית');
  return `היי! 👋\n\nאני כאן לעזור לך למצוא קורסים והשתלמויות למורים בשבתון.\n\n**אפשר לשאול אותי על:**\n• קורסים ספציפיים (צילום, פסיכולוגיה, טכנולוגיה...)\n• קורסים באזור שלך (צפון, דרום, מרכז...)\n• שאלות על התשלומים והרישום\n• מידע כללי על שבתון\n\n**דוגמאות לשאלות:**\n• "קורס פסיכולוגיה בצפון"\n• "למידה מרחוק בטכנולוגיה"\n• "כמה עולה קורס?"\n\n[🌐 כל הקורסים בשבתון](https://www.shabaton.online/courses)`;
}

// ================================================================
// 🌐 VERCEL HANDLER
// ================================================================

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  // ✅ CORS Headers - תמיכה מלאה
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // ✅ OPTIONS Preflight - חובה לCORS
  if (req.method === 'OPTIONS') {
    console.log('✅ [handler] OPTIONS preflight - returning 200');
    return res.status(200).end();
  }
  
  const body = req.body || {};
  
  console.log('📨 [handler] New request received');
  console.log(`   Method: ${req.method}`);
  console.log(`   Body preview: ${JSON.stringify(body).substring(0, 200)}${JSON.stringify(body).length > 200 ? '...' : ''}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'Unknown'}`);
  
  if (req.method !== 'POST') {
    console.error(`❌ Method ${req.method} not allowed`);
    return res.status(405).json({ 
      error: 'Method not allowed', 
      allowed: ['POST', 'OPTIONS'] 
    });
  }
  
  const { message } = body;
  
  if (!message || typeof message !== 'string') {
    console.error(`❌ Invalid message: "${message}" (type: ${typeof message})`);
    return res.status(400).json({ 
      error: 'Invalid message - string required',
      received: {
        type: typeof message,
        value: message
      }
    });
  }
  
  if (message.length > 500) {
    console.error(`❌ Message too long: ${message.length} characters`);
    return res.status(400).json({ 
      error: 'Message too long - maximum 500 characters',
      length: message.length
    });
  }
  
  console.log(`📨 [handler] Processing message: "${message}"`);
  
  try {
    const startTime = Date.now();
    
    const response = await generateSmartResponse(message);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`✅ [handler] Response generated successfully`);
    console.log(`   Response length: ${response.length} characters`);
    console.log(`   Processing time: ${processingTime}ms`);
    
    return res.status(200).json({
      reply: response,
      timestamp: new Date().toISOString(),
      processingTime: processingTime,
      version: 'FEB_17_v106_SMART_JUNK_FILTERING_FIX'
    });
    
  } catch (error) {
    console.error('❌ [handler] CRITICAL ERROR:', error);
    console.error('Stack trace:', error.stack);
    
    return res.status(500).json({ 
      error: 'Internal server error - please try again',
      message: error.message,
      timestamp: new Date().toISOString(),
      version: 'FEB_17_v106_SMART_JUNK_FILTERING_FIX'
    });
  }
}/ ================================================================
// 🎯 chat.js v106 - SMART JUNK FILTERING FIX
// ================================================================
// VERSION: FEB_17_v106_SMART_JUNK_FILTERING_FIX
// Created: 2026-02-17
// 
// תיקון קריטי: במקום לדחות דפים עם "close carousel"
// נקה את הטקסט ותמשיך עם החיפוש
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

// ================================================================
// 🔄 DATA LOADING FUNCTIONS
// ================================================================

function loadConfigs() {
  try {
    if (!REGIONS) {
      const regionsPath = path.join(process.cwd(), 'data', 'regions.json');
      const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
      REGIONS = regionsData.regions;
      console.log(`✅ נטען regions.json: ${REGIONS.length} אזורים`);
    }
    
    if (!STUDY_FIELDS) {
      const fieldsPath = path.join(process.cwd(), 'data', 'study-fields.json');
      const fieldsData = JSON.parse(fs.readFileSync(fieldsPath, 'utf8'));
      STUDY_FIELDS = fieldsData.studyFields;
      console.log(`✅ נטען study-fields.json: ${STUDY_FIELDS.length} תחומים`);
    }
    
    if (!REQUIRED_PHRASES) {
      const phrasesPath = path.join(process.cwd(), 'data', 'required-phrases.json');
      const phrasesData = JSON.parse(fs.readFileSync(phrasesPath, 'utf8'));
      REQUIRED_PHRASES = phrasesData.requiredPhrases || [];
      console.log(`✅ נטען required-phrases.json: ${REQUIRED_PHRASES.length} ביטויים`);
    }
    
    if (!COURSES_QA) {
      const coursesQaPath = path.join(process.cwd(), 'data', 'courses-qa.json');
      const coursesQaData = JSON.parse(fs.readFileSync(coursesQaPath, 'utf8'));
      COURSES_QA = coursesQaData;
      console.log(`✅ נטען courses-qa.json: ${coursesQaData.questions?.length || 0} שאלות`);
    }
    
    if (!PAYMENTS_QA) {
      const paymentsQaPath = path.join(process.cwd(), 'data', 'payments-qa.json');
      const paymentsQaData = JSON.parse(fs.readFileSync(paymentsQaPath, 'utf8'));
      PAYMENTS_QA = paymentsQaData;
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
    const semanticJson = JSON.parse(fs.readFileSync(semanticPath, 'utf8'));
    SEMANTIC_DATA = semanticJson;
    console.log(`✅ [Semantic] Loaded: ${Object.keys(semanticJson.synonyms || {}).length} synonyms`);
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
  console.log(`📁 Working directory: ${process.cwd()}`);
  
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
      console.log(`Trying to load: ${filePath}`);
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const pagesArray = Array.isArray(data) ? data : (data.pages || []);
      
      pages.push(...pagesArray);
      console.log(`✅ Loaded ${pagesArray.length} pages from ${filename}`);
    } catch (error) {
      console.log(`⚠️ Could not load ${filename}: ${error.message}`);
    }
  }
  
  console.log(`✅ Total loaded: ${pages.length} pages`);
  
  // הסר כפילויות
  const uniquePages = [];
  const seenUrls = new Set();
  
  for (const page of pages) {
    const url = page.url || page.link || '';
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniquePages.push(page);
    }
  }
  
  console.log(`⚠️ Removed ${pages.length - uniquePages.length} duplicates`);
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
  
  // 1. הסר דפטרנים ברורים של ניווט/carousel
  const navigationPatterns = [
    /close carousel/gi,
    /carousel/gi,
    /navigation/gi,
    /menu/gi,
    /תפריט/gi,
    /ניווט/gi,
    /next/gi,
    /prev/gi,
    /previous/gi,
    
    // דפטרנים של תאריכים שחוזרים בניווט
    /(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{4}/gi,
    
    // דפטרנים של רשימות קטגוריות ארוכות
    /צילום\s+(פסיכולוגיה|טכנולוגיה|רפואה|אמנות|חינוך|תרפיה|גיל\s+רך)/gi,
    /פסיכולוגיה\s+(צילום|טכנולוגיה|רפואה|אמנות|חינוך|תרפיה|גיל\s+רך)/gi,
    /טכנולוגיה\s+(צילום|פסיכולוגיה|רפואה|אמנות|חינוך|תרפיה|גיל\s+רך)/gi,
  ];
  
  // הסר דפטרנים בסיסיים
  navigationPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, ' ');
  });
  
  // 2. זיהוי וסינון רשימות קטגוריות ארוכות
  const categoryTerms = [
    'צילום', 'פוטותרפיה', 'פסיכולוגיה', 'טכנולוגיה', 'רפואה משלימה', 
    'אמנות', 'אומנויות', 'חינוך', 'הוראה', 'תרפיה', 'טיפול',
    'גיל רך', 'הנחיית קבוצות', 'תקשורת', 'העצמה', 'לקויות למידה',
    'פיתוח מקצועי', 'למידה מרחוק', 'תואר שני', 'השתלמות'
  ];
  
  // ספור קטגוריות ברצף
  const words = cleaned.split(/\s+/);
  let categoryCount = 0;
  let consecutiveCategories = 0;
  let maxConsecutive = 0;
  let categoryPositions = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length < 3) continue;
    
    const isCategory = categoryTerms.some(cat => {
      const catWords = cat.toLowerCase().split(/\s+/);
      if (catWords.length === 1) {
        return word.includes(catWords[0]) || catWords[0].includes(word);
      } else {
        // מונח מרובה מילים כמו "גיל רך"
        const wordsAround = words.slice(Math.max(0, i-1), i+2).join(' ');
        return wordsAround.includes(cat.toLowerCase());
      }
    });
    
    if (isCategory) {
      consecutiveCategories++;
      categoryCount++;
      categoryPositions.push(i);
      maxConsecutive = Math.max(maxConsecutive, consecutiveCategories);
    } else {
      consecutiveCategories = 0;
    }
  }
  
  // אם יש הרבה קטגוריות ברצף - זה כנראה ניווט
  const isNavigationHeavy = categoryCount > 6 || maxConsecutive > 4;
  
  if (isNavigationHeavy) {
    console.log(`  🧹 [CleanContent] "${title.substring(0, 50)}..." - Heavy navigation detected: ${categoryCount} categories, max ${maxConsecutive} consecutive`);
    
    // מצא מילים ייחודיות לדף הזה
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const descWords = (description || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const uniqueWords = [...new Set([...titleWords, ...descWords])];
    
    // חלק את התוכן למשפטים ושמור רק את הרלוונטיים
    const sentences = cleaned.split(/[.!?]+/);
    const relevantSentences = sentences.filter(sentence => {
      if (sentence.length < 30) return false; // משפטים קצרים מדי
      
      const sentenceWords = sentence.split(/\s+/);
      
      // ספור קטגוריות במשפט
      const categoryInSentence = sentenceWords.filter(w => 
        categoryTerms.some(cat => w.includes(cat.toLowerCase()) || cat.toLowerCase().includes(w))
      ).length;
      
      // ספור מילים ייחודיות במשפט
      const uniqueInSentence = sentenceWords.filter(w =>
        uniqueWords.some(unique => w.includes(unique) || unique.includes(w))
      ).length;
      
      // שמור משפט אם:
      // - יש בו מילים ייחודיות (מהכותרת/תיאור)
      // - אין יותר מ-3 קטגוריות (כנראה לא ניווט)
      return uniqueInSentence > 0 && categoryInSentence <= 3;
    });
    
    if (relevantSentences.length > 0) {
      cleaned = relevantSentences.join('. ');
      console.log(`  🎯 [CleanContent] Filtered to ${relevantSentences.length}/${sentences.length} sentences (${Math.round(cleaned.length/originalLength*100)}% kept)`);
    } else {
      // אם לא נמצא כלום רלוונטי, שמור את הכותרת והתיאור בלבד
      cleaned = (title + ' ' + description).toLowerCase();
      console.log(`  ⚠️ [CleanContent] No relevant sentences found, using title+description only`);
    }
  }
  
  // 3. הסר טקסט חוזר שמופיע בכל הדפים
  const commonRepeatedText = [
    'שבתון קורסים והשתלמויות למורים',
    'למורים לגננות ולקהל הרחב',
    'קורסים מוכרים משרד החינוך',
    'בהשתתפות משרד החינוך',
    'עוז לתמורה',
    'אופק חדש',
    'כל הזכויות שמורות'
  ];
  
  commonRepeatedText.forEach(repeated => {
    const pattern = new RegExp(repeated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleaned = cleaned.replace(pattern, ' ');
  });
  
  // 4. נקה רווחים מרובים
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// ================================================================
// 🧠 SEMANTIC ANALYSIS SYSTEM v2.0
// ================================================================

function buildWordGraph() {
  if (WORD_GRAPH) return WORD_GRAPH;
  
  loadSemanticData();
  loadConfigs();
  
  const wordGraph = new Map();
  
  // 1. הוסף מ-semantic-mappings.json
  if (SEMANTIC_DATA && SEMANTIC_DATA.synonyms) {
    for (const [mainTerm, data] of Object.entries(SEMANTIC_DATA.synonyms)) {
      const allTerms = [mainTerm, ...(data.variations || [])];
      
      for (const term of allTerms) {
        const termLower = term.toLowerCase();
        if (!wordGraph.has(termLower)) {
          wordGraph.set(termLower, new Set());
        }
        
        // הוסף כל הוריאציות
        allTerms.forEach(t => {
          if (t.toLowerCase() !== termLower) {
            wordGraph.get(termLower).add(t);
          }
        });
        
        // הוסף את המונח הראשי
        wordGraph.get(termLower).add(mainTerm);
      }
    }
  }
  
  // 2. הוסף מ-required-phrases.json
  if (REQUIRED_PHRASES) {
    for (const phraseEntry of REQUIRED_PHRASES) {
      const mainPhrase = phraseEntry.phrase;
      const variations = phraseEntry.variations || [];
      const allPhrases = [mainPhrase, ...variations];
      
      for (const phrase of allPhrases) {
        const phraseLower = phrase.toLowerCase();
        if (!wordGraph.has(phraseLower)) {
          wordGraph.set(phraseLower, new Set());
        }
        
        allPhrases.forEach(p => {
          if (p.toLowerCase() !== phraseLower) {
            wordGraph.get(phraseLower).add(p);
          }
        });
        
        wordGraph.get(phraseLower).add(mainPhrase);
      }
    }
  }
  
  // 3. הוסף מ-study-fields.json
  if (STUDY_FIELDS) {
    for (const field of STUDY_FIELDS) {
      const keywords = field.keywords || [];
      const allTerms = [field.name, ...keywords];
      
      for (const term of allTerms) {
        const termLower = term.toLowerCase();
        if (!wordGraph.has(termLower)) {
          wordGraph.set(termLower, new Set());
        }
        
        wordGraph.get(termLower).add(field.name);
      }
    }
  }
  
  WORD_GRAPH = wordGraph;
  console.log(`🧠 [buildWordGraph] Built unified graph with ${wordGraph.size} terms`);
  return wordGraph;
}

function expandQuerySemantically(query) {
  if (!WORD_GRAPH) {
    buildWordGraph();
  }
  
  loadSemanticData();
  
  const expanded = new Set([query]);
  const queryLower = query.toLowerCase();
  
  // שלב 1: הרחב מהגרף המאוחד
  for (const [term, relatedTerms] of WORD_GRAPH.entries()) {
    if (queryLower.includes(term)) {
      relatedTerms.forEach(rt => expanded.add(rt));
    }
  }
  
  // שלב 2: זיהוי כוונות מ-intentPatterns
  if (SEMANTIC_DATA && SEMANTIC_DATA.intentPatterns) {
    for (const [intentType, intentData] of Object.entries(SEMANTIC_DATA.intentPatterns)) {
      const patterns = intentData.patterns || [];
      
      const hasPattern = patterns.some(pattern => 
        queryLower.includes(pattern.toLowerCase())
      );
      
      if (hasPattern && intentData.problemToSolution) {
        for (const [problem, solutions] of Object.entries(intentData.problemToSolution)) {
          if (queryLower.includes(problem.toLowerCase())) {
            console.log(`  🎯 [Intent] Detected: "${problem}" → [${solutions.join(', ')}]`);
            solutions.forEach(sol => expanded.add(sol));
          }
        }
      }
    }
  }
  
  const result = Array.from(expanded);
  console.log(`  🧠 [Semantic Expansion] "${query}" → [${result.slice(0, 6).join(', ')}${result.length > 6 ? '...' : ''}]`);
  
  return result;
}

function isGenericTerm(term) {
  loadSemanticData();
  
  // רשימת מונחים גנריים מוגדרת מראש
  const defaultGenericTerms = ['סטודיו', 'studio', 'לימוד', 'קורס', 'טיפול', 'תרפיה'];
  
  if (!SEMANTIC_DATA || !SEMANTIC_DATA.genericTerms) {
    return defaultGenericTerms.includes(term.toLowerCase());
  }
  
  return SEMANTIC_DATA.genericTerms.includes(term.toLowerCase()) || 
         defaultGenericTerms.includes(term.toLowerCase());
}

// ================================================================
// 🔍 SEARCH & DETECTION FUNCTIONS
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
  
  // שלב 1: חפש התאמה מדויקת לשם תחום
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue; // דלג על למידה מרחוק
    
    const fieldNameLower = field.name.toLowerCase();
    
    if (lowerMessage.includes(fieldNameLower) || 
        expandedTerms.some(term => fieldNameLower.includes(term.toLowerCase()))) {
      console.log(`✅ Found exact field name: "${field.name}"`);
      return [{ ...field, specificKeyword: null }];
    }
  }
  
  // שלב 2: חפש keywords עם ניקוד חכם
  let bestMatch = null;
  const tooGenericKeywords = ['למידה', 'לימוד', 'קורס', 'קורסים', 'השתלמות', 'תואר'];
  
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    if (!field.keywords || !Array.isArray(field.keywords)) continue;
    
    for (const keyword of field.keywords) {
      if (!keyword || tooGenericKeywords.includes(keyword.toLowerCase())) continue;
      
      const keywordLower = keyword.toLowerCase();
      const foundInMessage = lowerMessage.includes(keywordLower);
      const foundInExpanded = expandedTerms.some(term => 
        term.toLowerCase().includes(keywordLower) || 
        keywordLower.includes(term.toLowerCase())
      );
      
      if (foundInMessage || foundInExpanded) {
        const keywordLength = keywordLower.length;
        
        if (!bestMatch || keywordLength > bestMatch.length) {
          bestMatch = {
            field: field,
            keyword: keyword,
            length: keywordLength,
            foundVia: foundInMessage ? 'direct' : 'semantic'
          };
        }
      }
    }
  }
  
  if (bestMatch) {
    console.log(`✅ Found keyword: "${bestMatch.keyword}" in field: "${bestMatch.field.name}" (via: ${bestMatch.foundVia})`);
    
    // מצא את המילה המלאה ב-query
    const words = lowerMessage.split(/\s+/);
    const keywordLower = bestMatch.keyword.toLowerCase();
    let fullWord = bestMatch.keyword;
    
    if (bestMatch.foundVia === 'semantic') {
      // אם נמצא דרך הרחבה סמנטית, חפש את המילה המקורית
      for (const expandedTerm of expandedTerms) {
        for (const word of words) {
          const cleanWord = word.replace(/[,\.!\?;:]/g, '');
          if (cleanWord.includes(expandedTerm.toLowerCase()) || 
              expandedTerm.toLowerCase().includes(cleanWord)) {
            fullWord = cleanWord;
            console.log(`  🔍 [Semantic] Found original term: "${fullWord}"`);
            break;
          }
        }
        if (fullWord !== bestMatch.keyword) break;
      }
    } else {
      // נמצא ישירות, חפש את המילה המלאה
      for (const word of words) {
        const cleanWord = word.replace(/[,\.!\?;:]/g, '');
        if (cleanWord.includes(keywordLower)) {
          fullWord = cleanWord;
          console.log(`  🔍 Found full word: "${fullWord}"`);
          break;
        }
      }
    }
    
    return [{ 
      ...bestMatch.field, 
      specificKeyword: fullWord
    }];
  }
  
  console.log('❌ No study field detected');
  return [];
}

function detectRegion(message) {
  loadConfigs();
  
  if (!REGIONS || !Array.isArray(REGIONS)) return null;
  
  const lowerMessage = message.toLowerCase().replace(/-/g, ' ');
  
  // חפש לפי שם אזור
  for (const region of REGIONS) {
    if (lowerMessage.includes(region.name.toLowerCase())) {
      console.log(`✅ [detectRegion] Found region by name: "${region.name}"`);
      return region;
    }
    
    // חפש לפי keywords
    if (region.keywords) {
      for (const keyword of region.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          console.log(`✅ [detectRegion] Found region by keyword: "${keyword}" → "${region.name}"`);
          return region;
        }
      }
    }
    
    // חפש לפי ערים
    if (region.cities) {
      for (const city of region.cities) {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        if (lowerMessage.includes(cityLower)) {
          console.log(`✅ [detectRegion] Found region by city: "${city}" → "${region.name}"`);
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
  
  const queryLower = query.toLowerCase().replace(/-/g, ' ');
  
  for (const city of region.cities) {
    const cityLower = city.toLowerCase().replace(/-/g, ' ');
    if (queryLower.includes(cityLower)) {
      console.log(`✅ [detectSpecificCity] Found specific city: "${city}" in region "${region.name}"`);
      return city;
    }
  }
  
  return null;
}

// ================================================================
// 📅 DATE & TIME UTILITIES
// ================================================================

function findUpcomingDateInSchedule(page, fieldName) {
  if (!page.text || !fieldName) return null;
  
  const text = page.text.toLowerCase();
  const fieldLower = fieldName.toLowerCase();
  
  // חפש דפטרנים של תאריכים
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
    /(\d{1,2}\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{2,4})/g
  ];
  
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const matchIndex = text.indexOf(match);
        const contextBefore = text.substring(Math.max(0, matchIndex - 100), matchIndex);
        const contextAfter = text.substring(matchIndex, matchIndex + 100);
        
        if (contextBefore.includes(fieldLower) || contextAfter.includes(fieldLower)) {
          console.log(`  📅 Found upcoming date: "${match}" for field "${fieldName}"`);
          return match;
        }
      }
    }
  }
  
  return null;
}

function isUpcomingDate(dateString) {
  if (!dateString) return false;
  
  const today = new Date();
  const twoMonthsFromNow = new Date();
  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
  
  let parsedDate;
  
  // דפטרן DD/MM/YYYY או DD-MM-YYYY
  const dateMatch = dateString.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    let year = parseInt(dateMatch[3]);
    if (year < 100) year += 2000;
    
    parsedDate = new Date(year, month, day);
  }
  
  // דפטרן עברי
  const hebrewMonths = {
    'ינואר': 0, 'פברואר': 1, 'מרץ': 2, 'אפריל': 3,
    'מאי': 4, 'יוני': 5, 'יולי': 6, 'אוגוסט': 7,
    'ספטמבר': 8, 'אוקטובר': 9, 'נובמבר': 10, 'דצמבר': 11
  };
  
  const hebrewMatch = dateString.match(/(\d{1,2})\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(\d{2,4})/);
  if (hebrewMatch && !parsedDate) {
    const day = parseInt(hebrewMatch[1]);
    const month = hebrewMonths[hebrewMatch[2]];
    let year = parseInt(hebrewMatch[3]);
    if (year < 100) year += 2000;
    
    parsedDate = new Date(year, month, day);
  }
  
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    return false;
  }
  
  const isUpcoming = parsedDate >= today && parsedDate <= twoMonthsFromNow;
  if (isUpcoming) {
    console.log(`  ✅ Date ${dateString} is upcoming (${parsedDate.toLocaleDateString('he-IL')})`);
  }
  
  return isUpcoming;
}

function isCourseRemote(page) {
  if (!page) return false;
  
  const location = (page.location || '').toLowerCase();
  const title = (page.title || page.h1 || '').toLowerCase();
  const description = (page.description || '').toLowerCase();
  
  const remoteKeywords = [
    'למידה מרחוק', 'מקוון', 'אונליין', 'online', 'zoom', 'דיגיטלי',
    'מרחוק', 'וירטואלי', 'אינטרנט'
  ];
  
  return remoteKeywords.some(keyword => 
    location.includes(keyword) || title.includes(keyword) || description.includes(keyword)
  );
}

// ================================================================
// 🔍 MAIN SEARCH FUNCTION - עם תיקון חכם לסינון דפי זבל
// ================================================================

async function searchPages(query, region = null, studyField = null) {
  console.log('========== [searchPages] START ==========');
  console.log(`🚀🚀🚀 CODE VERSION: FEB_17_v106_SMART_JUNK_FILTERING_FIX 🚀🚀🚀`);
  console.log('========================================');
  console.log(`Query: "${query}"`);
  console.log(`Region: ${region?.name || 'כל הארץ'}`);
  console.log(`Study Field: ${studyField?.name || 'כללי'}`);
  console.log('🎯 Query type: COURSES (חיפוש קורסים)');
  console.log('========================================');
  
  const pages = loadAllPages();
  const results = [];
  
  // דפטרנים לזיהוי דפי זבל - אלה יוסרו מהכותרת במקום לדחות את הדף
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
    const title = rawTitle.toLowerCase();
    const description = (page.description || '').toLowerCase();
    const rawContent = (page.text || '');
    const allHeadersText = ((page.h2 || []).join(' ') + ' ' + (page.h3 || []).join(' ')).toLowerCase();
    const url = (page.url || page.link || '').toLowerCase();
    
    // 🧹 נקה דפטרני זבל מהכותרת במקום לדחות את הדף
    let cleanedRawTitle = rawTitle;
    let cleanedTitle = title;
    
    // הסר דפטרנים של carousel/navigation מהכותרת
    for (const pattern of JUNK_TITLE_PATTERNS) {
      cleanedRawTitle = cleanedRawTitle.replace(new RegExp(pattern, 'gi'), '').trim();
      cleanedTitle = cleanedTitle.replace(new RegExp(pattern, 'gi'), '').trim();
    }
    
    // עכשיו בדוק אם זה באמת זבל אחרי הניקוי
    if (cleanedTitle.length === 0 || cleanedRawTitle.length < 3) {
      console.log(`  ❌ JUNK: "${rawTitle}" - no content after cleaning junk patterns`);
      continue;
    }
    if (!url || url.length < 10) {
      console.log(`  ❌ JUNK: "${rawTitle}" - invalid URL`);
      continue;
    }
    if (cleanedRawTitle.length < 10 && !description && !rawContent) {
      console.log(`  ❌ JUNK: "${rawTitle}" - no meaningful content after cleaning`);
      continue;
    }
    
    // השתמש בכותרת המנוקה לחיפוש
    const finalTitle = cleanedTitle;
    const finalRawTitle = cleanedRawTitle;
    
    console.log(`  🧼 "${rawTitle}" → "${finalRawTitle}" (cleaned)`);
    
    // 🧠 השתמש בחיפוש חכם עם ניקוי ניווט!
    const cleanedContent = cleanContentFromNavigation(rawContent, finalRawTitle, page.description || '');
    
    // סינון לפי תחום לימוד - משופר עם חיפוש חכם
    if (studyField) {
      const fieldNameLower = studyField.name.toLowerCase();
      const headerAndDesc = finalTitle + ' ' + description + ' ' + allHeadersText;
      
      let fieldFound = false;
      let searchLocation = '';
      
      if (studyField.specificKeyword) {
        // יש specificKeyword - חפש אותו בכל מקום
        const specificLower = studyField.specificKeyword.toLowerCase();
        
        if (finalTitle.includes(specificLower)) {
          fieldFound = true;
          searchLocation = 'title';
        } else if (description.includes(specificLower)) {
          fieldFound = true;
          searchLocation = 'description';
        } else if (allHeadersText.includes(specificLower)) {
          fieldFound = true;
          searchLocation = 'headers';
        } else if (cleanedContent.toLowerCase().includes(specificLower)) {
          fieldFound = true;
          searchLocation = 'clean_content';
        }
        
        if (!fieldFound) continue;
        
      } else {
        // אין specificKeyword - חפש את שם התחום
        const isGeneric = isGenericTerm(fieldNameLower);
        
        if (finalTitle.includes(fieldNameLower)) {
          fieldFound = true;
          searchLocation = 'title';
        } else if (description.includes(fieldNameLower)) {
          fieldFound = true;
          searchLocation = 'description'; 
        } else if (allHeadersText.includes(fieldNameLower)) {
          fieldFound = true;
          searchLocation = 'headers';
        } else if (!isGeneric && cleanedContent.toLowerCase().includes(fieldNameLower)) {
          fieldFound = true;
          searchLocation = 'clean_content';
          console.log(`  ℹ️ "${finalRawTitle}" - field found in cleaned content only`);
        } else {
          // אם זה גנרי ולא נמצא בכותרת/תיאור/headers - דחה
          if (isGeneric) continue;
          // אם זה לא גנרי ולא נמצא גם בתוכן המנוקה - דחה
          continue;
        }
      }
      
      console.log(`  ✅ "${finalRawTitle}" - field "${fieldNameLower}" found in ${searchLocation}`);
    }
    
    // חישוב Score מפורט ומדויק
    let matchScore = 0;
    
    if (studyField && studyField.specificKeyword) {
      const specificLower = studyField.specificKeyword.toLowerCase();
      if (finalTitle.includes(specificLower)) {
        matchScore += 150;
        console.log(`    [SCORE] +150 for specificKeyword "${studyField.specificKeyword}" in title`);
      } else if (description.includes(specificLower)) {
        matchScore += 100;
        console.log(`    [SCORE] +100 for specificKeyword "${studyField.specificKeyword}" in description`);
      } else {
        matchScore += 80;
        console.log(`    [SCORE] +80 for specificKeyword "${studyField.specificKeyword}"`);
      }
    } else if (studyField) {
      const fieldNameLower = studyField.name.toLowerCase();
      if (finalTitle.includes(fieldNameLower)) {
        matchScore += 100;
        console.log(`    [SCORE] +100 for field "${studyField.name}" in title`);
      } else if (description.includes(fieldNameLower)) {
        matchScore += 70;
        console.log(`    [SCORE] +70 for field "${studyField.name}" in description`);
      } else if (allHeadersText.includes(fieldNameLower)) {
        matchScore += 50;
        console.log(`    [SCORE] +50 for field "${studyField.name}" in headers`);
      } else {
        matchScore += 30;
        console.log(`    [SCORE] +30 for field "${studyField.name}" in content`);
      }
    }
    
    // זיהוי עיר ספציפית
    const specificCity = detectSpecificCity(query, region);
    let isInSpecificCity = false;
    
    if (specificCity && isStaticPage) {
      const location = (page.location || '').toLowerCase();
      const titleAndDesc = (finalTitle + ' ' + description + ' ' + url).toLowerCase();
      const cityLower = specificCity.toLowerCase().replace(/-/g, ' ');
      
      const inLocation = location.includes(cityLower);
      const inTitleOrDesc = titleAndDesc.includes(cityLower);
      
      if (inLocation || inTitleOrDesc) {
        isInSpecificCity = true;
        matchScore += 100;
        console.log(`    [SCORE] +100 for specific city "${specificCity}"`);
      }
    }
    
    let regionBonus = 0;
    
    // סינון לפי אזור - מדויק ומשופר
    if (region && region.cities && !isInSpecificCity) {
      const location = (page.location || '').toLowerCase();
      const fullText = cleanedContent; // השתמש בתוכן המנוקה
      const titleAndDesc = (finalTitle + ' ' + description + ' ' + fullText).toLowerCase().replace(/-/g, ' ');
      
      // בדיקה 1: האם ה-location מכיל עיר מהאזור?
      const hasRegionCityInLocation = region.cities.some(city => {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        return location.includes(cityLower);
      });
      
      if (location && location.trim() !== '') {
        // יש location - חייב להיות מהאזור הנכון או מרחוק
        if (!hasRegionCityInLocation) {
          const isRemote = isCourseRemote(page);
          
          if (isRemote) {
            // זה למידה מרחוק - בדוק שאין אזכור של אזור אחר
            let hasOtherRegion = false;
            
            if (REGIONS && Array.isArray(REGIONS)) {
              for (const otherRegion of REGIONS) {
                if (otherRegion.name === region.name) continue;
                
                for (const otherCity of otherRegion.cities || []) {
                  const otherCityLower = otherCity.toLowerCase().replace(/-/g, ' ');
                  if (titleAndDesc.includes(otherCityLower)) {
                    hasOtherRegion = true;
                    console.log(`    [REGION] Found other region city "${otherCity}" - rejecting`);
                    break;
                  }
                }
                
                if (hasOtherRegion) break;
              }
            }
            
            if (hasOtherRegion) {
              continue; // דף עם אזור אחר - נדחה!
            }
            
            // למידה מרחוק ללא אזור אחר - בדוק אזכור האזור המבוקש
            if (studyField && studyField.specificKeyword) {
              regionBonus = 10; // בונוס קטן למרחוק עם specific keyword
              console.log(`    [SCORE] +10 for remote learning with specific keyword`);
            } else {
              const mentionsRegion = titleAndDesc.includes(region.name.toLowerCase()) ||
                                     (region.keywords && region.keywords.some(k => titleAndDesc.includes(k.toLowerCase())));
              
              if (mentionsRegion) {
                regionBonus = 10;
                console.log(`    [SCORE] +10 for remote learning mentioning region`);
              } else {
                continue; // מרחוק בלי אזכור - דחה
              }
            }
          } else {
            console.log(`    [REGION] Not in region "${region.name}" and not remote - rejecting`);
            continue;
          }
        } else {
          regionBonus = isStaticPage ? 50 : 30;
          console.log(`    [SCORE] +${regionBonus} for being in region "${region.name}"`);
        }
      } else {
        // אין location - בדוק אזכור עיר או אזור בתוכן
        let cityMentioned = null;
        let cityRegion = null;
        let otherRegionMentioned = null;
        
        if (REGIONS && Array.isArray(REGIONS)) {
          // בדוק אזכור ערים
          for (const r of REGIONS) {
            for (const city of r.cities) {
              const cityLower = city.toLowerCase().replace(/-/g, ' ');
              if (titleAndDesc.includes(cityLower)) {
                cityMentioned = city;
                cityRegion = r.name;
                console.log(`    [REGION] Found city mention "${city}" from region "${r.name}"`);
                break;
              }
            }
            if (cityMentioned) break;
          }
          
          // בדוק אזכור אזורים אחרים
          if (!cityMentioned) {
            for (const r of REGIONS) {
              if (r.name === region.name) continue;
              
              const otherRegionName = r.name.toLowerCase();
              if (titleAndDesc.includes(otherRegionName)) {
                otherRegionMentioned = r.name;
                console.log(`    [REGION] Found other region mention "${r.name}"`);
                break;
              }
            }
          }
        }
        
        if (cityMentioned) {
          if (cityRegion === region.name) {
            regionBonus = 30;
            console.log(`    [SCORE] +30 for mentioning city "${cityMentioned}" in region`);
          } else {
            console.log(`    [REGION] City "${cityMentioned}" is from different region "${cityRegion}" - rejecting`);
            continue;
          }
        } else if (otherRegionMentioned) {
          console.log(`    [REGION] Mentions different region "${otherRegionMentioned}" - rejecting`);
          continue;
        } else {
          // אין אזכור עיר או אזור אחר - בדוק אזכור האזור המבוקש
          const regionMentioned = titleAndDesc.includes(region.name.toLowerCase()) ||
                                  (region.keywords && region.keywords.some(k => titleAndDesc.includes(k.toLowerCase())));
          
          if (regionMentioned) {
            regionBonus = 20;
            console.log(`    [SCORE] +20 for mentioning requested region`);
          } else {
            // אין אזכור של האזור המבוקש
            if (studyField && studyField.specificKeyword) {
              regionBonus = 0;
              console.log(`    [SCORE] +0 for no region mention but has specific keyword`);
            } else if (isStaticPage) {
              // בדוק אם המשתמש ביקש אזור ספציפי
              const queryLower = query.toLowerCase();
              const userRequestedSpecificRegion = 
                queryLower.includes('בצפון') || queryLower.includes('בדרום') ||
                queryLower.includes('במרכז') || queryLower.includes('בירושלים') ||
                queryLower.includes('בשפלה') || queryLower.includes('בשרון') ||
                queryLower.includes('בחיפה') || queryLower.includes('בגליל');
              
              if (userRequestedSpecificRegion) {
                console.log(`    [REGION] User requested specific region "${region.name}", no mention - REJECTED`);
                continue;
              } else {
                regionBonus = -10;
                console.log(`    [SCORE] -10 for static page without region mention`);
              }
            } else {
              console.log(`    [REGION] Info page without region mention - rejecting`);
              continue;
            }
          }
        }
      }
      
      matchScore += regionBonus;
    }
    
    // בדיקת תאריכים קרובים
    if (matchScore > 0 || isInfoPage) {
      let upcomingDate = page.upcomingDate || null;
      
      if (!upcomingDate && studyField) {
        const foundDate = findUpcomingDateInSchedule(page, studyField.name);
        if (foundDate) {
          upcomingDate = foundDate;
        }
      }
      
      let dateBonus = 0;
      if (upcomingDate && isUpcomingDate(upcomingDate)) {
        dateBonus = 200;
        matchScore += dateBonus;
        console.log(`    [SCORE] +200 for upcoming date: ${upcomingDate}`);
      }
      
      // בונוס לקורסים מרחוק כשמבוקש אזור
      if (region && isCourseRemote(page)) {
        const remoteBonus = 5;
        matchScore += remoteBonus;
        console.log(`    [SCORE] +${remoteBonus} for remote course when region requested`);
      }
      
      console.log(`  ✅ ADDED: "${finalRawTitle}"`);
      console.log(`     Final Score: ${matchScore} | Static: ${isStaticPage} | Location: "${page.location || 'N/A'}" | Remote: ${isCourseRemote(page)}`);
      
      results.push({
        ...page,
        title: finalRawTitle, // השתמש בכותרת המנוקה
        isStatic: isStaticPage,
        isInfo: isInfoPage,
        isInSpecificCity: isInSpecificCity,
        specificCity: isInSpecificCity ? specificCity : null,
        upcomingDate: upcomingDate,
        isRemote: isCourseRemote(page),
        score: matchScore
      });
    }
  }
  
  // מיון תוצאות - חכם ומדויק
  results.sort((a, b) => {
    // קודם כל - תאריכים קרובים
    const aHasUpcoming = a.upcomingDate && isUpcomingDate(a.upcomingDate);
    const bHasUpcoming = b.upcomingDate && isUpcomingDate(b.upcomingDate);
    
    if (aHasUpcoming && !bHasUpcoming) return -1;
    if (!aHasUpcoming && bHasUpcoming) return 1;
    
    // אחר כך לפי score
    if (b.score !== a.score) return b.score - a.score;
    
    // אחר כך static pages קודם
    if (a.isStatic && !b.isStatic) return -1;
    if (!a.isStatic && b.isStatic) return 1;
    
    // אחר כך עיר ספציפית
    if (a.isInSpecificCity && !b.isInSpecificCity) return -1;
    if (!a.isInSpecificCity && b.isInSpecificCity) return 1;
    
    // לבסוף - קורסים לא מרחוק קודם (אם יש אזור)
    if (region) {
      if (!a.isRemote && b.isRemote) return -1;
      if (a.isRemote && !b.isRemote) return 1;
    }
    
    return 0;
  });
  
  console.log(`[searchPages] ========== RESULTS ==========`);
  console.log(`Total: ${results.length} results found`);
  console.log(`Static: ${results.filter(r => r.isStatic).length}, Info: ${results.filter(r => r.isInfo).length}, Remote: ${results.filter(r => r.isRemote).length}`);
  console.log(`With upcoming dates: ${results.filter(r => r.upcomingDate && isUpcomingDate(r.upcomingDate)).length}`);
  console.log(`In specific city: ${results.filter(r => r.isInSpecificCity).length}`);
  console.log('[searchPages] ========== END ==========');
  
  return results;
}

// ================================================================
// 🌐 REMOTE LEARNING SEARCH - משופר ומלא
// ================================================================

async function searchRemoteLearning(studyField) {
  console.log('\n🌐 [searchRemoteLearning] START - Searching for remote learning alternatives...');
  
  if (!studyField) {
    console.log('  ⚠️ No study field provided');
    return [];
  }
  
  console.log(`  🔍 Looking for remote learning in field: "${studyField.name}"`);
  
  const pages = loadAllPages();
  const results = [];
  
  // דפטרנים לזיהוי דפי זבל - אותם דפטרנים שבחיפוש הראשי
  const JUNK_TITLE_PATTERNS = [
    'close carousel', 'carousel', 'next', 'prev', 'menu', 'navigation',
    'ינואר 2', 'פברואר 2', 'מרץ 2', 'אפריל 2', 'מאי 2', 'יוני 2',
    'יולי 2', 'אוגוסט 2', 'ספטמבר 2', 'אוקטובר 2', 'נובמבר 2', 'דצמבר 2'
  ];
  
  for (const page of pages) {
    const rawTitle = page.title || page.h1 || '';
    const title = rawTitle.toLowerCase().trim();
    const location = (page.location || '').toLowerCase();
    const description = (page.description || '').toLowerCase();
    const rawContent = (page.text || '');
    const url = (page.url || page.link || '').toLowerCase();
    
    // 🧹 נקה דפטרני זבל מהכותרת כמו בחיפוש הראשי
    let cleanedRawTitle = rawTitle;
    let cleanedTitle = title;
    
    for (const pattern of JUNK_TITLE_PATTERNS) {
      cleanedRawTitle = cleanedRawTitle.replace(new RegExp(pattern, 'gi'), '').trim();
      cleanedTitle = cleanedTitle.replace(new RegExp(pattern, 'gi'), '').trim();
    }
    
    // בדוק אם זה באמת זבל אחרי הניקוי
    if (cleanedTitle.length === 0 || cleanedRawTitle.length < 3) continue;
    if (!url || url.length < 10) continue;
    
    // בדוק אם זה למידה מרחוק
    const isRemote = isCourseRemote(page);
    if (!isRemote) continue;
    
    // 🧠 השתמש בחיפוש חכם עם ניקוי ניווט!
    const cleanedContent = cleanContentFromNavigation(rawContent, cleanedRawTitle, page.description || '');
    
    // בדוק אם יש את התחום
    const fieldLower = studyField.name.toLowerCase();
    const headerAndDesc = cleanedTitle + ' ' + description;
    
    let hasField = false;
    
    if (studyField.specificKeyword) {
      const specificLower = studyField.specificKeyword.toLowerCase();
      hasField = headerAndDesc.includes(specificLower) || 
                 cleanedContent.toLowerCase().includes(specificLower);
      
      if (hasField) {
        console.log(`  ✅ Remote course found: "${cleanedRawTitle}" - contains specificKeyword "${studyField.specificKeyword}"`);
      }
    } else {
      hasField = headerAndDesc.includes(fieldLower) || 
                 cleanedContent.toLowerCase().includes(fieldLower);
      
      if (hasField) {
        console.log(`  ✅ Remote course found: "${cleanedRawTitle}" - contains field "${studyField.name}"`);
      }
    }
    
    if (hasField) {
      // חישוב score לקורסים מרחוק
      let remoteScore = 50; // base score
      
      if (cleanedTitle.includes(fieldLower) || (studyField.specificKeyword && cleanedTitle.includes(studyField.specificKeyword.toLowerCase()))) {
        remoteScore += 30;
      } else if (description.includes(fieldLower) || (studyField.specificKeyword && description.includes(studyField.specificKeyword.toLowerCase()))) {
        remoteScore += 20;
      }
      
      // בונוס לתאריכים קרובים
      const upcomingDate = findUpcomingDateInSchedule(page, studyField.name);
      if (upcomingDate && isUpcomingDate(upcomingDate)) {
        remoteScore += 100;
        console.log(`    [REMOTE] +100 for upcoming date: ${upcomingDate}`);
      }
      
      results.push({
        ...page,
        title: cleanedRawTitle, // השתמש בכותרת המנוקה
        isRemote: true,
        upcomingDate: upcomingDate,
        score: remoteScore
      });
    }
  }
  
  // מיון תוצאות מרחוק
  results.sort((a, b) => {
    // תאריכים קרובים קודם
    const aHasUpcoming = a.upcomingDate && isUpcomingDate(a.upcomingDate);
    const bHasUpcoming = b.upcomingDate && isUpcomingDate(b.upcomingDate);
    
    if (aHasUpcoming && !bHasUpcoming) return -1;
    if (!aHasUpcoming && bHasUpcoming) return 1;
    
    // אחר כך לפי score
    return b.score - a.score;
  });
  
  const finalResults = results.slice(0, 3); // מקסימום 3
  
  console.log(`  📊 Found ${results.length} remote learning options, returning top ${finalResults.length}`);
  finalResults.forEach((result, index) => {
    console.log(`    ${index + 1}. "${result.title || result.h1}" (score: ${result.score})`);
  });
  
  console.log('[searchRemoteLearning] ========== END ==========');
  return finalResults;
}

// ================================================================
// 💬 QA SYSTEM
// ================================================================

function findQAAnswer(message) {
  loadConfigs();
  
  console.log(`🔍 [findQAAnswer] Searching for QA answer: "${message}"`);
  
  const lowerMessage = message.toLowerCase();
  
  // חפש ב-courses QA
  if (COURSES_QA && COURSES_QA.questions) {
    console.log(`  📚 Searching in ${COURSES_QA.questions.length} courses QA entries...`);
    
    for (const q of COURSES_QA.questions) {
      // חיפוש לפי שאלה ישירה
      if (q.question && lowerMessage.includes(q.question.toLowerCase())) {
        console.log(`  ✅ Found by question: "${q.question}"`);
        return { answer: q.answer, source: 'courses' };
      }
      
      // חיפוש לפי variations
      if (q.variations) {
        for (const variation of q.variations) {
          if (lowerMessage.includes(variation.toLowerCase())) {
            console.log(`  ✅ Found by variation: "${variation}"`);
            return { answer: q.answer, source: 'courses' };
          }
        }
      }
      
      // חיפוש לפי keywords (צריך לפחות 2 keywords)
      if (q.keywords) {
        const keywordMatches = q.keywords.filter(k => lowerMessage.includes(k.toLowerCase()));
        if (keywordMatches.length >= 2) {
          console.log(`  ✅ Found by keywords: [${keywordMatches.join(', ')}]`);
          return { answer: q.answer, source: 'courses' };
        }
      }
    }
  }
  
  // חפש ב-payments QA
  if (PAYMENTS_QA && PAYMENTS_QA.categories) {
    console.log(`  💰 Searching in ${PAYMENTS_QA.categories.length} payments QA categories...`);
    
    for (const category of PAYMENTS_QA.categories) {
      if (category.questions) {
        for (const q of category.questions) {
          // חיפוש לפי שאלה ישירה
          if (q.question && lowerMessage.includes(q.question.toLowerCase())) {
            console.log(`  ✅ Found in payments by question: "${q.question}"`);
            return { answer: q.answer, source: 'payments', category: category.category };
          }
          
          // חיפוש לפי variations
          if (q.variations) {
            for (const variation of q.variations) {
              if (lowerMessage.includes(variation.toLowerCase())) {
                console.log(`  ✅ Found in payments by variation: "${variation}"`);
                return { answer: q.answer, source: 'payments', category: category.category };
              }
            }
          }
        }
      }
    }
  }
  
  console.log('  ❌ No QA answer found');
  return null;
}

function classifyIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  console.log(`🎯 [classifyIntent] Analyzing: "${message}"`);
  
  // שאלות ספציפיות - QA
  const qaKeywords = ['כמה', 'מתי', 'איך', 'מה זה', 'האם', 'מי', 'למה', 'איפה', 'מה'];
  const hasQAKeyword = qaKeywords.some(k => lowerMessage.includes(k));
  
  if (hasQAKeyword) {
    console.log(`  🤔 Contains QA keyword, checking for answer...`);
    const qaAnswer = findQAAnswer(message);
    if (qaAnswer) {
      console.log(`  ✅ Found QA answer from ${qaAnswer.source}`);
      return { intent: 'qa', data: qaAnswer };
    }
  }
  
  // חיפוש קורסים
  const searchKeywords = ['קורס', 'לימוד', 'השתלמות', 'תואר', 'מכללה', 'לימודים'];
  if (searchKeywords.some(k => lowerMessage.includes(k))) {
    console.log(`  🔍 Classified as search intent`);
    return { intent: 'search', data: null };
  }
  
  console.log(`  🗣️ Classified as general intent`);
  return { intent: 'general', data: null };
}

// ================================================================
// 🎨 RESPONSE FORMATTING
// ================================================================

function formatResults(results, studyField, region) {
  if (results.length === 0) return '';
  
  let response = '';
  const fieldName = studyField?.specificKeyword || studyField?.name || 'הקורסים';
  const regionName = region?.name || 'כל הארץ';
  
  // כותרת ראשית
  response += `מצאתי ${results.length} מוסדות`;
  if (region) response += ` ב${regionName}`;
  response += ` ל${fieldName}:\n\n`;
  
  // הוסף תוצאות
  let addedResults = 0;
  for (const result of results) {
    if (addedResults >= 6) break; // מקסימום 6 תוצאות
    
    const title = result.title || result.h1 || 'ללא שם';
    const desc = result.description || 'אין תיאור זמין';
    const url = result.url || result.link || '#';
    const location = result.location || '';
    
    // אייקון לפי סוג
    let icon = '🏢';
    if (result.isRemote) icon = '🌐';
    else if (result.upcomingDate && isUpcomingDate(result.upcomingDate)) icon = '📅';
    else if (result.isInSpecificCity) icon = '📍';
    
    response += `${icon} **${title}**\n`;
    
    // הוסף מיקום אם קיים
    if (location) {
      response += `📍 ${location}\n`;
    }
    
    // הוסף תאריך קרוב אם קיים
    if (result.upcomingDate && isUpcomingDate(result.upcomingDate)) {
      response += `📅 תאריך קרוב: ${result.upcomingDate}\n`;
    }
    
    // תיאור קצר
    const shortDesc = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;
    response += `${shortDesc}\n`;
    
    response += `[למידע מלא וייעוץ אישי](${url})\n\n`;
    
    addedResults++;
  }
  
  // קישורים נוספים
  const slug = studyField?.slug || 'courses';
  response += `💡 **קישורים נוספים:**\n`;
  response += `[לכל הקורסים ב${fieldName}](https://www.shabaton.online/${slug})`;
  
  if (region && region.slug) {
    response += ` | [קורסים ב${regionName}](https://www.shabaton.online/${region.slug})`;
  }
  
  return response;
}

function formatRemoteResults(results, studyField) {
  if (results.length === 0) return '';
  
  const fieldName = studyField?.specificKeyword || studyField?.name || 'התחום';
  
  let response = `\n\n🌐 **למידה מרחוק ב${fieldName}:**\n\n`;
  response += `מצאתי אפשרויות למידה מרחוק שיכולות להתאים לך:\n\n`;
  
  for (const result of results) {
    const title = result.title || result.h1 || 'ללא שם';
    const desc = result.description || '';
    const url = result.url || result.link || '#';
    
    response += `📚 **${title}**\n`;
    
    // הוסף תאריך קרוב אם קיים
    if (result.upcomingDate && isUpcomingDate(result.upcomingDate)) {
      response += `📅 תאריך קרוב: ${result.upcomingDate}\n`;
    }
    
    if (desc) {
      const shortDesc = desc.length > 120 ? desc.substring(0, 120) + '...' : desc;
      response += `${shortDesc}\n`;
    }
    
    response += `[למידע נוסף והרשמה](${url})\n\n`;
  }
  
  return response;
}

// ================================================================
// 🎯 MAIN HANDLER
// ================================================================

async function generateSmartResponse(message) {
  console.log('========================================');
  console.log('🚀 [generateSmartResponse] START');
  console.log('🚀🚀🚀 CODE VERSION: FEB_17_v106_SMART_JUNK_FILTERING_FIX 🚀🚀🚀');
  console.log('========================================');
  console.log(`📝 Input message: "${message}"`);
  
  loadConfigs();
  
  // בדוק QA ראשון
  const qaAnswer = findQAAnswer(message);
  if (qaAnswer) {
    console.log('✅ שאלה ספציפית נמצאה - מחזיר תשובה מ-QA');
    return qaAnswer.answer;
  }
  
  console.log('⚠️ לא שאלה ספציפית - ממשיך לחיפוש קורסים');
  
  // זהה תחום ואזור
  const detectedFields = detectStudyField(message);
  const studyField = detectedFields[0] || null;
  const region = detectRegion(message);
  
  console.log(`📊 Detection Results:`);
  console.log(`   Study Field: ${studyField ? studyField.name + (studyField.specificKeyword ? ` (${studyField.specificKeyword})` : '') : 'None'}`);
  console.log(`   Region: ${region ? region.name : 'None'}`);
  
  const intentInfo = classifyIntent(message);
  console.log(`🎯 [Intent Classification] Result: ${intentInfo.intent}`);
  
  if (intentInfo.intent === 'search') {
    console.log('🔍 === התחלת תהליך חיפוש קורסים ===');
    
    if (studyField) {
      console.log(`✅ תחום זוהה: "${studyField.name}"`);
      if (studyField.specificKeyword) {
        console.log(`   🎯 Specific keyword: "${studyField.specificKeyword}"`);
      }
    } else {
      console.log('⚠️ לא זוהה תחום ספציפי');
    }
    
    if (region) {
      console.log(`🌍 אזור זוהה: "${region.name}"`);
      console.log(`🔍 מחפש מוסדות עבור:`);
      console.log(`   תחום: ${studyField?.name || 'כללי'}`);
      console.log(`   אזור: ${region.name}`);
    } else {
      console.log('🌍 חיפוש בכל הארץ');
    }
    
    // בצע חיפוש
    const results = await searchPages(message, region, studyField);
    
    console.log(`📊 תוצאות חיפוש: ${results.length} מוסדות נמצאו`);
    
    if (results.length > 0) {
      // יש תוצאות!
      console.log('✅ נמצאו תוצאות - מכין תגובה');
      const topResults = results.slice(0, 6); // מקסימום 6
      return formatResults(topResults, studyField, region);
      
    } else {
      // אין תוצאות - נסה למידה מרחוק
      console.log('⚠️ אין תוצאות ישירות - בודק למידה מרחוק...');
      
      if (studyField) {
        const remoteResults = await searchRemoteLearning(studyField);
        
        if (remoteResults.length > 0) {
          // יש למידה מרחוק!
          console.log(`✅ נמצאו ${remoteResults.length} אפשרויות למידה מרחוק`);
          
          let response = `לא מצאתי מוסדות`;
          if (region) response += ` ב${region.name}`;
          response += ` ל${studyField.specificKeyword || studyField.name}.\n`;
          
          response += formatRemoteResults(remoteResults, studyField);
          
          return response;
        }
      }
      
      // אין כלום
      console.log('❌ לא נמצא כלום - מחזיר הודעת "לא נמצא"');
      
      let response = `מצטער, לא מצאתי מוסדות`;
      if (region) response += ` ב${region.name}`;
      if (studyField) response += ` ל${studyField.specificKeyword || studyField.name}`;
      response += `.\n\n`;
      
      response += `💡 **הצעות:**\n`;
      response += `• נסה לחפש באזור אחר\n`;
      response += `• חפש קורסים דומים או קרובים\n`;
      response += `• בדוק את [כל הקורסים בשבתון](https://www.shabaton.online/courses)\n`;
      response += `• ליצור קשר ישיר עם המוסדות\n\n`;
      response += `📞 **צריך עזרה?** [צור קשר איתנו](https://www.shabaton.online/contact)`;
      
      return response;
    }
  }
  
  // תגובה כללית
  console.log('💬 מחזיר תגובה כללית');
  return `היי! 👋\n\nאני כאן לעזור לך למצוא קורסים והשתלמויות למורים בשבתון.\n\n**אפשר לשאול אותי על:**\n• קורסים ספציפיים (צילום, פסיכולוגיה, טכנולוגיה...)\n• קורסים באזור שלך (צפון, דרום, מרכז...)\n• שאלות על התשלומים והרישום\n• מידע כללי על שבתון\n\n**דוגמאות לשאלות:**\n• "קורס פסיכולוגיה בצפון"\n• "למידה מרחוק בטכנולוגיה"\n• "כמה עולה קורס?"\n\n[🌐 כל הקורסים בשבתון](https://www.shabaton.online/courses)`;
}

// ================================================================
// 🌐 VERCEL HANDLER
// ================================================================

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  // ✅ CORS Headers - תמיכה מלאה
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // ✅ OPTIONS Preflight - חובה לCORS
  if (req.method === 'OPTIONS') {
    console.log('✅ [handler] OPTIONS preflight - returning 200');
    return res.status(200).end();
  }
  
  const body = req.body || {};
  
  console.log('📨 [handler] New request received');
  console.log(`   Method: ${req.method}`);
  console.log(`   Body preview: ${JSON.stringify(body).substring(0, 200)}${JSON.stringify(body).length > 200 ? '...' : ''}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'Unknown'}`);
  
  if (req.method !== 'POST') {
    console.error(`❌ Method ${req.method} not allowed`);
    return res.status(405).json({ 
      error: 'Method not allowed', 
      allowed: ['POST', 'OPTIONS'] 
    });
  }
  
  const { message } = body;
  
  if (!message || typeof message !== 'string') {
    console.error(`❌ Invalid message: "${message}" (type: ${typeof message})`);
    return res.status(400).json({ 
      error: 'Invalid message - string required',
      received: {
        type: typeof message,
        value: message
      }
    });
  }
  
  if (message.length > 500) {
    console.error(`❌ Message too long: ${message.length} characters`);
    return res.status(400).json({ 
      error: 'Message too long - maximum 500 characters',
      length: message.length
    });
  }
  
  console.log(`📨 [handler] Processing message: "${message}"`);
  
  try {
    const startTime = Date.now();
    
    const response = await generateSmartResponse(message);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`✅ [handler] Response generated successfully`);
    console.log(`   Response length: ${response.length} characters`);
    console.log(`   Processing time: ${processingTime}ms`);
    
    return res.status(200).json({
      reply: response,
      timestamp: new Date().toISOString(),
      processingTime: processingTime,
      version: 'FEB_17_v106_SMART_JUNK_FILTERING_FIX'
    });
    
  } catch (error) {
    console.error('❌ [handler] CRITICAL ERROR:', error);
    console.error('Stack trace:', error.stack);
    
    return res.status(500).json({ 
      error: 'Internal server error - please try again',
      message: error.message,
      timestamp: new Date().toISOString(),
      version: 'FEB_17_v106_SMART_JUNK_FILTERING_FIX'
    });
  }
}
