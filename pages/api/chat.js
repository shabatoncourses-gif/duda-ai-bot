// pages/api/chat.js - Vercel Serverless with JSON config files
import fs from 'fs';
import path from 'path';

// ========================================
// 📚 טעינת כל קבצי האינדקס
// ========================================
let ALL_PAGES = null;
let REGIONS = null;
let STUDY_FIELDS = null;

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
    'morim.boutique',
    '/drushim/',
    '/consult',
    '/contact',
    '/knassim',
    '/משרות-הוראה',
    '/הוספת-מודעה',
    'https://www.shabaton.online/$', // דף הבית
    '/art',
    '/mosaic',
    '/courses-jewelry',
    '/empowering',
    '/cooking',
    '/trips',
    '/health',
    '/fashion',
    'קורסי-נגרות-וחידוש-רהיטים',
    '/courses-per-month-', // דפי חודשים - לא רלוונטי!
    '/Ma_Edu_', // דפי תואר שני כלליים
    'close carousel' // תוכן לא רלוונטי
  ];
  
  return blockedPatterns.some(pattern => url.includes(pattern));
}

// ========================================
// 🔍 חיפוש דפים באינדקסים (סטטיים ודינמיים)
// ========================================
function searchPages(query, region = null, pageType = 'all') {
  const pages = loadAllPages();
  const lowerQuery = query.toLowerCase();
  
  // ניקוי השאילתה (הסרת "ב", מקפים, "קורס", "קורסי")
  let cleanQuery = lowerQuery.replace(/\sב([א-ת])/g, ' $1');
  cleanQuery = cleanQuery.replace(/-/g, ' ');
  cleanQuery = cleanQuery.replace(/קורס(י)?/g, '').trim();
  
  // **הסרת שמות ערים מהשאילתה!**
  // כדי שלא נחפש "חיפה" בתוכן הדפים
  if (region && region.cities) {
    for (const city of region.cities) {
      const cityLower = city.toLowerCase();
      cleanQuery = cleanQuery.replace(new RegExp('\\b' + cityLower + '\\b', 'gi'), '').trim();
    }
  }
  
  // הסרת מילות עזר נוספות
  const stopWords = ['מרכז', 'הארץ', 'במרכז', 'בארץ', 'ב', 'ה', 'של', 'את', 'עם', 'על', 'אל', 'כל', 'צפון', 'בצפון', 'הצפון', 'דרום', 'בדרום', 'שרון', 'בשרון'];
  const queryWords = cleanQuery.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  // אם אין מילות חיפוש משמעותיות - החזר ריק
  if (queryWords.length === 0) {
    return [];
  }
  
  // המילה העיקרית = המילה הראשונה (הכי חשובה)
  const mainWord = queryWords[0];
  
  let results = [];
  
  for (const page of pages) {
    // דילוג על דפים מסוננים
    if (shouldFilterUrl(page.url)) {
      continue;
    }
    
    const title = (page.title || page.h1 || '').toLowerCase();
    const description = (page.description || '').toLowerCase();
    const url = (page.url || '').toLowerCase();
    const keywords = (page.keywords || []).map(k => k.toLowerCase());
    
    // זיהוי סוג הדף
    const isStaticPage = !url.includes('/results-') && !url.includes('/search-results-');
    const isInfoPage = url.includes('/זכאות') || url.includes('/מענק') || url.includes('/תקנון');
    
    // סינון לפי סוג דף מבוקש
    if (pageType === 'static' && !isStaticPage) continue;
    if (pageType === 'info' && !isInfoPage) continue;
    
    // **דרישה: המילה העיקרית חייבת להופיע!**
    const mainWordInTitle = title.includes(mainWord);
    const mainWordInDescription = description.includes(mainWord);
    const mainWordInKeywords = keywords.some(k => k.includes(mainWord));
    const mainWordInUrl = url.includes(mainWord);
    
    // אם המילה העיקרית לא מופיעה בשום מקום - דלג!
    if (!mainWordInTitle && !mainWordInDescription && !mainWordInKeywords && !mainWordInUrl) {
      continue;
    }
    
    // חישוב התאמה
    let matchScore = 0;
    
    // ציון גבוה למילה העיקרית
    if (mainWordInTitle) matchScore += 20;
    if (mainWordInDescription) matchScore += 10;
    if (mainWordInKeywords) matchScore += 8;
    if (mainWordInUrl) matchScore += 5;
    
    // בדיקה אם השאילתה המלאה מופיעה (בונוס)
    if (cleanQuery.length > 3) {
      if (title.includes(cleanQuery)) matchScore += 15;
      if (description.includes(cleanQuery)) matchScore += 8;
    }
    
    // בדיקת מילות מפתח נוספות (ציון נמוך יותר)
    for (let i = 1; i < queryWords.length; i++) {
      const word = queryWords[i];
      if (title.includes(word)) matchScore += 3;
      if (description.includes(word)) matchScore += 2;
      if (keywords.some(k => k.includes(word))) matchScore += 2;
    }
    
    // בדיקה אם תואם לאזור (לפי location בדף, לא לפי שם העיר בתוכן!)
    let matchesRegion = true;
    if (region && region.cities && isStaticPage) {
      const location = (page.location || '').toLowerCase();
      matchesRegion = region.cities.some(city => 
        location.includes(city.toLowerCase().replace(/-/g, ' '))
      );
      
      if (!matchesRegion) {
        matchScore = 0; // אפס התאמה אם לא באזור הנכון
      }
    }
    
    if (matchScore > 0) {
      results.push({
        ...page,
        isStatic: isStaticPage,
        isInfo: isInfoPage,
        score: matchScore
      });
    }
  }
  
  // מיון לפי ציון (גבוה לנמוך), ודפים סטטיים קודם
  results.sort((a, b) => {
    if (a.isStatic && !b.isStatic) return -1;
    if (!a.isStatic && b.isStatic) return 1;
    return b.score - a.score;
  });
  
  // **סינון נוסף: רק תוצאות עם ציון מעל 15**
  results = results.filter(r => r.score >= 15);
  
  return results.slice(0, 10); // מקסימום 10 תוצאות
}

