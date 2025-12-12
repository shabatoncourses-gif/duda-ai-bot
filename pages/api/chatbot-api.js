// chatbot-api.js - Backend API Handler
// ========================================
// 🤖 Shabaton Chatbot API
// ========================================

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// ========================================
// ⚙️ Configuration
// ========================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// ========================================
// 📚 טעינת אינדקס
// ========================================
function loadIndex() {
  try {
    const shabatonIndex = JSON.parse(
      fs.readFileSync('data/shabaton_index_part1.json', 'utf8')
    );
    const morimIndex = JSON.parse(
      fs.readFileSync('data/morim_index_part1.json', 'utf8')
    );
    
    return [...shabatonIndex, ...morimIndex];
  } catch (err) {
    console.error('שגיאה בטעינת אינדקס:', err);
    return [];
  }
}

const PAGES_INDEX = loadIndex();

// ========================================
// 🗺️ מיפוי אזורים ועיירות
// ========================================
const REGIONS = {
  'תל אביב והמרכז': {
    slug: 'merkaz',
    cities: ['תל אביב', 'רמת גן', 'גבעתיים', 'חולון', 'בת ים', 'רמת השרון', 'הרצליה', 'כפר סבא', 'רעננה', 'פתח תקווה', 'ראשון לציון', 'רחובות', 'נס ציונה', 'מודיעין']
  },
  'חיפה והצפון': {
    slug: 'Zafon',
    cities: ['חיפה', 'קריות', 'עכו', 'נהריה', 'קרית שמונה', 'צפת', 'טבריה', 'עפולה', 'נצרת', 'כרמיאל']
  },
  'השרון': {
    slug: 'Sharon',
    cities: ['נתניה', 'הוד השרון', 'רמת השרון', 'רעננה', 'כפר סבא', 'רעות']
  },
  'ירושלים והסביבה': {
    slug: 'jerusalem',
    cities: ['ירושלים', 'בית שמש', 'מעלה אדומים', 'גוש עציון', 'מבשרת ציון']
  },
  'השפלה והדרום': {
    slug: 'shfea-darom',
    cities: ['באר שבע', 'אשדוד', 'אשקלון', 'קריית גת', 'נתיבות', 'אילת', 'דימונה', 'ערד', 'שדרות', 'רהט']
  }
};

// ========================================
// 🎓 מיפוי תחומי לימוד
// ========================================
const STUDY_FIELDS = {
  'טכנולוגיה': ['מחשבים', 'קומפיוטר', 'מיחשוב', 'דיגיטלי', 'אינטרנט', 'AI', 'בינה מלאכותית', 'תוכנה', 'אתרים', 'סייבר'],
  'הנחיית קבוצות': ['הנחייה', 'קבוצות', 'פסיכודרמה', 'סוציודרמה', 'דיאלוג'],
  'NLP': ['NLP', 'פרוגרמינג', 'לשוני', 'עצבי'],
  'ייעוץ': ['ייעוץ', 'יעוץ', 'קריירה', 'תעסוקה'],
  'טיפול': ['טיפול', 'פסיכותרפיה', 'ריפוי', 'תרפיה'],
  'אימון': ['אימון', 'קואצ\'ינג', 'coaching'],
  'הוראה מתקנת': ['הוראה מתקנת', 'מתקנת', 'לקויות למידה', 'דיסלקציה'],
  'חינוך': ['חינוך', 'הוראה', 'פדגוגיה', 'דידקטיקה'],
  'תכשיטנות': ['תכשיטים', 'צורפות', 'תכשיטנות', 'תכשיט'],
  'אמנות': ['אמנות', 'ציור', 'פיסול', 'קרמיקה', 'פסיפס', 'משי'],
  'בריאות': ['בריאות', 'תזונה', 'פיזיותרפיה', 'עיסוי']
};

// ========================================
// 🔍 זיהוי אזור מהשאלה
// ========================================
function detectRegion(message) {
  const lowerMessage = message.toLowerCase();
  
  for (const [regionName, regionData] of Object.entries(REGIONS)) {
    // בדיקה אם נזכר שם האזור
    if (lowerMessage.includes(regionName.toLowerCase())) {
      return { name: regionName, slug: regionData.slug };
    }
    
    // בדיקה אם נזכרה עיר מהאזור
    for (const city of regionData.cities) {
      if (lowerMessage.includes(city.toLowerCase())) {
        return { name: regionName, slug: regionData.slug, city: city };
      }
    }
  }
  
  return null;
}

