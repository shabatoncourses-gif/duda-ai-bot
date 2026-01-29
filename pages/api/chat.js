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
let REQUIRED_PHRASES = null;
let COURSES_QA = null;

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
  
  if (!REQUIRED_PHRASES) {
    try {
      const phrasesPath = path.join(process.cwd(), 'data', 'required-phrases.json');
      const phrasesData = JSON.parse(fs.readFileSync(phrasesPath, 'utf8'));
      REQUIRED_PHRASES = phrasesData.requiredPhrases || [];
      console.log(`[loadConfigs] Loaded ${REQUIRED_PHRASES.length} required phrases`);
    } catch (error) {
      console.log('[loadConfigs] Required phrases not loaded (optional)');
      REQUIRED_PHRASES = [];
    }
  }
}

// ========================================
// 🌐 מילות מפתח למידה מרחוק (רשימה אחת!)
// ========================================
const REMOTE_LEARNING_KEYWORDS = [
  'למידה מרחוק',
  'בלמידה מרחוק',
  'מרחוק',
  'אונליין',
  'online',
  'on-line',
  'ON-LINE',
  'ONLINE',
  'zoom',
  'ZOOM',
  'זום',
  'בזום',
  'מקוון',
  'מקוונים',
  'מקוונת',
  'דיגיטלי',
  'דיגיטלים',
  'דיגיטלית',
  'סינכרוני',
  'סינכרונים',
  'סינכרוניים',
  'אסינכרוני',
  'אסינכרונים',
  'אסינכרוניים',
  'א-סינכרוניים',
  'מתוקשב',
  'מתוקשבת',
  'מתוקשבים'
];

// ========================================
// 🌐 זיהוי בקשה ללמידה מרחוק (מהודעה)
// ========================================
function detectRemoteLearning(message) {
  const messageLower = message.toLowerCase();
  
  for (const keyword of REMOTE_LEARNING_KEYWORDS) {
    if (messageLower.includes(keyword.toLowerCase())) {
      console.log(`✅ [detectRemoteLearning] Found: ${keyword}`);
      return true;
    }
  }
  
  return false;
}

// ========================================
// 🌐 בדיקה אם דף הוא למידה מרחוק / ארצי
// ========================================
function isRemoteLearningPage(page, includeNational = false) {
  const keywords = [...REMOTE_LEARNING_KEYWORDS];
  
  if (includeNational) {
    keywords.push('ארצי', 'ברחבי הארץ', 'הדרכה ארצית', 'בכל הארץ', 'כל הארץ', 'פריסה ארצית');
  }
  
  const title = (page.title || '').toLowerCase();
  const description = (page.description || '').toLowerCase();
  const location = (page.location || '').toLowerCase();
  const pageKeywords = (page.keywords || []).map(k => k.toLowerCase()).join(' ');
  const h2Text = Array.isArray(page.h2) ? page.h2.join(' ').toLowerCase() : (page.h2 || '').toLowerCase();
  const h3Text = Array.isArray(page.h3) ? page.h3.join(' ').toLowerCase() : (page.h3 || '').toLowerCase();
  
  const pageContent = title + ' ' + description + ' ' + location + ' ' + pageKeywords + ' ' + h2Text + ' ' + h3Text;
  
  return keywords.some(keyword => pageContent.includes(keyword.toLowerCase()));
}

// ========================================
// 🏷️ זיהוי סוג דף
// ========================================
function identifyPageType(page) {
  if (!page || !page.url) return 'unknown';
  
  const url = page.url.toLowerCase();
  const title = (page.title || page.h1 || '').toLowerCase();
  
  // ❌ דפים כלליים - לעולם לא להציג!
  const generalPagePatterns = [
    '/$',                          // דף הבית
    '/about',                      // אודות
    '/contact',                    // צור קשר
    '/drushim/',                   // דרושים
    '/משרות-הוראה',                // משרות הוראה
    '/הוספת-מודעה',                // הוספת מודעה
    '/knassim',                    // כנסים
    '/consult'                     // ייעוץ
  ];
  
  for (const pattern of generalPagePatterns) {
    const regex = new RegExp(pattern);
    if (regex.test(url)) {
      return 'general'; // ❌ דף כללי
    }
  }
  
  // 📘 דפי מידע על שבתון
  const infoPagePatterns = [
    '/luz_shabaton',
    '/shabaton-video',
    '/end_shabaton',
    '/halforfull_shabaton',
    '/phones_shabaton',
    '/forms_shabaton',
    '/Payments_shabaton',
    '/tlush_maanak_shabaton',
    '/btl-morim-shabaton',
    '/btl_shabaton',
    '/birth_shabatgon',
    '/tuition_reimbursement',
    '/kabalot_shabaton',
    '/shabaton-maanak',
    '/pension_shabaton',
    '/keren_makor_mishor',
    '/tofes_101',
    '/learning_programs_shabaton'
  ];
  
  for (const pattern of infoPagePatterns) {
    if (url.includes(pattern)) {
      return 'info'; // 📘 דף מידע
    }
  }
  
  // 🔍 דפי תוצאות חיפוש דינמיים
  if (url.includes('/results-') || 
      url.includes('/search-results-') || 
      url.includes('/courses-per-month')) {
    return 'dynamic'; // 🔍 דף תוצאות
  }
  
  // 🏛️ דפי מוסדות עם קורסים
  return 'static'; // 🏛️ דף מוסד
}

// ========================================
// 💼 ביטוח לאומי - טעינה
// ========================================
function loadInsuranceQA() {
  if (!INSURANCE_QA) {
    try {
      const insurancePath = path.join(process.cwd(), 'data', 'insurance-qa.json');
      const fileContent = fs.readFileSync(insurancePath, 'utf8');
      INSURANCE_QA = JSON.parse(fileContent);
      
      console.log(`✅ נטען insurance-qa.json: ${INSURANCE_QA.questions.length} שאלות`);
      
      if (!INSURANCE_QA.keywords || INSURANCE_QA.keywords.length === 0) {
        console.error('❌ שגיאה: insurance-qa.json לא מכיל keywords!');
      }
    } catch (error) {
      console.error('❌ שגיאה בטעינת insurance-qa.json:', error.message);
      INSURANCE_QA = { questions: [], keywords: [], generalInfo: {}, fallbackMessage: '' };
    }
  }
  return INSURANCE_QA;
}

function detectInsuranceQuestion(message) {
  loadInsuranceQA();
  const lowerMessage = message.toLowerCase();
  
  if (!INSURANCE_QA || !INSURANCE_QA.keywords || INSURANCE_QA.keywords.length === 0) {
    return false;
  }
  
  if (!lowerMessage.includes('ביטוח')) {
    return false;
  }
  
  const hasInsuranceKeyword = INSURANCE_QA.keywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return lowerMessage.includes(keywordLower);
  });
  
  if (hasInsuranceKeyword) {
    console.log('✅ זוהתה שאלה על ביטוח לאומי');
  }
  
  return hasInsuranceKeyword;
}

