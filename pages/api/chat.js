// pages/api/chat.js - Vercel Serverless with JSON config files
import fs from 'fs';
import path from 'path';

// ========================================
// 📚 טעינת כל קבצי האינדקס
// ========================================
let ALL_PAGES = null;
let REGIONS = null;
let STUDY_FIELDS = null;
let PAYMENTS_QA = null;
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
function loadPaymentsQA() {
  if (!PAYMENTS_QA) {
    try {
      const paymentsPath = path.join(process.cwd(), 'data', 'payments-qa.json');
      const fileContent = fs.readFileSync(paymentsPath, 'utf8');
      PAYMENTS_QA = JSON.parse(fileContent);
      
      const totalQuestions = PAYMENTS_QA.categories.reduce((sum, cat) => sum + cat.questions.length, 0);
      console.log(`✅ נטען payments-qa.json: ${totalQuestions} שאלות ב-${PAYMENTS_QA.categories.length} קטגוריות`);
      
      if (!PAYMENTS_QA.keywords || PAYMENTS_QA.keywords.length === 0) {
        console.error('⚠️ payments-qa.json לא מכיל keywords!');
      }
    } catch (error) {
      console.error('❌ שגיאה בטעינת payments-qa.json:', error.message);
      PAYMENTS_QA = { categories: [], keywords: [], generalInfo: {}, fallbackMessage: '' };
    }
  }
  return PAYMENTS_QA;
}

function detectPaymentsQuestion(message) {
  loadPaymentsQA();
  const lowerMessage = message.toLowerCase();
  
  if (!PAYMENTS_QA || !PAYMENTS_QA.keywords || PAYMENTS_QA.keywords.length === 0) {
    return false;
  }
  
  // בדיקה מהירה - האם יש מילת מפתח תשלומים
  const hasPaymentsKeyword = PAYMENTS_QA.keywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return lowerMessage.includes(keywordLower);
  });
  
  if (hasPaymentsKeyword) {
    console.log('✅ זוהתה שאלה על תשלומים/מענקים');
  }
  
  return hasPaymentsKeyword;
}

