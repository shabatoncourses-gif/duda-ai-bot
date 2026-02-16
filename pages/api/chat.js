// pages/api/chat.js - Vercel Serverless with JSON config files
import fs from 'fs';
import path from 'path';

// ========================================
// 🔧 Semantic Search Configuration
// ========================================
const SEMANTIC_SEARCH_CONFIG = {
  enabled: false,  // כבוי לגמרי! עד שיש API key תקין!
  openaiApiKey: process.env.OPENAI_API_KEY,  // צריך להגדיר ב-Vercel
  embeddingModel: 'text-embedding-3-small',  // model זול וטוב
  hybridWeight: 0.6,  // משקל ל-semantic (0.6) vs keyword (0.4)
  minSimilarityScore: 0.3,  // סף מינימלי לsimilarity
  maxResults: 20  // כמה תוצאות semantic לשלב
};

// ========================================
// 📚 טעינת כל קבצי האינדקס
// ========================================
let ALL_PAGES = null;

// פונקציה לרענון הקבצים (לדיבוג)
function reloadAllPages() {
  ALL_PAGES = null;
  return loadAllPages();
}
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
// 📊 ניתוח מבנה דף - זיהוי קורסים תחת כותרות
// ========================================

/**
 * מנתח את מבנה הדף ומזהה איזה קורס נמצא תחת איזו כותרת
 * @param {Object} page - דף מה-index
 * @returns {Object} - { courses: [{name, isRemote, section, sectionTitle}] }
 */
function analyzeCourseStructure(page) {
  try {
    // שלב 1: קבל את הכותרות (h3) והטקסט המלא
    const h3Headers = page.h3 || [];
    const fullText = page.text || '';
    
    if (!fullText || h3Headers.length === 0) {
      return { courses: [] };
    }
    
    // שלב 2: זהה איזה כותרות הן "למידה מרחוק"
    const remoteSectionPatterns = [
      'למידה מרחוק',
      'בלמידה מרחוק',
      'מקוון',
      'אונליין',
      'זום',
      'א-סינכרונית',
      'סינכרונית'
    ];
    
    const isRemoteSection = (sectionTitle) => {
      const lower = sectionTitle.toLowerCase();
      return remoteSectionPatterns.some(pattern => lower.includes(pattern));
    };
    
    // שלב 3: פצל את הטקסט לפי הכותרות
    const sections = [];
    
    for (let i = 0; i < h3Headers.length; i++) {
      const currentHeader = h3Headers[i];
      const nextHeader = h3Headers[i + 1] || null;
      
      // מצא את המיקום של הכותרת הנוכחית והבאה בטקסט
      const currentIndex = fullText.indexOf(currentHeader);
      if (currentIndex === -1) continue;
      
      const nextIndex = nextHeader ? fullText.indexOf(nextHeader, currentIndex + 1) : fullText.length;
      
      // חלץ את הטקסט בין שתי הכותרות
      const sectionText = fullText.substring(currentIndex + currentHeader.length, nextIndex);
      
      sections.push({
        title: currentHeader,
        text: sectionText.trim(),
        isRemote: isRemoteSection(currentHeader)
      });
    }
    
    // שלב 4: זהה קורסים בכל סקשן
    const coursePatterns = [
      /(?:^|\n)\s*(קורס[^\n]+)/gm,
      /(?:^|\n)\s*(הכשרת[^\n]+)/gm,
      /(?:^|\n)\s*(לימודי[^\n]+)/gm,
      /(?:^|\n)\s*(תכנית[^\n]+)/gm,
      /(?:^|\n)\s*(מסלול[^\n]+)/gm
    ];
    
    const allCourses = [];
    
    for (const section of sections) {
      const coursesInSection = [];
      
      for (const pattern of coursePatterns) {
        let match;
        while ((match = pattern.exec(section.text)) !== null) {
          const courseName = match[1].trim();
          
          // סנן שמות קצרים מדי או כלליים מדי
          if (courseName.length < 10) continue;
          if (courseName.includes('פנו ל')) continue;
          if (courseName.includes('למידע')) continue;
          
          coursesInSection.push({
            name: courseName,
            isRemote: section.isRemote,
            section: section.text.substring(0, 100) + '...',
            sectionTitle: section.title
          });
        }
      }
      
      allCourses.push(...coursesInSection);
    }
    
    return {
      courses: allCourses,
      sections: sections.map(s => ({ title: s.title, isRemote: s.isRemote }))
    };
    
  } catch (error) {
    console.error('[analyzeCourseStructure] ERROR:', error.message);
    return { courses: [] };
  }
}

/**
 * בדוק אם קורס ספציפי הוא בלמידה מרחוק
 * @param {Object} page - דף מה-index
 * @param {string} keyword - מילת מפתח (כמו "פוטותרפיה")
 * @returns {Object} - { found: boolean, isRemote: boolean, courseName: string }
 */
function isCourseRemote(page, keyword) {
  try {
    const analysis = analyzeCourseStructure(page);
    
    if (!analysis.courses || analysis.courses.length === 0) {
      // אם לא הצלחנו לנתח - נסה בדיקה פשוטה
      return fallbackRemoteCheck(page, keyword);
    }
    
    const keywordLower = keyword.toLowerCase();
    
    // חפש קורס שמכיל את ה-keyword
    for (const course of analysis.courses) {
      if (course.name.toLowerCase().includes(keywordLower)) {
        console.log(`  🔍 [isCourseRemote] Found course: "${course.name}" under section: "${course.sectionTitle}" | isRemote: ${course.isRemote}`);
        return {
          found: true,
          isRemote: course.isRemote,
          courseName: course.name,
          sectionTitle: course.sectionTitle
        };
      }
    }
    
    // לא מצאנו - נסה fallback
    return fallbackRemoteCheck(page, keyword);
    
  } catch (error) {
    console.error('[isCourseRemote] ERROR:', error.message);
    return { found: false, isRemote: false };
  }
}

/**
 * בדיקה פשוטה יותר אם הניתוח המלא נכשל
 */
function fallbackRemoteCheck(page, keyword) {
  const text = (page.text || '').toLowerCase();
  const keywordLower = keyword.toLowerCase();
  
  // האם הקורס קיים בכלל?
  if (!text.includes(keywordLower)) {
    return { found: false, isRemote: false };
  }
  
  // מצא את המיקום של ה-keyword
  const keywordIndex = text.indexOf(keywordLower);
  
  // קח 500 תווים לפני ואחרי
  const contextBefore = text.substring(Math.max(0, keywordIndex - 500), keywordIndex);
  const contextAfter = text.substring(keywordIndex, Math.min(text.length, keywordIndex + 500));
  const context = contextBefore + contextAfter;
  
  // בדוק אם יש "למידה מרחוק" בקונטקסט הקרוב
  const hasRemoteNearby = context.includes('למידה מרחוק') || 
                          context.includes('מקוון') || 
                          context.includes('אונליין') ||
                          context.includes('זום');
  
  // אבל בדוק גם שזה לא כותרת כללית רחוקה
  const h3Text = Array.isArray(page.h3) ? page.h3.join(' ').toLowerCase() : '';
  const hasRemoteInHeaders = h3Text.includes('קורסים בלמידה מרחוק');
  
  // אם יש "למידה מרחוק" בכותרות כלליות, אבל לא בקונטקסט הקרוב - אז כנראה לא בלמידה מרחוק
  if (hasRemoteInHeaders && !hasRemoteNearby) {
    console.log(`  ⚠️ [fallbackRemoteCheck] "${keyword}" - has remote in headers but NOT in context - assuming NOT remote`);
    return { found: true, isRemote: false, courseName: keyword };
  }
  
  // אם יש בקונטקסט הקרוב - כנראה כן בלמידה מרחוק
  console.log(`  ℹ️ [fallbackRemoteCheck] "${keyword}" - hasRemoteNearby: ${hasRemoteNearby}`);
  return { 
    found: true, 
    isRemote: hasRemoteNearby,
    courseName: keyword,
    confidence: hasRemoteNearby ? 'high' : 'low'
  };
}