function findInsuranceAnswer(message) {
  loadInsuranceQA();
  
  if (!INSURANCE_QA || !INSURANCE_QA.questions || INSURANCE_QA.questions.length === 0) {
    return null;
  }
  
  const lowerMessage = message.toLowerCase();
  const questionWords = ['מתי', 'איך', 'מה', 'למה', 'האם', 'מדוע', 'איפה', 'כמה'];
  const isSpecificQuestion = questionWords.some(word => lowerMessage.includes(word));
  
  if (!isSpecificQuestion) {
    return null;
  }
  
  const cleanMessage = lowerMessage.replace(/[?.]/g, '').trim();
  
  const scoredQuestions = INSURANCE_QA.questions.map(qa => {
    let score = 0;
    
    for (const keyword of qa.keywords) {
      if (cleanMessage.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }
    
    const qaWords = qa.question.toLowerCase().split(/\s+/);
    const msgWords = cleanMessage.split(/\s+/);
    
    for (const word of msgWords) {
      if (word.length > 2 && qaWords.some(qw => qw.includes(word) || word.includes(qw))) {
        score += 5;
      }
    }
    
    return { qa, score };
  });
  
  scoredQuestions.sort((a, b) => b.score - a.score);
  
  const bestMatch = scoredQuestions[0];
  const bestScore = bestMatch ? bestMatch.score : 0;
  
  if (bestMatch && bestScore >= 10) {
    return bestMatch.qa;
  }
  
  return null;
}

function formatInsuranceAnswer(qa) {
  let response = `💼 **ביטוח לאומי בשבתון**\n\n`;
  response += `**שאלה:**\n${qa.question}\n\n`;
  response += `**תשובה:**\n${qa.answer}\n`;
  
  if (qa.relatedLinks && qa.relatedLinks.length > 0) {
    response += `\n`;
    qa.relatedLinks.forEach(link => {
      response += `[${link.text}](${link.url})\n`;
    });
  }
  
  const btlLink = 'https://www.shabaton.online/btl_shabaton';
  const alreadyHasLink = qa.relatedLinks && qa.relatedLinks.some(link => link.url === btlLink);
  
  if (!alreadyHasLink) {
    response += `\n[למידע מפורט על ביטוח לאומי בשבתון](${btlLink})\n`;
  }
  
  return response;
}

function formatGeneralInsuranceInfo() {
  loadInsuranceQA();
  
  if (!INSURANCE_QA || !INSURANCE_QA.generalInfo || !INSURANCE_QA.questions) {
    return `💼 **ביטוח לאומי בשבתון**\n\nלמידע מפורט:\n[ביטוח לאומי בשבתון](https://www.shabaton.online/btl_shabaton)`;
  }
  
  let response = `💼 **ביטוח לאומי בשבתון**\n\n`;
  response += `${INSURANCE_QA.generalInfo.content}\n\n`;
  response += `**📘 למידע מפורט:**\n`;
  response += `[ביטוח לאומי בשבתון - מדריך מלא](https://www.shabaton.online/btl_shabaton)\n\n`;
  response += `💡 אפשר גם לשאול שאלות ספציפיות`;
  
  return response;
}

// ========================================
// 📚 הכרת קורסים - טעינה
// ========================================
function loadCoursesQA() {
  if (!COURSES_QA) {
    try {
      const coursesQAPath = path.join(process.cwd(), 'data', 'courses-qa.json');
      const fileContent = fs.readFileSync(coursesQAPath, 'utf8');
      COURSES_QA = JSON.parse(fileContent);
      
      const totalQuestions = COURSES_QA.categories.reduce((sum, cat) => sum + cat.questions.length, 0);
      console.log(`✅ נטען courses-qa.json: ${totalQuestions} שאלות ב-${COURSES_QA.categories.length} קטגוריות`);
      
      if (!COURSES_QA.keywords || COURSES_QA.keywords.length === 0) {
        console.error('⚠️ courses-qa.json לא מכיל keywords!');
      }
    } catch (error) {
      console.error('❌ שגיאה בטעינת courses-qa.json:', error.message);
      console.log('⚠️ מערכת הכרת קורסים לא תעבוד עד שהקובץ יועלה');
      COURSES_QA = { categories: [], keywords: [], generalInfo: {}, fallbackMessage: '' };
    }
  }
  return COURSES_QA;
}

function detectCoursesQuestion(message) {
  loadCoursesQA();
  const lowerMessage = message.toLowerCase();
  
  if (!COURSES_QA || !COURSES_QA.keywords || COURSES_QA.keywords.length === 0) {
    return false;
  }
  
  // 🎯 מילות מפתח ספציפיות לתכנון לימודים והכרה
  const planningKeywords = [
    'הכרה',
    'מוכר',
    'מאושר',
    'פורטל',
    'קרן השתלמות',
    'המוסד התחייב',
    'לא מופיע',
    'היה מוכר',
    'חברה שלי',
    'בדיקה',
    'אישור'
  ];
  
  // בדיקה מהירה
  const isPlanningQuestion = planningKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  if (!isPlanningQuestion) {
    return false;
  }
  
  // בדיקה מדויקת יותר עם keywords מהקובץ
  const hasCoursesKeyword = COURSES_QA.keywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return lowerMessage.includes(keywordLower);
  });
  
  if (hasCoursesKeyword) {
    console.log('✅ זוהתה שאלה על הכרת קורסים');
  }
  
  return hasCoursesKeyword;
}

