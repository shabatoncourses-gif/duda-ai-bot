// pages/api/chat.js - Vercel Serverless with JSON config files
import fs from 'fs';
import path from 'path';

// ========================================
// 📚 טעינת כל קבצי האינדקס
// ========================================
let ALL_PAGES = null;
let REGIONS = null;
let STUDY_FIELDS = null;
let INSURANCE_QA = null;
let REQUIRED_PHRASES = null; // חדש! מילון ביטויים שחייבים להופיע ברצף

function loadConfigs() {
  try {
    if (!REGIONS) {
      const regionsPath = path.join(process.cwd(), 'data', 'regions.json');
      const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
      REGIONS = regionsData.regions;
    }
  } catch (error) {
    console.error('Error loading regions:', error.message);
    REGIONS = [];
  }
  
  try {
    if (!STUDY_FIELDS) {
      const fieldsPath = path.join(process.cwd(), 'data', 'study-fields.json');
      const fieldsData = JSON.parse(fs.readFileSync(fieldsPath, 'utf8'));
      STUDY_FIELDS = fieldsData.studyFields;
    }
  } catch (error) {
    console.error('Error loading study fields:', error.message);
    STUDY_FIELDS = [];
  }
  
  // טען מילון ביטויים - חדש!
  if (!REQUIRED_PHRASES) {
    try {
      const phrasesPath = path.join(process.cwd(), 'data', 'required-phrases.json');
      const phrasesData = JSON.parse(fs.readFileSync(phrasesPath, 'utf8'));
      REQUIRED_PHRASES = phrasesData.requiredPhrases || [];
      console.log(`[loadConfigs] Loaded ${REQUIRED_PHRASES.length} required phrases`);
    } catch (error) {
      // אם הקובץ לא קיים - לא נורא
      console.log('[loadConfigs] Required phrases not loaded (optional) - continuing without phrase detection');
      REQUIRED_PHRASES = [];
    }
  }
}

function loadInsuranceQA() {
  if (!INSURANCE_QA) {
    try {
      const insurancePath = path.join(process.cwd(), 'data', 'insurance-qa.json');
      const fileContent = fs.readFileSync(insurancePath, 'utf8');
      INSURANCE_QA = JSON.parse(fileContent);
      
      console.log(`✅ נטען insurance-qa.json: ${INSURANCE_QA.questions.length} שאלות, ${INSURANCE_QA.keywords.length} keywords`);
      
      // בדיקת תקינות
      if (!INSURANCE_QA.keywords || INSURANCE_QA.keywords.length === 0) {
        console.error('❌ שגיאה: insurance-qa.json לא מכיל keywords!');
      }
    } catch (error) {
      console.error('❌ שגיאה בטעינת insurance-qa.json:', error.message);
      console.log('⚠️ מערכת ביטוח לאומי לא תעבוד עד שהקובץ יועלה');
      INSURANCE_QA = { questions: [], keywords: [], generalInfo: {}, fallbackMessage: '' };
    }
  }
  return INSURANCE_QA;
}

// ========================================
// 🔍 זיהוי שאלה על ביטוח לאומי
// ========================================
function detectInsuranceQuestion(message) {
  loadInsuranceQA();
  const lowerMessage = message.toLowerCase();
  
  // ✅ בדיקת תקינות: וודא ש-keywords קיים ולא ריק
  if (!INSURANCE_QA || !INSURANCE_QA.keywords || INSURANCE_QA.keywords.length === 0) {
    console.log('⚠️ insurance-qa.json לא נטען נכון - דולג על בדיקת ביטוח לאומי');
    return false;
  }
  
  // 🛡️ הגנה כפולה: השאילתה חייבת להכיל את המילה "ביטוח"
  // (למניעת false positives!)
  if (!lowerMessage.includes('ביטוח')) {
    return false;
  }
  
  // בדיקה פשוטה - האם יש מילת מפתח של ביטוח לאומי?
  // (ללא word boundaries שיכולים לגרום לבעיות עם עברית)
  const hasInsuranceKeyword = INSURANCE_QA.keywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return lowerMessage.includes(keywordLower);
  });
  
  if (hasInsuranceKeyword) {
    console.log('✅ זוהתה שאלה על ביטוח לאומי');
  }
  
  return hasInsuranceKeyword;
}

