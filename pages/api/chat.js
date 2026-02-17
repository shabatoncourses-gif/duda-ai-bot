// ================================================================
// 🎯 chat.js v100 - CLEAN & COMPLETE VERSION
// ================================================================
// VERSION: FEB_17_v102_FILTER_JUNK_PAGES
// Created: 2026-02-16
// 
// פיצ'רים:
// ✅ ניתוח סמנטי v2.0 מ-JSON
// ✅ חיפוש בתוכן למילים ספציפיות
// ✅ סינון אזורים מדויק
// ✅ הצעת למידה מרחוק כשאין תוצאות
// ✅ מערכת QA
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
// 🔄 DATA LOADING
// ================================================================

function loadConfigs() {
  try {
    if (!REGIONS) {
      const regionsPath = path.join(process.cwd(), 'data', 'regions.json');
      REGIONS = JSON.parse(fs.readFileSync(regionsPath, 'utf8')).regions;
    }
    
    if (!STUDY_FIELDS) {
      const fieldsPath = path.join(process.cwd(), 'data', 'study-fields.json');
      STUDY_FIELDS = JSON.parse(fs.readFileSync(fieldsPath, 'utf8')).studyFields;
    }
    
    if (!REQUIRED_PHRASES) {
      const phrasesPath = path.join(process.cwd(), 'data', 'required-phrases.json');
      REQUIRED_PHRASES = JSON.parse(fs.readFileSync(phrasesPath, 'utf8')).requiredPhrases || [];
      console.log(`[loadConfigs] Loaded ${REQUIRED_PHRASES.length} required phrases`);
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
    console.log(`✅ [Semantic] Loaded: ${Object.keys(SEMANTIC_DATA.synonyms || {}).length} terms`);
    return SEMANTIC_DATA;
  } catch (error) {
    console.error('⚠️ [Semantic] Failed to load semantic-mappings.json');
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
      console.log(`⚠️ Could not load ${filename}`);
    }
  }
  
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
  
  console.log(`✅ Loaded ${uniquePages.length} unique pages`);
  ALL_PAGES = uniquePages;
  return ALL_PAGES;
}

// ================================================================
// 🧠 SEMANTIC ANALYSIS
// ================================================================

function buildWordGraph() {
  if (WORD_GRAPH) return WORD_GRAPH;
  
  loadSemanticData();
  loadConfigs();
  
  const wordGraph = new Map();
  
  // מ-semantic-mappings.json
  if (SEMANTIC_DATA?.synonyms) {
    for (const [mainTerm, data] of Object.entries(SEMANTIC_DATA.synonyms)) {
      const allTerms = [mainTerm, ...(data.variations || [])];
      
      for (const term of allTerms) {
        const lower = term.toLowerCase();
        if (!wordGraph.has(lower)) wordGraph.set(lower, new Set());
        
        allTerms.forEach(t => {
          if (t.toLowerCase() !== lower) wordGraph.get(lower).add(t);
        });
        wordGraph.get(lower).add(mainTerm);
      }
    }
  }
  
  // מ-required-phrases.json
  if (REQUIRED_PHRASES) {
    for (const phraseEntry of REQUIRED_PHRASES) {
      const allPhrases = [phraseEntry.phrase, ...(phraseEntry.variations || [])];
      
      for (const phrase of allPhrases) {
        const lower = phrase.toLowerCase();
        if (!wordGraph.has(lower)) wordGraph.set(lower, new Set());
        
        allPhrases.forEach(p => {
          if (p.toLowerCase() !== lower) wordGraph.get(lower).add(p);
        });
        wordGraph.get(lower).add(phraseEntry.phrase);
      }
    }
  }
  
  // מ-study-fields.json
  if (STUDY_FIELDS) {
    for (const field of STUDY_FIELDS) {
      const allTerms = [field.name, ...(field.keywords || [])];
      
      for (const term of allTerms) {
        const lower = term.toLowerCase();
        if (!wordGraph.has(lower)) wordGraph.set(lower, new Set());
        wordGraph.get(lower).add(field.name);
      }
    }
  }
  
  WORD_GRAPH = wordGraph;
  console.log(`🧠 [buildWordGraph] Built graph with ${wordGraph.size} terms`);
  return wordGraph;
}