function findPaymentsAnswer(message) {
  loadPaymentsQA();
  
  if (!PAYMENTS_QA || !PAYMENTS_QA.categories || PAYMENTS_QA.categories.length === 0) {
    console.log('⚠️ payments-qa.json לא נטען נכון');
    return null;
  }
  
  const lowerMessage = message.toLowerCase();
  
  const questionWords = ['מה', 'איך', 'למה', 'מתי', 'האם', 'מדוע', 'איפה', 'כמה', 'מי'];
  const isSpecificQuestion = questionWords.some(word => lowerMessage.includes(word));
  
  if (!isSpecificQuestion) {
    console.log('⚠️ לא שאלה ספציפית');
    return null;
  }
  
  console.log('✅ שאלה ספציפית על תשלומים/מענקים - מחפש תשובה');
  
  const cleanMessage = lowerMessage
    .replace(/\?/g, '')
    .replace(/\./g, '')
    .trim();
  
  let bestMatch = null;
  let bestScore = 0;
  let bestCategory = null;
  
  for (const category of PAYMENTS_QA.categories) {
    for (const qa of category.questions) {
      let score = 0;
      
      if (qa.keywords && Array.isArray(qa.keywords)) {
        for (const keyword of qa.keywords) {
          const keywordLower = keyword.toLowerCase();
          
          if (cleanMessage.includes(keywordLower)) {
            score += 15;
            continue;
          }
          
          if (keywordLower.length >= 3) {
            const keywordStem = keywordLower.substring(0, Math.max(3, keywordLower.length - 2));
            if (cleanMessage.includes(keywordStem)) {
              score += 10;
            }
          }
        }
      }
      
      const questionWords = qa.question.toLowerCase().split(/\s+/);
      const messageWords = cleanMessage.split(/\s+/);
      
      for (const word of messageWords) {
        if (word.length > 2 && questionWords.some(qw => qw.includes(word) || word.includes(qw))) {
          score += 5;
        }
      }
      
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
  
  if (bestMatch && bestScore >= 8) {
    console.log(`✅ נמצאה תשובה בקטגוריה: ${bestCategory.name}`);
    return { qa: bestMatch, category: bestCategory };
  }
  
  console.log('⚠️ לא נמצאה תשובה טובה מספיק');
  return null;
}

function formatPaymentsAnswer(match) {
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

function formatGeneralPaymentsInfo() {
  loadPaymentsQA();
  
  if (!PAYMENTS_QA || !PAYMENTS_QA.generalInfo) {
    return `💰 **תשלומים ומענקים בשבתון**\n\nלמידע מפורט:\n[תשלומים בשבתון](https://www.shabaton.online/Payments_shabaton)`;
  }
  
  let response = `💰 **תשלומים ומענקים בשבתון**\n\n`;
  
  if (PAYMENTS_QA.generalInfo.content) {
    response += `${PAYMENTS_QA.generalInfo.content}\n\n`;
  }
  
  response += `**💡 שאלות נפוצות:**\n`;
  
  const topCategories = PAYMENTS_QA.categories.slice(0, 3);
  topCategories.forEach(cat => {
    if (cat.questions && cat.questions.length > 0) {
      response += `\n${cat.icon} **${cat.name}**\n`;
      response += `• ${cat.questions[0].question}\n`;
    }
  });
  
  response += `\n📘 [למידע מפורט על תשלומים](https://www.shabaton.online/Payments_shabaton)`;
  
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
  
  // 🎯 מילות מפתח ספציפיות לתכנון לימודים והכרה - מורחבות!
  const planningKeywords = [
    // הכרה בסיסית
    'הכרה',
    'מוכר',
    'מאושר',
    'אישור',
    'פורטל',
    'מאגר',
    
    // מוסדות וגורמים
    'קרן השתלמות',
    'המוסד',
    'מכללה',
    'התחייב',
    'הבטיח',
    'הבטחה',
    
    // זיהוי קורס
    'לא מופיע',
    'אין במאגר',
    'לא נמצא',
    'חסר',
    
    // היסטוריה
    'היה מוכר',
    'בעבר',
    'בשנה קודמת',
    'חברה שלי',
    'מורה אחרת',
    
    // הרשמה ותשלום
    'נרשמתי',
    'הרשמה',
    'שילמתי',
    'מקדמה',
    'תשלום',
    'בדיעבד',
    'לפני ההרשמה',
    
    // ריבוי קורסים
    'כמה קורסים',
    'שני קורסים',
    'מספר קורסים',
    'קורס אחד',
    'מסלולים',
    
    // בדיקה
    'בדיקה',
    'לבדוק',
    'איך בודקים',
    'מה עושים',
    
    // תכנון ומבנה תוכנית
    'תוכנית לימודים',
    'תכנית לימודים',
    'מורכבת',
    'מבנה',
    'דרישות',
    'חובות',
    'מה צריך ללמוד',
    'כמה צריך ללמוד',
    'איך בונים',
    'איך מתכננים',
    'רכיבים',
    'מה כולל',
    'ממה מורכב'
  ];
  
  // בדיקה מהירה - אם יש מילת מפתח ספציפית לתכנון
  const isPlanningQuestion = planningKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  if (!isPlanningQuestion) {
    // 🔍 אין planning keyword - בדוק אם יש מילת שאלה
    // אם אין שאלה → זה חיפוש קורסים, לא שאלה תכנון!
    const questionWords = ['מה', 'איך', 'למה', 'מתי', 'האם', 'מדוע', 'כמה', 'מי', 'ממה', 'מאיזה'];
    const hasQuestionWord = questionWords.some(w => lowerMessage.includes(w));
    
    if (!hasQuestionWord) {
      console.log('🔍 אין שאלה ואין planning keyword → חיפוש קורסים');
      return false;
    }
    
    // יש שאלה - בדוק keywords כלליים מהקובץ
    const hasCoursesKeyword = COURSES_QA.keywords.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      return lowerMessage.includes(keywordLower);
    });
    
    if (hasCoursesKeyword) {
      console.log('✅ זוהתה שאלה על הכרת קורסים (keywords כלליים)');
      return true;
    }
    
    return false;
  }
  
  // ✅ יש מילת מפתח ספציפית - זו בהחלט שאלה על הכרת קורסים!
  console.log('✅ זוהתה שאלה על הכרת קורסים');
  return true;
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
      
      // התאמה למילות מפתח - משופרת!
      if (qa.keywords && Array.isArray(qa.keywords)) {
        for (const keyword of qa.keywords) {
          const keywordLower = keyword.toLowerCase();
          
          // התאמה מדויקת
          if (cleanMessage.includes(keywordLower)) {
            score += 15;
            continue;
          }
          
          // התאמה לשורש המילה (למשל: הרשמה -> נרשמתי)
          if (keywordLower.length >= 3) {
            const keywordStem = keywordLower.substring(0, Math.max(3, keywordLower.length - 2));
            if (cleanMessage.includes(keywordStem)) {
              score += 10;
            }
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
  
  if (bestMatch && bestScore >= 8) {
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
    
    let bestMatch = null;

    for (const keyword of field.keywords) {
      if (!keyword) continue;
      
      const keywordLower = keyword.toLowerCase();
      
      if (tooGenericKeywords.includes(keywordLower)) {
        continue;
      }
      
      if (lowerMessage.includes(keywordLower)) {
        if (!bestMatch || keywordLower.length > bestMatch.length) {
          bestMatch = { keyword, length: keywordLower.length };
        }
      }
    }

    if (bestMatch) {
      matches.push({ field, keyword: bestMatch.keyword, length: bestMatch.length });
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
// 🤔 אבחנת כוונת המשתמש
// ========================================

function classifyIntent(message) {
  const lower = message.toLowerCase().trim();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1️⃣ תשלומים — ברור, אין ספק
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (detectPaymentsQuestion(message)) return 'payments';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2️⃣ FAQ ברור — שאלות שהן 100% מידע, לא חיפוש
  //    אלה שאלות שמתחילות עם "מה זה", "ממה מורכבת" וכו'
  //    → אין ספק, תשובה אוטומטית
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const clearFAQPatterns = [
    'מה זה קורס רשות',
    'מה זה קורס חובה',
    'מה זה לימודי רשות',
    'מה זה לימודי חובה',
    'ממה מורכבת תוכנית',
    'ממה מורכבת תכנית',
    'כמה שעות רשות',
    'כמה שעות חובה',
    'כמה שעות צריך',
    'מתי צריך לבדוק',
    'לא מופיע בפורטל',
    'לא מופיע במאגר',
    'נרשמתי כבר',
    'שילמתי מקדמה',
    'מה זה שש',
    'תוכנית הלימודים',
    'תכנית הלימודים',
    'הכרה בקורס',
    'הוא מוכר לשבתון',
    'קורס מוכר לשבתון',
  ];
  if (clearFAQPatterns.some(p => lower.includes(p))) return 'qa';

  // גם בדוק findCoursesAnswer — אם יש match חזק בקובץ
  const coursesMatch = findCoursesAnswer(message);
  if (coursesMatch) return 'qa';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3️⃣ חיפוש ברור — תחום + מקום → ברור שמחפשת קורס
  //    דוגמה: "קורס צילום בתל אביב"
  //    דוגמה: "מה יש בירושלים"
  //    → אין ספק, חיפוש אוטומטי
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const regions = detectRegions(message);
  const studyFields = detectStudyField(message);
  const hasLocation = regions && regions.length > 0;
  const hasStudyField = studyFields && studyFields.length > 0;

  // "מחפשת קורס ___" = חיפוש ברור
  const clearSearchPatterns = ['מחפש קורס', 'מחפשת קורס', 'תמצאי קורס', 'תמצא קורס'];
  if (clearSearchPatterns.some(p => lower.includes(p))) return 'search';

  // תחום + מקום = חיפוש ברור ("צילום בתל אביב")
  if (hasLocation && hasStudyField) return 'search';

  // רק מקום ("מה יש בירושלים", "קורסים בחיפה") = חיפוש
  if (hasLocation) return 'search';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4️⃣ יש "קורס"/"לימוד"/תחום אבל אין מקום → ספק!
  //    דוגמה: "האם יש קורס הנחיית קבוצות"
  //    דוגמה: "קורס עיסת נייר"
  //    → שאל את הגולש
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (lower.includes('קורס') || lower.includes('לימוד') || hasStudyField) return 'ambiguous';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5️⃣ Default — אין keywords קורס → חיפוש כללי
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return 'search';
}

function formatDisambiguation(originalMessage) {
  let response = `🤔 כדי שאני אעזור לך הכי טוב:\n\n`;
  response += `> "${originalMessage}"\n\n`;
  response += `מה הכוונה?\n\n`;
  response += `**1️⃣ 🔍 חיפוש קורס** — מחפש.ת קורס כזה, מצא לי בבקשה\n`;
  response += `**2️⃣ 📚 מידע שבתון** — שואל.ת אם הוא מוכר/מאושר לשבתון\n\n`;
  response += `כתבי **1** או **2** 😊`;
  return response;
}

// ========================================
// 🤖 יצירת תשובה חכמה
// ========================================
function generateSmartResponse(userMessage, forcedMode) {
  console.log('\n========================================');
  console.log('🚀 [generateSmartResponse] START');
  console.log('========================================\n');

  try {
    // 🎯 אבחנת כוונה
    const intent = forcedMode || classifyIntent(userMessage);
    console.log(`🎯 [classifyIntent] intent: ${intent}`);

    // 🤔 אמבמבוי → שאל את הגולשת
    if (intent === 'ambiguous') {
      return formatDisambiguation(userMessage);
    }

    // ✅ תשלומים ומענקים
    if (intent === 'payments') {
      const answer = findPaymentsAnswer(userMessage);
      if (answer) return formatPaymentsAnswer(answer);
      return formatGeneralPaymentsInfo();
    }

    // 📚 שאלות מידע (courses-qa)
    if (intent === 'qa') {
      const answer = findCoursesAnswer(userMessage);
      if (answer) return formatCoursesAnswer(answer);
      return formatGeneralCoursesInfo();
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
        const keyword = field.specificKeyword;
        console.log(`🔍 "${keyword}" לא נמצא ב${regionNames.join(' ו')} — מחפש בכל הארץ עם אותה מילה`);

        // שלב 1: חיפוש "פיסול" בכל הארץ (הפילטר נשאר!)
        let nationwideResults = [];
        try {
          nationwideResults = searchPages(userMessage, null, 'all', field);
          console.log(`📊 Nationwide with filter: ${nationwideResults.length} results`);
        } catch (error) {
          console.error(`Error in nationwide search:`, error.message);
        }

        const regionSlugs = regions.map(r => r.slug).filter(s => s).join('-');
        const fieldSlug = field.slug || field.name.replace(/[, ]/g, '-').toLowerCase();

        // שלב 2: נמצא בכל הארץ → הציג אותו עם הבהרה
        if (nationwideResults.length > 0) {
          response = `לא מצאתי קורסים ב**${keyword}** ב${regionNames.join(' ו')}.\n\n`;
          response += `📍 אבל מצאתי ${nationwideResults.length} ${nationwideResults.length === 1 ? 'קורס' : 'קורסים'} ב**${keyword}** בכל הארץ:\n\n`;

          const formatted = formatSearchResults(nationwideResults.slice(0, 10), field, null);
          if (formatted) response += formatted;

          if (regionSlugs && fieldSlug) {
            response += `\n💡 רוצה לראות גם קורסים אחרים ב${regionNames.join(' ו')}?\n`;
            response += `[לכל הקורסים ב${field.name} ב${regionNames.join(' ו')}](https://www.shabaton.online/${regionSlugs}/${fieldSlug})\n`;
          }

          return response;
        }

        // שלב 3: לא נמצא גם בכל הארץ → הודעה ברורה + לינקים
        console.log(`❌ "${keyword}" לא נמצא גם בכל הארץ`);

        response = `לא מצאתי קורסים ב**${keyword}** בשבתון.\n\n`;
        response += `💡 אפשר לנסות:\n`;

        if (regionSlugs && fieldSlug) {
          response += `• [כל הקורסים ב${field.name} ב${regionNames.join(' ו')}](https://www.shabaton.online/${regionSlugs}/${fieldSlug})\n`;
        }
        response += `• [כל הקורסים ב${field.name} בכל הארץ](https://www.shabaton.online/${fieldSlug})\n`;
        response += `\nאפשר גם לכתוב תחום אחר 😊`;

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
    
    // 🤔 בדוק אם הגולשת מתפתחת לשאלת הבהרה שלנו
    let lastBotMessage = null;
    if (history && Array.isArray(history) && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'assistant') {
          lastBotMessage = history[i].content;
          break;
        }
      }
    }
    
    if (lastBotMessage && lastBotMessage.includes('מה הכוונה?')) {
      // השאלה המקורית היא הודעת הגולש הקודמה ב-history
      let originalQuery = null;
      if (history && Array.isArray(history) && history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].role === 'user') {
            originalQuery = history[i].content;
            break;
          }
        }
      }

      if (originalQuery) {
        const userChoice = message.toLowerCase().trim();
        console.log(`🤔 [handler] Disambiguation! choice="${userChoice}" original="${originalQuery}"`);

        let forcedMode = null;
        if (userChoice === '1' || userChoice.includes('חיפוש') || userChoice.includes('🔍')) {
          forcedMode = 'search';
        } else if (userChoice === '2' || userChoice.includes('מידע') || userChoice.includes('📚') || userChoice.includes('שבתון')) {
          forcedMode = 'qa';
        }

        if (forcedMode) {
          console.log(`🎯 [handler] Routing to: ${forcedMode} with query: "${originalQuery}"`);
          const response = generateSmartResponse(originalQuery, forcedMode);
          return res.status(200).json({ response, timestamp: new Date().toISOString() });
        }
      }
    }
    
    // 🔄 בדוק אם זו תשובת המשך לשאלה של הבוט
    const isShortAnswer = message.trim().split(/\s+/).length <= 5;
    const messageLower = message.toLowerCase();
    const isActualQuery = messageLower.includes('קורס') || 
                          messageLower.includes('לימוד') || 
                          messageLower.includes('השתלמות');
    
    const lastBotMessageWasFollowUpQuestion = lastBotMessage && 
      (lastBotMessage.includes('באיזה אזור') || 
       lastBotMessage.includes('איזה תחום') ||
       lastBotMessage.includes('מה תרצה'));
    
    if (isShortAnswer && !isActualQuery && lastBotMessageWasFollowUpQuestion) {
      console.log('🔄 [handler] Detected short answer to follow-up question');
      
      let contextPrefix = '';
      
      // אם הבוט שאל "באיזה תחום?" - חלץ את האזור מההודעה הקודמת
      if (lastBotMessage.includes('באיזה תחום')) {
        const regionMatch = lastBotMessage.match(/מעולה!\s+([^🗺️]+)/);
        if (regionMatch) {
          contextPrefix = regionMatch[1].trim();
          console.log(`   📍 Extracted region context: "${contextPrefix}"`);
        }
      }
      
      // אם הבוט שאל "באיזה אזור תרצה ללמוד X?" - חלץ את התחום
      if (lastBotMessage.includes('באיזה אזור')) {
        const fieldMatch = lastBotMessage.match(/באיזה אזור תרצה ללמוד\s+([^?]+)/);
        if (fieldMatch) {
          contextPrefix = fieldMatch[1].trim();
          console.log(`   📚 Extracted field context: "${contextPrefix}"`);
        }
      }
      
      // אם הבוט שאל את השאלה הגנרית "באיזה אזור? איזה תחום?"
      // צריך לחזור להיסטוריה ולמצוא את השאילתה המקורית
      if (!contextPrefix && (lastBotMessage.includes('אשמח לעזור') || lastBotMessage.includes('ספר לי'))) {
        console.log('   🔍 Generic question detected - searching history for original query');
        
        if (history && Array.isArray(history) && history.length >= 2) {
          // חפש בהיסטוריה אחורה - דלג על ההודעה הנוכחית ועל תשובות disambiguation
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'user' && history[i].content !== message) {
              const previousUserMessage = history[i].content.trim();
              
              // דלג על תשובות disambiguation ("1", "2")
              if (previousUserMessage === '1' || previousUserMessage === '2') {
                continue;
              }
              
              console.log(`   📝 Found original query in history: "${previousUserMessage}"`);
              contextPrefix = previousUserMessage;
              break;
            }
          }
        }
      }
      
      const fullQuery = contextPrefix ? `${contextPrefix} ${message}` : message;
      console.log(`📝 [handler] Reconstructed query: "${fullQuery}"`);
      const response = generateSmartResponse(fullQuery);
      return res.status(200).json({ response, timestamp: new Date().toISOString() });
    }
    
    let response = generateSmartResponse(message);
    
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