// ========================================
// 🏷️ זיהוי סוג דף
// ========================================
function identifyPageType(page) {
  if (!page || !page.url) return 'unknown';
  
  const url = page.url.toLowerCase();
  const title = (page.title || page.h1 || '').toLowerCase();
  const description = (page.description || '').toLowerCase();
  const location = (page.location || '').toLowerCase();
  
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
  
  // ❌ זיהוי דפים כלליים לפי תוכן (close carousel וכו')
  if (title.includes('close carousel') || description.includes('close carousel')) {
    return 'general'; // ❌ דף כללי דינמי
  }
  
  // ❌ דפים שמציגים קורסים מכל הארץ (לא מוסדות ספציפיים)
  if (title.startsWith('קורסי ') || title.startsWith('לימודי ')) {
    // זה דף קטגוריה כללי, לא מוסד
    return 'general';
  }
  
  // ❌ דפים שהכותרת שלהם היא בדיוק שם התחום (לא מוסד ספציפי)
  // דוגמה: "הדרכת הורים, זוגיות ומשפחה" זה לא שם מוסד!
  const categoryTitles = [
    'אמנות',
    'מוסיקה',
    'צילום',
    'תרפיה וטיפול',
    'הדרכת הורים, זוגיות ומשפחה',
    'הדרכת הורים',
    'זוגיות ומשפחה',
    'ניהול',
    'חינוך והוראה',
    'אימון',
    'הנחיית קבוצות'
  ];
  
  // בדיקה מדויקת
  for (const categoryTitle of categoryTitles) {
    const categoryLower = categoryTitle.toLowerCase();
    if (title === categoryLower || 
        title === `קורסי ${categoryLower}` ||
        title === `לימודי ${categoryLower}`) {
      // DEBUG_LOG: console.log(`  🚫 Identified as GENERAL (exact category match): "${title}"`);
      return 'general'; // ❌ דף קטגוריה
    }
  }
  
  // ❌ דף עם כותרת כללית וללא location = דף קטגוריה
  // אם אין location וכותרת היא רק שם תחום (ללא שם מוסד) → general
  if (!location || location === 'n/a' || location.trim() === '') {
    // בדוק אם יש שם מוסד בכותרת
    const hasInstitutionName = title.includes('מכון') || 
                               title.includes('מכללת') ||
                               title.includes('אוניברסיטת') ||
                               title.includes('המרכז ל') ||
                               title.includes('מרכז ') ||
                               title.includes(' - ') || // בדרך כלל מפריד בין שם מוסד לתיאור
                               title.length > 50; // כותרת ארוכה = מפורטת = מוסד
    
    // אם אין שם מוסד והכותרת מכילה רק שם תחום → general
    if (!hasInstitutionName) {
      for (const categoryTitle of categoryTitles) {
        if (title === categoryTitle.toLowerCase() ||
            title === `${categoryTitle.toLowerCase()} בלמידה מרחוק` ||
            title === `${categoryTitle.toLowerCase()} במרכז הארץ` ||
            title === `${categoryTitle.toLowerCase()} בשרון`) {
          // DEBUG_LOG: console.log(`  🚫 Identified as GENERAL (category without institution): "${title}"`);
          return 'general'; // ❌ דף קטגוריה
        }
      }
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
      
      console.log('🔍 [loadAllPages] Starting to load index files...');
      console.log(`📁 Working directory: ${process.cwd()}`);
      
      for (const filename of indexFiles) {
        try {
          const filepath = path.join(process.cwd(), 'data', filename);
          console.log(`   Trying to load: ${filepath}`);
          
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          
          if (Array.isArray(data)) {
            console.log(`   ✅ Loaded ${data.length} pages from ${filename}`);
            ALL_PAGES = ALL_PAGES.concat(data);
          } else if (data.pages) {
            console.log(`   ✅ Loaded ${data.pages.length} pages from ${filename}`);
            ALL_PAGES = ALL_PAGES.concat(data.pages);
          } else {
            console.log(`   ✅ Loaded 1 page from ${filename}`);
            ALL_PAGES.push(data);
          }
        } catch (err) {
          console.log(`   ❌ Could not load ${filename}: ${err.message}`);
        }
      }
      
      console.log(`✅ Total loaded: ${ALL_PAGES.length} pages`);
      
      // תיקון אולטרה קריטי: הסר duplicates by URL!
      const seen = new Set();
      const uniquePages = [];
      let duplicatesCount = 0;
      
      for (const page of ALL_PAGES) {
        const url = page.url || '';
        if (url && seen.has(url)) {
          duplicatesCount++;
          // לא להדפיס כל duplicate - רק לספור!
          continue;
        }
        if (url) seen.add(url);
        uniquePages.push(page);
      }
      
      ALL_PAGES = uniquePages;
      
      if (duplicatesCount > 0) {
        console.log(`⚠️ Removed ${duplicatesCount} duplicates`);
        console.log(`✅ Final unique pages: ${ALL_PAGES.length}`);
      }
      
      if (ALL_PAGES.length === 0) {
        console.error('⚠️ WARNING: ALL_PAGES is EMPTY!');
        console.error('   Check if files exist in: ' + path.join(process.cwd(), 'data'));
      }
    } catch (error) {
      console.error('❌ Error loading indexes:', error);
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
// 🧠 Semantic Search Functions
// ========================================

/**
 * חישוב Cosine Similarity בין שני vectors
 * @param {number[]} vecA - Vector ראשון
 * @param {number[]} vecB - Vector שני
 * @returns {number} - Similarity score (0-1)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    console.error('⚠️ Invalid vectors for similarity calculation');
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * המרת טקסט ל-embedding vector באמצעות OpenAI
 * @param {string} text - הטקסט להמרה
 * @returns {Promise<number[]>} - Vector embedding
 */
async function getEmbedding(text) {
  // בדיקה מוקדמת - אם אין API key או שהוא לא תקין
  if (!SEMANTIC_SEARCH_CONFIG.openaiApiKey || 
      SEMANTIC_SEARCH_CONFIG.openaiApiKey === '' ||
      SEMANTIC_SEARCH_CONFIG.openaiApiKey === 'undefined' ||
      SEMANTIC_SEARCH_CONFIG.openaiApiKey === 'null') {
    console.log('⚠️ [getEmbedding] No valid OpenAI API key configured');
    return null;
  }
  
  try {
    // יצירת Promise עם timeout של 5 שניות (קצר יותר!)
    const fetchPromise = fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SEMANTIC_SEARCH_CONFIG.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: SEMANTIC_SEARCH_CONFIG.embeddingModel,
        input: text
      })
    });
    
    // יצירת timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
    
    // Promise.race - מי שמסיים ראשון מנצח!
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [getEmbedding] OpenAI API error:', error.substring(0, 200));
      return null;
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    if (error.message === 'Timeout') {
      console.error('❌ [getEmbedding] Request timeout (5s) - API not responding');
    } else {
      console.error('❌ [getEmbedding] Error:', error.message);
    }
    return null;
  }
}

/**
 * חיפוש semantic - מוצא דפים דומים לפי משמעות
 * @param {string} query - שאילתת החיפוש
 * @param {Object} region - אזור (אופציונלי)
 * @param {Object} studyField - תחום לימוד (אופציונלי)
 * @returns {Promise<Array>} - דפים ממוינים לפי דמיון
 */