function expandQuerySemantically(query) {
  if (!WORD_GRAPH) buildWordGraph();
  loadSemanticData();
  
  const expanded = new Set([query]);
  const queryLower = query.toLowerCase();
  
  // הרחב מהגרף
  for (const [term, relatedTerms] of WORD_GRAPH.entries()) {
    if (queryLower.includes(term)) {
      relatedTerms.forEach(rt => expanded.add(rt));
    }
  }
  
  // זיהוי כוונה
  if (SEMANTIC_DATA?.intentPatterns) {
    for (const [intentType, intentData] of Object.entries(SEMANTIC_DATA.intentPatterns)) {
      const patterns = intentData.patterns || [];
      
      if (patterns.some(pattern => queryLower.includes(pattern.toLowerCase()))) {
        if (intentData.problemToSolution) {
          for (const [problem, solutions] of Object.entries(intentData.problemToSolution)) {
            if (queryLower.includes(problem.toLowerCase())) {
              console.log(`  🎯 [Intent] "${problem}" → [${solutions.join(', ')}]`);
              solutions.forEach(sol => expanded.add(sol));
            }
          }
        }
      }
    }
  }
  
  const result = Array.from(expanded);
  console.log(`  🧠 [Semantic] "${query}" → [${result.slice(0, 6).join(', ')}...]`);
  return result;
}

function isGenericTerm(term) {
  loadSemanticData();
  
  if (!SEMANTIC_DATA?.genericTerms) {
    return ['סטודיו', 'studio', 'לימוד', 'קורס', 'טיפול', 'תרפיה'].includes(term.toLowerCase());
  }
  
  return SEMANTIC_DATA.genericTerms.includes(term.toLowerCase());
}

// ================================================================
// 🔍 DETECTION
// ================================================================

function detectStudyField(message) {
  loadConfigs();
  
  console.log('\n🔍 [detectStudyField] START');
  console.log(`📝 Message: "${message}"`);
  
  if (!STUDY_FIELDS || !Array.isArray(STUDY_FIELDS)) return [];
  
  const lowerMessage = message.toLowerCase();
  const expandedTerms = expandQuerySemantically(message);
  
  // שלב 1: חפש שם תחום מדויק
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    
    const fieldNameLower = field.name.toLowerCase();
    
    if (lowerMessage.includes(fieldNameLower) || 
        expandedTerms.some(term => fieldNameLower.includes(term.toLowerCase()))) {
      console.log(`✅ Found exact field: "${field.name}"`);
      return [{ ...field, specificKeyword: null }];
    }
  }
  
  // שלב 2: חפש keywords
  let bestMatch = null;
  const tooGeneric = ['למידה', 'לימוד', 'קורס', 'קורסים', 'השתלמות', 'תואר'];
  
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    if (!field.keywords) continue;
    
    for (const keyword of field.keywords) {
      if (!keyword || tooGeneric.includes(keyword.toLowerCase())) continue;
      
      const keywordLower = keyword.toLowerCase();
      const foundInMessage = lowerMessage.includes(keywordLower);
      const foundInExpanded = expandedTerms.some(term => 
        term.toLowerCase().includes(keywordLower) || 
        keywordLower.includes(term.toLowerCase())
      );
      
      if (foundInMessage || foundInExpanded) {
        if (!bestMatch || keywordLower.length > bestMatch.length) {
          bestMatch = {
            field: field,
            keyword: keyword,
            length: keywordLower.length,
            foundVia: foundInMessage ? 'direct' : 'semantic'
          };
        }
      }
    }
  }
  
  if (bestMatch) {
    console.log(`✅ Found keyword: "${bestMatch.keyword}" in "${bestMatch.field.name}"`);
    
    // מצא מילה מלאה
    const words = lowerMessage.split(/\s+/);
    let fullWord = bestMatch.keyword;
    
    for (const word of words) {
      const cleanWord = word.replace(/[,\.!\?;:]/g, '');
      if (cleanWord.includes(bestMatch.keyword.toLowerCase())) {
        fullWord = cleanWord;
        break;
      }
    }
    
    return [{ ...bestMatch.field, specificKeyword: fullWord }];
  }
  
  console.log('❌ No field detected');
  return [];
}

