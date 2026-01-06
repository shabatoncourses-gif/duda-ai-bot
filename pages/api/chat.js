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

function loadConfigs() {
  if (!REGIONS) {
    const regionsPath = path.join(process.cwd(), 'data', 'regions.json');
    const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
    REGIONS = regionsData.regions;
  }
  
  if (!STUDY_FIELDS) {
    const fieldsPath = path.join(process.cwd(), 'data', 'study-fields.json');
    const fieldsData = JSON.parse(fs.readFileSync(fieldsPath, 'utf8'));
    STUDY_FIELDS = fieldsData.studyFields;
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
  
  // החזרת התשובה הטובה ביותר (אם הציון מספיק גבוה)
  // הורדנו את הסף מ-10 ל-5 כדי להיות יותר סלחניים
  if (scoredQuestions[0] && scoredQuestions[0].score >= 5) {
    return scoredQuestions[0].qa;
  }
  
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
    return `לא מצאתי מידע על ביטוח לאומי. אתה מוזמן לעיין בפורטל שבתון:\nhttps://www.shabaton.online/btl_shabaton\n\nאו לשאול בקבוצת WhatsApp:\nhttps://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME`;
  }
  
  let response = `💼 **ביטוח לאומי בשבתון**\n\n`;
  response += `${INSURANCE_QA.generalInfo.content}\n\n`;
  
  // הקישור המרכזי לביטוח לאומי
  response += `**למידע מפורט:**\n`;
  response += `[ביטוח לאומי בשבתון - מדריך מלא](https://www.shabaton.online/btl_shabaton)\n\n`;
  
  // לוח זמנים
  response += `**לוח זמנים:**\n`;
  response += `[לוח הזמנים לשנת השבתון](${INSURANCE_QA.generalInfo.link})\n\n`;
  
  response += `**שאלות נפוצות:**\n`;
  
  // הצג 3 שאלות נפוצות
  INSURANCE_QA.questions.slice(0, 3).forEach((qa, i) => {
    const shortQ = qa.question.length > 80 ? qa.question.substring(0, 77) + '...' : qa.question;
    response += `${i + 1}. ${shortQ}\n`;
  });
  
  response += `\nאפשר לשאול אותי שאלה ספציפית על ביטוח לאומי!`;
  
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
// 🚫 בדיקה אם URL צריך להיות מסונן
// ========================================
function shouldFilterUrl(url) {
  if (!url) return true;
  
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
  
  return blockedPatterns.some(pattern => url.includes(pattern));
}

// ========================================
// 🔍 חיפוש דפים באינדקסים (חיפוש מאוזן!)
// ========================================
function searchPages(query, region = null, pageType = 'all') {
  const pages = loadAllPages();
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
  
  // **סף מאוזן - מאפשר תוצאות טובות אבל מסנן זבל**
  const minScore = isSpecificQuery ? 35 : 20;
  
  // **זיהוי מילת הנושא העיקרית (המילה הראשונה)**
  // לדוגמה: "גישור בירושלים" → "גישור" הוא הנושא העיקרי
  const mainTopicWord = queryWordsWithoutCities[0];
  
  let results = [];
  
  for (const page of pages) {
    if (shouldFilterUrl(page.url)) {
      continue;
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
                       url.includes('/learning_programs_shabaton');
    
    if (pageType === 'static' && !isStaticPage) continue;
    if (pageType === 'info' && !isInfoPage) continue;
    
    let matchScore = 0;
    
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
    
    for (const word of queryWordsWithoutCities) {
      let foundInTitle = title.includes(word);
      let foundInDesc = description.includes(word);
      let foundInKeywords = keywords.some(k => k.includes(word));
      
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
    
    // **דרישה קריטית: הנושא העיקרי חייב להימצא!**
    if (isSpecificQuery && !hasMainTopic) {
      // אם לא מצאנו את הנושא העיקרי - דלג!
      continue;
    }
    
    // **בונוס אם רוב המילים נמצאו**
    const totalMatches = wordMatchesInTitle + wordMatchesInDesc + wordMatchesInKeywords;
    const matchRatio = totalMatches / queryWordsWithoutCities.length;
    
    if (matchRatio >= 0.7) {
      // 70% מהמילים נמצאו
      matchScore += 25;
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
      
      const inTitleOrDesc = region.cities.some(city => {
        const cityLower = city.toLowerCase().replace(/-/g, ' ');
        return titleAndDesc.includes(cityLower);
      });
      
      matchesRegion = inLocation || inTitleOrDesc;
      
      // בונוס אם מוזכר באזור הנכון
      if (inLocation) {
        regionBonus = 20; // בונוס גבוה למיקום מדויק
      } else if (inTitleOrDesc) {
        regionBonus = 15; // בונוס נמוך יותר אם רק בתיאור
      }
      
      matchScore += regionBonus;
      
      if (!matchesRegion) {
        // הנמכת ציון משמעותית במקום אפס מוחלט
        matchScore = Math.floor(matchScore * 0.3); // 70% הנחה
      }
    }
    
    if (matchScore > 0) {
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
  results = results.filter(r => r.score >= minScore);
  
  return results.slice(0, 10);
}

// ========================================
// 📝 פורמט תוצאות חיפוש (עיצוב אלגנטי!)
// ========================================
function formatSearchResults(pages, region = null) {
  if (pages.length === 0) return null;
  
  let response = '';
  const staticPages = pages.filter(p => p.isStatic);
  
  // הצגת מוסדות (דפים סטטיים בלבד)
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
      response += `[→ פנו למוסד הלימודים](${page.url})\n`;
      
      // מפריד דק בין מוסדות (לא אחרי האחרון)
      if (index < staticPages.length - 1) {
        response += `\n`;
      }
    });
  }
  
  return response;
}

// ========================================
// 🔍 זיהוי אזור מהשאלה
// ========================================
function detectRegion(message) {
  loadConfigs();
  let lowerMessage = message.toLowerCase();
  
  // ניקוי: הסרת "ב" בהתחלת מילים והחלפת מקפים ברווחים
  lowerMessage = lowerMessage.replace(/\sב([א-ת])/g, ' $1'); // "ברמת גן" → "רמת גן"
  lowerMessage = lowerMessage.replace(/-/g, ' '); // "רמת-גן" → "רמת גן"
  
  for (const region of REGIONS) {
    // בדיקת מילות מפתח (אם קיימות)
    if (region.keywords) {
      for (const keyword of region.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          return { name: region.name, slug: region.slug, cities: region.cities };
        }
      }
    }
    
    // בדיקה אם נזכר שם האזור המלא
    if (lowerMessage.includes(region.name.toLowerCase())) {
      return { name: region.name, slug: region.slug, cities: region.cities };
    }
    
    // בדיקה אם נזכרה עיר מהאזור
    for (const city of region.cities) {
      const normalizedCity = city.toLowerCase().replace(/-/g, ' ');
      if (lowerMessage.includes(normalizedCity)) {
        return { name: region.name, slug: region.slug, cities: region.cities, city: city };
      }
    }
  }
  
  return null;
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
  const lowerMessage = message.toLowerCase();
  const detectedFields = [];
  
  // **שלב 1: חיפוש התאמה מדויקת לשם התחום (עדיפות גבוהה)**
  for (const field of STUDY_FIELDS) {
    const fieldNameLower = field.name.toLowerCase();
    if (lowerMessage.includes(fieldNameLower)) {
      return [field]; // מצאנו התאמה מדויקת - נחזיר מיד!
    }
  }
  
  // **שלב 2: חיפוש במילות מפתח עם word boundaries**
  const matches = [];
  
  for (const field of STUDY_FIELDS) {
    for (const keyword of field.keywords) {
      const keywordLower = keyword.toLowerCase();
      
      // בדיקה אם המילה מופיעה כמילה שלמה
      const regex = new RegExp('\\b' + keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (regex.test(lowerMessage)) {
        matches.push({ field, keyword, length: keywordLower.length });
        break;
      }
    }
  }
  
  // מיון לפי אורך מילת המפתח (ארוכה יותר = ספציפית יותר)
  matches.sort((a, b) => b.length - a.length);
  detectedFields.push(...matches.map(m => m.field));
  
  // **שלב 3: אם עדיין לא מצאנו - חיפוש חלקי**
  if (detectedFields.length === 0) {
    for (const field of STUDY_FIELDS) {
      for (const keyword of field.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          detectedFields.push(field);
          break;
        }
      }
    }
  }
  
  return detectedFields;
}

// ========================================
// 🤖 יצירת תשובה חכמה (לוגיקה פשוטה!)
// ========================================
function generateSmartResponse(userMessage) {
  // ✅ ראשית - בדוק אם זו שאלה על ביטוח לאומי
  if (detectInsuranceQuestion(userMessage)) {
    const answer = findInsuranceAnswer(userMessage);
    
    if (answer) {
      // מצאנו תשובה ספציפית!
      return formatInsuranceAnswer(answer);
    } else {
      // שאלה על ביטוח לאומי, אבל לא מצאנו תשובה ספציפית
      return formatGeneralInsuranceInfo();
    }
  }
  
  const region = detectRegion(userMessage);
  const studyFields = detectStudyField(userMessage);
  
  let response = '';
  
  // **זיהוי סוג השאלה**
  const isInfoQuestion = userMessage.toLowerCase().includes('שבתון') || 
                         userMessage.toLowerCase().includes('מענק') ||
                         userMessage.toLowerCase().includes('ביטוח לאומי') ||
                         userMessage.toLowerCase().includes('לידה');
  
  // **שאלות מידע על שבתון**
  if (isInfoQuestion) {
    const infoResults = searchPages(userMessage, null, 'info');
    
    if (infoResults && infoResults.length > 0) {
      response = formatSearchResults(infoResults);
      return response;
    } else {
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
  }
  
  // **אם יש תחום מזוהה ואזור - חיפוש באינדקס קודם!**
  if (studyFields.length > 0 && region) {
    const field = studyFields[0];
    
    // **קודם: חיפוש דפים סטטיים באינדקס**
    const searchResults = searchPages(userMessage, region, 'static');
    
    if (searchResults && searchResults.length > 0) {
      // **מצאנו דפים סטטיים רלוונטיים!**
      response = `מצאתי ${searchResults.length} תוצאות רלוונטיות ב${region.name}:\n\n`;
      response += formatSearchResults(searchResults);
      
      // **הוספת קישור לדף דינמי - קורסים נוספים**
      const regionSlug = region.slug;
      const encodedSlug = field.slug.replace(/ /g, '%20');
      const url = `https://www.shabaton.online/${regionSlug}/${encodedSlug}`;
      
      response += `\nלקורסים נוספים ב${field.name}:\n${url}`;
      
      return response;
    }
    
    // **לא מצאנו תוצאות ספציפיות - נציע את הדף הדינמי**
    const regionSlug = region.slug;
    const encodedSlug = field.slug.replace(/ /g, '%20');
    const url = `https://www.shabaton.online/${regionSlug}/${encodedSlug}`;
    
    response = `לא מצאתי תוצאות ספציפיות לשאילתה שלך, אבל תוכל למצוא קורסים ב${field.name} ב${region.name}:\n\n`;
    response += `${url}`;
    
    return response;
  }
  
  // **אם יש תחום אבל אין אזור - שאל איפה!**
  if (studyFields.length > 0 && !region) {
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
  if (region) {
    response = `מעולה! ${region.name} 🗺️\n\n`;
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