// ========================================
// 🎯 חיפוש התשובה הטובה ביותר
// ========================================
function findInsuranceAnswer(message) {
  loadInsuranceQA();
  
  // ✅ בדיקת תקינות
  if (!INSURANCE_QA || !INSURANCE_QA.questions || INSURANCE_QA.questions.length === 0) {
    console.log('⚠️ insurance-qa.json לא נטען נכון - אין שאלות');
    return null;
  }
  
  const lowerMessage = message.toLowerCase();
  
  // 🎯 בדיקה: האם זו שאלה ספציפית?
  // שאלה ספציפית = מכילה מילת שאלה
  const questionWords = ['מתי', 'איך', 'מה', 'למה', 'האם', 'מדוע', 'איפה', 'כמה', 'האם'];
  const isSpecificQuestion = questionWords.some(word => lowerMessage.includes(word));
  
  // אם זו לא שאלה ספציפית - הפנה לדף כללי
  if (!isSpecificQuestion) {
    console.log('⚠️ שאלה כללית (אין מילת שאלה) - מציג מידע כללי');
    return null;
  }
  
  console.log('✅ שאלה ספציפית - מחפש תשובה');
  
  // ניקוי השאילתה
  const cleanMessage = lowerMessage
    .replace(/\?/g, '')
    .replace(/\./g, '')
    .trim();
  
  // חישוב ציון התאמה לכל שאלה
  const scoredQuestions = INSURANCE_QA.questions.map(qa => {
    let score = 0;
    
    // התאמה למילות מפתח של השאלה
    for (const keyword of qa.keywords) {
      if (cleanMessage.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }
    
    // התאמה לטקסט השאלה עצמה
    const questionWords = qa.question.toLowerCase().split(/\s+/);
    const messageWords = cleanMessage.split(/\s+/);
    
    for (const word of messageWords) {
      if (word.length > 2 && questionWords.some(qw => qw.includes(word) || word.includes(qw))) {
        score += 5;
      }
    }
    
    return { qa, score };
  });
  
  // מיון לפי ציון
  scoredQuestions.sort((a, b) => b.score - a.score);
  
  const bestMatch = scoredQuestions[0];
  const bestScore = bestMatch ? bestMatch.score : 0;
  
  console.log(`🔍 ציון התאמה מירבי: ${bestScore}`);
  
  // לשאלה ספציפית - החזר את התשובה הכי טובה
  if (bestMatch && bestScore >= 10) {
    console.log(`✅ נמצאה תשובה: "${bestMatch.qa.question.substring(0, 50)}..."`);
    return bestMatch.qa;
  }
  
  console.log('⚠️ לא נמצאה תשובה טובה מספיק');
  return null;
}

// ========================================
// 📝 עיצוב תשובה על ביטוח לאומי
// ========================================
function formatInsuranceAnswer(qa) {
  let response = `💼 **ביטוח לאומי בשבתון**\n\n`;
  
  // השאלה
  response += `**שאלה:**\n${qa.question}\n\n`;
  
  // התשובה
  response += `**תשובה:**\n${qa.answer}\n`;
  
  // קישורים נוספים (אם יש)
  if (qa.relatedLinks && qa.relatedLinks.length > 0) {
    response += `\n`;
    qa.relatedLinks.forEach(link => {
      response += `[${link.text}](${link.url})\n`;
    });
  }
  
  // ✨ תמיד הוסף את הקישור המרכזי לביטוח לאומי
  // (רק אם הוא לא כבר מוצג)
  const btlLink = 'https://www.shabaton.online/btl_shabaton';
  const alreadyHasLink = qa.relatedLinks && qa.relatedLinks.some(link => link.url === btlLink);
  
  if (!alreadyHasLink) {
    response += `\n[למידע מפורט על ביטוח לאומי בשבתון](${btlLink})\n`;
  }
  
  return response;
}

// ========================================
// 📋 עיצוב תשובה כללית על ביטוח לאומי
// ========================================
function formatGeneralInsuranceInfo() {
  loadInsuranceQA();
  
  // ✅ בדיקת תקינות
  if (!INSURANCE_QA || !INSURANCE_QA.generalInfo || !INSURANCE_QA.questions) {
    console.log('⚠️ insurance-qa.json לא נטען נכון - מחזיר הודעת fallback');
    return `💼 **ביטוח לאומי בשבתון**\n\nלמידע מפורט על ביטוח לאומי בשבתון:\n[ביטוח לאומי בשבתון - מדריך מלא](https://www.shabaton.online/btl_shabaton)\n\nאו לשאול בקבוצת WhatsApp:\n[פנו למידע נוסף](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)`;
  }
  
  let response = `💼 **ביטוח לאומי בשבתון**\n\n`;
  response += `${INSURANCE_QA.generalInfo.content}\n\n`;
  
  // 🎯 הקישור המרכזי - זה מה שהמשתמש צריך!
  response += `**📘 למידע מפורט ולוח זמנים:**\n`;
  response += `[ביטוח לאומי בשבתון - מדריך מלא](https://www.shabaton.online/btl_shabaton)\n\n`;
  
  response += `💡 אפשר גם לשאול אותי שאלות ספציפיות, למשל:\n`;
  response += `• "מתי להירשם לביטוח לאומי?"\n`;
  response += `• "אם אעבוד בשבתון צריך לשלם?"\n`;
  response += `• "מה ההבדל בין שבתון מלא לחצי?"`;
  
  return response;
}

function loadAllPages() {
  if (!ALL_PAGES) {
    try {
      ALL_PAGES = [];
      
      // טעינת כל קבצי האינדקס
      const indexFiles = [
        'shabaton_index_part1.json',
        'shabaton_index_part2.json',
        'morim_index_part1.json',
        'shabaton_index.json'
      ];
      
      for (const filename of indexFiles) {
        try {
          const filepath = path.join(process.cwd(), 'data', filename);
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          
          // אם זה מערך - הוסף ישירות
          if (Array.isArray(data)) {
            ALL_PAGES = ALL_PAGES.concat(data);
          } else if (data.pages) {
            // אם יש שדה pages
            ALL_PAGES = ALL_PAGES.concat(data.pages);
          } else {
            // אחרת הוסף את האובייקט עצמו
            ALL_PAGES.push(data);
          }
        } catch (err) {
          console.log(`Could not load ${filename}:`, err.message);
        }
      }
      
      console.log(`Loaded ${ALL_PAGES.length} total pages from all indexes`);
      
      if (ALL_PAGES.length === 0) {
        console.error('⚠️⚠️⚠️ WARNING: ALL_PAGES is EMPTY! No index files loaded! ⚠️⚠️⚠️');
      }
    } catch (error) {
      console.error('Error loading indexes:', error);
      ALL_PAGES = [];
    }
  }
  return ALL_PAGES;
}

// ========================================
// 📅 בדיקה אם תאריך פתיחה בתוך 3 חודשים
// ========================================
function isWithinThreeMonths(dateStr) {
  if (!dateStr) return false;
  
  try {
    const courseDate = new Date(dateStr);
    const today = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(today.getMonth() + 3);
    
    return courseDate >= today && courseDate <= threeMonthsFromNow;
  } catch {
    return false;
  }
}

// ========================================
// 🚫 בדיקה אם URL או כותרת צריכים להיות מסוננים
// ========================================
function shouldFilterUrl(url, title = '') {
  if (!url) return true;
  
  const urlLower = url.toLowerCase();
  const titleLower = (title || '').toLowerCase();
  
  const blockedPatterns = [
    '/drushim/',
    '/consult',
    '/contact',
    '/knassim',
    '/משרות-הוראה',
    '/הוספת-מודעה',
    'https://www.shabaton.online/$', // דף הבית
    '/courses-per-month-', // דפי חודשים - לא רלוונטי!
    '/Ma_Edu_', // דפי תואר שני כלליים
    'close carousel', // תוכן לא רלוונטי
    // דפים ספציפיים ב-morim.boutique שלא רלוונטיים
    'morim.boutique/art',
    'morim.boutique/mosaic',
    'morim.boutique/courses-jewelry',
    'morim.boutique/empowering',
    'morim.boutique/cooking',
    'morim.boutique/trips',
    'morim.boutique/health',
    'morim.boutique/fashion',
    'morim.boutique/$', // דף הבית של morim
    'קורסי-נגרות-וחידוש-רהיטים'
  ];
  
  // בדיקת URL
  if (blockedPatterns.some(pattern => urlLower.includes(pattern))) {
    return true;
  }
  
  // בדיקת כותרת - דפים כלליים
  const blockedTitles = [
    'קורסי העשרה',
    'העשרה ופנאי',
    'קורסים כלליים',
    'לוח זמנים',
    'לוח הזמנים',
    'סמינר הקיבוצים',
    'המכללה האקדמית',
    'השתלמויות מורים',
    'מרכז י.נ.ר',
    'נישואין ומשפחה'
  ];
  
  if (blockedTitles.some(pattern => titleLower.includes(pattern))) {
    return true;
  }
  
  return false;
}

// ========================================
// 🔍 חיפוש מחמיר - רק התאמות חזקות!
// ========================================
function searchPagesStrict(query, region, studyField) {
  const results = [];
  const pages = loadAllPages(); // טען את כל הדפים!
  
  for (const page of pages) {
    // ==============================
    // שלב 1: בדיקות בסיסיות
    // ==============================
    
    // חסום URLs לא רלוונטיים
    if (shouldFilterUrl(page.url, page.title || page.h1)) {
      continue;
    }
    
    const title = (page.title || page.h1 || '').toLowerCase();
    const description = (page.description || '').toLowerCase();
    const url = (page.url || '').toLowerCase();
    const location = (page.location || '').toLowerCase();
    
    // רק דפים סטטיים
    const isStaticPage = !url.includes('/results-') && 
                         !url.includes('/search-results-') && 
                         !url.includes('/courses-per-month');
    
    if (!isStaticPage) continue;
    
    // לא דפי מידע!
    const isInfoPage = url.includes('/luz_shabaton') ||
                       url.includes('/shabaton-video') ||
                       url.includes('/end_shabaton') ||
                       url.includes('/halforfull_shabaton') ||
                       url.includes('/phones_shabaton') ||
                       url.includes('/forms_shabaton') ||
                       url.includes('/time') ||
                       url.includes('/schedule') ||
                       url.includes('/timetable') ||
                       title.includes('לוח זמנים') ||
                       title.includes('לוח הזמנים');
    
    if (isInfoPage) continue;
    
    // ==============================
    // שלב 2: בדיקת keywords (חובה!)
    // ==============================
    
    let hasKeyword = false;
    
    if (studyField && studyField.keywords) {
      for (const kw of studyField.keywords) {
        const kwLower = kw.toLowerCase();
        
        // בדוק אם המילה מופיעה (includes פשוט)
        if (title.includes(kwLower) || description.includes(kwLower)) {
          hasKeyword = true;
          break;
        }
      }
    }
    
    // אם אין keyword - דלג!
    if (!hasKeyword) continue;
    
    // ==============================
    // שלב 3: בדיקת אזור (בונוס!)
    // ==============================
    
    let inRegion = false;
    let regionScore = 0;
    
    // בדוק שיש region לפני שניגש ל-cities
    if (!region || !region.cities) {
      continue; // אין region - דלג על הדף
    }
    
    // אופציה 1: יש location field
    if (location && location.trim() !== '') {
      inRegion = region.cities.some(city => {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        return location.includes(cityLower);
      });
      
      if (inRegion) {
        regionScore = 50; // בונוס גבוה למוסד מהאזור
      } else {
        // בדוק אם ה-location הוא ארצי/כללי
        const isNationalLocation = location.includes('ארצי') || 
                                    location.includes('כל הארץ') ||
                                    location.includes('למידה מרחוק') ||
                                    location.includes('אונליין') ||
                                    location.includes('online');
        
        if (isNationalLocation) {
          regionScore = 5; // בונוס קטן מאוד לקורסים ארציים
        } else {
          continue; // location ספציפי לא מהאזור - דלג
        }
      }
    } else {
      // אופציה 2: יש עיר בכותרת או תיאור
      const titleAndDesc = title + ' ' + description;
      
      for (const city of region.cities) {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        if (titleAndDesc.includes(cityLower)) {
          inRegion = true;
          regionScore = 30; // בונוס בינוני לעיר בכותרת
          break;
        }
      }
      
      // אם אין location ואין עיר - תן בונוס קטן
      if (!inRegion) {
        regionScore = 10; // בונוס קטן לדפים כלליים
      }
    }
    
    // ==============================
    // שלב 4: הדף עבר את כל הבדיקות!
    // ==============================
    
    results.push({
      ...page,
      matchScore: 100 + regionScore // ציון בסיס + בונוס אזור
    });
  }
  
  // החזר את התוצאות ממוינות לפי ציון
  return results
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .slice(0, 20); // מקסימום 20 תוצאות
}

// ========================================
// 🔍 חיפוש דפים באינדקסים (חיפוש מאוזן!)
// ========================================
function searchPages(query, region = null, pageType = 'all', studyField = null) {
  console.log(`\n========== [searchPages] START ==========`);
  console.log(`Query: "${query}"`);
  console.log(`Region: ${region?.name || 'none'}`);
  console.log(`Region object:`, region ? JSON.stringify(region) : 'null');
  console.log(`Study Field: ${studyField?.name || 'none'}`);
  console.log(`Study Field keywords:`, studyField?.keywords || 'none');
  console.log(`REGIONS available:`, REGIONS ? `yes (${REGIONS.length})` : 'no');
  console.log(`REQUIRED_PHRASES available:`, REQUIRED_PHRASES ? `yes (${REQUIRED_PHRASES.length})` : 'no');
  
  const pages = loadAllPages();
  console.log(`Total pages loaded: ${pages?.length || 0}`);
  
  const lowerQuery = query.toLowerCase();
  
  // ניקוי השאילתה לחיפוש
  let cleanQuery = lowerQuery.replace(/\sב([א-ת])/g, ' $1');
  cleanQuery = cleanQuery.replace(/-/g, ' ');
  cleanQuery = cleanQuery.replace(/קורס(י)?/g, '').trim();
  
  // חלץ מילות מפתח לפני הסרת ערים
  const stopWords = ['מרכז', 'הארץ', 'במרכז', 'בארץ', 'ב', 'ה', 'של', 'את', 'עם', 'על', 'אל', 'כל', 'צפון', 'בצפון', 'הצפון', 'דרום', 'בדרום', 'שרון', 'בשרון'];
  let queryWords = cleanQuery.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  // זיהוי: שאילתה ספציפית? (2+ מילות מפתח כולל עיר)
  const isSpecificQuery = queryWords.length >= 2;
  
  // עכשיו הסר שמות ערים מה-cleanQuery (אבל לא מ-queryWords!)
  let cleanQueryForSearch = cleanQuery;
  if (region && region.cities) {
    for (const city of region.cities) {
      const cityLower = city.toLowerCase();
      cleanQueryForSearch = cleanQueryForSearch.replace(new RegExp('\\b' + cityLower + '\\b', 'gi'), '').trim();
    }
  }
  
  // עדכן queryWords ללא שמות ערים
  const queryWordsWithoutCities = cleanQueryForSearch.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  if (queryWordsWithoutCities.length === 0) {
    return [];
  }
  
  // **סף נמוך - מאפשר תוצאות גם עם התאמה חלקית**
  const minScore = 5; // סף נמוך לגמישות מקסימלית
  
  // **זיהוי מילת הנושא העיקרית (לא כולל מילות רעש)**
  // מילות רעש: קורס, קורסי, לימודי, השתלמות, וכו'
  const noiseWords = ['קורס', 'קורסי', 'קורסים', 'לימודי', 'לימוד', 'השתלמות', 'השתלמויות', 'סדנה', 'סדנת', 'סדנאות', 'הכשרה', 'הכשרת'];
  const topicWords = queryWordsWithoutCities.filter(w => !noiseWords.includes(w));
  
  // המילה העיקרית היא הראשונה שאינה מילת רעש
  const mainTopicWord = topicWords.length > 0 ? topicWords[0] : queryWordsWithoutCities[0];
  
  // **זיהוי ביטוי מהמילון - חדש!**
  // בדוק אם השאילתה מכילה ביטוי מהמילון של ביטויים שחייבים להופיע ברצף
  loadConfigs(); // וודא שהמילון נטען
  
  let detectedPhrase = null;
  let phraseVariations = [];
  
  if (REQUIRED_PHRASES && REQUIRED_PHRASES.length > 0) {
    for (const phraseEntry of REQUIRED_PHRASES) {
      const mainPhrase = phraseEntry.phrase.toLowerCase();
      
      // בדוק אם השאילתה מכילה את הביטוי הזה
      if (lowerQuery.includes(mainPhrase)) {
        detectedPhrase = mainPhrase;
        phraseVariations = phraseEntry.variations.map(v => v.toLowerCase());
        break; // מצאנו ביטוי - נעצור
      }
    }
  }
  
  console.log(`[searchPages] Detected phrase: "${detectedPhrase || 'none'}"`);
  if (phraseVariations.length > 0) {
    console.log(`[searchPages] Phrase variations: ${phraseVariations.join(', ')}`);
  }
  console.log(`[searchPages] Starting page loop...`);
  
  let results = [];
  let passedPhraseCheck = 0;
  let failedPhraseCheck = 0;
  let totalPagesChecked = 0;
  let passedTotalMatches = 0;
  let failedTotalMatches = 0;
  
  for (const page of pages) {
    totalPagesChecked++;
    
    // 🔍 Debug ספציפי לדף gishot
    const isGishotPage = page.url && page.url.includes('gishot');
    if (isGishotPage) {
      console.log(`\n🎯 [DEBUG-GISHOT] Found gishot page!`);
      console.log(`  URL: ${page.url}`);
      console.log(`  Title: ${page.title || page.h1}`);
      console.log(`  Description: ${page.description || 'none'}`);
      console.log(`  Location: ${page.location || 'none'}`);
    }
    
    // לוג את ה-10 הדפים הראשונים
    if (totalPagesChecked <= 10) {
      console.log(`[searchPages] Page ${totalPagesChecked}: "${page.title || page.h1}"`);
    }
    
    if (shouldFilterUrl(page.url, page.title || page.h1)) {
      if (isGishotPage) {
        console.log(`  ❌ FILTERED by shouldFilterUrl`);
      }
      continue;
    }
    
    if (isGishotPage) {
      console.log(`  ✅ Passed shouldFilterUrl`);
    }
    
    const title = (page.title || page.h1 || '').toLowerCase();
    const description = (page.description || '').toLowerCase();
    const url = (page.url || '').toLowerCase();
    const keywords = (page.keywords || []).map(k => k.toLowerCase());
    
    // זיהוי סוג הדף
    const isStaticPage = !url.includes('/results-') && !url.includes('/search-results-') && !url.includes('/courses-per-month');
    const isInfoPage = url.includes('/luz_shabaton') ||
                       url.includes('/shabaton-video') ||
                       url.includes('/end_shabaton') ||
                       url.includes('/halforfull_shabaton') ||
                       url.includes('/phones_shabaton') ||
                       url.includes('/forms_shabaton') ||
                       url.includes('/Payments_shabaton') ||
                       url.includes('/tlush_maanak_shabaton') ||
                       url.includes('/btl-morim-shabaton') ||
                       url.includes('/birth_shabatgon') ||
                       url.includes('/tuition_reimbursement') ||
                       url.includes('/kabalot_shabaton') ||
                       url.includes('/shabaton-maanak') ||
                       url.includes('/pension_shabaton') ||
                       url.includes('/keren_makor_mishor') ||
                       url.includes('/tofes_101') ||
                       url.includes('/learning_programs_shabaton') ||
                       url.includes('/time') ||  // לוח זמנים
                       url.includes('/schedule') ||  // לוח זמנים
                       url.includes('/timetable') ||  // לוח זמנים
                       title.includes('לוח זמנים') ||  // לוח זמנים בכותרת
                       title.includes('לוח הזמנים');  // לוח הזמנים בכותרת
    
    // Debug: לוג את ה-5 דפים הראשונים שעוברים את הפילטרים
    if (totalPagesChecked <= 5 && !shouldFilterUrl(page.url, page.title || page.h1)) {
      console.log(`[Page ${totalPagesChecked}] isStatic: ${isStaticPage}, URL: ${url.substring(0, 60)}...`);
    }
    
    if (pageType === 'static' && !isStaticPage) continue;
    if (pageType === 'info' && !isInfoPage) continue;
    
    let matchScore = 0;
    
    // **בונוס studyField - אם יש התאמה לתחום הלימוד**
    if (studyField && studyField.keywords) {
      for (const kw of studyField.keywords) {
        const kwLower = kw.toLowerCase();
        
        if (title.includes(kwLower)) {
          matchScore += 50; // בונוס גבוה לתואם studyField בכותרת!
          break;
        } else if (description.includes(kwLower)) {
          matchScore += 40; // בונוס גבוה לתואם studyField בתיאור
          break;
        } else if (keywords.some(k => k.toLowerCase().includes(kwLower))) {
          matchScore += 30; // בונוס לתואם studyField ב-keywords
          break;
        }
      }
    }
    
    // **עדיפות עליונה: ביטוי מלא מופיע!**
    if (cleanQueryForSearch.length > 5) {
      if (title.includes(cleanQueryForSearch)) {
        matchScore += 100; // ביטוי מלא בכותרת!
      }
      if (description.includes(cleanQueryForSearch)) {
        matchScore += 70;
      }
    }
    
    // **בדיקת מילות מפתח**
    let wordMatchesInTitle = 0;
    let wordMatchesInDesc = 0;
    let wordMatchesInKeywords = 0;
    let hasMainTopic = false;
    
    // **פונקציה עזרה: התאמה גמישה של מילים (שורש)**
    function flexibleMatch(text, word) {
      if (text.includes(word)) return true;
      if (word.includes(text)) return true;
      
      // בדיקת שורש משותף (4+ תווים)
      if (word.length >= 4) {
        const stem = word.substring(0, Math.min(word.length - 1, 5));
        if (text.includes(stem)) return true;
      }
      
      return false;
    }
    
    for (const word of queryWordsWithoutCities) {
      let foundInTitle = flexibleMatch(title, word);
      let foundInDesc = flexibleMatch(description, word);
      let foundInKeywords = keywords.some(k => flexibleMatch(k, word));
      
      // זיהוי אם זו מילת הנושא העיקרית
      const isMainTopic = (word === mainTopicWord);
      
      if (foundInTitle) {
        matchScore += isMainTopic ? 30 : 20; // ציון גבוה יותר לנושא העיקרי
        wordMatchesInTitle++;
        if (isMainTopic) hasMainTopic = true;
      }
      if (foundInDesc) {
        matchScore += isMainTopic ? 15 : 10;
        wordMatchesInDesc++;
        if (isMainTopic) hasMainTopic = true;
      }
      if (foundInKeywords) {
        matchScore += isMainTopic ? 12 : 8;
        wordMatchesInKeywords++;
        if (isMainTopic) hasMainTopic = true;
      }
    }
    
    // **חשב סך המילים שנמצאו**
    const totalMatches = wordMatchesInTitle + wordMatchesInDesc + wordMatchesInKeywords;
    const matchRatio = totalMatches / queryWordsWithoutCities.length;
    
    // **בדיקת ביטוי מהמילון - דרישה חובה!**
    // אם זוהה ביטוי במילון, הוא חייב להופיע בדף!
    let foundPhraseVariation = false; // דגל חדש!
    
    if (detectedPhrase && phraseVariations.length > 0) {
      const pageText = (title + ' ' + description).toLowerCase();
      
      // 🔍 Debug לדף gishot
      if (isGishotPage) {
        console.log(`  [DEBUG-GISHOT] Phrase check:`);
        console.log(`    Detected phrase: "${detectedPhrase}"`);
        console.log(`    Phrase variations:`, phraseVariations);
        console.log(`    Page text: "${pageText.substring(0, 200)}..."`);
      }
      
      // בדוק אם אחת מהוריאציות מופיעה בדף
      let exactVariation = null;
      
      for (const variation of phraseVariations) {
        if (pageText.includes(variation)) {
          foundPhraseVariation = true; // דף עבר את בדיקת הביטוי!
          exactVariation = variation;
          
          if (isGishotPage) {
            console.log(`    ✅ Found variation: "${variation}"`);
          }
          
          break;
        }
      }
      
      // ⭐ אם זוהה ביטוי אבל הוא לא נמצא בדף - דחה את הדף!
      if (!foundPhraseVariation) {
        failedPhraseCheck++;
        
        if (isGishotPage) {
          console.log(`    ❌ Phrase required but not found - PAGE REJECTED`);
        }
        
        // לוג דחייה
        if (failedPhraseCheck <= 5) {
          console.log(`[searchPages] Page REJECTED (phrase required): "${page.title || page.h1}"`);
        }
        
        continue; // ⭐ דלג על הדף!
      }
      
      // אם נמצא הביטוי - תן בונוס גבוה!
      passedPhraseCheck++;
      
      if (isGishotPage) {
        console.log(`    ✅ Phrase bonus added`);
      }
      
      // לוג את ה-5 הדפים הראשונים שעברו
      if (passedPhraseCheck <= 5) {
        console.log(`[searchPages] Page PASSED (has phrase): "${page.title || page.h1}" - found: "${exactVariation}"`);
      }
      
      // בונוס אם הביטוי המדויק (לא וריאציה) נמצא
      if (exactVariation === detectedPhrase) {
        matchScore += 100; // בונוס ענק לביטוי מדויק!
      } else {
        matchScore += 50; // בונוס לוריאציה
      }
    }
    
    // **הערה: totalMatches היא רק בונוס, לא דרישה**
    // דפים יכולים לעבור גם עם totalMatches=0 אם יש להם matchScore מספיק גבוה
    // (למשל מהתאמת אזור, studyField, וכו')
    
    if (totalMatches > 0 || foundPhraseVariation) {
      passedTotalMatches++;
    }
    
    // **בונוס אם רוב המילים נמצאו**
    if (matchRatio >= 0.7) {
      matchScore += 25; // 70% מהמילים נמצאו
    }
    
    // **בונוס נוסף אם כל המילים בכותרת**
    if (wordMatchesInTitle >= queryWordsWithoutCities.length) {
      matchScore += 30; // כל המילים בכותרת!
    }
    
    // ⭐ זיהוי עיר ספציפית (קודם!)
    const specificCity = detectSpecificCity(query, region);
    
    // בדיקת עיר ספציפית - בונוס ענק!
    let cityBonus = 0;
    let isInSpecificCity = false;
    
    if (specificCity && isStaticPage) {
      const location = (page.location || '').toLowerCase();
      const titleAndDesc = (title + ' ' + description + ' ' + url).toLowerCase();
      const cityLower = specificCity.toLowerCase().replace(/-/g, ' ');
      
      // בדיקה אם הדף מהעיר הספציפית
      const inLocation = location.includes(cityLower);
      const inTitleOrDesc = titleAndDesc.includes(cityLower);
      
      if (inLocation || inTitleOrDesc) {
        isInSpecificCity = true;
        cityBonus = 100; // ⭐ בונוס ענק לעיר ספציפית!
        matchScore += cityBonus;
      }
    }
    
    // בדיקת אזור (רק אם לא מצאנו עיר ספציפית)
    let matchesRegion = true;
    let regionBonus = 0;
    
    if (region && region.cities && isStaticPage && !isInSpecificCity) {
      const location = (page.location || '').toLowerCase();
      const titleAndDesc = (title + ' ' + description).toLowerCase();
      
      // בדוק גם ב-location וגם בכותרת/תיאור
      const inLocation = region.cities.some(city => {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        return location.includes(cityLower);
      });
      
      // ✅ אם יש location מדויק - תסתמך עליו!
      if (location && location.trim() !== '') {
        matchesRegion = inLocation;
        
        if (matchesRegion) {
          regionBonus = 50; // בונוס גבוה לדף מהאזור
        } else {
          // במקום לדחות - פשוט אל תתן בונוס
          // הדף עדיין יכול לעבור אם יש לו ציון מספיק מתחומים אחרים
          regionBonus = 0;
        }
      } else {
        // אם אין location - בדוק מה העיר הראשונה שמופיעה בכותרת/תיאור
        let firstCityPosition = Infinity;
        let firstCity = null;
        let firstCityInRegion = false;
        
        // עבור על כל הערים בכל האזורים
        if (!REGIONS || !Array.isArray(REGIONS)) {
          console.error('[searchPages] REGIONS is not available!');
          // דלג על בדיקה זו
        } else {
          for (const r of REGIONS) {
            for (const city of r.cities) {
              const cityLower = city.toLowerCase().replace(/-/g, ' ');
              const pos = titleAndDesc.indexOf(cityLower);
              
              if (pos !== -1 && pos < firstCityPosition) {
                firstCityPosition = pos;
                firstCity = city;
                firstCityInRegion = (r.name === region.name);
              }
            }
          }
        }
        
        // בדוק אם יש עיר כלשהי מוזכרת (מכל אזור)
        let anyCityMentioned = false;
        if (REGIONS && Array.isArray(REGIONS)) {
          for (const r of REGIONS) {
            for (const city of r.cities) {
              const cityLower = city.toLowerCase().replace(/-/g, ' ');
              if (titleAndDesc.includes(cityLower)) {
                anyCityMentioned = true;
                break;
              }
            }
            if (anyCityMentioned) break;
          }
        }
        
        // אם אין שום עיר מוזכרת - בדוק אם האזור מוזכר במפורש
        if (!anyCityMentioned) {
          // בדוק אם שם האזור או מילות מפתח של האזור מופיעים בדף
          const regionMentioned = titleAndDesc.includes(region.name.toLowerCase()) ||
                                  (region.keywords && region.keywords.some(k => titleAndDesc.includes(k.toLowerCase())));
          
          if (regionMentioned) {
            matchesRegion = true;
            regionBonus = 10; // בונוס קטן לדפים כלליים של האזור
          } else {
            // אין עיר ואין אזור - דלג!
            // (כאשר מחפשים באזור ספציפי, רק דפים מהאזור צריכים לעבור)
            continue;
          }
        } else if (firstCity === null) {
          // יש עיר מוזכרת אבל לא מצאנו אותה - שגיאה?
          continue;
        } else {
          // יש עיר - בדוק אם היא מהאזור הנכון
          if (!firstCityInRegion) {
            continue;
          }
          matchesRegion = true;
        }
      }
      
      // בונוס אם מוזכר באזור הנכון
      if (inLocation) {
        regionBonus = 20; // בונוס גבוה למיקום מדויק
      } else if (matchesRegion) {
        regionBonus = 15; // בונוס נמוך יותר אם רק בתיאור
      }
      
      matchScore += regionBonus;
    }
    
    // 🔍 Debug לדף gishot - final score
    if (isGishotPage) {
      console.log(`  [DEBUG-GISHOT] Final matchScore: ${matchScore}`);
      console.log(`  [DEBUG-GISHOT] Will be added to results: ${matchScore > 0 ? 'YES' : 'NO'}`);
    }
    
    if (matchScore > 0) {
      if (isGishotPage) {
        console.log(`  ✅ [DEBUG-GISHOT] ADDED TO RESULTS`);
      }
      
      results.push({
        ...page,
        isStatic: isStaticPage,
        isInfo: isInfoPage,
        isInSpecificCity: isInSpecificCity,  // ⭐ חדש!
        specificCity: isInSpecificCity ? specificCity : null,  // ⭐ חדש!
        score: matchScore
      });
    }
  }
  
  console.log(`\n[searchPages] ========== SUMMARY ==========`);
  console.log(`[searchPages] Total pages checked: ${totalPagesChecked}`);
  console.log(`[searchPages] Phrase check: ${passedPhraseCheck} passed, ${failedPhraseCheck} failed`);
  console.log(`[searchPages] Results before filtering: ${results.length}`);
  console.log(`[searchPages] Min score required: ${minScore}`);
  
  if (results.length > 0) {
    console.log(`[searchPages] Top 3 scores: ${results.slice(0, 3).map(r => `${r.score} (${r.title || r.h1})`).join(', ')}`);
    console.log(`[searchPages] Score range: ${Math.min(...results.map(r => r.score))} - ${Math.max(...results.map(r => r.score))}`);
  } else {
    console.log(`[searchPages] ⚠️ NO RESULTS before filtering!`);
  }
  
  // מיון משופר
  results.sort((a, b) => {
    // ⭐ עדיפות ראשונה: עיר ספציפית!
    if (a.isInSpecificCity && !b.isInSpecificCity) return -1;
    if (!a.isInSpecificCity && b.isInSpecificCity) return 1;
    
    // עדיפות שנייה: דפים סטטיים
    if (a.isStatic && !b.isStatic) return -1;
    if (!a.isStatic && b.isStatic) return 1;
    
    // עדיפות שלישית: ציון
    return b.score - a.score;
  });
  
  // **סינון לפי סף**
  const beforeFilterResults = [...results]; // שמור עותק לפני filter
  const beforeFilter = results.length;
  results = results.filter(r => r.score >= minScore);
  const afterFilter = results.length;
  
  console.log(`[searchPages] After score filter (>=${minScore}): ${afterFilter} results (removed ${beforeFilter - afterFilter})`);
  
  // בדוק אם gishot היה בתוצאות לפני/אחרי הfilter
  const gishotBefore = beforeFilterResults.find(r => r.url && r.url.includes('gishot'));
  const gishotAfter = results.find(r => r.url && r.url.includes('gishot'));
  
  if (gishotBefore) {
    if (gishotAfter) {
      console.log(`🎯 [DEBUG-GISHOT] Still in results after filter! Score: ${gishotAfter.score}`);
    } else {
      console.log(`❌ [DEBUG-GISHOT] Was in results (score: ${gishotBefore.score}) but REMOVED by filter (minScore: ${minScore})`);
    }
  }
  
  console.log(`[searchPages] After score filter (>=${minScore}): ${results.length} results`);
  console.log(`[searchPages] Returning: ${Math.min(results.length, 10)} results`);
  console.log(`[searchPages] ========== END ==========\n`);
  
  return results.slice(0, 10);
}

// ========================================
// 📝 פורמט תוצאות חיפוש (עיצוב אלגנטי!)
// ========================================
function formatSearchResults(pages, region = null) {
  console.log(`\n🎨 [formatSearchResults] START`);
  console.log(`📊 Total pages received: ${pages.length}`);
  
  if (pages.length === 0) return null;
  
  let response = '';
  const staticPages = pages.filter(p => p.isStatic);
  
  console.log(`📊 Static pages: ${staticPages.length}`);
  console.log(`📊 Non-static pages: ${pages.length - staticPages.length}`);
  
  // **תצוגה בסדר:**
  // 1. דפים סטטיים (מוסדות)
  // 2. דפים דינמיים (חיפוש)
  
  // ========================================
  // 1. הצגת מוסדות (דפים סטטיים)
  // ========================================
  if (staticPages.length > 0) {
    staticPages.forEach((page, index) => {
      const title = page.title || page.h1 || 'מוסד לימודים';
      
      // כותרת מוסד (ללא אייקון, גופן רגיל)
      response += `**${title}**\n`;
      
      // רשימת קורסים או תיאור
      if (page.courses && Array.isArray(page.courses) && page.courses.length > 0) {
        // הצג עד 2 קורסים
        page.courses.slice(0, 2).forEach(course => {
          response += `${course}\n`;
        });
      } else if (page.description) {
        // תיאור חכם - עד 250 תווים, חיתוך במילה שלמה
        let desc = page.description.trim();
        
        if (desc.length > 250) {
          // חתוך ב-250 תווים
          desc = desc.substring(0, 250);
          
          // מצא את הרווח האחרון (גבול מילה)
          const lastSpace = desc.lastIndexOf(' ');
          
          if (lastSpace > 200) {
            // אם יש רווח סביר, חתוך שם
            desc = desc.substring(0, lastSpace) + '...';
          } else {
            // אם אין רווח, פשוט חתוך ב-250
            desc = desc + '...';
          }
        }
        
        if (desc) response += `${desc}\n`;
      }
      
      // תאריך פתיחה (אם ב-3 חודשים הקרובים)
      if (page.startDate && isWithinThreeMonths(page.startDate)) {
        const date = new Date(page.startDate).toLocaleDateString('he-IL');
        response += `📅 ${date}\n`;
      }
      
      // קישור עם חץ כתום
      let cleanUrl = page.url;
      if (cleanUrl && cleanUrl.includes('://') && cleanUrl.indexOf('://') !== cleanUrl.lastIndexOf('://')) {
        const parts = cleanUrl.split('://');
        cleanUrl = parts[0] + '://' + parts[parts.length - 1];
      }
      response += `[→ פנו למוסד הלימודים](${cleanUrl})\n`;
      
      // מפריד דק בין מוסדות
      if (index < staticPages.length - 1) {
        response += `\n`;
      }
    });
  }
  
  // ========================================
  // 2. הצגת דפי חיפוש (דפים דינמיים)
  // ========================================
  const dynamicPages = pages.filter(p => !p.isStatic && !p.isInfo);
  
  if (dynamicPages.length > 0) {
    // אם יש דפים סטטיים, הוסף מפריד
    if (staticPages.length > 0) {
      response += `\n---\n\n**דפי חיפוש נוספים:**\n\n`;
    }
    
    dynamicPages.forEach((page, index) => {
      const title = page.title || page.h1 || 'קורסים';
      const cleanTitle = title.replace(/\n/g, ' ').replace(/close carousel/g, '').trim();
      
      // קישור לדף הדינמי
      let cleanUrl = page.url;
      if (cleanUrl && cleanUrl.includes('://') && cleanUrl.indexOf('://') !== cleanUrl.lastIndexOf('://')) {
        const parts = cleanUrl.split('://');
        cleanUrl = parts[0] + '://' + parts[parts.length - 1];
      }
      
      response += `[${cleanTitle}](${cleanUrl})\n`;
    });
  }
  
  return response;
}

// ========================================
// 🔍 זיהוי אזור מהשאלה
// ========================================
function detectRegions(message) {
  loadConfigs();
  
  // וודא ש-REGIONS הוא מערך (במקרה ש-loadConfigs נכשל)
  if (!REGIONS || !Array.isArray(REGIONS)) {
    console.error('REGIONS is not an array, returning empty array');
    return [];
  }
  
  let lowerMessage = message.toLowerCase();
  
  // ניקוי: הסרת "ב" בהתחלת מילים והחלפת מקפים ברווחים
  lowerMessage = lowerMessage.replace(/\sב([א-ת])/g, ' $1'); // "ברמת גן" → "רמת גן"
  lowerMessage = lowerMessage.replace(/-/g, ' '); // "רמת-גן" → "רמת גן"
  
  const foundRegions = []; // מערך של אזורים שנמצאו
  
  for (const region of REGIONS) {
    let matched = false;
    
    // בדיקת מילות מפתח (אם קיימות)
    if (region.keywords) {
      for (const keyword of region.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          matched = true;
          break;
        }
      }
    }
    
    // בדיקה אם נזכר שם האזור המלא
    if (!matched && lowerMessage.includes(region.name.toLowerCase())) {
      matched = true;
    }
    
    // ✨ בדיקת קיצורים של ערים
    if (!matched && region.abbreviations) {
      for (const [cityName, abbrevs] of Object.entries(region.abbreviations)) {
        for (const abbrev of abbrevs) {
          const abbrevLower = abbrev.toLowerCase();
          // בדיקה עם word boundaries לקיצורים
          const regex = new RegExp('\\b' + abbrevLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
          if (regex.test(lowerMessage)) {
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }
    
    // בדיקה אם נזכרה עיר מהאזור
    if (!matched && region.cities) {
      for (const city of region.cities) {
        const normalizedCity = city.toLowerCase().replace(/-/g, ' ');
        if (lowerMessage.includes(normalizedCity)) {
          matched = true;
          break;
        }
      }
    }
    
    // אם נמצא התאמה - הוסף את האזור למערך
    if (matched) {
      foundRegions.push({
        name: region.name,
        slug: region.slug,
        cities: region.cities,
        keywords: region.keywords,
        abbreviations: region.abbreviations
      });
    }
  }
  
  return foundRegions.length > 0 ? foundRegions : null;
}

// ========================================
// 🏙️ זיהוי עיר ספציפית מהשאלה
// ========================================
function detectSpecificCity(message, region = null) {
  loadConfigs();
  let lowerMessage = message.toLowerCase();
  
  // ניקוי
  lowerMessage = lowerMessage.replace(/\sב([א-ת])/g, ' $1');
  lowerMessage = lowerMessage.replace(/-/g, ' ');
  
  // אם יש אזור מזוהה - בדוק קיצורים תחילה
  if (region && region.abbreviations) {
    for (const [cityName, abbrevs] of Object.entries(region.abbreviations)) {
      for (const abbrev of abbrevs) {
        const abbrevLower = abbrev.toLowerCase();
        // בדיקה עם word boundaries
        const regex = new RegExp('\\b' + abbrevLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (regex.test(lowerMessage)) {
          return cityName;
        }
      }
    }
  }
  
  // אם יש אזור מזוהה - חפש רק ערים מהאזור הזה
  const citiesToCheck = region && region.cities ? region.cities : 
                        REGIONS.flatMap(r => r.cities);
  
  for (const city of citiesToCheck) {
    const normalizedCity = city.toLowerCase().replace(/-/g, ' ');
    
    // בדיקה עם word boundaries
    const regex = new RegExp('\\b' + normalizedCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    
    if (regex.test(lowerMessage)) {
      return city;
    }
  }
  
  return null;
}

// ========================================
// 🎓 זיהוי תחום לימוד מהשאלה
// ========================================
function detectStudyField(message) {
  loadConfigs();
  
  console.log('\n🔍 [detectStudyField] START');
  console.log(`📝 Message: "${message}"`);
  console.log(`📚 STUDY_FIELDS available: ${STUDY_FIELDS ? STUDY_FIELDS.length : 0}`);
  
  // וודא ש-STUDY_FIELDS הוא מערך (במקרה ש-loadConfigs נכשל)
  if (!STUDY_FIELDS || !Array.isArray(STUDY_FIELDS)) {
    console.error('❌ STUDY_FIELDS is not an array, returning empty array');
    return [];
  }
  
  const lowerMessage = message.toLowerCase();
  const detectedFields = [];
  
  // **שלב 1: חיפוש התאמה מדויקת לשם התחום (עדיפות גבוהה)**
  for (const field of STUDY_FIELDS) {
    const fieldNameLower = field.name.toLowerCase();
    if (lowerMessage.includes(fieldNameLower)) {
      console.log(`✅ Found exact match: "${field.name}"`);
      return [field]; // מצאנו התאמה מדויקת - נחזיר מיד!
    }
  }
  
  // **שלב 2: חיפוש במילות מפתח - חיפוש פשוט**
  const matches = [];
  
  for (const field of STUDY_FIELDS) {
    for (const keyword of field.keywords) {
      if (!keyword) continue; // בטיחות
      
      const keywordLower = keyword.toLowerCase();
      
      // בדיקה פשוטה - includes (לא word boundary!)
      if (lowerMessage.includes(keywordLower)) {
        matches.push({ field, keyword, length: keywordLower.length });
        break;
      }
    }
  }
  
  // מיון לפי אורך מילת המפתח (ארוכה יותר = ספציפית יותר)
  matches.sort((a, b) => b.length - a.length);
  detectedFields.push(...matches.map(m => m.field));
  
  if (detectedFields.length > 0) {
    console.log(`✅ Found ${detectedFields.length} fields via keywords: ${detectedFields.map(f => f.name).join(', ')}`);
  } else {
    console.log(`⚠️ No study fields detected`);
  }
  
  return detectedFields;
}

// ========================================
// 🤖 יצירת תשובה חכמה (לוגיקה פשוטה!)
// ========================================
function generateSmartResponse(userMessage) {
  console.log('\n\n========================================');
  console.log('🚀 [generateSmartResponse] START');
  console.log('📝 Message:', userMessage);
  console.log('========================================\n');
  
  try {
    // ✅ ראשית - בדוק אם זו שאלה על ביטוח לאומי
    if (detectInsuranceQuestion(userMessage)) {
      const answer = findInsuranceAnswer(userMessage);
      
      if (answer) {
        // מצאנו תשובה ספציפית!
        console.log('[generateSmartResponse] Insurance answer found');
        return formatInsuranceAnswer(answer);
      } else {
        // שאלה על ביטוח לאומי, אבל לא מצאנו תשובה ספציפית
        console.log('[generateSmartResponse] General insurance info');
        return formatGeneralInsuranceInfo();
      }
    }
    
    console.log('[generateSmartResponse] Detecting regions and fields...');
    const regions = detectRegions(userMessage); // מערך של אזורים!
    const studyFields = detectStudyField(userMessage);
    
    console.log('[generateSmartResponse] Regions:', regions?.length || 0);
    console.log('[generateSmartResponse] Study fields:', studyFields?.length || 0);
    
    let response = '';
  
  // **זיהוי סוג השאלה**
  const isInfoQuestion = userMessage.toLowerCase().includes('שבתון') || 
                         userMessage.toLowerCase().includes('מענק') ||
                         userMessage.toLowerCase().includes('ביטוח לאומי') ||
                         userMessage.toLowerCase().includes('לידה');
  
  // **שאלות מידע על שבתון**
  if (isInfoQuestion) {
    try {
      const infoResults = searchPages(userMessage, null, 'info');
      
      if (infoResults && infoResults.length > 0) {
        response = formatSearchResults(infoResults);
        return response;
      }
    } catch (error) {
      console.error('[generateSmartResponse] Error in info search:', error.message);
    }
    
    // אם אין תוצאות או היתה שגיאה, הצג מידע כללי
    response = `שנת שבתון - מידע כללי 📘\n\n`;
    response += `מה תרצה לדעת?\n`;
    response += `• מענק בשבתון\n`;
    response += `• ביטוח לאומי\n`;
    response += `• לידה בשבתון\n`;
    response += `• תוכנית הלימודים\n\n`;
    response += `אם לא מצאתי תשובה, אפשר לשאול בקבוצת WhatsApp:\n`;
    response += `https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME`;
    return response;
  }
  
  // **אם יש תחום מזוהה ואזורים - חיפוש מחמיר!**
  if (studyFields.length > 0 && regions && regions.length > 0) {
    const field = studyFields[0];
    
    console.log('\n🔍 ========== SEARCHING PAGES ==========');
    console.log(`📚 Field: ${field.name}`);
    console.log(`📍 Regions: ${regions.map(r => r.name).join(', ')}`);
    console.log('========================================\n');
    
    // חפש בכל האזורים ואחד את התוצאות
    let allResults = [];
    const regionNames = [];
    
    for (const region of regions) {
      try {
        regionNames.push(region.name);
        const searchResults = searchPages(userMessage, region, 'all', field);
        if (searchResults && searchResults.length > 0) {
          allResults = allResults.concat(searchResults);
        }
      } catch (error) {
        console.error(`[generateSmartResponse] Error searching in region ${region.name}:`);
        console.error(`  Error message: ${error.message}`);
        console.error(`  Error name: ${error.name}`);
        console.error(`  Error stack: ${error.stack}`);
        // המשך עם האזור הבא
      }
    }
    
    // הסר כפילויות (דפים שמופיעים ביותר מאזור אחד)
    const uniqueResults = [];
    const seenUrls = new Set();
    for (const result of allResults) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        uniqueResults.push(result);
      }
    }
    
    console.log('\n📊 ========== RESULTS SUMMARY ==========');
    console.log(`🎯 All results: ${allResults.length}`);
    console.log(`✅ Unique results: ${uniqueResults.length}`);
    
    // 🔄 אם אין תוצאות - נסה חיפוש רחב יותר ללא studyField
    if (uniqueResults.length === 0) {
      console.log('\n⚠️ No results with studyField - trying without...\n');
      
      for (const region of regions) {
        try {
          const searchResults = searchPages(userMessage, region, 'all', null);
          if (searchResults && searchResults.length > 0) {
            allResults = allResults.concat(searchResults);
          }
        } catch (error) {
          console.error(`Error in fallback search: ${error.message}`);
        }
      }
      
      // הסר כפילויות שוב
      const seenUrls2 = new Set();
      for (const result of allResults) {
        if (!seenUrls2.has(result.url)) {
          seenUrls2.add(result.url);
          uniqueResults.push(result);
        }
      }
      
      console.log(`✅ After fallback: ${uniqueResults.length} results`);
    }
    
    console.log('========================================\n');
    
    if (uniqueResults.length > 0) {
      // **מצאנו דפים רלוונטיים!**
      const regionsText = regionNames.length > 1 ? regionNames.join(' ו') : regionNames[0];
      
      // ספור דפים סטטיים ודינמיים
      const staticCount = uniqueResults.filter(r => r.isStatic).length;
      const dynamicCount = uniqueResults.filter(r => !r.isStatic && !r.isInfo).length;
      
      // בנה הודעה מתאימה
      if (staticCount > 0 && dynamicCount > 0) {
        response = `מצאתי ${staticCount} ${staticCount === 1 ? 'מוסד' : 'מוסדות'} ב${regionsText} ל${field.name}:\n\n`;
      } else if (staticCount > 0) {
        response = `מצאתי ${staticCount} ${staticCount === 1 ? 'מוסד' : 'מוסדות'} ב${regionsText} ל${field.name}:\n\n`;
      } else {
        response = `🎯 מצאתי קורסים ב${field.name} ב${regionsText}:\n\n`;
      }
      
      console.log(`\n📝 [generateSmartResponse] Calling formatSearchResults with ${uniqueResults.length} results (${staticCount} static, ${dynamicCount} dynamic)`);
      const formatted = formatSearchResults(uniqueResults);
      console.log(`📝 [generateSmartResponse] formatSearchResults returned: ${formatted ? formatted.length + ' chars' : 'NULL'}`);
      
      if (formatted) {
        response += formatted;
      } else {
        console.error(`⚠️ formatSearchResults returned NULL even though we have ${uniqueResults.length} results!`);
      }
      
      // הוסף גם קישור לדף כללי
      response += `\n\n💡 לכל הקורסים ב${field.name}:\n`;
      for (const region of regions) {
        const regionSlug = region.slug;
        const encodedSlug = field.slug.replace(/ /g, '%20');
        const url = `https://www.shabaton.online/${regionSlug}/${encodedSlug}`;
        response += `[${region.name}](${url})\n`;
      }
      
      return response;
    }
    
    // **לא מצאנו תוצאות ספציפיות - נציע דפים דינמיים**
    response = `🎯 מצאתי קורסים ב${field.name} ב${regionNames.join(' ו')}:\n\n`;
    
    // הוסף קישורים לדפים דינמיים של כל אזור
    for (const region of regions) {
      const regionSlug = region.slug;
      const encodedSlug = field.slug.replace(/ /g, '%20');
      const url = `https://www.shabaton.online/${regionSlug}/${encodedSlug}`;
      response += `[${region.name}](${url})\n`;
    }
    
    response += `\n💡 כאן תמצא/י את כל הקורסים הזמינים באזור!`;
    
    return response;
  }
  
  // **אם יש תחום אבל אין אזור - שאל איפה!**
  if (studyFields.length > 0 && (!regions || regions.length === 0)) {
    const field = studyFields[0];
    
    response = `באיזה אזור תרצה ללמוד ${field.name}?\n\n`;
    response += `📍 תל אביב והמרכז\n`;
    response += `📍 חיפה והצפון\n`;
    response += `📍 השרון\n`;
    response += `📍 ירושלים והסביבה\n`;
    response += `📍 השפלה והדרום\n`;
    response += `💻 למידה מרחוק\n`;
    response += `🌍 כל הארץ`;
    
    return response;
  }
  
  // **אם יש אזור אבל אין תחום**
  if (regions && regions.length > 0) {
    const regionNames = regions.map(r => r.name).join(' ו');
    response = `מעולה! ${regionNames} 🗺️\n\n`;
    response += `באיזה תחום תרצה להתמחות?\n`;
    response += `ספר לי במילים שלך - למשל: "גישור", "צילום", "NLP", "בישול", "תכשיטים"...`;
    
    return response;
  }
  
  // **אם אין תחום ואין אזור - חיפוש כללי באינדקס**
  const searchResults = searchPages(userMessage, null, 'static');
  
  if (searchResults && searchResults.length > 0) {
    response = `מצאתי ${searchResults.length} תוצאות:\n\n`;
    response += formatSearchResults(searchResults);
    return response;
  }
  
  // **לא זיהיתי כלום**
  response = `אשמח לעזור! 🎯\n\n`;
  response += `ספר לי:\n`;
  response += `📍 באיזה אזור?\n`;
  response += `📚 איזה תחום?\n\n`;
  response += `דוגמה: "הנחיית קבוצות בחיפה"\n\n`;
  response += `אם אין לי תשובה מתאימה, אפשר לשאול בקבוצת WhatsApp:\n`;
  response += `https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME`;
  
  return response;
  
  } catch (error) {
    console.error('[generateSmartResponse] ERROR:', error.message);
    console.error('[generateSmartResponse] Stack:', error.stack);
    
    // במקרה של שגיאה, החזר הודעה כללית
    return `אשמח לעזור! 🎯\n\nספר לי:\n📍 באיזה אזור?\n📚 איזה תחום?\n\nאם אין לי תשובה מתאימה, אפשר לשאול בקבוצת WhatsApp:\nhttps://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME`;
  }
}

// ========================================
// 🚀 API Handler (Vercel Format)
// ========================================
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { message, history } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'חסרה הודעה' });
    }
    
    // **קודם - ננסה לזהות מההודעה הנוכחית בלבד**
    let response = generateSmartResponse(message);
    
    // **אם ההודעה הנוכחית לא הצליחה (חסר תחום או אזור) - נשתמש בהיסטוריה**
    // זה מתאים למקרים כמו: "תל אביב" אחרי "הנחיית קבוצות"
    const needsContext = response.includes('באיזה אזור') || 
                         response.includes('באיזה תחום') ||
                         response.includes('אשמח לעזור');
    
    if (needsContext && history && Array.isArray(history) && history.length > 0) {
      // לקיחת רק 3 הודעות אחרונות של המשתמש
      const recentUserMessages = history
        .filter(msg => msg.role === 'user')
        .slice(-3)
        .map(msg => msg.content)
        .join(' ');
      
      // איחוד עם ההודעה הנוכחית
      const fullContext = recentUserMessages + ' ' + message;
      response = generateSmartResponse(fullContext);
    }
    
    return res.status(200).json({
      response: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('שגיאה:', error);
    
    return res.status(500).json({
      response: 'מצטער, הייתה בעיה טכנית. בינתיים, אתה מוזמן לפנות לקבוצת WhatsApp שלנו:\n\nhttps://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME',
      error: error.message
    });
  }
}