function detectRegion(message) {
  loadConfigs();
  if (!REGIONS) return null;
  
  const lowerMessage = message.toLowerCase().replace(/-/g, ' ');
  
  for (const region of REGIONS) {
    if (lowerMessage.includes(region.name.toLowerCase())) return region;
    
    if (region.keywords?.some(k => lowerMessage.includes(k.toLowerCase()))) return region;
    
    if (region.cities?.some(city => 
      lowerMessage.includes(city.toLowerCase().replace(/-/g, ' '))
    )) return region;
  }
  
  return null;
}

// ================================================================
// 🔍 SEARCH
// ================================================================

async function searchPages(query, region = null, studyField = null) {
  console.log('========== [searchPages] START ==========');
  console.log(`🚀 VERSION: FEB_17_v102_FILTER_JUNK_PAGES`);
  console.log(`Query: "${query}"`);
  console.log(`Region: ${region?.name || 'כל הארץ'}`);
  console.log(`Study Field: ${studyField?.name || 'כללי'}`);
  
  const pages = loadAllPages();
  const results = [];
  
  // מילים שמעידות על דף זבל (ניווט, carousel, תאריכים)
  const JUNK_TITLE_PATTERNS = [
    'close carousel', 'carousel', 'ינואר 2', 'פברואר 2', 'מרץ 2',
    'אפריל 2', 'מאי 2', 'יוני 2', 'יולי 2', 'אוגוסט 2',
    'ספטמבר 2', 'אוקטובר 2', 'נובמבר 2', 'דצמבר 2',
    'next', 'prev', 'menu', 'navigation'
  ];
  
  for (const page of pages) {
    const pageType = page.pageType || 'unknown';
    const isStatic = pageType === 'static';
    const isInfo = pageType === 'info';
    
    const rawTitle = page.title || page.h1 || '';
    const title = rawTitle.toLowerCase().trim();
    const desc = (page.description || '').toLowerCase();
    const content = (page.text || '').toLowerCase();
    const headers = ((page.h2 || []).join(' ') + ' ' + (page.h3 || []).join(' ')).toLowerCase();
    const url = (page.url || page.link || '').toLowerCase();
    
    // ❌ סנן דפי זבל
    if (JUNK_TITLE_PATTERNS.some(p => title.includes(p))) continue;
    if (!url || url.length < 10) continue;
    if (!rawTitle || rawTitle.trim().length < 3) continue;
    // דפי ניווט - כותרת קצרה מאוד ללא תוכן ממשי
    if (rawTitle.trim().length < 10 && !desc && !content) continue;
    
    // סינון תחום
    if (studyField) {
      const fieldLower = studyField.name.toLowerCase();
      // חיפוש רק בכותרת + תיאור + headers (לא בכל התוכן!)
      const headerAndDesc = title + ' ' + desc + ' ' + headers;
      
      if (studyField.specificKeyword) {
        const specificLower = studyField.specificKeyword.toLowerCase();
        // חפש בכותרת/תיאור/headers בלבד
        if (!headerAndDesc.includes(specificLower)) {
          continue; // לא מוצאים בכותרת - דחה!
        }
      } else {
        if (!headerAndDesc.includes(fieldLower)) {
          continue; // רק כותרת/תיאור - לא תוכן!
        }
      }
    }
    
    // חישוב Score
    let score = 0;
    
    if (studyField?.specificKeyword) {
      score = 100;
      if (title.includes(studyField.specificKeyword.toLowerCase())) score += 50;
    } else if (studyField) {
      const fieldLower = studyField.name.toLowerCase();
      if (title.includes(fieldLower)) score += 100;
      else if (desc.includes(fieldLower)) score += 70;
      else if (headers.includes(fieldLower)) score += 50;
      // אין score=30 לתוכן בלבד - כבר סוננו למעלה
    }
    
    // סינון אזור
    if (region) {
      const location = (page.location || '').toLowerCase();
      const fullText = (title + ' ' + desc + ' ' + content).toLowerCase().replace(/-/g, ' ');
      
      if (location) {
        const hasRegionCity = region.cities?.some(city => 
          location.includes(city.toLowerCase().replace(/-/g, ' '))
        );
        
        if (!hasRegionCity) {
          const isRemote = location.includes('למידה מרחוק') || 
                          location.includes('מקוון') || 
                          location.includes('אונליין');
          if (!isRemote) continue;
        } else {
          score += isStatic ? 50 : 30;
        }
      } else {
        const regionMentioned = fullText.includes(region.name.toLowerCase()) ||
                               region.keywords?.some(k => fullText.includes(k.toLowerCase()));
        
        if (regionMentioned) {
          score += 20;
        } else if (studyField?.specificKeyword) {
          score += 0;
        } else if (isStatic) {
          const queryLower = query.toLowerCase();
          const userWantsSpecificRegion = 
            queryLower.includes('בצפון') || queryLower.includes('בדרום') ||
            queryLower.includes('במרכז') || queryLower.includes('בירושלים') ||
            queryLower.includes('בשפלה') || queryLower.includes('בשרון');
          
          if (userWantsSpecificRegion) {
            console.log(`  ❌ "${page.title}" - user wants specific region, no mention - REJECTED`);
            continue;
          }
          
          score -= 10;
        } else {
          continue;
        }
      }
    }
    
    if (score > 0 || isInfo) {
      console.log(`  ✅ "${page.title}" | score: ${score}`);
      results.push({ ...page, isStatic, isInfo, score });
    }
  }
  
  results.sort((a, b) => b.score - a.score);
  
  console.log(`[searchPages] ${results.length} results`);
  console.log('[searchPages] ========== END ==========');
  
  return results;
}