async function semanticSearch(query, region = null, studyField = null) {
  try {
    console.log('\n🧠 [semanticSearch] START');
    console.log(`📝 Query: "${query}"`);
    
    if (!SEMANTIC_SEARCH_CONFIG.enabled) {
      console.log('⚠️ Semantic search is disabled');
      return [];
    }
    
    // 1. המר את השאילתה ל-vector
    const queryVector = await getEmbedding(query);
    if (!queryVector) {
      console.log('❌ Failed to get query embedding');
      return [];
    }
    
    console.log(`✅ Got query embedding (${queryVector.length} dimensions)`);
  
  // 2. טען את כל הדפים
  const allPages = loadAllPages();
  console.log(`📚 Loaded ${allPages.length} pages`);
  
  // 3. חשב similarity עם כל דף שיש לו vector
  const results = [];
  let pagesWithVectors = 0;
  let pagesWithoutVectors = 0;
  
  for (const page of allPages) {
    if (!page.vector || !Array.isArray(page.vector) || page.vector.length === 0) {
      pagesWithoutVectors++;
      continue;
    }
    
    pagesWithVectors++;
    const similarity = cosineSimilarity(queryVector, page.vector);
    
    // סנן תוצאות עם similarity נמוך מדי
    if (similarity < SEMANTIC_SEARCH_CONFIG.minSimilarityScore) {
      continue;
    }
    
    results.push({
      ...page,
      semanticScore: similarity
    });
  }
  
  console.log(`📊 Pages with vectors: ${pagesWithVectors}, without: ${pagesWithoutVectors}`);
  console.log(`🎯 Found ${results.length} results above threshold (${SEMANTIC_SEARCH_CONFIG.minSimilarityScore})`);
  
  // 4. מיין לפי similarity (גבוה לנמוך)
  results.sort((a, b) => b.semanticScore - a.semanticScore);
  
  // 5. סנן לפי region אם צריך
  let filtered = results;
  if (region && region.cities) {
    filtered = results.filter(page => {
      const fullText = (page.text || '').toLowerCase();
      const titleAndDesc = (page.title + ' ' + page.description).toLowerCase().replace(/-/g, ' ');
      const content = titleAndDesc + ' ' + fullText;
      
      // בדוק אם יש אזכור של עיר מהאזור
      return region.cities.some(city => {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        return content.includes(cityLower);
      });
    });
    
    console.log(`🗺️ Filtered by region "${region.name}": ${filtered.length} results`);
  }
  
  // 6. החזר את התוצאות הטובות ביותר
  const topResults = filtered.slice(0, SEMANTIC_SEARCH_CONFIG.maxResults);
  
  if (topResults.length > 0) {
    console.log(`✅ Top ${topResults.length} semantic results:`);
    topResults.slice(0, 5).forEach((page, i) => {
      console.log(`  ${i + 1}. "${page.title}" (score: ${page.semanticScore.toFixed(3)})`);
    });
  }
  
  console.log('🧠 [semanticSearch] END\n');
  return topResults;
  } catch (error) {
    console.error('❌ [semanticSearch] CRITICAL ERROR:', error.message);
    console.error('❌ [semanticSearch] Stack:', error.stack);
    console.log('⚠️ [semanticSearch] Falling back to empty results');
    return [];
  }
}

/**
 * חיפוש היברידי - משלב semantic search עם keyword search
 * @param {string} query - שאילתת החיפוש
 * @param {Object} region - אזור
 * @param {string} pageType - סוג דף
 * @param {Object} studyField - תחום לימוד
 * @returns {Promise<Array>} - דפים ממוינים
 */
async function hybridSearch(query, region = null, pageType = 'all', studyField = null) {
  console.log('\n🔀 [hybridSearch] START');
  
  // 1. הפעל שני חיפושים במקביל
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(query, region, studyField),
    Promise.resolve(searchPages(query, region, pageType, studyField))
  ]);
  
  console.log(`📊 Semantic: ${semanticResults.length} results, Keyword: ${keywordResults.length} results`);
  
  // 2. מזג תוצאות
  const scoreMap = new Map();
  
  // הוסף semantic results
  semanticResults.forEach((page, index) => {
    const normalizedScore = page.semanticScore; // כבר בין 0-1
    scoreMap.set(page.url, {
      ...page,
      semanticScore: normalizedScore,
      semanticRank: index + 1,
      keywordScore: 0,
      keywordRank: null
    });
  });
  
  // הוסף keyword results
  keywordResults.forEach((page, index) => {
    const normalizedScore = 1 - (index / Math.max(keywordResults.length, 1));
    const existing = scoreMap.get(page.url);
    
    if (existing) {
      // הדף נמצא גם ב-semantic - עדכן
      existing.keywordScore = normalizedScore;
      existing.keywordRank = index + 1;
    } else {
      // דף חדש מ-keyword
      scoreMap.set(page.url, {
        ...page,
        semanticScore: 0,
        semanticRank: null,
        keywordScore: normalizedScore,
        keywordRank: index + 1
      });
    }
  });
  
  // 3. חשב combined score
  const semanticWeight = SEMANTIC_SEARCH_CONFIG.hybridWeight;
  const keywordWeight = 1 - semanticWeight;
  
  const combinedResults = Array.from(scoreMap.values()).map(page => ({
    ...page,
    combinedScore: (page.semanticScore * semanticWeight) + (page.keywordScore * keywordWeight)
  }));
  
  // 4. מיין לפי combined score
  combinedResults.sort((a, b) => b.combinedScore - a.combinedScore);
  
  console.log(`🎯 Combined ${combinedResults.length} unique results`);
  
  if (combinedResults.length > 0) {
    console.log('📊 Top 5 hybrid results:');
    combinedResults.slice(0, 5).forEach((page, i) => {
      const semRank = page.semanticRank ? `#${page.semanticRank}` : 'N/A';
      const kwRank = page.keywordRank ? `#${page.keywordRank}` : 'N/A';
      console.log(`  ${i + 1}. "${page.title}"`);
      // DEBUG_LOG: console.log(`     Combined: ${page.combinedScore.toFixed(3)} | Semantic: ${semRank} (${page.semanticScore.toFixed(3)}) | Keyword: ${kwRank} (${page.keywordScore.toFixed(3)})`);
    });
  }
  
  console.log('🔀 [hybridSearch] END\n');
  return combinedResults;
}