function findCoursesAnswer(message) {
  loadCoursesQA();
  
  if (!COURSES_QA || !COURSES_QA.categories || COURSES_QA.categories.length === 0) {
    console.log('⚠️ courses-qa.json לא נטען נכון');
    return null;
  }
  
  const lowerMessage = message.toLowerCase();
  
  // 🎯 זיהוי סוג השאלה
  const questionWords = ['מה', 'איך', 'למה', 'מתי', 'האם', 'מדוע', 'איפה', 'כמה', 'מי'];
  const isSpecificQuestion = questionWords.some(word => lowerMessage.includes(word));
  
  if (!isSpecificQuestion) {
    console.log('⚠️ לא שאלה ספציפית');
    return null;
  }
  
  console.log('✅ שאלה ספציפית על הכרת קורסים - מחפש תשובה');
  
  const cleanMessage = lowerMessage
    .replace(/\?/g, '')
    .replace(/\./g, '')
    .trim();
  
  let bestMatch = null;
  let bestScore = 0;
  let bestCategory = null;
  
  // חיפוש בכל הקטגוריות
  for (const category of COURSES_QA.categories) {
    for (const qa of category.questions) {
      let score = 0;
      
      // התאמה למילות מפתח
      if (qa.keywords && Array.isArray(qa.keywords)) {
        for (const keyword of qa.keywords) {
          if (cleanMessage.includes(keyword.toLowerCase())) {
            score += 10;
          }
        }
      }
      
      // התאמה לשאלה עצמה
      const questionWords = qa.question.toLowerCase().split(/\s+/);
      const messageWords = cleanMessage.split(/\s+/);
      
      for (const word of messageWords) {
        if (word.length > 2 && questionWords.some(qw => qw.includes(word) || word.includes(qw))) {
          score += 5;
        }
      }
      
      // התאמה לווריאציות של השאלה
      if (qa.variations && Array.isArray(qa.variations)) {
        for (const variation of qa.variations) {
          const variationWords = variation.toLowerCase().split(/\s+/);
          for (const word of messageWords) {
            if (word.length > 2 && variationWords.some(vw => vw.includes(word) || word.includes(vw))) {
              score += 3;
            }
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = qa;
        bestCategory = category;
      }
    }
  }
  
  console.log(`🔍 ציון התאמה מירבי: ${bestScore}`);
  
  if (bestMatch && bestScore >= 10) {
    console.log(`✅ נמצאה תשובה בקטגוריה: ${bestCategory.name}`);
    return { qa: bestMatch, category: bestCategory };
  }
  
  console.log('⚠️ לא נמצאה תשובה טובה מספיק');
  return null;
}

function formatCoursesAnswer(match) {
  const { qa, category } = match;
  
  let response = `${category.icon} **${category.name}**\n\n`;
  response += `**שאלה:** ${qa.question}\n\n`;
  response += `**תשובה:**\n${qa.answer}\n`;
  
  if (qa.relatedLinks && qa.relatedLinks.length > 0) {
    response += `\n`;
    qa.relatedLinks.forEach(link => {
      response += `[${link.text}](${link.url})\n`;
    });
  }
  
  return response;
}

function formatGeneralCoursesInfo() {
  loadCoursesQA();
  
  if (!COURSES_QA || !COURSES_QA.generalInfo) {
    return `📚 **הכרת קורסים בשבתון**\n\nלמידע מפורט:\n[תוכניות לימוד בשבתון](https://www.shabaton.online/learning_programs_shabaton)`;
  }
  
  let response = `📚 **הכרת קורסים בשבתון**\n\n`;
  
  if (COURSES_QA.generalInfo.content) {
    response += `${COURSES_QA.generalInfo.content}\n\n`;
  }
  
  response += `**💡 שאלות נפוצות:**\n`;
  
  // הצג את 3 הקטגוריות הראשונות
  const topCategories = COURSES_QA.categories.slice(0, 3);
  topCategories.forEach(cat => {
    if (cat.questions && cat.questions.length > 0) {
      response += `\n${cat.icon} **${cat.name}**\n`;
      response += `• ${cat.questions[0].question}\n`;
    }
  });
  
  response += `\n📘 [למידע מפורט על הכרת קורסים](https://www.shabaton.online/learning_programs_shabaton)`;
  
  return response;
}

function loadAllPages() {
  if (!ALL_PAGES) {
    try {
      ALL_PAGES = [];
      
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
          
          if (Array.isArray(data)) {
            ALL_PAGES = ALL_PAGES.concat(data);
          } else if (data.pages) {
            ALL_PAGES = ALL_PAGES.concat(data.pages);
          } else {
            ALL_PAGES.push(data);
          }
        } catch (err) {
          console.log(`Could not load ${filename}:`, err.message);
        }
      }
      
      console.log(`Loaded ${ALL_PAGES.length} total pages`);
      
      if (ALL_PAGES.length === 0) {
        console.error('⚠️ WARNING: ALL_PAGES is EMPTY!');
      }
    } catch (error) {
      console.error('Error loading indexes:', error);
      ALL_PAGES = [];
    }
  }
  return ALL_PAGES;
}

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

function isUpcomingDate(dateStr) {
  if (!dateStr) return false;
  
  try {
    const now = new Date();
    const twoMonthsFromNow = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000));
    
    let date = null;
    
    const match1 = dateStr.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/);
    if (match1) {
      const day = parseInt(match1[1]);
      const month = parseInt(match1[2]) - 1;
      let year = parseInt(match1[3]);
      if (year < 100) year += 2000;
      
      date = new Date(year, month, day);
    }
    
    if (!date) {
      const hebrewMonths = {
        'ינואר': 0, 'פברואר': 1, 'מרץ': 2, 'אפריל': 3,
        'מאי': 4, 'יוני': 5, 'יולי': 6, 'אוגוסט': 7,
        'ספטמבר': 8, 'אוקטובר': 9, 'נובמבר': 10, 'דצמבר': 11
      };
      
      for (const [monthName, monthNum] of Object.entries(hebrewMonths)) {
        if (dateStr.includes(monthName)) {
          const yearMatch = dateStr.match(/20\d{2}/);
          if (yearMatch) {
            date = new Date(parseInt(yearMatch[0]), monthNum, 1);
            break;
          }
        }
      }
    }
    
    if (date && date >= now && date <= twoMonthsFromNow) {
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

function findUpcomingDateInSchedule(page, fieldName = null) {
  const schedule = page.dates || page.schedule || page.upcomingDates || [];
  
  if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
    return null;
  }
  
  for (const entry of schedule) {
    let dateStr = '';
    let courseName = '';
    
    if (typeof entry === 'string') {
      dateStr = entry;
    } else if (typeof entry === 'object') {
      dateStr = entry.date || entry.startDate || entry.openingDate || '';
      courseName = entry.course || entry.name || '';
    }
    
    if (fieldName && courseName && !courseName.toLowerCase().includes(fieldName.toLowerCase())) {
      continue;
    }
    
    if (isUpcomingDate(dateStr)) {
      return dateStr;
    }
  }
  
  return null;
}

function filterBySpecificCity(institutions, city, includeRemote = false) {
  if (!city && !includeRemote) {
    return institutions;
  }
  
  const cityLower = city ? city.toLowerCase().replace(/-/g, ' ') : '';
  
  const filtered = institutions.filter(inst => {
    const location = (inst.location || '').toLowerCase();
    const isRemote = isRemoteLearningPage(inst);
    
    if (includeRemote && isRemote) {
      return true;
    }
    
    if (!city) {
      if (isRemote) {
        return includeRemote;
      }
      return true;
    }
    
    if (isRemote && !location.includes(cityLower)) {
      return false;
    }
    
    const hasCity = location.includes(cityLower);
    return hasCity;
  });
  
  return filtered;
}