async function searchRemoteLearning(studyField) {
  console.log('\n🌐 [Remote] Searching for remote learning...');
  
  if (!studyField) return [];
  
  const pages = loadAllPages();
  const results = [];
  
  const JUNK_TITLE_PATTERNS = [
    'close carousel', 'carousel', 'ינואר 2', 'פברואר 2', 'מרץ 2',
    'אפריל 2', 'מאי 2', 'יוני 2', 'יולי 2', 'אוגוסט 2',
    'ספטמבר 2', 'אוקטובר 2', 'נובמבר 2', 'דצמבר 2'
  ];
  
  for (const page of pages) {
    const rawTitle = page.title || page.h1 || '';
    const title = rawTitle.toLowerCase().trim();
    const location = (page.location || '').toLowerCase();
    const desc = (page.description || '').toLowerCase();
    const url = (page.url || page.link || '').toLowerCase();
    
    // סנן זבל
    if (JUNK_TITLE_PATTERNS.some(p => title.includes(p))) continue;
    if (!url || url.length < 10) continue;
    if (!rawTitle || rawTitle.trim().length < 3) continue;
    const content = (page.text || '').toLowerCase();
    
    // בדוק למידה מרחוק
    const isRemote = location.includes('למידה מרחוק') || 
                    location.includes('מקוון') || 
                    location.includes('אונליין') ||
                    location.includes('zoom') ||
                    title.includes('למידה מרחוק') ||
                    title.includes('מקוון') ||
                    desc.includes('למידה מרחוק');
    
    if (!isRemote) continue;
    
    // בדוק תחום
    const fieldLower = studyField.name.toLowerCase();
    const headerAndDesc = title + ' ' + desc;
    
    let hasField = false;
    
    if (studyField.specificKeyword) {
      const specificLower = studyField.specificKeyword.toLowerCase();
      hasField = headerAndDesc.includes(specificLower) || content.includes(specificLower);
    } else {
      hasField = headerAndDesc.includes(fieldLower) || content.includes(fieldLower);
    }
    
    if (hasField) {
      console.log(`  ✅ Remote: "${page.title}"`);
      results.push({ ...page, isRemote: true, score: 50 });
    }
  }
  
  console.log(`  📊 ${results.length} remote options found`);
  return results.slice(0, 3);
}