// ========================================
// 🎓 זיהוי תחום לימוד מהשאלה
// ========================================
function detectStudyField(message) {
  const lowerMessage = message.toLowerCase();
  const detectedFields = [];
  
  for (const [fieldName, keywords] of Object.entries(STUDY_FIELDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        detectedFields.push(fieldName);
        break;
      }
    }
  }
  
  return detectedFields;
}

// ========================================
// 🔍 חיפוש במבנה סמנטי
// ========================================
async function semanticSearch(query, topK = 5) {
  try {
    // יצירת embedding לשאלה
    const embeddingResponse = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    });
    
    const queryVector = embeddingResponse.data[0].embedding;
    
    // חישוב דמיון קוסינוס
    const results = PAGES_INDEX.map(page => {
      const similarity = cosineSimilarity(queryVector, page.vector);
      return { ...page, similarity };
    });
    
    // מיון ולקיחת top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
    
  } catch (err) {
    console.error('שגיאה בחיפוש סמנטי:', err);
    return [];
  }
}

// חישוב דמיון קוסינוס
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ========================================
// 🤖 יצירת תשובה חכמה
// ========================================
async function generateSmartResponse(userMessage, history = []) {
  // 1. זיהוי אזור
  const region = detectRegion(userMessage);
  
  // 2. זיהוי תחום לימוד
  const studyFields = detectStudyField(userMessage);
  
  // 3. חיפוש סמנטי
  const relevantPages = await semanticSearch(userMessage, 5);
  
  // 4. בניית הקשר ל-GPT
  const context = relevantPages.map((page, i) => {
    return `[${i + 1}] ${page.title}\nURL: ${page.url}\n${page.description || ''}\n`;
  }).join('\n---\n');
  
  // 5. בניית System Prompt
  const systemPrompt = `אתה עוזר וירטואלי של "שבתון" - פלטפורמה למציאת קורסים והשתלמויות למורים.

**חוקים חשובים:**
1. ענה רק על בסיס המידע שסופק לך בהקשר
2. אם גולש מבקש קורס באזור מסוים - תן קישור לדף הדינמי המתאים
3. אם מצאת דף סטטי עם תאריך פתיחה ב-3 חודשים הקרובים - הזכר את התאריך
4. כל קישור יוצג בשורה נפרדת
5. אם אין תשובה טובה - הפנה לקבוצת WhatsApp: https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME

**מבנה תשובה:**
- תאר קצר של מה מצאת
- כל קישור בשורה חדשה
- אם זיהית אזור ותחום - הוסף קישור לדף דינמי:
  https://www.shabaton.online/results-{region}/{studyField}

**אזורים זמינים:**
- merkaz (תל אביב והמרכז)
- Zafon (חיפה והצפון)
- Sharon (השרון)
- jerusalem (ירושלים והסביבה)
- shfea-darom (השפלה והדרום)
- all (כל הארץ)

${region ? `**אזור שזוהה:** ${region.name} (${region.slug})${region.city ? ` - ${region.city}` : ''}` : ''}
${studyFields.length > 0 ? `**תחומים שזוהו:** ${studyFields.join(', ')}` : ''}

**דפים רלוונטיים:**
${context}`;

  // 6. שליחה ל-GPT
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10), // 10 הודעות אחרונות
    { role: 'user', content: userMessage }
  ];
  
  const response = await client.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: messages,
    temperature: 0.7,
    max_tokens: 800
  });
  
  return response.choices[0].message.content;
}

// ========================================
// 🚀 API Handler
// ========================================
export async function handleChatRequest(request) {
  try {
    const { message, history } = await request.json();
    
    if (!message || message.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'חסרה הודעה'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // יצירת תשובה
    const response = await generateSmartResponse(message, history);
    
    return new Response(JSON.stringify({
      response: response,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('שגיאה:', error);
    
    return new Response(JSON.stringify({
      error: 'שגיאה בעיבוד הבקשה',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========================================
// 🧪 Local Testing
// ========================================
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log('🤖 בודק את הבוט...\n');
    
    const testQueries = [
      'אני רוצה קורס הנחיית קבוצות בתל אביב',
      'יש קורס מחשבים בחיפה?',
      'מה עם תכשיטנות בצפון?'
    ];
    
    for (const query of testQueries) {
      console.log(`\n📝 שאלה: "${query}"`);
      const response = await generateSmartResponse(query, []);
      console.log(`💬 תשובה:\n${response}\n${'='.repeat(60)}`);
    }
  })();
}