// ========================================
// 🔍 חיפוש דפים באינדקסים
// ========================================
function searchPages(query, region = null, pageType = 'all', studyField = null) {
  console.log(`\n========== [searchPages] START ==========`);
  console.log(`Query: "${query}"`);
  console.log(`Region: ${region?.name || 'none'}`);
  console.log(`Study Field: ${studyField?.name || 'none'}`);
  
  const pages = loadAllPages();
  const lowerQuery = query.toLowerCase();
  
  const isInfoQuery = lowerQuery.includes('שבתון') || 
                      lowerQuery.includes('מענק') ||
                      lowerQuery.includes('ביטוח לאומי') ||
                      lowerQuery.includes('לידה') ||
                      lowerQuery.includes('לוז') ||
                      lowerQuery.includes('תשלום') ||
                      lowerQuery.includes('קבלות') ||
                      lowerQuery.includes('פנסיה') ||
                      lowerQuery.includes('טופס');
  
  console.log(`🎯 Query type: ${isInfoQuery ? 'INFO (מידע על שבתון)' : 'COURSES (חיפוש קורסים)'}`);
  
  let cleanQuery = lowerQuery.replace(/\sב([א-ת])/g, ' $1');
  cleanQuery = cleanQuery.replace(/-/g, ' ');
  cleanQuery = cleanQuery.replace(/קורס(י)?/g, '').trim();
  
  const stopWords = ['מרכז', 'הארץ', 'במרכז', 'בארץ', 'ב', 'ה', 'של', 'את', 'עם', 'על', 'אל', 'כל', 'צפון', 'בצפון', 'הצפון', 'דרום', 'בדרום', 'שרון', 'בשרון'];
  
  let cleanQueryForSearch = cleanQuery;
  if (region && region.cities) {
    for (const city of region.cities) {
      const cityLower = city.toLowerCase();
      cleanQueryForSearch = cleanQueryForSearch.replace(new RegExp('\\b' + cityLower + '\\b', 'gi'), '').trim();
    }
  }
  
  const queryWordsWithoutCities = cleanQueryForSearch.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  if (queryWordsWithoutCities.length === 0 && !isInfoQuery) {
    return [];
  }
  
  const minScore = 5;
  const noiseWords = ['קורס', 'קורסי', 'קורסים', 'לימודי', 'לימוד', 'השתלמות', 'השתלמויות', 'סדנה', 'סדנת', 'סדנאות', 'הכשרה', 'הכשרת'];
  const topicWords = queryWordsWithoutCities.filter(w => !noiseWords.includes(w));
  const mainTopicWord = topicWords.length > 0 ? topicWords[0] : queryWordsWithoutCities[0];
  
  loadConfigs();
  
  let detectedPhrase = null;
  let phraseVariations = [];
  
  if (REQUIRED_PHRASES && REQUIRED_PHRASES.length > 0) {
    for (const phraseEntry of REQUIRED_PHRASES) {
      const mainPhrase = phraseEntry.phrase.toLowerCase();
      
      if (lowerQuery.includes(mainPhrase)) {
        detectedPhrase = mainPhrase;
        phraseVariations = phraseEntry.variations.map(v => v.toLowerCase());
        break;
      }
    }
  }
  
  let results = [];
  
  for (const page of pages) {
    const pageTypeIdentified = identifyPageType(page);
    
    if (pageTypeIdentified === 'general') {
      continue;
    }
    
    if (isInfoQuery && pageTypeIdentified !== 'info') {
      continue;
    }
    
    if (!isInfoQuery && pageTypeIdentified === 'info') {
      continue;
    }
    
    const titleText = (page.title || '').toLowerCase();
    const h1Text = (page.h1 || '').toLowerCase();
    const h2Text = Array.isArray(page.h2) ? page.h2.join(' ').toLowerCase() : (page.h2 || '').toLowerCase();
    const h3Text = Array.isArray(page.h3) ? page.h3.join(' ').toLowerCase() : (page.h3 || '').toLowerCase();
    const allHeadersText = titleText + ' ' + h1Text + ' ' + h2Text + ' ' + h3Text;
    
    const hasSpecificPhrase = detectedPhrase && phraseVariations.some(v => allHeadersText.includes(v));
    
    const title = (page.title || page.h1 || '').toLowerCase();
    const description = (page.description || '').toLowerCase();
    const url = (page.url || '').toLowerCase();
    const keywords = (page.keywords || []).map(k => k.toLowerCase());
    
    if (studyField && studyField.specificKeyword) {
      const specificKeywordLower = studyField.specificKeyword.toLowerCase();
      const pageContent = title + ' ' + description + ' ' + allHeadersText + ' ' + keywords.join(' ');
      
      if (!pageContent.includes(specificKeywordLower)) {
        continue;
      }
    }
    
    const isStaticPage = pageTypeIdentified === 'static';
    const isInfoPage = pageTypeIdentified === 'info';
    
    let matchScore = 0;
    
    if (studyField && studyField.keywords) {
      for (const kw of studyField.keywords) {
        const kwLower = kw.toLowerCase();
        
        if (title.includes(kwLower)) {
          matchScore += 50;
          break;
        } else if (description.includes(kwLower)) {
          matchScore += 40;
          break;
        } else if (keywords.some(k => k.toLowerCase().includes(kwLower))) {
          matchScore += 30;
          break;
        }
      }
    }
    
    if (cleanQueryForSearch.length > 5) {
      if (title.includes(cleanQueryForSearch)) {
        matchScore += 100;
      }
      if (description.includes(cleanQueryForSearch)) {
        matchScore += 70;
      }
    }
    
    function flexibleMatch(text, word) {
      if (text.includes(word)) return true;
      if (word.includes(text)) return true;
      
      if (word.length >= 4) {
        const stem = word.substring(0, Math.min(word.length - 1, 5));
        if (text.includes(stem)) return true;
      }
      
      return false;
    }
    
    let wordMatchesInTitle = 0;
    
    for (const word of queryWordsWithoutCities) {
      let foundInTitle = flexibleMatch(title, word);
      let foundInDesc = flexibleMatch(description, word);
      let foundInKeywords = keywords.some(k => flexibleMatch(k, word));
      
      const isMainTopic = (word === mainTopicWord);
      
      if (foundInTitle) {
        matchScore += isMainTopic ? 30 : 20;
        wordMatchesInTitle++;
      }
      if (foundInDesc) {
        matchScore += isMainTopic ? 15 : 10;
      }
      if (foundInKeywords) {
        matchScore += isMainTopic ? 12 : 8;
      }
    }
    
    let exactVariation = null;
    
    if (detectedPhrase && phraseVariations.length > 0) {
      const coursesText = (page.courses && Array.isArray(page.courses)) ? page.courses.join(' ').toLowerCase() : '';
      const descText = description.substring(0, 300).toLowerCase();
      
      let foundPhraseVariation = false;
      let foundInHeader = false;
      
      for (const variation of phraseVariations) {
        if (titleText.includes(variation) || h1Text.includes(variation) || h2Text.includes(variation) || h3Text.includes(variation) || coursesText.includes(variation)) {
          foundPhraseVariation = true;
          foundInHeader = true;
          exactVariation = variation;
          break;
        }
        
        if (descText.includes(variation)) {
          foundPhraseVariation = true;
          exactVariation = variation;
          break;
        }
      }
      
      if (!foundPhraseVariation) {
        continue;
      }
      
      if (studyField && !foundInHeader) {
        continue;
      }
      
      if (exactVariation === detectedPhrase) {
        matchScore += 100;
      } else {
        matchScore += 50;
      }
    }
    
    if (wordMatchesInTitle >= queryWordsWithoutCities.length) {
      matchScore += 30;
    }
    
    const specificCity = detectSpecificCity(query, region);
    
    let isInSpecificCity = false;
    
    if (specificCity && isStaticPage) {
      const location = (page.location || '').toLowerCase();
      const titleAndDesc = (title + ' ' + description + ' ' + url).toLowerCase();
      const cityLower = specificCity.toLowerCase().replace(/-/g, ' ');
      
      const inLocation = location.includes(cityLower);
      const inTitleOrDesc = titleAndDesc.includes(cityLower);
      
      if (inLocation || inTitleOrDesc) {
        isInSpecificCity = true;
        matchScore += 100;
      }
    }
    
    let matchesRegion = true;
    let regionBonus = 0;
    
    if (region && region.cities && isStaticPage && !isInSpecificCity) {
      const location = (page.location || '').toLowerCase();
      const titleAndDesc = (title + ' ' + description).toLowerCase();
      
      const hasRegionCityInLocation = region.cities.some(city => {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        return location.includes(cityLower);
      });
      
      if (location && location.trim() !== '') {
        if (!hasRegionCityInLocation) {
          const isNationalOrRemote = isRemoteLearningPage(page, true);
          
          if (isNationalOrRemote) {
            console.log(`  ℹ️ "${page.title || page.h1}" - national/remote, passing without region bonus`);
            regionBonus = 0;
          } else {
            console.log(`  ❌ "${page.title || page.h1}" - location "${location}" not in region, rejected`);
            continue;
          }
        } else {
          regionBonus = 50;
        }
      } else {
        let cityMentioned = null;
        let cityRegion = null;
        
        if (REGIONS && Array.isArray(REGIONS)) {
          for (const r of REGIONS) {
            for (const city of r.cities) {
              const cityLower = city.toLowerCase().replace(/-/g, ' ');
              if (titleAndDesc.includes(cityLower)) {
                cityMentioned = city;
                cityRegion = r.name;
                break;
              }
            }
            if (cityMentioned) break;
          }
        }
        
        if (cityMentioned) {
          if (cityRegion === region.name) {
            regionBonus = 30;
          } else {
            console.log(`  ❌ "${page.title || page.h1}" - mentions city "${cityMentioned}" from different region "${cityRegion}", rejected`);
            continue;
          }
        } else {
          const regionMentioned = titleAndDesc.includes(region.name.toLowerCase()) ||
                                  (region.keywords && region.keywords.some(k => titleAndDesc.includes(k.toLowerCase())));
          
          if (regionMentioned) {
            regionBonus = 20;
          } else {
            const isNationalOrRemote = isRemoteLearningPage(page, true);
            
            if (isNationalOrRemote) {
              console.log(`  ℹ️ "${page.title || page.h1}" - national/remote (no location), passing without bonus`);
              regionBonus = 0;
            } else {
              console.log(`  ❌ "${page.title || page.h1}" - no region mention and not national, rejected`);
              continue;
            }
          }
        }
      }
      
      matchScore += regionBonus;
    }
    
    if (matchScore > 0 || isInfoPage) {
      let upcomingDate = page.upcomingDate || null;
      
      if (!upcomingDate && studyField) {
        const foundDate = findUpcomingDateInSchedule(page, studyField.name);
        if (foundDate) {
          upcomingDate = foundDate;
        }
      }
      
      if (upcomingDate && isUpcomingDate(upcomingDate)) {
        matchScore += 200;
      }
      
      results.push({
        ...page,
        isStatic: isStaticPage,
        isInfo: isInfoPage,
        isInSpecificCity: isInSpecificCity,
        specificCity: isInSpecificCity ? specificCity : null,
        upcomingDate: upcomingDate,
        score: matchScore
      });
    }
  }
  
  results.sort((a, b) => {
    const aHasUpcoming = a.upcomingDate && isUpcomingDate(a.upcomingDate);
    const bHasUpcoming = b.upcomingDate && isUpcomingDate(b.upcomingDate);
    
    if (aHasUpcoming && !bHasUpcoming) return -1;
    if (!aHasUpcoming && bHasUpcoming) return 1;
    
    if (a.isInSpecificCity && !b.isInSpecificCity) return -1;
    if (!a.isInSpecificCity && b.isInSpecificCity) return 1;
    
    if (a.isStatic && !b.isStatic) return -1;
    if (!a.isStatic && b.isStatic) return 1;
    
    return b.score - a.score;
  });
  
  results = results.filter(r => r.score >= minScore || r.isInfo);
  
  console.log(`[searchPages] Returning: ${Math.min(results.length, 10)} results`);
  console.log(`[searchPages] Types: ${results.filter(r => r.isStatic).length} static, ${results.filter(r => r.isInfo).length} info`);
  console.log(`[searchPages] ========== END ==========\n`);
  
  return results.slice(0, 10);
}