// ================================================================
// 💬 QA SYSTEM
// ================================================================

function findQAAnswer(message) {
  loadConfigs();
  const lowerMessage = message.toLowerCase();
  
  // Courses QA
  if (COURSES_QA?.questions) {
    for (const q of COURSES_QA.questions) {
      if (q.question && lowerMessage.includes(q.question.toLowerCase())) {
        return { answer: q.answer, source: 'courses' };
      }
      
      if (q.variations?.some(v => lowerMessage.includes(v.toLowerCase()))) {
        return { answer: q.answer, source: 'courses' };
      }
      
      if (q.keywords?.filter(k => lowerMessage.includes(k.toLowerCase())).length >= 2) {
        return { answer: q.answer, source: 'courses' };
      }
    }
  }
  
  // Payments QA
  if (PAYMENTS_QA?.categories) {
    for (const cat of PAYMENTS_QA.categories) {
      for (const q of cat.questions || []) {
        if (q.question && lowerMessage.includes(q.question.toLowerCase())) {
          return { answer: q.answer, source: 'payments' };
        }
        
        if (q.variations?.some(v => lowerMessage.includes(v.toLowerCase()))) {
          return { answer: q.answer, source: 'payments' };
        }
      }
    }
  }
  
  return null;
}

function classifyIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // QA
  const qaKeywords = ['כמה', 'מתי', 'איך', 'מה זה', 'האם', 'מי', 'למה', 'איפה'];
  if (qaKeywords.some(k => lowerMessage.includes(k))) {
    const qa = findQAAnswer(message);
    if (qa) return { intent: 'qa', data: qa };
  }
  
  // Search
  const searchKeywords = ['קורס', 'לימוד', 'השתלמות', 'תואר', 'מכללה'];
  if (searchKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'search', data: null };
  }
  
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
  
  response += `מצאתי ${results.length} מוסדות `;
  if (region) response += `ב${regionName} `;
  response += `ל${fieldName}:\n\n`;
  
  for (const result of results) {
    const title = result.title || result.h1 || 'ללא שם';
    const desc = result.description || 'אין תיאור';
    const url = result.url || result.link || '#';
    
    response += `🏢${title}\n`;
    response += `${desc.substring(0, 200)}...\n`;
    response += `[למידע ולייעוץ אישי](${url})\n\n`;
  }
  
  // קישור לכל הקורסים
  const slug = studyField?.slug || 'courses';
  response += `💡 [לכל הקורסים ב${fieldName}](https://www.shabaton.online/${slug})`;
  if (region) {
    response += `: [${regionName}](https://www.shabaton.online/${region.slug || 'all'})`;
  }
  
  return response;
}

function formatRemoteResults(results, studyField) {
  if (results.length === 0) return '';
  
  const fieldName = studyField?.specificKeyword || studyField?.name || 'התחום';
  
  let response = `\n\n🌐 **למידה מרחוק ב${fieldName}:**\n\n`;
  response += `לא מצאתי מוסדות באזור שביקשת, אבל יש אפשרויות למידה מרחוק:\n\n`;
  
  for (const result of results) {
    const title = result.title || result.h1 || 'ללא שם';
    const desc = result.description || '';
    const url = result.url || result.link || '#';
    
    response += `📚 **${title}**\n`;
    if (desc) response += `${desc.substring(0, 150)}...\n`;
    response += `[למידע נוסף](${url})\n\n`;
  }
  
  return response;
}

