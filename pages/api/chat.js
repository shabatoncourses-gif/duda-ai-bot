// pages/api/chat.js - Vercel Serverless with JSON config files
import fs from 'fs';
import path from 'path';

// ========================================
// 📦 טעינת קבצי הגדרות
// ========================================
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
// 🤖 יצירת תשובה חכמה
// ========================================
function generateSmartResponse(userMessage) {
  const region = detectRegion(userMessage);
  const studyFields = detectStudyField(userMessage);
  
  let response = '';
  
  // מקרה 1: יש תחום ואזור
  if (studyFields.length > 0 && region) {
    const field = studyFields[0];
    const regionSlug = region.slug;
    
    // קידוד URL - החלפת רווחים ב-%20
    const encodedSlug = field.slug.replace(/ /g, '%20');
    const url = `https://www.shabaton.online/${regionSlug}/${encodedSlug}`;
    
    response = `מצאתי עבורך קורסים ב${region.city ? region.city : region.name}! 🎓\n\n`;
    response += `${field.slug}\n${url}`;
    
    if (studyFields.length > 1) {
      response += `\n\n💡 תחומים נוספים שעשויים לעניין:\n`;
      for (let i = 1; i < Math.min(3, studyFields.length); i++) {
        const additionalEncodedSlug = studyFields[i].slug.replace(/ /g, '%20');
        const additionalUrl = `https://www.shabaton.online/${regionSlug}/${additionalEncodedSlug}`;
        response += `\n${studyFields[i].slug}\n${additionalUrl}`;
      }
    }
    
  // מקרה 2: יש תחום אבל אין אזור
  } else if (studyFields.length > 0) {
    const field = studyFields[0];
    const encodedSlug = field.slug.replace(/ /g, '%20');
    const url = `https://www.shabaton.online/results-all/${encodedSlug}`;
    
    response = `מצאתי עבורך קורסים בכל הארץ! 🎓\n\n`;
    response += `${field.slug}\n${url}\n\n`;
    response += `💡 רוצה לצמצם לאזור מסוים? ספר לי!`;
    
  // מקרה 3: יש אזור אבל אין תחום
  } else if (region) {
    response = `מעולה! ${region.name} 🗺️\n\n`;
    response += `באיזה תחום תרצה להתמחות?\n\n`;
    response += `📚 הנחיית קבוצות\n`;
    response += `💻 טכנולוגיה דיגיטלית\n`;
    response += `🎓 ייעוץ חינוכי\n`;
    response += `👨‍🏫 חינוך והוראה\n`;
    response += `✨ העצמה אישית`;
    
  // מקרה 4: שאלה כללית על שבתון
  } else if (userMessage.toLowerCase().includes('שבתון') || 
             userMessage.toLowerCase().includes('מענק') ||
             userMessage.toLowerCase().includes('זכאות')) {
    response = `שנת שבתון - מידע כללי 📘\n\n`;
    response += `מה תרצה לדעת?\n`;
    response += `• זכאות למענק\n`;
    response += `• תלוש מענק\n`;
    response += `• תקנון\n`;
    response += `• קורסים מוכרים`;
    
  // מקרה 5: לא זיהיתי כלום
  } else {
    response = `בוא נמצא את הקורס המושלם עבורך! 🎯\n\n`;
    response += `ספר לי:\n`;
    response += `📍 באיזה אזור?\n`;
    response += `📚 איזה תחום?\n\n`;
    response += `דוגמה: "הנחיית קבוצות בחיפה"`;
  }
  
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
    
    const response = generateSmartResponse(message);
    
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