function buildResultsPageUrl(field, region) {
  const baseUrl = 'https://www.shabaton.online';
  
  if (!field) return null;
  
  if (region && region.slug) {
    return `${baseUrl}/${region.slug}/${encodeURIComponent(field.name)}`;
  } else {
    return `${baseUrl}/results-all/${encodeURIComponent(field.name)}`;
  }
}

function formatSearchResults(pages, field = null, region = null) {
  if (pages.length === 0) return null;
  
  let response = '';
  const staticPages = pages.filter(p => p.isStatic);
  
  if (staticPages.length > 0) {
    staticPages.forEach((page, index) => {
      const title = page.title || page.h1 || 'מוסד לימודים';
      
      response += `**${title}**\n`;
      
      if (page.courses && Array.isArray(page.courses) && page.courses.length > 0) {
        page.courses.slice(0, 2).forEach(course => {
          response += `${course}\n`;
        });
      } else if (page.description) {
        let desc = page.description.trim();
        
        desc = desc.split('\n')
          .filter(line => !line.trim().startsWith('פנו ל'))
          .join('\n');
        
        if (desc.length > 250) {
          desc = desc.substring(0, 250);
          const lastSpace = desc.lastIndexOf(' ');
          
          if (lastSpace > 200) {
            desc = desc.substring(0, lastSpace) + '...';
          } else {
            desc = desc + '...';
          }
        }
        
        if (desc) response += `${desc}\n`;
      }
      
      if (page.upcomingDate && isUpcomingDate(page.upcomingDate)) {
        response += `📅 נפתח בקרוב: ${page.upcomingDate}\n`;
      } else if (page.startDate && isWithinThreeMonths(page.startDate)) {
        const date = new Date(page.startDate).toLocaleDateString('he-IL');
        response += `📅 ${date}\n`;
      }
      
      if (page.location && page.location !== 'לא צוין') {
        response += `📍 ${page.location}\n`;
      }
      
      if (page.url && page.url.trim() !== '') {
        let cleanUrl = page.url.trim();
        
        if (cleanUrl.includes('://') && cleanUrl.indexOf('://') !== cleanUrl.lastIndexOf('://')) {
          const parts = cleanUrl.split('://');
          cleanUrl = parts[0] + '://' + parts[parts.length - 1];
        }
        
        response += `[→ פנו למוסד הלימודים](${cleanUrl})\n`;
      } else {
        response += `→ פנו למוסד הלימודים\n`;
      }
      
      if (index < staticPages.length - 1) {
        response += `\n`;
      }
    });
  }
  
  if (field && region) {
    const resultsUrl = buildResultsPageUrl(field, region);
    
    if (resultsUrl) {
      const linkText = `💡 [לכל הקורסים ב${field.name}: ${region.name}](${resultsUrl})`;
      response += `\n${linkText}\n`;
    }
  }
  
  return response;
}

