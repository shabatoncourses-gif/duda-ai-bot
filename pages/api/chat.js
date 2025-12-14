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
// 🔍 חיפוש דפים באינדקסים (חיפוש חכם!)
// ========================================
function searchPages(query, region = null, pageType = 'all') {
  const pages = loadAllPages();
  const lowerQuery = query.toLowerCase();
  
  // ניקוי השאילתה
  let cleanQuery = lowerQuery.replace(/\sב([א-ת])/g, ' $1');
  cleanQuery = cleanQuery.replace(/-/g, ' ');
  cleanQuery = cleanQuery.replace(/קורס(י)?/g, '').trim();
  
  // הסרת שמות ערים
  if (region && region.cities) {
    for (const city of region.cities) {
      const cityLower = city.toLowerCase();
      cleanQuery = cleanQuery.replace(new RegExp('\\b' + cityLower + '\\b', 'gi'), '').trim();
    }
  }
  
  // הסרת מילות עזר
  const stopWords = ['מרכז', 'הארץ', 'במרכז', 'בארץ', 'ב', 'ה', 'של', 'את', 'עם', 'על', 'אל', 'כל', 'צפון', 'בצפון', 'הצפון', 'דרום', 'בדרום', 'שרון', 'בשרון'];
  const queryWords = cleanQuery.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  if (queryWords.length === 0) {
    return [];
  }
  
  // **זיהוי: האם זו שאילתה ספציפית? (3+ מילות מפתח)**
  const isSpecificQuery = queryWords.length >= 3;
  const minScore = isSpecificQuery ? 40 : 15; // סף גבוה לשאילתות ספציפיות!
  
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
    if (cleanQuery.length > 5) {
      if (title.includes(cleanQuery)) {
        matchScore += 100; // ביטוי מלא בכותרת = התאמה מושלמת!
      }
      if (description.includes(cleanQuery)) {
        matchScore += 70; // ביטוי מלא בתיאור = מאוד טוב!
      }
    }
    
    // **בדיקת מילות מפתח בודדות**
    let wordMatchesInTitle = 0;
    let wordMatchesInDesc = 0;
    
    for (const word of queryWords) {
      if (title.includes(word)) {
        matchScore += 15;
        wordMatchesInTitle++;
      }
      if (description.includes(word)) {
        matchScore += 8;
        wordMatchesInDesc++;
      }
      if (keywords.some(k => k.includes(word))) {
        matchScore += 5;
      }
    }
    
    // **בונוס אם רוב המילים בכותרת או בתיאור**
    const totalWordMatches = wordMatchesInTitle + wordMatchesInDesc;
    if (totalWordMatches >= queryWords.length) {
      matchScore += 20; // כל המילים נמצאו!
    }
    
    // **עונש לדפים לא רלוונטיים**
    // אם זו שאילתה ספציפית אבל הדף לא מכיל את הביטוי המלא
    if (isSpecificQuery && matchScore < 50) {
      matchScore = Math.floor(matchScore * 0.3); // הורדת ציון משמעותית
    }
    
    // בדיקת אזור
    let matchesRegion = true;
    if (region && region.cities && isStaticPage) {
      const location = (page.location || '').toLowerCase();
      matchesRegion = region.cities.some(city => 
        location.includes(city.toLowerCase().replace(/-/g, ' '))
      );
      
      if (!matchesRegion) {
        matchScore = 0;
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
  
  // מיון
  results.sort((a, b) => {
    if (a.isStatic && !b.isStatic) return -1;
    if (!a.isStatic && b.isStatic) return 1;
    return b.score - a.score;
  });
  
  // **סינון לפי סף מינימלי**
  results = results.filter(r => r.score >= minScore);
  
  return results.slice(0, 10);
}

// ========================================
// 📝 פורמט תוצאות חיפוש (עיצוב משופר!)
// ========================================
function formatSearchResults(pages, region = null) {
  if (pages.length === 0) return null;
  
  let response = '';
  const staticPages = pages.filter(p => p.isStatic);
  
  // הצגת מוסדות (דפים סטטיים בלבד)
  if (staticPages.length > 0) {
    staticPages.forEach((page, index) => {
      const title = page.title || page.h1 || 'מוסד לימודים';
      
      // אייקון + כותרת בבולד
      response += `🎓 **${title}**\n`;
      
      // רשימת קורסים (אם קיימת)
      if (page.courses && Array.isArray(page.courses)) {
        page.courses.slice(0, 3).forEach(course => {
          response += `   • ${course}\n`;
        });
      } else if (page.description && page.description.length < 200) {
        // אם אין courses, הצג תיאור קצר
        const desc = page.description.substring(0, 150);
        if (desc) response += `   ${desc}\n`;
      }
      
      // תאריך פתיחה (אם ב-3 חודשים הקרובים)
      if (page.startDate && isWithinThreeMonths(page.startDate)) {
        const date = new Date(page.startDate).toLocaleDateString('he-IL');
        response += `   📅 מועד פתיחה: ${date}\n`;
      }
      
      // קישור מוסתר מאחורי טקסט
      response += `   [פנו למוסד הלימודים](${page.url})\n`;
      
      // מפריד בין מוסדות (לא אחרי האחרון)
      if (index < staticPages.length - 1) {
        response += `\n───────────────────\n\n`;
      } else {
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
  
  // ספירת מילות מפתח בשאילתה (לאחר ניקוי)
  const cleanedMessage = lowerMessage
    .replace(/קורס(י)?/g, '')
    .replace(/\sב([א-ת])/g, ' $1')
    .trim();
  const significantWords = cleanedMessage.split(/\s+/).filter(w => w.length > 2);
  const isSpecificQuery = significantWords.length >= 3; // שאילתה ספציפית = 3+ מילים
  
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
        // **אם זו שאילתה ספציפית - דלג על תחומים כלליים (1-2 מילים)**
        if (isSpecificQuery && keywordLower.split(/\s+/).length <= 2) {
          continue; // דלג על "אמנות", "פיסול" וכו'
        }
        
        matches.push({ field, keyword, length: keywordLower.length });
        break;
      }
    }
  }
  
  // מיון לפי אורך מילת המפתח (ארוכה יותר = ספציפית יותר)
  matches.sort((a, b) => b.length - a.length);
  detectedFields.push(...matches.map(m => m.field));
  
  // **שלב 3: אם עדיין לא מצאנו ולא שאילתה ספציפית - חיפוש חלקי**
  if (detectedFields.length === 0 && !isSpecificQuery) {
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