// ================================================================
// 🎯 MAIN HANDLER
// ================================================================

async function generateSmartResponse(message) {
  console.log('========================================');
  console.log('🚀 [generateSmartResponse] START');
  console.log('🚀🚀🚀 CODE VERSION: FEB_17_v102_FILTER_JUNK_PAGES 🚀🚀🚀');
  console.log('========================================');
  
  loadConfigs();
  
  // בדוק QA
  const qaAnswer = findQAAnswer(message);
  if (qaAnswer) {
    console.log('✅ שאלה ספציפית - מחזיר תשובה מ-QA');
    return qaAnswer.answer;
  }
  
  console.log('⚠️ לא שאלה ספציפית');
  
  // זהה תחום ואזור
  const detectedFields = detectStudyField(message);
  const studyField = detectedFields[0] || null;
  const region = detectRegion(message);
  
  const intentInfo = classifyIntent(message);
  console.log(`🎯 [classifyIntent] intent: ${intentInfo.intent}`);
  
  if (intentInfo.intent === 'search') {
    console.log('🔍 === התחלת תהליך חיפוש קורסים ===');
    
    if (studyField) {
      console.log(`✅ תחום זוהה: ${studyField.name}`);
    }
    
    if (region) {
      console.log(`🔍 מחפש מוסדות עבור:`);
      console.log(`תחום: ${studyField?.name || 'כללי'}`);
      console.log(`אזורים: ${region.name}`);
    }
    
    // חפש
    const results = await searchPages(message, region, studyField);
    
    console.log(`📊 נמצאו ${results.length} תוצאות`);
    
    if (results.length > 0) {
      // יש תוצאות!
      const topResults = results.slice(0, 5);
      return formatResults(topResults, studyField, region);
    } else {
      // אין תוצאות - נסה למידה מרחוק
      console.log('⚠️ אין תוצאות - מחפש למידה מרחוק...');
      
      if (studyField) {
        const remoteResults = await searchRemoteLearning(studyField);
        
        if (remoteResults.length > 0) {
          // יש למידה מרחוק!
          let response = `לא מצאתי מוסדות`;
          if (region) response += ` ב${region.name}`;
          response += ` ל${studyField.specificKeyword || studyField.name}.\n`;
          
          response += formatRemoteResults(remoteResults, studyField);
          
          return response;
        }
      }
      
      // אין כלום
      let response = `לא מצאתי מוסדות`;
      if (region) response += ` ב${region.name}`;
      if (studyField) response += ` ל${studyField.specificKeyword || studyField.name}`;
      response += `.\n\n`;
      response += `💡 נסה:\n`;
      response += `• לחפש באזור אחר\n`;
      response += `• לחפש קורסים דומים\n`;
      response += `• ליצור קשר עם המוסדות ישירות\n`;
      
      return response;
    }
  }
  
  // תגובה כללית
  return 'היי! אני כאן לעזור לך למצוא קורסים והשתלמויות למורים בשבתון. אפשר לשאול אותי על קורסים ספציפיים, אזורים, או שאלות כלליות על שבתון.';
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
  // ✅ CORS Headers - חובה לכל בקשה!
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // ✅ OPTIONS Preflight - חייב להחזיר 200!
  if (req.method === 'OPTIONS') {
    console.log('✅ [handler] OPTIONS preflight - OK');
    return res.status(200).end();
  }
  
  const body = req.body || {};
  
  console.log('📨 [handler] New request');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(body).substring(0, 100));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { message } = body;
  
  if (!message || typeof message !== 'string') {
    console.error('❌ Invalid message:', message);
    return res.status(400).json({ 
      error: 'Invalid message',
      received: typeof message
    });
  }
  
  console.log('📨 [handler] Message:', message);
  
  try {
    const response = await generateSmartResponse(message);
    
    console.log(`✅ [handler] Returning response (${response.length} chars)`);
    
    return res.status(200).json({
      reply: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [handler] ERROR:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