function detectRegions(message) {
  loadConfigs();
  
  if (!REGIONS || !Array.isArray(REGIONS)) {
    console.error('REGIONS is not an array');
    return [];
  }
  
  let lowerMessage = message.toLowerCase();
  
  lowerMessage = lowerMessage.replace(/\sב([א-ת])/g, ' $1');
  lowerMessage = lowerMessage.replace(/-/g, ' ');
  
  const foundRegions = [];
  
  for (const region of REGIONS) {
    let matched = false;
    
    if (region.keywords) {
      for (const keyword of region.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          matched = true;
          break;
        }
      }
    }
    
    if (!matched && lowerMessage.includes(region.name.toLowerCase())) {
      matched = true;
    }
    
    if (!matched && region.abbreviations) {
      for (const [cityName, abbrevs] of Object.entries(region.abbreviations)) {
        for (const abbrev of abbrevs) {
          const abbrevLower = abbrev.toLowerCase();
          const regex = new RegExp('\\b' + abbrevLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
          if (regex.test(lowerMessage)) {
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }
    
    if (!matched && region.cities) {
      for (const city of region.cities) {
        const normalizedCity = city.toLowerCase().replace(/-/g, ' ');
        if (lowerMessage.includes(normalizedCity)) {
          matched = true;
          break;
        }
      }
    }
    
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

function detectSpecificCity(message, region = null) {
  loadConfigs();
  let lowerMessage = message.toLowerCase();
  
  lowerMessage = lowerMessage.replace(/\sב([א-ת])/g, ' $1');
  lowerMessage = lowerMessage.replace(/-/g, ' ');
  
  if (region && region.abbreviations) {
    for (const [cityName, abbrevs] of Object.entries(region.abbreviations)) {
      for (const abbrev of abbrevs) {
        const abbrevLower = abbrev.toLowerCase();
        const regex = new RegExp('\\b' + abbrevLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (regex.test(lowerMessage)) {
          return cityName;
        }
      }
    }
  }
  
  const citiesToCheck = region && region.cities ? region.cities : 
                        REGIONS.flatMap(r => r.cities);
  
  for (const city of citiesToCheck) {
    const normalizedCity = city.toLowerCase().replace(/-/g, ' ');
    const regex = new RegExp('\\b' + normalizedCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    
    if (regex.test(lowerMessage)) {
      return city;
    }
  }
  
  return null;
}

function detectStudyField(message) {
  loadConfigs();
  
  console.log('\n🔍 [detectStudyField] START');
  
  if (!STUDY_FIELDS || !Array.isArray(STUDY_FIELDS)) {
    console.error('❌ STUDY_FIELDS is not an array');
    return [];
  }
  
  const lowerMessage = message.toLowerCase();
  const detectedFields = [];
  
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') {
      continue;
    }
    
    const fieldNameLower = field.name.toLowerCase();
    if (lowerMessage.includes(fieldNameLower)) {
      console.log(`✅ Found exact match: "${field.name}"`);
      return [{ ...field, specificKeyword: field.name }];
    }
  }
  
  if (REQUIRED_PHRASES && Array.isArray(REQUIRED_PHRASES)) {
    for (const phraseEntry of REQUIRED_PHRASES) {
      const mainPhrase = phraseEntry.phrase.toLowerCase();
      
      if (mainPhrase === 'למידה מרחוק') {
        continue;
      }
      
      for (const variation of phraseEntry.variations) {
        const variationLower = variation.toLowerCase();
        
        if (lowerMessage.includes(variationLower)) {
          console.log(`✅ Found phrase variation: "${variation}"`);
          
          for (const field of STUDY_FIELDS) {
            if (field.name.toLowerCase().includes(mainPhrase)) {
              return [{ ...field, specificKeyword: variation }];
            }
            
            if (field.keywords && field.keywords.some(kw => kw.toLowerCase() === mainPhrase)) {
              return [{ ...field, specificKeyword: variation }];
            }
          }
        }
      }
    }
  }
  
  const matches = [];
  const tooGenericKeywords = ['למידה', 'לימוד', 'קורס', 'קורסים', 'השתלמות'];
  
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') {
      continue;
    }
    
    for (const keyword of field.keywords) {
      if (!keyword) continue;
      
      const keywordLower = keyword.toLowerCase();
      
      if (tooGenericKeywords.includes(keywordLower)) {
        continue;
      }
      
      if (lowerMessage.includes(keywordLower)) {
        matches.push({ field, keyword, length: keywordLower.length });
        break;
      }
    }
  }
  
  matches.sort((a, b) => b.length - a.length);
  
  detectedFields.push(...matches.map(m => ({ ...m.field, specificKeyword: m.keyword })));
  
  if (detectedFields.length > 0) {
    console.log(`✅ Found ${detectedFields.length} fields`);
  }
  
  return detectedFields;
}

// ========================================
// 🤖 יצירת תשובה חכמה
// ========================================
function generateSmartResponse(userMessage) {
  console.log('\n========================================');
  console.log('🚀 [generateSmartResponse] START');
  console.log('========================================\n');
  
  try {
    // ✅ בדוק ביטוח לאומי
    if (detectInsuranceQuestion(userMessage)) {
      const answer = findInsuranceAnswer(userMessage);
      
      if (answer) {
        return formatInsuranceAnswer(answer);
      } else {
        return formatGeneralInsuranceInfo();
      }
    }
    
    // 🆕 בדוק הכרת קורסים
    if (detectCoursesQuestion(userMessage)) {
      const answer = findCoursesAnswer(userMessage);
      
      if (answer) {
        return formatCoursesAnswer(answer);
      } else {
        return formatGeneralCoursesInfo();
      }
    }
    
    let regions = detectRegions(userMessage);
    const studyFields = detectStudyField(userMessage);
    
    let response = '';
    
    const isInfoQuery = userMessage.toLowerCase().includes('שבתון') || 
                        userMessage.toLowerCase().includes('מענק') ||
                        userMessage.toLowerCase().includes('ביטוח לאומי') ||
                        userMessage.toLowerCase().includes('לידה');
    
    if (isInfoQuery) {
      try {
        const infoResults = searchPages(userMessage, null, 'info');
        
        if (infoResults && infoResults.length > 0) {
          response = formatSearchResults(infoResults);
          return response;
        }
      } catch (error) {
        console.error('[generateSmartResponse] Error in info search:', error.message);
      }
      
      response = `שנת שבתון - מידע כללי 📘\n\n`;
      response += `מה תרצה לדעת?\n`;
      response += `• מענק בשבתון\n`;
      response += `• ביטוח לאומי\n`;
      response += `• לידה בשבתון\n`;
      response += `• תוכנית הלימודים\n\n`;
      response += `[שאל בקבוצת WhatsApp](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)`;
      return response;
    }
    
    const isRemoteLearning = detectRemoteLearning(userMessage);
    if (isRemoteLearning) {
      console.log('🌐 Remote learning detected - removing region filter');
      regions = null;
    }
    
    if (studyFields.length > 0 && regions && regions.length > 0) {
      const field = studyFields[0];
      
      console.log(`📚 Field: ${field.name}`);
      console.log(`📍 Regions: ${regions.map(r => r.name).join(', ')}`);
      
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
          console.error(`Error searching in region ${region.name}:`, error.message);
        }
      }
      
      const uniqueResults = [];
      const seenUrls = new Set();
      for (const result of allResults) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          uniqueResults.push(result);
        }
      }
      
      const includeRemote = detectRemoteLearning(userMessage);
      
      let filteredResults = uniqueResults;
      if (regions.length > 0) {
        const specificCity = detectSpecificCity(userMessage, regions[0]);
        
        if (specificCity || includeRemote) {
          filteredResults = filterBySpecificCity(filteredResults, specificCity, includeRemote);
        }
      }
      
      const hasSpecificKeyword = field && field.specificKeyword;
      
      if (filteredResults.length === 0 && uniqueResults.length === 0 && hasSpecificKeyword) {
        console.log(`🔍 Trying broader search in region...`);
        
        let broaderRegionResults = [];
        try {
          const fieldWithoutKeyword = { ...field, specificKeyword: null };
          
          for (const region of regions) {
            const resultsInRegion = searchPages(field.name, region, 'all', fieldWithoutKeyword);
            broaderRegionResults = broaderRegionResults.concat(resultsInRegion);
          }
          
          console.log(`📊 Found ${broaderRegionResults.length} courses in region`);
        } catch (error) {
          console.error(`Error in broader region search:`, error.message);
        }
        
        if (broaderRegionResults.length > 0) {
          let remoteCount = 0;
          let regionalCount = 0;
          
          broaderRegionResults.slice(0, 15).forEach(page => {
            const hasRemote = isRemoteLearningPage(page);
            
            if (hasRemote) {
              remoteCount++;
            } else {
              regionalCount++;
            }
          });
          
          let locationText = '';
          if (remoteCount > 0 && regionalCount > 0) {
            locationText = `ב${regionNames.join(' ו')} ובלמידה מרחוק`;
          } else if (remoteCount > 0) {
            locationText = `בלמידה מרחוק`;
          } else {
            locationText = `ב${regionNames.join(' ו')}`;
          }
          
          response = `מצאתי ${broaderRegionResults.length} ${broaderRegionResults.length === 1 ? 'קורס' : 'קורסים'} ב${field.name} ${locationText}:\n\n`;
          
          const formatted = formatSearchResults(broaderRegionResults.slice(0, 15), field, null);
          if (formatted) {
            response += formatted;
          }
          
          const regionSlugs = regions.map(r => r.slug).filter(s => s).join('-');
          const fieldSlug = field.slug || field.name.replace(/[, ]/g, '-').toLowerCase();
          
          if (regionSlugs && fieldSlug) {
            response += `\n💡 **רוצה לראות עוד?**\n`;
            response += `[לכל הקורסים ב${field.name} ב${regionNames.join(' ו')}](https://www.shabaton.online/${regionSlugs}/${fieldSlug})\n`;
          }
          
          return response;
        }
        
        console.log(`🔍 No results in region - searching for remote learning...`);
        
        let remoteResults = [];
        try {
          const fieldWithoutKeyword = { ...field, specificKeyword: null };
          remoteResults = searchPages(field.name, null, 'all', fieldWithoutKeyword);
          
          remoteResults = remoteResults.filter(page => isRemoteLearningPage(page));
          
          console.log(`✅ Found ${remoteResults.length} remote courses`);
        } catch (error) {
          console.error(`Error searching for remote courses:`, error.message);
        }
        
        if (remoteResults.length > 0) {
          response = `מצאתי ${remoteResults.length} ${remoteResults.length === 1 ? 'קורס' : 'קורסים'} ב${field.name} בלמידה מרחוק:\n\n`;
          
          const formatted = formatSearchResults(remoteResults.slice(0, 10), field, null);
          if (formatted) {
            response += formatted;
          }
        } else {
          response = `לא מצאתי קורסים ב${field.name} ב${regionNames.join(' ו')}.\n\n`;
        }
        
        response += `\n💡 **רוצה לראות עוד?**\n`;
        
        const regionSlugs = regions.map(r => r.slug).filter(s => s).join('-');
        const fieldSlug = field.slug || field.name.replace(/[, ]/g, '-').toLowerCase();
        
        if (regionSlugs && fieldSlug) {
          response += `[לכל הקורסים ב${field.name} ב${regionNames.join(' ו')}](https://www.shabaton.online/${regionSlugs}/${fieldSlug})\n`;
        }
        
        return response;
      }
      
      if (filteredResults.length > 0) {
        const staticCount = filteredResults.filter(r => r.isStatic).length;
        
        if (isRemoteLearning) {
          response = `מצאתי ${staticCount} ${staticCount === 1 ? 'מוסד' : 'מוסדות'} בלמידה מרחוק ל${field.name}:\n\n`;
        } else {
          const regionsText = regionNames.join(' ו');
          response = `מצאתי ${staticCount} ${staticCount === 1 ? 'מוסד' : 'מוסדות'} ב${regionsText} ל${field.name}:\n\n`;
        }
        
        const formatted = formatSearchResults(filteredResults, field, regions[0]);
        if (formatted) {
          response += formatted;
        }
        
        if (staticCount < 5 && field) {
          try {
            let remoteResults = searchPages(userMessage, null, 'all', field);
            remoteResults = remoteResults.filter(page => isRemoteLearningPage(page));
            
            const shownUrls = new Set(filteredResults.map(r => r.url));
            remoteResults = remoteResults.filter(page => !shownUrls.has(page.url));
            
            if (remoteResults.length > 0) {
              response += `\n\n💡 **מצאתי גם ${remoteResults.length} ${remoteResults.length === 1 ? 'קורס' : 'קורסים'} בלמידה מרחוק**\n\n`;
              const remoteFormatted = formatSearchResults(remoteResults.slice(0, 5), field, null);
              if (remoteFormatted) {
                response += remoteFormatted;
              }
            }
          } catch (error) {
            console.error(`Error adding remote suggestions:`, error.message);
          }
        }
        
        return response;
      }
    }
    
    if (studyFields.length > 0 && (!regions || regions.length === 0)) {
      const field = studyFields[0];
      
      const isRemoteLearning = detectRemoteLearning(userMessage);
      if (isRemoteLearning) {
        try {
          let remoteResults = searchPages(userMessage, null, 'all', field);
          remoteResults = remoteResults.filter(page => isRemoteLearningPage(page));
          
          if (remoteResults.length > 0) {
            const staticCount = remoteResults.filter(r => r.isStatic).length;
            response = `מצאתי ${staticCount} ${staticCount === 1 ? 'מוסד' : 'מוסדות'} בלמידה מרחוק ל${field.name}:\n\n`;
            const formatted = formatSearchResults(remoteResults.slice(0, 10), field, null);
            if (formatted) {
              response += formatted;
            }
            return response;
          }
        } catch (error) {
          console.error(`Error in remote learning search:`, error.message);
        }
      }
      
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
    
    if (regions && regions.length > 0) {
      const regionNames = regions.map(r => r.name).join(' ו');
      response = `מעולה! ${regionNames} 🗺️\n\n`;
      response += `באיזה תחום תרצה להתמחות?\n`;
      response += `ספר לי במילים שלך - למשל: "גישור", "צילום", "NLP"...`;
      
      return response;
    }
    
    const searchResults = searchPages(userMessage, null, 'static');
    
    if (searchResults && searchResults.length > 0) {
      response = `מצאתי ${searchResults.length} תוצאות:\n\n`;
      response += formatSearchResults(searchResults);
      return response;
    }
    
    response = `אשמח לעזור! 🎯\n\n`;
    response += `ספר לי:\n`;
    response += `📍 באיזה אזור?\n`;
    response += `📚 איזה תחום?\n\n`;
    response += `דוגמה: "הנחיית קבוצות בחיפה"`;
    
    return response;
    
  } catch (error) {
    console.error('[generateSmartResponse] ERROR:', error.message);
    return `אשמח לעזור! 🎯\n\nספר לי:\n📍 באיזה אזור?\n📚 איזה תחום?`;
  }
}