// ========================================
// 📝 פורמט תוצאות חיפוש (פורמט חדש!)
// ========================================
function formatSearchResults(pages, region = null) {
  if (pages.length === 0) return null;
  
  let response = '';
  const staticPages = pages.filter(p => p.isStatic);
  
  // הצגת מוסדות (דפים סטטיים בלבד)
  if (staticPages.length > 0) {
    staticPages.forEach((page) => {
      const title = page.title || page.h1 || 'מוסד לימודים';
      
      // שם המוסד
      response += `${title}\n`;
      
      // רשימת קורסים (אם קיימת)
      if (page.courses && Array.isArray(page.courses)) {
        page.courses.slice(0, 3).forEach(course => {
          response += `• ${course}\n`;
        });
      } else if (page.description && page.description.length < 200) {
        // אם אין courses, הצג תיאור קצר
        const desc = page.description.substring(0, 150);
        if (desc) response += `${desc}\n`;
      }
      
      // תאריך פתיחה (אם ב-3 חודשים הקרובים)
      if (page.startDate && isWithinThreeMonths(page.startDate)) {
        const courseName = page.courseName || title;
        const date = new Date(page.startDate).toLocaleDateString('he-IL');
        response += `מועד פתיחה: ${date}\n`;
      }
      
      // קישור טקסטואלי (לא כפתור!)
      response += `פנו ישירות למוסד הלימודים:\n${page.url}\n\n`;
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
          return { name: region.name, slug: region.slug };
        }
      }
    }
    
    // בדיקה אם נזכר שם האזור המלא
    if (lowerMessage.includes(region.name.toLowerCase())) {
      return { name: region.name, slug: region.slug };
    }
    
    // בדיקה אם נזכרה עיר מהאזור
    for (const city of region.cities) {
      const normalizedCity = city.toLowerCase().replace(/-/g, ' ');
      if (lowerMessage.includes(normalizedCity)) {
        return { name: region.name, slug: region.slug, city: city };
      }
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
  
  for (const field of STUDY_FIELDS) {
    for (const keyword of field.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        detectedFields.push(field);
        break;
      }
    }
  }
  
  return detectedFields;
}

// ========================================
// 🤖 יצירת תשובה חכמה (לוגיקה פשוטה!)
// ========================================
function generateSmartResponse(userMessage) {
  const region = detectRegion(userMessage);
  const studyFields = detectStudyField(userMessage);
  
  let response = '';
  
  // **זיהוי סוג השאלה**
  const isInfoQuestion = userMessage.toLowerCase().includes('שבתון') || 
                         userMessage.toLowerCase().includes('מענק') ||
                         userMessage.toLowerCase().includes('זכאות') ||
                         userMessage.toLowerCase().includes('תקנון');
  
  // **שאלות מידע על שבתון**
  if (isInfoQuestion) {
    const infoResults = searchPages(userMessage, null, 'info');
    
    if (infoResults && infoResults.length > 0) {
      response = formatSearchResults(infoResults);
      return response;
    } else {
      response = `שנת שבתון - מידע כללי 📘\n\n`;
      response += `מה תרצה לדעת?\n`;
      response += `• זכאות למענק\n`;
      response += `• תלוש מענק\n`;
      response += `• תקנון\n`;
      response += `• קורסים מוכרים\n\n`;
      response += `אם לא מצאתי תשובה, אפשר לשאול בקבוצת WhatsApp:\n`;
      response += `https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME`;
      return response;
    }
  }
  
  // **אם יש תחום מזוהה ואזור - ישר לדף דינמי!**
  if (studyFields.length > 0 && region) {
    const field = studyFields[0];
    const regionSlug = region.slug;
    const encodedSlug = field.slug.replace(/ /g, '%20');
    const url = `https://www.shabaton.online/${regionSlug}/${encodedSlug}`;
    
    response = `מצאתי ${field.name} ב${region.name}! 🎓\n\n`;
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
    
    // **בניית הקשר מלא מההיסטוריה**
    let fullContext = message;
    
    if (history && Array.isArray(history) && history.length > 0) {
      // לקיחת כל הודעות המשתמש מההיסטוריה
      const userMessages = history
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join(' ');
      
      // איחוד עם ההודעה הנוכחית
      fullContext = userMessages + ' ' + message;
    }
    
    // יצירת תשובה עם ההקשר המלא
    const response = generateSmartResponse(fullContext);
    
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
