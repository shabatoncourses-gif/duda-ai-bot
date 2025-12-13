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
  const lowerMessage = message.toLowerCase();
  
  for (const region of REGIONS) {
    // בדיקה אם נזכר שם האזור
    if (lowerMessage.includes(region.name.toLowerCase())) {
      return { name: region.name, slug: region.slug };
    }
    
    // בדיקה אם נזכרה עיר מהאזור
    for (const city of region.cities) {
      if (lowerMessage.includes(city.toLowerCase())) {
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
    const url = `https://www.shabaton.online/results-${regionSlug}/${field.slug}`;
    
    response = `מצאתי עבורך ${field.name} ${region.city ? `ב${region.city}` : `ב${region.name}`}! 🎓\n\n`;
    response += `${field.name} ב${region.name}:\n${url}\n\n`;
    
    if (studyFields.length > 1) {
      response += `💡 זיהיתי גם תחומים נוספים שעשויים לעניין אותך:\n`;
      for (let i = 1; i < Math.min(3, studyFields.length); i++) {
        const additionalUrl = `https://www.shabaton.online/results-${regionSlug}/${studyFields[i].slug}`;
        response += `\n${studyFields[i].name} ב${region.name}:\n${additionalUrl}\n`;
      }
    }
    
  // מקרה 2: יש תחום אבל אין אזור
  } else if (studyFields.length > 0) {
    const field = studyFields[0];
    const url = `https://www.shabaton.online/results-all/${field.slug}`;
    
    response = `מצאתי עבורך ${field.name} בכל הארץ! 🎓\n\n`;
    response += `${field.name} בכל הארץ:\n${url}\n\n`;
    response += `💡 אם תרצה, ספר לי באיזה אזור אתה מעוניין ואתאים לך את התוצאות.\n\n`;
    response += `לדוגמה: "${field.name} בתל אביב"`;
    
    if (studyFields.length > 1) {
      response += `\n\n🔍 זיהיתי גם תחומים נוספים:\n`;
      for (let i = 1; i < Math.min(3, studyFields.length); i++) {
        response += `• ${studyFields[i].name}\n`;
      }
    }
    
  // מקרה 3: יש אזור אבל אין תחום
  } else if (region) {
    response = `אשמח לעזור לך למצוא קורסים ב${region.name}! 🗺️\n\n`;
    response += `באיזה תחום אתה מעוניין? הנה כמה אפשרויות פופולריות:\n\n`;
    
    const popularFields = [
      'הנחיית קבוצות',
      'טכנולוגיה דיגיטלית ואינטרנט',
      'ייעוץ חינוכי',
      'חינוך והוראה',
      'העצמה והתפתחות אישית'
    ];
    
    popularFields.forEach(fieldName => {
      response += `📚 ${fieldName}\n`;
    });
    
    response += `\nפשוט ספר לי מה מעניין אותך!`;
    
  // מקרה 4: שאלה כללית על שבתון
  } else if (userMessage.toLowerCase().includes('שבתון') || 
             userMessage.toLowerCase().includes('מענק') ||
             userMessage.toLowerCase().includes('זכאות')) {
    response = `אשמח לעזור לך עם מידע על שנת שבתון! 📘\n\n`;
    response += `מה תרצה לדעת?\n`;
    response += `• זכאות למענק\n`;
    response += `• תלוש מענק\n`;
    response += `• תקנון שבתון\n`;
    response += `• קורסים מוכרים\n\n`;
    response += `או שאל אותי ישירות!`;
    
  // מקרה 5: לא זיהיתי כלום
  } else {
    response = `אשמח לעזור לך למצוא את הקורס המתאים! 🎯\n\n`;
    response += `ספר לי:\n`;
    response += `1️⃣ איזה תחום מעניין אותך?\n`;
    response += `2️⃣ באיזה אזור בארץ?\n\n`;
    response += `🔍 לדוגמה:\n`;
    response += `• "קורס הנחיית קבוצות בתל אביב"\n`;
    response += `• "טכנולוגיה בהוראה בחיפה"\n`;
    response += `• "ייעוץ חינוכי בירושלים"`;
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