// ========================================
// 🚀 API Handler
// ========================================
export default async function handler(req, res) {
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
    
    console.log(`\n📨 [handler] New message: "${message}"`);
    
    let response = generateSmartResponse(message);
    
    const missingRegion = response.includes('באיזה אזור');
    const missingField = response.includes('באיזה תחום');
    const genericResponse = response.includes('אשמח לעזור');
    
    const needsContext = missingRegion && !missingField && !genericResponse;
    
    const isShortAnswer = message.trim().split(/\s+/).length <= 5;
    
    console.log(`🔍 [handler] Analysis:`);
    console.log(`   - Needs context: ${needsContext}`);
    console.log(`   - Is short answer: ${isShortAnswer}`);
    console.log(`   - Missing region: ${missingRegion}`);
    console.log(`   - Missing field: ${missingField}`);
    
    let lastBotMessage = null;
    if (history && Array.isArray(history) && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'assistant') {
          lastBotMessage = history[i].content;
          break;
        }
      }
    }
    
    const lastBotMessageWasQuestion = lastBotMessage && 
      (lastBotMessage.includes('באיזה אזור') || 
       lastBotMessage.includes('באיזה תחום') ||
       lastBotMessage.includes('מה תרצה'));
    
    console.log(`   - Last bot message was question: ${lastBotMessageWasQuestion}`);
    if (lastBotMessage) {
      console.log(`   - Last bot message preview: "${lastBotMessage.substring(0, 100)}..."`);
    }
    
    if (needsContext && isShortAnswer && lastBotMessageWasQuestion && lastBotMessage) {
      console.log('🔄 [handler] Short answer to bot question - using only last exchange');
      
      let context = '';
      
      if (lastBotMessage.includes('באיזה תחום')) {
        const regionMatch = lastBotMessage.match(/מעולה!\s+([^🗺️]+)/);
        if (regionMatch) {
          context = regionMatch[1].trim();
          console.log(`   📍 Extracted region context: "${context}"`);
        }
      }
      
      if (lastBotMessage.includes('באיזה אזור')) {
        const fieldMatch = lastBotMessage.match(/באיזה אזור תרצה ללמוד\s+([^?]+)/);
        if (fieldMatch) {
          context = fieldMatch[1].trim();
          console.log(`   📚 Extracted field context: "${context}"`);
        }
      }
      
      const fullContext = context ? `${context} ${message}` : message;
      console.log(`📝 [handler] Reconstructed query: "${fullContext}"`);
      response = generateSmartResponse(fullContext);
    }
    else if (needsContext && history && Array.isArray(history) && history.length > 0) {
      console.log('🔄 [handler] Using history for context');
      
      const recentUserMessages = history
        .filter(msg => msg.role === 'user')
        .slice(-1)
        .map(msg => msg.content)
        .join(' ');
      
      const fullContext = recentUserMessages + ' ' + message;
      console.log(`📝 [handler] Context from history: "${fullContext}"`);
      response = generateSmartResponse(fullContext);
    }
    
    console.log(`✅ [handler] Returning response (${response.length} chars)\n`);
    
    return res.status(200).json({
      response: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [handler] Error:', error);
    
    return res.status(500).json({
      response: 'מצטער, הייתה בעיה טכנית.',
      error: error.message
    });
  }
}