// ========================================
// 🔍 חיפוש דפים באינדקסים
// ========================================
function searchPages(query, region = null, pageType = 'all', studyField = null) {
  console.log(`\n========== [searchPages] START ==========`);
  console.log(`🚀🚀🚀 CODE VERSION: FEB_16_v94_DEEP_PAGE_STRUCTURE_ANALYSIS 🚀🚀🚀`);
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
  
  // בדוק פעם אחת בלבד אם המילה הספציפית היא "מאוד ספציפית"
  let isVerySpecificKeyword = false;
  
  if (studyField && studyField.specificKeyword) {
    const specificKeywordLower = studyField.specificKeyword.toLowerCase();
    
    if (studyField.keywords && Array.isArray(studyField.keywords)) {
      for (const fieldKeyword of studyField.keywords) {
        const fieldKeywordLower = fieldKeyword.toLowerCase();
        if (fieldKeywordLower === specificKeywordLower) continue;
        if (fieldKeywordLower.length < 4) continue;
        
        if (specificKeywordLower.includes(fieldKeywordLower)) {
          isVerySpecificKeyword = true;
          console.log(`🔍 "${specificKeywordLower}" is very specific (contains "${fieldKeywordLower}") - strict search only`);
          break;
        }
      }
    }
  }
  
  let results = [];
  
  // תיקון קריטי: אם יש studyField - ALWAYS strict search!
  // לא משנה אם יש specificKeyword או לא!
  const shouldUseStrictSearch = studyField && studyField.name;
  
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
    
    // תיקון קריטי: דחה category pages אם יש studyField!
    // category pages מכילים רשימות קורסים, לא קורסים ספציפיים!
    if (shouldUseStrictSearch && pageTypeIdentified !== 'static') {
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
    
    // הוסף את כל התוכן לחיפוש
    const coursesText = Array.isArray(page.courses) ? page.courses.join(' ').toLowerCase() : '';
    const fullText = (page.text || '').toLowerCase();
    const pageContent = title + ' ' + description + ' ' + allHeadersText + ' ' + keywords.join(' ') + ' ' + coursesText + ' ' + fullText;
    
    // תיקון קריטי: אם יש studyField - וודא שהדף באמת על התחום!
    if (shouldUseStrictSearch) {
      // אפשרות 1: יש specificKeyword (כמו "הידרותרפיה")
      if (studyField.specificKeyword) {
        const specificKeywordLower = studyField.specificKeyword.toLowerCase();
        
        if (!pageContent.includes(specificKeywordLower)) {
          // אין את המילה הספציפית - דחה!
          continue;
        }
      } 
      // אפשרות 2: אין specificKeyword, אבל יש keywords (כמו "צילום")
      else if (studyField.keywords && Array.isArray(studyField.keywords) && studyField.keywords.length > 0) {
        // בדוק אם יש לפחות keyword אחד מהתחום
        let hasFieldKeyword = false;
        
        for (const fieldKeyword of studyField.keywords) {
          const fieldKeywordLower = fieldKeyword.toLowerCase();
          
          // דלג על מילים גנריות מדי
          if (fieldKeywordLower.length < 3) continue;
          if (['קורס', 'קורסי', 'קורסים', 'לימוד', 'לימודי'].includes(fieldKeywordLower)) continue;
          
          // בדוק אם המילה קיימת בכותרת/תיאור (לא בתוכן המלא!)
          // זה מבטיח שהדף באמת על התחום
          const headerAndDesc = title + ' ' + description + ' ' + allHeadersText;
          
          if (headerAndDesc.includes(fieldKeywordLower)) {
            hasFieldKeyword = true;
            break;
          }
        }
        
        if (!hasFieldKeyword) {
          // אין אף keyword מהתחום בכותרת/תיאור - דחה!
          continue;
        }
      }
      // אפשרות 3: אין specificKeyword ואין keywords - השתמש בשם התחום
      else {
        const fieldNameLower = studyField.name.toLowerCase();
        const headerAndDesc = title + ' ' + description + ' ' + allHeadersText;
        
        if (!headerAndDesc.includes(fieldNameLower)) {
          // אין את שם התחום בכותרת/תיאור - דחה!
          continue;
        }
      }
    }
    
    const isStaticPage = pageTypeIdentified === 'static';
    const isInfoPage = pageTypeIdentified === 'info';
    
    let matchScore = 0;
    
    // תיקון אולטרה קריטי: חישוב score חכם!
    if (studyField && studyField.specificKeyword) {
      // יש specificKeyword - כבר בדקנו שהדף מכיל אותו
      // תן score בסיסי של 100
      matchScore = 100;
      console.log(`  ✅ "${page.title || page.h1}" - has specificKeyword "${studyField.specificKeyword}", base score: 100`);
      
      // בונוס אם המילה בכותרת
      if (title.includes(studyField.specificKeyword.toLowerCase())) {
        matchScore += 50;
      }
    } else if (studyField && studyField.keywords) {
      // אין specificKeyword - חפש keywords רגילות (כבר בדקנו שיש לפחות אחת!)
      for (const kw of studyField.keywords) {
        const kwLower = kw.toLowerCase();
        
        // דלג על מילים גנריות
        if (kwLower.length < 3) continue;
        if (['קורס', 'קורסי', 'קורסים', 'לימוד', 'לימודי'].includes(kwLower)) continue;
        
        if (title.includes(kwLower)) {
          matchScore += 100;
          console.log(`  ✅ "${page.title || page.h1}" - has field keyword "${kw}" in title, score: +100`);
          break;
        } else if (description.includes(kwLower)) {
          matchScore += 70;
          break;
        } else if (allHeadersText.includes(kwLower)) {
          matchScore += 50;
          break;
        }
      }
    } else if (studyField) {
      // אין specificKeyword ואין keywords - השתמש בשם התחום
      const fieldNameLower = studyField.name.toLowerCase();
      if (title.includes(fieldNameLower)) {
        matchScore += 100;
      } else if (description.includes(fieldNameLower)) {
        matchScore += 70;
      } else if (allHeadersText.includes(fieldNameLower)) {
        matchScore += 50;
      }
    }
    
    // תיקון: אל תוסיף score נוסף אם כבר יש studyField!
    // הקוד כבר עשה strict search ונתן score מתאים
    if (!shouldUseStrictSearch) {
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
      
      if (wordMatchesInTitle >= queryWordsWithoutCities.length) {
        matchScore += 30;
      }
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
    
    // סינון לפי אזור - לכל סוגי הדפים!
    if (region && region.cities && !isInSpecificCity) {
      const location = (page.location || '').toLowerCase();
      // הסר גם "-" מהכותרת והתיאור כדי למצוא "תל-אביב"!
      // הוסף גם text לחיפוש מיקום!
      const fullText = (page.text || '').toLowerCase();
      const titleAndDesc = (title + ' ' + description + ' ' + fullText).toLowerCase().replace(/-/g, ' ');
      
      // בדיקה 1: האם ה-location מכיל עיר מהאזור?
      const hasRegionCityInLocation = region.cities.some(city => {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        return location.includes(cityLower);
      });
      
      if (location && location.trim() !== '') {
        // יש location - חייב להיות מהאזור הנכון
        if (!hasRegionCityInLocation) {
          // הדף לא מהאזור הנכון - בדוק אם זה למידה מרחוק
          
          // תיקון קריטי v94: שימוש בניתוח מבנה דף מתקדם!
          let isRemote = false;
          
          // אם יש specificKeyword - השתמש בפונקציה החדשה לניתוח מבנה הדף
          if (studyField && studyField.specificKeyword) {
            const specificKeywordLower = studyField.specificKeyword.toLowerCase();
            
            // קרא לפונקציה החדשה שמנתחת את מבנה הדף!
            const courseCheck = isCourseRemote(page, specificKeywordLower);
            
            if (courseCheck.found) {
              isRemote = courseCheck.isRemote;
              console.log(`  📊 [Page Analysis] Course "${specificKeywordLower}" in "${page.title}": isRemote=${isRemote}, section="${courseCheck.sectionTitle || 'unknown'}"`);
            } else {
              console.log(`  ⚠️ [Page Analysis] Course "${specificKeywordLower}" not found in "${page.title}"`);
            }
          } else {
            // אין specificKeyword - בדוק את כל הדף (לוגיקה ישנה)
            isRemote = location.includes('למידה מרחוק') || 
                      location.includes('מקוון') || 
                      location.includes('אונליין') ||
                      location.includes('זום');
          }
          
          if (isRemote) {
            // זה למידה מרחוק - אבל בדוק שאין אזכור של אזור אחר!
            let hasOtherRegion = false;
            
            if (REGIONS && Array.isArray(REGIONS)) {
              for (const r of REGIONS) {
                if (r.name === region.name) continue; // דלג על האזור הנוכחי
                
                // בדוק אם ה-location מכיל את שם האזור האחר
                const otherRegionName = r.name.toLowerCase();
                if (location.includes(otherRegionName)) {
                  hasOtherRegion = true;
                  // DEBUG_LOG: console.log(`  ❌ "${page.title || page.h1}" - location mentions "${r.name}" (different region), rejected`);
                  break;
                }
                
                // בדוק אם ה-location מכיל עיר מאזור אחר
                for (const city of r.cities) {
                  const cityLower = city.toLowerCase().replace(/-/g, ' ');
                  if (location.includes(cityLower)) {
                    hasOtherRegion = true;
                    // DEBUG_LOG: console.log(`  ❌ "${page.title || page.h1}" - location mentions city "${city}" from "${r.name}", rejected`);
                    break;
                  }
                }
                
                if (hasOtherRegion) break;
              }
            }
            
            if (hasOtherRegion) {
              continue; // דף עם אזור אחר - נדחה!
            }
            
            // למידה מרחוק ללא אזור אחר
            // אם יש specificKeyword - כלול גם בלי אזכור אזור!
            if (studyField && studyField.specificKeyword) {
              // DEBUG_LOG: console.log(`  ℹ️ "${page.title || page.h1}" - remote learning with specificKeyword, passing`);
              regionBonus = 0;
            } else {
              // אין specificKeyword - צריך אזכור של האזור המבוקש
              const mentionsRegion = titleAndDesc.includes(region.name.toLowerCase()) ||
                                     (region.keywords && region.keywords.some(k => titleAndDesc.includes(k.toLowerCase())));
              
              if (mentionsRegion) {
                // DEBUG_LOG: console.log(`  ℹ️ "${page.title || page.h1}" - remote learning, mentions region, passing`);
                regionBonus = 0;
              } else {
                // DEBUG_LOG: console.log(`  ❌ "${page.title || page.h1}" - remote learning but no region mention, rejected`);
                continue;
              }
            }
          } else {
            // DEBUG_LOG: console.log(`  ❌ "${page.title || page.h1}" - location "${location}" not in region "${region.name}", rejected`);
            continue;
          }
        } else {
          regionBonus = isStaticPage ? 50 : 30;
        }
      } else {
        // אין location - בדוק אם יש אזכור עיר או אזור בתוכן
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
                break;
              }
            }
            if (cityMentioned) break;
          }
          
          // בדוק אזכור אזורים אחרים
          if (!cityMentioned) {
            for (const r of REGIONS) {
              if (r.name === region.name) continue; // דלג על האזור הנוכחי
              
              const otherRegionName = r.name.toLowerCase();
              if (titleAndDesc.includes(otherRegionName)) {
                otherRegionMentioned = r.name;
                break;
              }
            }
          }
        }
        
        if (cityMentioned) {
          // נמצא אזכור עיר - חייב להיות מהאזור הנכון
          if (cityRegion === region.name) {
            regionBonus = 30;
          } else {
            // DEBUG_LOG: console.log(`  ❌ "${page.title || page.h1}" - mentions city "${cityMentioned}" from region "${cityRegion}", not "${region.name}", rejected`);
            continue;
          }
        } else if (otherRegionMentioned) {
          // נמצא אזכור של אזור אחר - דחה
          // DEBUG_LOG: console.log(`  ❌ "${page.title || page.h1}" - mentions region "${otherRegionMentioned}", not "${region.name}", rejected`);
          continue;
        } else {
          // אין אזכור עיר או אזור אחר - בדוק אם יש אזכור האזור המבוקש
          const regionMentioned = titleAndDesc.includes(region.name.toLowerCase()) ||
                                  (region.keywords && region.keywords.some(k => titleAndDesc.includes(k.toLowerCase())));
          
          if (regionMentioned) {
            regionBonus = 20;
          } else {
            // אין אזכור של האזור המבוקש
            // אם יש specificKeyword - כלול גם בלי אזכור אזור!
            if (studyField && studyField.specificKeyword) {
              // DEBUG_LOG: console.log(`  ℹ️ "${page.title || page.h1}" - no location but has specificKeyword, passing`);
              regionBonus = 0;
            } else if (isStaticPage) {
              // אין specificKeyword, אבל זה static page (מוסד אמיתי) - אפשר לעבור עם בונוס נמוך
              console.log(`  ⚠️ "${page.title || page.h1}" - static page, no region mention, allowing with low bonus`);
              regionBonus = -10; // בונוס שלילי - יופיע בסוף
            } else {
              // DEBUG_LOG: console.log(`  ❌ "${page.title || page.h1}" - no region "${region.name}" mention, rejected`);
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
      
      console.log(`  ✅ ADDED: "${page.title || page.h1}" | score: ${matchScore} | static: ${isStaticPage} | location: ${page.location || 'N/A'}`);
      
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
  
  // אם יש specificKeyword - הצג רק דפים שעברו את הסינון הקפדני
  // אחרת - הצג רק static pages
  const hasSpecificKeyword = field && field.specificKeyword;
  let pagesToShow = hasSpecificKeyword ? pages : pages.filter(p => p.isStatic);
  
  // תיקון קריטי: אם יש specificKeyword, דחה דפי קטגוריה כלליים!
  if (hasSpecificKeyword) {
    console.log(`🔍 [formatSearchResults] Filtering by specificKeyword: "${field.specificKeyword}"`);
    
    const specificKeywordLower = field.specificKeyword.toLowerCase();
    
    // דחה דפים שהם general (דפי קטגוריה)
    pagesToShow = pagesToShow.filter(p => p.pageType !== 'general');
    
    // תיקון אולטרה קריטי: וודא שכל דף באמת מכיל את ה-specificKeyword!
    pagesToShow = pagesToShow.filter(page => {
      const title = (page.title || '').toLowerCase();
      const h1 = (page.h1 || '').toLowerCase();
      const h2 = (Array.isArray(page.h2) ? page.h2.join(' ') : (page.h2 || '')).toLowerCase();
      const h3 = (Array.isArray(page.h3) ? page.h3.join(' ') : (page.h3 || '')).toLowerCase();
      const description = (page.description || '').toLowerCase();
      const text = (page.text || '').toLowerCase();
      
      const pageContent = title + ' ' + h1 + ' ' + h2 + ' ' + h3 + ' ' + description + ' ' + text;
      
      const hasKeyword = pageContent.includes(specificKeywordLower);
      
      if (!hasKeyword) {
        // DEBUG_LOG: console.log(`  ❌ [formatSearchResults] Rejected: "${page.title}" - no "${field.specificKeyword}"`);
      } else {
        console.log(`  ✅ [formatSearchResults] Kept: "${page.title}" - has "${field.specificKeyword}"`);
      }
      
      return hasKeyword;
    });
    
    console.log(`📊 [formatSearchResults] After filtering: ${pagesToShow.length} pages with "${field.specificKeyword}"`);
    
    // אם אין אף דף אחד - החזר null (לא מצאנו תוצאות)
    if (pagesToShow.length === 0) {
      console.log(`⚠️ [formatSearchResults] No pages left after specificKeyword filtering!`);
      return null;
    }
  }
  
  if (pagesToShow.length > 0) {
    pagesToShow.forEach((page, index) => {
      let title = page.title || page.h1 || 'מוסד לימודים';
      
      // לוג לדיבוג
      if (title.includes('|||')) {
        console.log(`  🔍 BOLD DEBUG: Original title: "${title.substring(0, 100)}..."`);
      }
      
      // המר |||BOLD|||...|||ENDBOLD||| ל-markdown bold
      // גישה חדשה: split/join במקום regex (יותר אמין!)
      title = title.split('|||BOLD|||').join('**');
      title = title.split('|||ENDBOLD|||').join('**');
      title = title.split('|||bold|||').join('**');
      title = title.split('|||endbold|||').join('**');
      title = title.split('||| BOLD |||').join('**');
      title = title.split('||| ENDBOLD |||').join('**');
      
      if (title.includes('|||')) {
        console.log(`  ⚠️ BOLD WARNING: Still contains ||| after replacement: "${title.substring(0, 100)}..."`);
      }
      
      // ודא שהכותרת מובלטת
      if (!title.startsWith('**')) {
        title = `**${title}**`;
      } else if (!title.endsWith('**')) {
        // אם מתחיל ב-** אבל לא נגמר ב-**, הוסף בסוף
        title = `${title}**`;
      }
      
      // הוסף אייקון למוסד
      response += `🏢 ${title}\n`;
      
      if (page.courses && Array.isArray(page.courses) && page.courses.length > 0) {
        page.courses.slice(0, 2).forEach(course => {
          // המר |||BOLD||| ל-markdown
          let cleanCourse = course
            .split('|||BOLD|||').join('**')
            .split('|||ENDBOLD|||').join('**')
            .split('|||bold|||').join('**')
            .split('|||endbold|||').join('**');
          response += `${cleanCourse}\n`;
        });
      } else if (page.description && page.description.trim() !== '') {
        let desc = page.description.trim();
        
        // המר |||BOLD||| ל-markdown
        desc = desc
          .split('|||BOLD|||').join('**')
          .split('|||ENDBOLD|||').join('**')
          .split('|||bold|||').join('**')
          .split('|||endbold|||').join('**');
        
        // הסר את הכותרת מתחילת ה-description אם היא שם
        const titleText = (page.title || page.h1 || '').trim();
        if (titleText && desc.startsWith(titleText)) {
          desc = desc.substring(titleText.length).trim();
          // הסר גם - או : אם יש בהתחלה
          if (desc.startsWith('-') || desc.startsWith(':')) {
            desc = desc.substring(1).trim();
          }
        }
        
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
        
        if (desc && desc.trim() !== '') {
          response += `${desc}\n`;
        }
      } else {
        // אין courses ואין description - נסה fallback
        console.log(`  ⚠️ No description for: "${page.title || page.h1}"`);
        
        // נסה להציג h2/h3
        let fallbackText = '';
        if (page.h2 && Array.isArray(page.h2) && page.h2.length > 0) {
          fallbackText = page.h2.slice(0, 2).join(' • ');
        } else if (page.h2 && typeof page.h2 === 'string') {
          fallbackText = page.h2;
        } else if (page.h3 && Array.isArray(page.h3) && page.h3.length > 0) {
          fallbackText = page.h3.slice(0, 2).join(' • ');
        } else if (page.keywords && Array.isArray(page.keywords) && page.keywords.length > 0) {
          fallbackText = page.keywords.slice(0, 3).join(' • ');
        }
        
        if (fallbackText && fallbackText.trim() !== '') {
          // המר |||BOLD||| גם ב-fallback
          fallbackText = fallbackText.replace(/\|\|\|BOLD\|\|\|/g, '**').replace(/\|\|\|ENDBOLD\|\|\|/g, '**');
          response += `${fallbackText.trim()}\n`;
        }
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
        
        response += `[למידע ולייעוץ אישי](${cleanUrl})\n`;
      }
      
      if (index < pagesToShow.length - 1) {
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
  console.log(`📝 Message: "${message}"`);
  
  if (!STUDY_FIELDS || !Array.isArray(STUDY_FIELDS)) {
    console.error('❌ STUDY_FIELDS is not an array');
    return [];
  }
  
  const lowerMessage = message.toLowerCase();
  
  // שלב 1: חפש התאמה מדויקת לשם התחום
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    
    const fieldNameLower = field.name.toLowerCase();
    if (lowerMessage.includes(fieldNameLower)) {
      console.log(`✅ Found exact field name: "${field.name}"`);
      return [{ ...field, specificKeyword: null }];
    }
  }
  
  // שלב 2: חפש keywords - העדף מילים ארוכות (ספציפיות) יותר
  let bestMatch = null;
  const tooGenericKeywords = ['למידה', 'לימוד', 'קורס', 'קורסים', 'השתלמות', 'תואר'];
  
  for (const field of STUDY_FIELDS) {
    if (field.name === 'למידה מרחוק') continue;
    if (!field.keywords || !Array.isArray(field.keywords)) continue;
    
    for (const keyword of field.keywords) {
      if (!keyword) continue;
      
      const keywordLower = keyword.toLowerCase();
      
      // דלג על מילים גנריות
      if (tooGenericKeywords.includes(keywordLower)) continue;
      
      // בדוק אם המילה נמצאת בהודעה
      if (lowerMessage.includes(keywordLower)) {
        const keywordLength = keywordLower.length;
        
        // שמור את ההתאמה הכי ארוכה (הכי ספציפית)
        if (!bestMatch || keywordLength > bestMatch.length) {
          bestMatch = {
            field: field,
            keyword: keyword,
            length: keywordLength
          };
        }
      }
    }
  }
  
  if (bestMatch) {
    console.log(`✅ Found keyword: "${bestMatch.keyword}" in field: "${bestMatch.field.name}"`);
    
    // תיקון קריטי: מצא את המילה המלאה ב-query שמכילה את ה-keyword!
    // דוגמה: query="הידרותרפיה", keyword="תרפיה" → specificKeyword="הידרותרפיה"
    const words = lowerMessage.split(/\s+/);
    const keywordLower = bestMatch.keyword.toLowerCase();
    let fullWord = bestMatch.keyword; // default
    
    for (const word of words) {
      // נקה מילה מסימני פיסוק
      const cleanWord = word.replace(/[,\.!\?;:]/g, '');
      if (cleanWord.includes(keywordLower)) {
        // מצאנו את המילה המלאה!
        fullWord = cleanWord;
        console.log(`  🔍 Found full word: "${fullWord}" (contains "${bestMatch.keyword}")`);
        break;
      }
    }
    
    return [{ 
      ...bestMatch.field, 
      specificKeyword: fullWord  // ← עכשיו זה המילה המלאה!
    }];
  }
  
  console.log('❌ No study field detected');
  return [];
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
  // 2️⃣ שאלות מידע (QA) - שאלה + מילות מפתח ספציפיות
  //    זיהוי: מילת שאלה (איך, מתי, מה זה...) + נושא מידע
  //    נושאי מידע: ביטוח לאומי, רשות, חובה, תוכנית לימודים,
  //                  לידה, מענק, פנסיה, משכורת, טופס, מוכר...
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  const infoKeywords = [
    'ביטוח לאומי', 'ביטוח', 'לאומי',
    'רשות', 'חובה',
    'תוכנית לימודים', 'תכנית לימודים', 'תוכנית', 'תכנית',
    'לידה',
    'מענק', 'מענקים',
    'פנסיה',
    'משכורת',
    'חישוב',
    'טופס', 'טפסים',
    'מוכר', 'מוכרים', 'מאושר', 'מאושרים',
    'הכרה', 'הכרת',
    'שבתון',
    'שש', 'מש"ש',
    'פורטל', 'מאגר',
    'נרשמתי', 'שילמתי', 'מקדמה'
  ];
  
  const questionWords = [
    'איך', 'מתי', 'למי פונים', 'למי', 'מה עושים', 'איפה ממלאים',
    'מה זה', 'ממה מורכבת', 'כמה שעות', 'מה צריך', 'האם',
    'האם מוכר', 'האם מאושר', 'האם נדרש'
  ];
  
  const hasInfoKeyword = infoKeywords.some(kw => lower.includes(kw));
  const hasQuestionWord = questionWords.some(qw => lower.includes(qw));
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // תיקון קריטי: בדוק חיפוש למידה מרחוק לפני QA!
  // אם יש "קורס/השתלמות" + "למידה מרחוק" → זה חיפוש, לא QA!
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const isRemoteLearningSearch = (lower.includes('קורס') || lower.includes('השתלמות') || lower.includes('לימוד')) &&
                                   (lower.includes('למידה מרחוק') || 
                                    lower.includes('בלמידה מרחוק') ||
                                    lower.includes('במרחוק') || 
                                    lower.includes('מקוון') ||
                                    lower.includes('אונליין') ||
                                    lower.includes('zoom') ||
                                    lower.includes('זום'));
  
  if (isRemoteLearningSearch) {
    console.log('🔍 [classifyIntent] Detected remote learning search → search (not QA)');
    return 'search';
  }
  
  // שאלה + מילת מפתח מידע = QA ברור
  if (hasQuestionWord && hasInfoKeyword) return 'qa';
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3️⃣ FAQ ברור — דפוסים ספציפיים
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
  // 4️⃣ חיפוש ברור — תחום + מקום → ברור שמחפשת קורס
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
  // 5️⃣ "קורס X" כש-X = תחום → חיפוש ברור!
  //    דוגמה: "קורס פוטותרפיה"
  //    דוגמה: "לימודי צילום"
  //    → אין ספק, חיפוש אוטומטי
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const hasCourseTrigger = lower.includes('קורס') || 
                           lower.includes('לימוד') || 
                           lower.includes('השתלמות');
  
  if (hasCourseTrigger && hasStudyField) return 'search';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6️⃣ רק "קורס" בלי תחום ברור → ספק
  //    דוגמה: "האם יש קורסים"
  //    → שאל את הגולש
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (hasCourseTrigger || hasStudyField) return 'ambiguous';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7️⃣ Default — אין keywords קורס → חיפוש כללי
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
async function generateSmartResponse(userMessage, forcedMode) {
  console.log('\n========================================');
  console.log('🚀 [generateSmartResponse] START');
  console.log('🚀🚀🚀 CODE VERSION: FEB_16_v94_DEEP_PAGE_STRUCTURE_ANALYSIS 🚀🚀🚀');
  console.log('========================================\n');

  try {
    // 🎯 זיהוי אופק חדש / עוז לתמורה
    const isOfek = /אופק חדש|עוז לתמורה|אופק\s+חדש/i.test(userMessage);
    if (isOfek) {
      console.log('🎓 זוהה אופק חדש - מחפש ב-ofek.json');
      try {
        const ofekPath = path.join(process.cwd(), 'data', 'ofek.json');
        if (fs.existsSync(ofekPath)) {
          const ofekData = JSON.parse(fs.readFileSync(ofekPath, 'utf8'));
          const regions = detectRegions(userMessage);
          
          let results = ofekData.institutions || [];
          
          // סינון לפי אזור אם נבקש
          if (regions && regions.length > 0) {
            const regionNames = regions.map(r => r.name.toLowerCase());
            results = results.filter(inst => {
              const location = inst.location_in_israel.toLowerCase();
              return regionNames.some(rn => location.includes(rn) || rn.includes(location));
            });
          }
          
          if (results.length > 0) {
            let response = `מצאתי ${results.length} ${results.length === 1 ? 'מוסד' : 'מוסדות'} לאופק חדש`;
            if (regions && regions.length > 0) {
              response += ` ב${regions[0].name}`;
            }
            response += `:\n\n`;
            
            results.slice(0, 10).forEach(inst => {
              response += `**${inst.institution_name}**\n`;
              response += `📍 ${inst.location_in_israel}\n`;
              if (inst.tracks && inst.tracks.length > 0) {
                response += `קורסים: ${inst.tracks.slice(0, 3).join(', ')}`;
                if (inst.tracks.length > 3) response += ` ועוד ${inst.tracks.length - 3}`;
                response += `\n`;
              }
              if (inst.url) {
                response += `[→ למידע נוסף](${inst.url})\n`;
              }
              response += `\n`;
            });
            
            return response;
          }
        }
      } catch (error) {
        console.error('שגיאה בטעינת ofek.json:', error.message);
      }
    }
    
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
      
      // אין תשובה ספציפית - הפנה לדף המידע
      return `💼 **תשלומים בשבתון**\n\nמידע בנוגע לביטוח לאומי ותשלומים ניתן לקרוא [כאן](https://www.shabaton.online/Payments_shabaton)`;
    }

    // 📚 שאלות מידע (courses-qa)
    if (intent === 'qa') {
      const answer = findCoursesAnswer(userMessage);
      if (answer) return formatCoursesAnswer(answer);
      
      // אין תשובה ספציפית - אל תמציא!
      return `📚 **מידע על שבתון**\n\nלא מצאתי מידע ספציפי על השאלה שלך.\n\n📞 **לשאלות על הכרת קורסים ותוכנית הלימודים:**\n• צרי קשר עם רכז השבתון שלך\n• או פני למחלקת שבתון במשרד החינוך\n\n📘 [למידע כללי](https://www.shabaton.online)`;
    }
    
    // 🎯 חיפוש קורסים - לוגיקה חדשה
    console.log('\n🔍 === התחלת תהליך חיפוש קורסים ===\n');
    
    // שלב 1: זיהוי תחום
    const studyFields = detectStudyField(userMessage);
    const field = studyFields.length > 0 ? studyFields[0] : null;
    
    if (!field) {
      console.log('❌ לא זוהה תחום לימוד');
      response = `איזה תחום לימוד מעניין אותך?\n\n`;
      response += `לדוגמה: צילום, אמנות, מוסיקה, חינוך, ניהול, תרפיה...\n\n`;
      response += `[לכל התחומים](https://www.shabaton.online)`;
      return response;
    }
    
    console.log(`✅ תחום זוהה: ${field.name}`);
    if (field.specificKeyword) {
      console.log(`🔍 מילת מפתח ספציפית: ${field.specificKeyword}`);
    }
    
    // שלב 2: זיהוי אזור
    let regions = detectRegions(userMessage);
    const isRemoteLearning = detectRemoteLearning(userMessage);
    
    if (isRemoteLearning) {
      console.log('🌐 זוהתה למידה מרחוק - לא דורש אזור');
      regions = null;
    }
    
    if (!regions || regions.length === 0) {
      if (!isRemoteLearning) {
        console.log('❌ לא זוהה אזור ולא למידה מרחוק');
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
    }
    
    // שלב 3: חיפוש
    console.log(`\n🔍 מחפש מוסדות עבור:`);
    console.log(`   תחום: ${field.name}`);
    if (field.specificKeyword) console.log(`   מילת מפתח: ${field.specificKeyword}`);
    if (regions) console.log(`   אזורים: ${regions.map(r => r.name).join(', ')}`);
    if (isRemoteLearning) console.log(`   למידה מרחוק: כן`);
    
    let allResults = [];
    const regionNames = regions ? regions.map(r => r.name) : [];
    
    if (regions && regions.length > 0) {
      // חיפוש לפי אזורים
      for (const region of regions) {
        try {
          // שימוש ב-hybrid search אם semantic מופעל
          const searchResults = SEMANTIC_SEARCH_CONFIG.enabled 
            ? await hybridSearch(userMessage, region, 'all', field)
            : searchPages(userMessage, region, 'all', field);
          if (searchResults && searchResults.length > 0) {
            allResults = allResults.concat(searchResults);
          }
        } catch (error) {
          console.error(`Error searching in region ${region.name}:`, error.message);
        }
      }
    } else if (isRemoteLearning) {
      // חיפוש למידה מרחוק בלבד
      try {
        const searchResults = SEMANTIC_SEARCH_CONFIG.enabled 
          ? await hybridSearch(userMessage, null, 'all', field)
          : searchPages(userMessage, null, 'all', field);
        allResults = searchResults.filter(page => isRemoteLearningPage(page));
      } catch (error) {
        console.error('Error in remote learning search:', error.message);
      }
    } else {
      // חיפוש בכל הארץ
      try {
        const searchResults = SEMANTIC_SEARCH_CONFIG.enabled 
          ? await hybridSearch(userMessage, null, 'all', field)
          : searchPages(userMessage, null, 'all', field);
        if (searchResults && searchResults.length > 0) {
          allResults = searchResults;
        }
      } catch (error) {
        console.error('Error in nationwide search:', error.message);
      }
    }
    
    // הסרת כפילויות
    const uniqueResults = [];
    const seenUrls = new Set();
    for (const result of allResults) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        uniqueResults.push(result);
      }
    }
    
    let filteredResults = uniqueResults;
    
    console.log(`📊 נמצאו ${filteredResults.length} תוצאות`);
    
    // שלב 4: הצגת תוצאות
    const hasSpecificKeyword = field && field.specificKeyword;
    let response = '';
    
    // הגדרת slugs לקישורים
    const regionSlugs = regions ? regions.map(r => r.slug).filter(s => s).join('-') : '';
    const fieldSlug = field.slug || field.name.replace(/[, ]/g, '-').toLowerCase();
    
    if (filteredResults.length === 0) {
      // אין תוצאות באזור - נסה חיפוש אוטומטי למידה מרחוק!
      console.log('⚠️ אין תוצאות באזור - מנסה למידה מרחוק אוטומטית...');
      
      if (regions && regions.length > 0 && !isRemoteLearning) {
        // חיפשנו באזור ספציפי ולא מצאנו - נסה למידה מרחוק
        try {
          console.log('🔄 מחפש אוטומטית במידה מרחוק...');
          
          const remoteSearchResults = SEMANTIC_SEARCH_CONFIG.enabled 
            ? await hybridSearch(userMessage, null, 'all', field)
            : searchPages(userMessage, null, 'all', field);
          
          const remoteResults = remoteSearchResults.filter(page => isRemoteLearningPage(page));
          
          if (remoteResults.length > 0) {
            console.log(`✅ נמצאו ${remoteResults.length} תוצאות למידה מרחוק!`);
            
            // הצג תוצאות למידה מרחוק
            const fieldName = hasSpecificKeyword ? field.specificKeyword : field.name;
            response = `לא מצאתי קורסים ב**${fieldName}** ב${regionNames.join(' ו')}, אבל מצאתי ${remoteResults.length} ${remoteResults.length === 1 ? 'קורס' : 'קורסים'} **בלמידה מרחוק**:\n\n`;
            
            const remoteFormatted = formatSearchResults(remoteResults.slice(0, 10), field, null);
            if (remoteFormatted) {
              response += remoteFormatted;
            }
            
            response += `\n\n💡 לכל הקורסים ב${field.name}: [למידה מרחוק](https://www.shabaton.online/remote-learning/${fieldSlug}) | [${regionNames.join(' ו')}](https://www.shabaton.online/${regionSlugs}/${fieldSlug})`;
            
            return response;
          }
        } catch (error) {
          console.error('❌ שגיאה בחיפוש למידה מרחוק אוטומטי:', error.message);
        }
      }
      
      // אין תוצאות גם במידה מרחוק (או לא ניסינו)
      const searchDesc = hasSpecificKeyword ? field.specificKeyword : field.name;
      const locationDesc = isRemoteLearning ? 'בלמידה מרחוק' : 
                           (regions && regions.length > 0 ? `ב${regionNames.join(' ו')}` : 'בכל הארץ');
      
      response = `לא מצאתי קורסים **ב${searchDesc}** ${locationDesc}.\n\n`;
      response += `💡 אפשר לנסות:\n`;
      if (regions && regionSlugs && fieldSlug) {
        response += `• [כל הקורסים ב${field.name} ${locationDesc}](https://www.shabaton.online/${regionSlugs}/${fieldSlug})\n`;
      }
      response += `• [כל הקורסים ב${field.name} בכל הארץ](https://www.shabaton.online/${fieldSlug})\n`;
      response += `\nאו תנסה חיפוש אחר 😊`;
      
      return response;
    }
    
    // יש תוצאות - נסה לעצב אותן
    const formatted = formatSearchResults(filteredResults, field, regions ? regions[0] : null);
    
    // אם formatSearchResults החזיר null (כי סינן דפים general), אין תוצאות אמיתיות!
    if (!formatted) {
      const searchDesc = hasSpecificKeyword ? field.specificKeyword : field.name;
      const locationDesc = isRemoteLearning ? 'בלמידה מרחוק' : 
                           (regions && regions.length > 0 ? `ב${regionNames.join(' ו')}` : 'בכל הארץ');
      
      response = `לא מצאתי קורסים **ב${searchDesc}** ${locationDesc}.\n\n`;
      response += `💡 אפשר לנסות:\n`;
      if (regions && regionSlugs && fieldSlug) {
        response += `• [כל הקורסים ב${field.name} ${locationDesc}](https://www.shabaton.online/${regionSlugs}/${fieldSlug})\n`;
      }
      response += `• [כל הקורסים ב${field.name} בכל הארץ](https://www.shabaton.online/${fieldSlug})\n`;
      response += `\nאו תנסה חיפוש אחר 😊`;
      
      return response;
    }
    
    // יש תוצאות אמיתיות - הצג אותן
    const fieldName = hasSpecificKeyword ? field.specificKeyword : field.name;
    const totalCount = filteredResults.filter(p => p.pageType !== 'general').length; // ספור רק דפים אמיתיים
    
    if (isRemoteLearning) {
      response = `מצאתי ${totalCount} ${totalCount === 1 ? 'מוסד' : 'מוסדות'} בלמידה מרחוק ל${fieldName}:\n\n`;
    } else if (regions && regions.length > 0) {
      const regionsText = regionNames.join(' ו');
      response = `מצאתי ${totalCount} ${totalCount === 1 ? 'מוסד' : 'מוסדות'} ב${regionsText} ל${fieldName}:\n\n`;
    } else {
      response = `מצאתי ${totalCount} ${totalCount === 1 ? 'מוסד' : 'מוסדות'} ל${fieldName}:\n\n`;
    }
    
    response += formatted;
    
    // תיקון קריטי v93: הסרה מלאה של חיפוש "למידה מרחוק" אוטומטי!
    // הסיבה: אין לנו מידע מדויק ברמת הקורס הספציפי אם הוא בלמידה מרחוק.
    // ה-index מכיל מידע כללי על המוסד, לא על כל קורס בנפרד.
    // אם המשתמש רוצה למידה מרחוק - הוא יכתוב את זה בשאילתה!
    
    return response;
    
  } catch (error) {
    console.error('[generateSmartResponse] ERROR:', error.message);
    console.error('[generateSmartResponse] Stack:', error.stack);
    
    // נסה לזהות לפחות את התחום והאזור
    try {
      const fields = detectStudyField(userMessage);
      const regions = detectRegions(userMessage);
      
      if (fields && fields.length > 0 && regions && regions.length > 0) {
        // יש גם תחום וגם אזור - אבל יש שגיאה, אז נחזיר תשובה בסיסית
        return `מצטער, הייתה בעיה טכנית בחיפוש.\n\nאבל נראה שאתה מחפש **${fields[0].name}** ב**${regions[0].name}**.\n\nנסה שוב, או [חפש כאן](https://www.shabaton.online/${regions[0].slug}/${encodeURIComponent(fields[0].name)})`;
      } else if (fields && fields.length > 0) {
        return `מצטער, הייתה בעיה טכנית בחיפוש.\n\nאבל נראה שאתה מחפש **${fields[0].name}**.\n\nנסה שוב, או [חפש כאן](https://www.shabaton.online/${encodeURIComponent(fields[0].name)})`;
      }
    } catch (fallbackError) {
      console.error('[generateSmartResponse] Fallback also failed:', fallbackError.message);
    }
    
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
          const response = await generateSmartResponse(originalQuery, forcedMode);
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
      const response = await generateSmartResponse(fullQuery);
      return res.status(200).json({ response, timestamp: new Date().toISOString() });
    }
    
    let response = await generateSmartResponse(message);
    
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
