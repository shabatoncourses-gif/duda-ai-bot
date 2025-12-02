// scripts/autoBuildIndex.js
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

// ============================================
// 🔧 הגדרות ואימות
// ============================================
const CONFIG = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_CONTENT_TOKEN,
  GITHUB_REPO: process.env.GITHUB_REPO,
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || "main",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  BATCH_SIZE: Number(process.env.BATCH_SIZE) || 40,
  MAX_PER_FILE: 500,
  RETRY_ATTEMPTS: 3,
  BASE_DELAY: 4000,
};

// ============================================
// 📋 דפי מידע סטטיים (ידניים)
// ============================================
const STATIC_INFO_PAGES = [
  "https://www.shabaton.online/btl_shabaton",
  "https://www.shabaton.online/shabaton-video",
  "https://www.shabaton.online/learning_programs_shabaton",
  "https://www.shabaton.online/luz_shabaton",
  "https://www.shabaton.online/end_shabaton",
  "https://www.shabaton.online/halforfull_shabaton",
  "https://www.shabaton.online/phones_shabaton",
  "https://www.shabaton.online/forms_shabaton",
  "https://www.shabaton.online/Payments_shabaton",
  "https://www.shabaton.online/tlush_maanak_shabaton",
  "https://www.shabaton.online/kabalot_shabaton",
  "https://www.shabaton.online/tuition_reimbursement",
  "https://www.shabaton.online/shabaton-maanak",
  "https://www.shabaton.online/birth_shabatgon",
  "https://www.shabaton.online/pension_shabaton",
  "https://www.shabaton.online/keren_makor_mishor",
  "https://www.shabaton.online/tofes_101",
  "https://www.morim.boutique/rights",
];

// ============================================
// 🚫 דפים להתעלמות (EXCLUDED PAGES) - חדש!
// ============================================
const EXCLUDED_PAGES = [
  "https://www.shabaton.online/",
  "https://www.morim.boutique/",
  "https://www.shabaton.online/consult",
  "https://www.shabaton.online/contact",
  "https://www.shabaton.online/knassim",
  "https://www.shabaton.online/משרות-הוראה",
  "https://www.shabaton.online/הוספת-מודעה-למציעי-משרה",
  "https://www.shabaton.online/הוספת-מודעה-למבקשי-משרה",
  "https://www.morim.boutique/קורסי-נגרות-וחידוש-רהיטים",
];

// פונקציה לבדיקה אם URL להתעלם
function isExcludedUrl(url) {
  // בדיקה ברשימה
  if (EXCLUDED_PAGES.includes(url)) return true;
  
  // בדיקה לפי patterns
  if (url.includes('/drushim/')) return true;
  if (url.includes('contact-us-phone')) return true;
  if (url.includes('/thanks')) return true;
  if (url.includes('mosad-index')) return true;
  
  return false;
}

// אימות API Key
if (!CONFIG.OPENAI_API_KEY?.startsWith("sk-")) {
  console.error("❌ חסר או לא תקין OPENAI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ============================================
// 🌐 Puppeteer - לדפי Duda דינמיים
// ============================================
let browserInstance = null;

async function fetchDudaPageWithPuppeteer(url) {
  console.log(`   🌐 טוען דף Duda עם Puppeteer...`);
  
  try {
    // פתיחת דפדפן (רק פעם אחת)
    if (!browserInstance) {
      browserInstance = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      console.log(`   ✅ דפדפן נפתח`);
    }
    
    const page = await browserInstance.newPage();
    
    // הגדרות
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // טעינת הדף
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // המתנה ל-li.listItem (עד 10 שניות)
    try {
      await page.waitForSelector('li.listItem', { timeout: 10000 });
      console.log(`   ✅ li.listItem נטען בהצלחה!`);
    } catch {
      console.log(`   ⚠️ לא נמצא li.listItem (המתנה פסקה), ממשיכים`);
    }
    
    // קבלת ה-HTML המלא (אחרי JavaScript)
    const html = await page.content();
    
    await page.close();
    
    return {
      ok: true,
      text: async () => html,
      status: 200
    };
    
  } catch (err) {
    console.error(`   ❌ שגיאת Puppeteer: ${err.message}`);
    return null;
  }
}

// סגירת הדפדפן בסוף
process.on('beforeExit', async () => {
  if (browserInstance) {
    console.log('\n🔚 סוגר דפדפן...');
    await browserInstance.close();
    browserInstance = null;
  }
});

// ============================================
// 🧹 משפטים להתעלמות (IGNORE LIST)
// ============================================
const IGNORE_PATTERNS = [
  /רוצים\s+להיות\s+מעודכנים\s*\?\s*הרשמו\s+לעלון\s+שבתון\s+בנושאי\s+לימודים.*?לכם!/gi,
  /הרשמו\s+לעלון\s+שבתון/gi,
  /רוצים\s+להיות\s+מעודכנים/gi,
];

function removeIgnoredText(text) {
  let cleaned = text;
  IGNORE_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  return cleaned.replace(/\s+/g, ' ').trim();
}

// ============================================
// 🌐 טיפול ב-URLs (עברית + אנגלית)
// ============================================

// מיפוי אזורים לעברית
const REGION_MAP = {
  'all': 'כל הארץ',
  'merkaz': 'מרכז',
  'zafon': 'צפון',
  'sharon': 'שרון',
  'jerusalem': 'ירושלים',
  'shfea-darom': 'שפלה ודרום'
};

function normalizeUrl(url) {
  try {
    url = url.trim();
    
    // אם אין protocol, נוסיף https
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
    
    // שמירת ה-URL כמו שהוא - לא נשנה את ה-encoding
    return url;
  } catch (err) {
    return url.trim();
  }
}

// ============================================
// 🎭 User-Agents רנדומליים
// ============================================
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ============================================
// 📡 קריאת Sitemap
// ============================================
async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`\n📥 קורא sitemap: ${sitemapUrl}`);
  
  try {
    const res = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": getRandomUA(),
        "Accept": "application/xml,text/xml,*/*",
        "Accept-Language": "he,en-US;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const xml = await res.text();
    
    // תמיכה ב-sitemap index וגם ב-sitemap רגיל
    const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
    const urls = matches
      .map((m) => {
        let url = m[1].trim();
        
        try {
          // הסרת HTML entities
          url = url
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
          
          // **רק נחליף רווחים ל-%20, נשאיר עברית כמו שהיא**
          url = url.replace(/ /g, '%20');
          
          return url;
          
        } catch (err) {
          console.warn(`⚠️ בעיה בעיבוד URL: ${url.substring(0, 60)}...`);
          return url.replace(/ /g, '%20');
        }
      })
      .filter(Boolean)
      .filter((url) => {
        // סינון דפים שצריך להתעלם מהם
        if (isExcludedUrl(url)) return false;
        
        const lower = url.toLowerCase();
        const withSpaces = lower.replace(/%20/g, ' ');
        
        return !lower.includes("/tag/") && 
               !lower.includes("/author/") &&
               !lower.includes("/page/") &&
               !withSpaces.includes("/tag/") && 
               !withSpaces.includes("/author/") &&
               !withSpaces.includes("/page/");
      });

    console.log(`✅ נמצאו ${urls.length} URLs תקינים מה-sitemap`);
    
    if (urls.length > 0) {
      console.log(`\n📋 דוגמאות URLs (5 ראשונים):`);
      urls.slice(0, 5).forEach((url, i) => {
        console.log(`   ${i+1}. ${url.substring(0, 80)}...`);
      });
    }
    
    return urls;
  } catch (err) {
    console.error(`❌ שגיאה בקריאת sitemap: ${err.message}`);
    return [];
  }
}

// ============================================
// 🔄 Fetch מתקדם עם retry logic + Puppeteer
// ============================================
async function fetchPageWithRetry(url, maxRetries = CONFIG.RETRY_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // זיהוי דפי results (דינמיים)
      const needsPuppeteer = 
        url.includes('/results-') || 
        url.includes('/search-results-') || 
        url.includes('/courses-per-month-');
      
      if (needsPuppeteer) {
        console.log(`   🎭 דף דינמי - משתמש ב-Puppeteer (ניסיון ${attempt}/${maxRetries})`);
        const response = await fetchDudaPageWithPuppeteer(url);
        if (response && response.ok) {
          return response;
        }
      } else {
        // fetch רגיל
        const response = await fetch(url, {
          headers: {
            "User-Agent": getRandomUA(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "he,en-US;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
          },
          signal: AbortSignal.timeout(15000),
        });
        
        if (response.ok) {
          return response;
        }
        
        if (response.status === 404) {
          return { ok: false, status: 404 };
        }
      }
      
      if (attempt < maxRetries) {
        const backoff = CONFIG.BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 2000;
        console.log(`   ⏳ ניסיון ${attempt} נכשל, ממתין ${Math.round(backoff / 1000)}s...`);
        await delay(backoff);
      }
      
    } catch (err) {
      console.error(`   ⚠️ ניסיון ${attempt}/${maxRetries} נכשל: ${err.message}`);
      
      if (attempt < maxRetries) {
        const backoff = CONFIG.BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 2000;
        await delay(backoff);
      }
    }
  }
  
  return null;
}

// ============================================
// 🕵️ זיהוי דפי results (רשימות קורסים)
// ============================================
async function detectIfResultsPage(url, html) {
  try {
    const $ = cheerio.load(html);
    
    // זיהוי לפי URL
    if (url.includes('/results') || 
        url.includes('/search-results') || 
        url.includes('/courses-per-month')) {
      return { isResultsPage: true };
    }
    
    // זיהוי לפי תוכן
    const hasList = $('li.listItem').length > 0;
    const hasResults = $('.dmNewParagraph').length > 3;
    const hasCourseLinks = $('a[href*="/course"]').length > 5;
    
    if (hasList || (hasResults && hasCourseLinks)) {
      return { isResultsPage: true };
    }
    
    return { isResultsPage: false };
    
  } catch (err) {
    return { isResultsPage: false };
  }
}

function identifyPageType(url, $) {
  const lower = url.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();

  // דפי תוצאות/חיפוש (רשימות קורסים) - **עדיפות גבוהה**
  if (
    path.includes("/results") ||
    path.includes("/search-results") ||
    path.includes("/courses-per-month") ||
    path.includes("per-month")
  ) {
    return "course-list";
  }

  // דפי מידע ספציפיים
  if (
    path.includes("/btl") ||
    path.includes("/luz") ||
    path.includes("/shabaton") ||
    path.includes("/rights") ||
    path.includes("/forms") ||
    path.includes("/tofes") ||
    path.includes("/maanak") ||
    path.includes("/pension") ||
    path.includes("/birth") ||
    path.includes("/tuition") ||
    lower.includes("info")
  ) {
    return "info-page";
  }

  // דף מוסד לימוד - זיהוי משופר + _teachers
  const hasInstitutionPattern = 
    path.includes("-edu") || 
    path.includes("-college") || 
    path.includes("-university") ||
    path.includes("_teachers") ||  // הוספה חדשה
    path.includes("haifa-") ||
    path.includes("tau-") ||
    path.includes("huji-") ||
    (($("ul li a").length > 5 || $("a").length > 10) && $("h2, h3").length > 2);
  
  if (hasInstitutionPattern) {
    return "institution-page";
  }

  // דף קורס בודד
  if (
    $("table").length > 0 ||
    $(".course-details").length > 0 ||
    ($("h1").length === 1 && $("p").length > 5)
  ) {
    return "course-detail";
  }

  return "general";
}

// ============================================
// 🧹 סינון מתקדם של אלמנטים לא רלוונטיים
// ============================================
function cleanDom($) {
  // הסרת אלמנטים טכניים
  const removeSelectors = [
    "header",
    "footer",
    "nav",
    ".navbar",
    ".nav",
    ".menu",
    ".breadcrumb",
    ".breadcrumbs",
    ".sidebar",
    ".widget",
    "script",
    "style",
    "noscript",
    "iframe",
    "form",
    ".cookie",
    ".popup",
    ".modal",
    ".advertisement",
    ".ad",
    ".social-share",
    ".comments",
    ".newsletter",
    ".subscription",
  ];

  removeSelectors.forEach((sel) => $(sel).remove());

  return $;
}

// ============================================
// 📝 חילוץ תוכן חכם (משופר!)
// ============================================
function extractSmartContent(html, url) {
  const $ = cheerio.load(html);
  cleanDom($);

  const pageType = identifyPageType(url, $);

  // מטא-דאטה
  const title = $("title").text().trim();
  const h1 = $("h1").first().text().trim();
  const description = $("meta[name='description']").attr("content") || "";

  const h2s = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 3);

  const h3s = $("h3")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 3);

  // חילוץ רשימות (משופר לדפי מוסדות!)
  const lists = [];
  $("ul, ol").each((_, list) => {
    const items = $(list)
      .find("li")
      .map((_, li) => $(li).text().trim())
      .get()
      .filter((t) => t.length > 10 && !t.includes("קורסים נוספים"));

    if (items.length > 0 && items.length < 50) {
      lists.push(...items);
    }
  });

  // חילוץ טבלאות (משופר! הסרת קישורים)
  const tables = [];
  if (pageType === "course-detail" || 
      pageType === "institution-page" || 
      pageType === "course-list") {
    
    $("table").each((_, table) => {
      const rows = $(table).find("tr");
      
      // הגדלה ל-150 שורות (במקום 50)
      if (rows.length > 0 && rows.length < 150) {
        
        rows.each((_, row) => {
          const cells = $(row)
            .find("td, th")
            .map((_, cell) => {
              // הסרת קישורי "צרו קשר" ופעולה
              return $(cell).clone()
                .find('a[href*="contact"], a:contains("צרו קשר"), a:contains("הרשמה")')
                .remove()
                .end()
                .text().trim();
            })
            .get()
            .filter(t => t.length > 0)
            .join(" | ");
          
          if (cells) tables.push(cells);
        });
      }
    });
  }

  // חילוץ פסקאות
  const paragraphs = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 20 && t.length < 600);

  // חילוץ תוכן Duda (לדפי results)
  const dudaContent = [];
  if (pageType === "course-list") {
    $("li.listItem").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 20) {
        dudaContent.push(text);
      }
    });

    $(".dmNewParagraph").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 20) {
        dudaContent.push(text);
      }
    });
  }

  // חילוץ קישורים (טקסט בלבד)
  $("a").each((_, el) => {
    const linkText = $(el).text().trim();
    if (linkText && linkText.length > 10 && linkText.length < 200) {
      dudaContent.push(linkText);
    }
  });

  // ============================================
  // 🔥 בניית הטקסט הסופי (משופר לדפי מוסדות!)
  // ============================================
  const parts = [];

  // משקל כפול לכותרות
  if (title) parts.push(title, title);
  if (h1 && h1 !== title) parts.push(h1, h1);
  if (description) parts.push(description);

  // כותרות משנה
  parts.push(...h2s, ...h3s);

  // תוכן עיקרי - **משופר לדפי מוסדות**
  if (pageType === "institution-page") {
    // לדפי מוסדות: 100 פריטים (במקום 20!)
    parts.push(...lists.slice(0, 100));
    parts.push(...tables.slice(0, 100));
  } else {
    // לדפים אחרים: הגבלה רגילה
    parts.push(...lists.slice(0, 20));
    parts.push(...tables.slice(0, 15));
  }

  parts.push(...paragraphs);
  parts.push(...dudaContent.slice(0, 30));

  // הסרת כפילויות
  const uniqueParts = [...new Set(parts)].filter(Boolean);
  let cleanText = uniqueParts.join(" ");

  // הסרת משפטים להתעלמות
  cleanText = removeIgnoredText(cleanText);

  // קיצוץ לאורך מקסימלי
  if (cleanText.length > 8000) {
    cleanText = cleanText.substring(0, 8000);
  }

  // חישוב מספר מילים
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  return {
    text: cleanText,
    wordCount,
    title,
    h1,
    h2: h2s,
    h3: h3s,
    description,
    type: pageType,
  };
}

// ============================================
// 📊 טיפול בדפי RESULTS (רשימות קורסים)
// ============================================
function extractResultsPageCourses(html) {
  const $ = cheerio.load(html);
  const courses = [];

  // Duda: li.listItem
  $("li.listItem").each((_, item) => {
    try {
      const $item = $(item);

      const courseName = $item.find("h3, .course-title, .dmNewParagraph").first().text().trim();
      const institutionElements = $item.find("p, div, span").toArray();
      let institution = "";
      for (const el of institutionElements) {
        const text = $(el).text().trim();
        if (text && !text.includes(courseName) && text.length > 5 && text.length < 100) {
          institution = text;
          break;
        }
      }

      const link = $item.find("a").attr("href") || "";
      let dates = [];
      $item.find("p, span, div").each((_, el) => {
        const text = $(el).text();
        const dateMatches = text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g);
        if (dateMatches) {
          dates.push(...dateMatches);
        }
      });

      if (courseName) {
        courses.push({
          courseName,
          institution: institution || "לא צוין",
          dates: dates.length > 0 ? dates : [],
          link,
        });
      }
    } catch (err) {
      console.error(`⚠️ שגיאה בחילוץ קורס מ-listItem: ${err.message}`);
    }
  });

  console.log(`   📚 נמצאו ${courses.length} קורסים בדף`);
  return courses;
}

// ============================================
// 🔗 חילוץ 11 קורסים למוסד (Regex משופר)
// ============================================
function extractCoursesFromHtml(html) {
  const courses = [];
  
  // Regex: שם קורס (עם <br>) + עד 10 מוסדות
  const regex = /<h3[^>]*>(.*?)<\/h3>\s*(?:<br\s*\/?.*?>)?\s*(.*?)(?=<h3|<\/div|$)/gis;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const courseName = match[1].replace(/<[^>]*>/g, '').trim();
      const institutionsBlock = match[2];
      
      if (!courseName || courseName.length < 5) continue;
      
      // חילוץ עד 10 מוסדות
      const institutionMatches = institutionsBlock.match(/<a[^>]*>(.*?)<\/a>/gi);
      const institutions = [];
      
      if (institutionMatches) {
        for (let i = 0; i < Math.min(institutionMatches.length, 10); i++) {
          const inst = institutionMatches[i]
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
          if (inst && inst.length > 2) {
            institutions.push(inst);
          }
        }
      }
      
      if (institutions.length > 0) {
        courses.push({
          courseName,
          institutions: institutions.slice(0, 10),
          institutionCount: institutions.length
        });
      }
      
    } catch (err) {
      console.error(`⚠️ שגיאה בחילוץ קורס: ${err.message}`);
    }
  }
  
  console.log(`   🎓 חולצו ${courses.length} קורסים עם מוסדות`);
  return courses;
}

// ============================================
// ⚙️ עיבוד דף בודד
// ============================================
async function processPage(url) {
  try {
    console.log(`   ⚙️ מעבד: ${url.substring(0, 70)}...`);

    const response = await fetchPageWithRetry(url);

    if (!response) {
      console.log(`   ❌ כישלון בטעינת הדף`);
      return null;
    }

    if (response.status === 404) {
      console.log(`   🚫 404 - דף לא נמצא`);
      return "404";
    }

    const html = await response.text();
    const detectionResult = await detectIfResultsPage(url, html);

    let extractedContent;
    let courses = [];

    if (detectionResult.isResultsPage) {
      console.log(`   📋 דף רשימת קורסים (results)`);
      extractedContent = extractSmartContent(html, url);
      courses = extractResultsPageCourses(html);
      
      if (courses.length === 0) {
        courses = extractCoursesFromHtml(html);
      }
      
      console.log(`   ✅ חולצו ${courses.length} קורסים`);
    } else {
      console.log(`   📄 דף תוכן רגיל`);
      extractedContent = extractSmartContent(html, url);
    }

    if (!extractedContent.text || extractedContent.text.length < 50) {
      console.log(`   ⚠️ אין תוכן מספיק (${extractedContent.text.length} תווים)`);
      return null;
    }

    console.log(`   📝 ${extractedContent.wordCount} מילים | ${extractedContent.text.length} תווים`);

    // יצירת embedding
    console.log(`   🔢 יוצר embedding...`);
    const embRes = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: extractedContent.text,
    });

    const pageData = {
      url,
      title: extractedContent.title || "",
      h1: extractedContent.h1 || "",
      h2: extractedContent.h2 || [],
      h3: extractedContent.h3 || [],
      description: extractedContent.description || "",
      type: extractedContent.type || "general",
      text: extractedContent.text,
      wordCount: extractedContent.wordCount,
      vector: embRes.data[0].embedding,
      indexedAt: new Date().toISOString(),
    };

    if (courses.length > 0) {
      pageData.courses = courses;
    }

    console.log(`   ✅ הושלם בהצלחה`);
    return pageData;

  } catch (err) {
    console.error(`   ❌ שגיאה: ${err.message}`);
    return null;
  }
}

// ============================================
// 💾 שמירה ב-GitHub
// ============================================
async function uploadToGitHub(filePath, commitMessage) {
  if (!CONFIG.GITHUB_TOKEN || !CONFIG.GITHUB_REPO) {
    console.log(`⚠️ GitHub לא מוגדר - דילוג על העלאה`);
    return true;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const base64Content = Buffer.from(content).toString("base64");
    const relativePath = filePath.replace(process.cwd() + "/", "");

    const owner = CONFIG.GITHUB_REPO.split("/")[0];
    const repo = CONFIG.GITHUB_REPO.split("/")[1];
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${relativePath}`;

    let sha = null;
    try {
      const getRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${CONFIG.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      }
    } catch (err) {}

    const body = {
      message: commitMessage,
      content: base64Content,
      branch: CONFIG.GITHUB_BRANCH,
    };

    if (sha) {
      body.sha = sha;
    }

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CONFIG.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (putRes.ok) {
      console.log(`✅ הועלה ל-GitHub: ${relativePath}`);
      return true;
    } else {
      const errorText = await putRes.text();
      console.error(`❌ שגיאה בהעלאה ל-GitHub: ${putRes.status}`);
      console.error(`   ${errorText.substring(0, 200)}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ שגיאה בהעלאה ל-GitHub: ${err.message}`);
    return false;
  }
}

// ============================================
// 🔄 אינדוקס אוטומטי (משופר - תיקון לולאה!)
// ============================================
async function buildIndex(name, sitemapUrl, batchSize, manualPages = []) {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);

  // טעינת done list
  let done = [];
  if (fs.existsSync(donePath)) {
    try {
      done = JSON.parse(fs.readFileSync(donePath, "utf8"));
      console.log(`📂 נטען done.json: ${done.length} דפים`);
    } catch (err) {
      console.log(`⚠️ שגיאה בטעינת done.json: ${err.message}`);
    }
  }

  // טעינת אינדקס קיים
  let pages = [];
  if (fs.existsSync(indexPath)) {
    try {
      pages = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      console.log(`📂 נטען אינדקס קיים: ${pages.length} דפים`);
    } catch (err) {
      console.log(`⚠️ שגיאה בטעינת אינדקס: ${err.message}`);
    }
  }

  // קבלת URLs מה-sitemap
  const allUrls = await getUrlsFromSitemap(sitemapUrl);
  if (allUrls.length === 0) {
    console.error("❌ לא נמצאו URLs בsitemap");
    return false;
  }

  // הוספת דפים ידניים
  const combinedUrls = [...new Set([...manualPages, ...allUrls])];
  console.log(`📝 סה"כ URLs: ${combinedUrls.length} (כולל ${manualPages.length} ידניים)`);

  // סינון דפים שכבר עובדו
  const pending = combinedUrls.filter((u) => !done.includes(u));
  console.log(`⏳ נותרו לעיבוד: ${pending.length}`);

  if (pending.length === 0) {
    console.log(`✅ כל הדפים כבר עובדו!`);
    return false;
  }

  // בחירת batch
  const batch = pending.slice(0, batchSize);
  console.log(`\n🎯 מעבד ${batch.length} דפים בסבב זה...\n`);

  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;

  // עיבוד כל דף ב-batch
  for (let i = 0; i < batch.length; i++) {
    const url = batch[i];
    console.log(`\n[${i + 1}/${batch.length}] ${url}`);

    const result = await processPage(url);

    if (!result) {
      failCount++;
    } else if (result === "404") {
      notFoundCount++;
      done.push(url);
    } else {
      const existingIndex = pages.findIndex((p) => p.url === url);
      if (existingIndex >= 0) {
        pages[existingIndex] = result;
      } else {
        pages.push(result);
      }
      done.push(url);
      successCount++;
    }

    // שמירה מיידית
    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));

    // המתנה בין דפים
    if (i < batch.length - 1) {
      const waitTime = 2000 + Math.random() * 3000;
      await delay(waitTime);
    }
  }

  // פיצול לחלקים והעלאה
  console.log(`\n📦 מפצל לחלקים...`);
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }

  console.log(`\n📤 מעלה ${chunks.length} חלקים ל-GitHub...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(
      chunkPath,
      `🔄 ${name} - אינדוקס אוטומטי - חלק ${i + 1}/${chunks.length}`
    );
  }

  await uploadToGitHub(donePath, `📊 ${name} - דפים שהושלמו`);

  // סיכום
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 סיכום סבב:`);
  console.log(`   ✅ הצליחו: ${successCount}`);
  console.log(`   🚫 404: ${notFoundCount}`);
  console.log(`   ⚠️ כשלו: ${failCount}`);
  console.log(`   📈 סה"כ באינדקס: ${pages.length}`);
  console.log(`   ⏳ נותרו: ${pending.length - batch.length}`);
  console.log(`${"=".repeat(60)}\n`);

  // **תיקון לולאה אינסופית!**
  const remainingPending = pending.length - batch.length;
  const shouldContinue = remainingPending > 0 && successCount > 0;
  
  if (!shouldContinue && successCount === 0) {
    console.log(`⚠️ אזהרה: כל הניסיונות בסבב זה נכשלו - עוצר!`);
  }
  
  return shouldContinue;
}

// ============================================
// 🚀 ריצה מלאה
// ============================================
export async function runFullIndexing(name, sitemapUrl, batchSize = CONFIG.BATCH_SIZE) {
  console.log(`\n🏁 מתחיל אינדוקס מלא ל-${name}\n`);

  console.log(`📘 נוספו ${STATIC_INFO_PAGES.length} דפי מידע ידניים\n`);

  let round = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`\n🔄 סבב ${round}`);
    hasMore = await buildIndex(name, sitemapUrl, batchSize, STATIC_INFO_PAGES);

    if (hasMore) {
      const waitTime = 8000 + Math.random() * 4000;
      console.log(`⏳ ממתין ${Math.round(waitTime / 1000)}s לפני הסבב הבא...\n`);
      await delay(waitTime);
      round++;
    }
  }

  console.log(`\n🎉 אינדוקס ${name} הסתיים בהצלחה!\n`);
}

// ============================================
// 📄 עדכון דפים סטטיים בלבד
// ============================================
export async function updateStaticPages(name) {
  console.log(`\n📄 מעדכן דפים סטטיים בלבד...\n`);
  console.log(`   📝 ${STATIC_INFO_PAGES.length} דפים לעדכון`);
  
  const dataDir = path.join(process.cwd(), "data");
  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);
  
  // טעינת אינדקס קיים
  let pages = [];
  if (fs.existsSync(indexPath)) {
    try {
      pages = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      console.log(`📂 נטען אינדקס קיים עם ${pages.length} דפים`);
    } catch (err) {
      console.log(`⚠️ שגיאה בטעינת אינדקס: ${err.message}`);
    }
  }
  
  // טעינת done list
  let done = [];
  if (fs.existsSync(donePath)) {
    try {
      done = JSON.parse(fs.readFileSync(donePath, "utf8"));
    } catch (err) {}
  }
  
  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;
  
  // עיבוד כל דף סטטי
  for (let i = 0; i < STATIC_INFO_PAGES.length; i++) {
    const url = STATIC_INFO_PAGES[i];
    console.log(`\n[${i + 1}/${STATIC_INFO_PAGES.length}] ${url}`);
    
    // בדיקה אם הדף כבר באינדקס
    const existingIndex = pages.findIndex(p => p.url === url);
    
    // עיבוד הדף
    const result = await processPage(url);
    
    if (!result) {
      console.log(`❌ כישלון בעיבוד`);
      failCount++;
    } else if (result === "404") {
      console.log(`🚫 דף לא נמצא (404)`);
      if (existingIndex >= 0) {
        pages.splice(existingIndex, 1);
        console.log(`🗑️ הוסר מהאינדקס`);
      }
      const doneIndex = done.indexOf(url);
      if (doneIndex >= 0) {
        done.splice(doneIndex, 1);
      }
      notFoundCount++;
    } else {
      if (existingIndex >= 0) {
        pages[existingIndex] = result;
        console.log(`✅ דף עודכן`);
      } else {
        pages.push(result);
        console.log(`✅ דף נוסף`);
      }
      
      if (!done.includes(url)) {
        done.push(url);
      }
      successCount++;
    }
    
    // שמירה מיידית
    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
    
    // המתנה קצרה
    if (i < STATIC_INFO_PAGES.length - 1) {
      await delay(1000 + Math.random() * 1000);
    }
  }
  
  // פיצול והעלאה
  console.log(`\n📦 מפצל לחלקים...`);
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }
  
  console.log(`\n📤 מעלה ${chunks.length} חלקים ל-GitHub...`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(
      chunkPath,
      `📄 ${name} - עדכון דפים סטטיים - חלק ${i + 1}/${chunks.length}`
    );
  }
  
  await uploadToGitHub(donePath, `📊 ${name} - דפים שהושלמו (עדכון סטטי)`);
  
  // סיכום
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 סיכום עדכון דפים סטטיים:`);
  console.log(`   ✅ הצליחו: ${successCount}`);
  console.log(`   🚫 404: ${notFoundCount}`);
  console.log(`   ⚠️ כשלו: ${failCount}`);
  console.log(`   📚 סה"כ באינדקס: ${pages.length}`);
  console.log(`${"=".repeat(60)}\n`);
  
  return true;
}

// ============================================
// 🏫 עדכון דפי מוסדות בלבד (חדש!)
// ============================================
export async function updateInstitutionPages(name, sitemapUrl) {
  console.log(`\n🏫 מעדכן דפי מוסדות בלבד...\n`);
  
  const dataDir = path.join(process.cwd(), "data");
  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);
  
  // טעינת אינדקס קיים
  let pages = [];
  if (fs.existsSync(indexPath)) {
    try {
      pages = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      console.log(`📂 נטען אינדקס קיים עם ${pages.length} דפים`);
    } catch (err) {
      console.log(`⚠️ שגיאה בטעינת אינדקס: ${err.message}`);
    }
  }
  
  // טעינת done list
  let done = [];
  if (fs.existsSync(donePath)) {
    try {
      done = JSON.parse(fs.readFileSync(donePath, "utf8"));
    } catch (err) {}
  }
  
  // קבלת כל ה-URLs מה-sitemap
  const allUrls = await getUrlsFromSitemap(sitemapUrl);
  if (allUrls.length === 0) {
    console.error("❌ לא נמצאו URLs בsitemap");
    return false;
  }
  
  // סינון רק דפי מוסדות
  const institutionUrls = allUrls.filter(url => {
    // לא דף מידע סטטי
    if (STATIC_INFO_PAGES.includes(url)) return false;
    
    // לא דף דינמי
    if (url.includes('/results-') || 
        url.includes('/search-results-') || 
        url.includes('/courses-per-month-')) return false;
    
    // לא דף להתעלם
    if (isExcludedUrl(url)) return false;
    
    // הכל השאר = דף מוסד
    return true;
  });
  
  console.log(`🏫 נמצאו ${institutionUrls.length} דפי מוסדות`);
  
  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;
  
  // עיבוד כל דף מוסד
  for (let i = 0; i < institutionUrls.length; i++) {
    const url = institutionUrls[i];
    console.log(`\n[${i + 1}/${institutionUrls.length}] ${url}`);
    
    const existingIndex = pages.findIndex(p => p.url === url);
    const result = await processPage(url);
    
    if (!result) {
      console.log(`❌ כישלון בעיבוד`);
      failCount++;
    } else if (result === "404") {
      console.log(`🚫 דף לא נמצא (404)`);
      if (existingIndex >= 0) {
        pages.splice(existingIndex, 1);
        console.log(`🗑️ הוסר מהאינדקס`);
      }
      const doneIndex = done.indexOf(url);
      if (doneIndex >= 0) {
        done.splice(doneIndex, 1);
      }
      notFoundCount++;
    } else {
      if (existingIndex >= 0) {
        pages[existingIndex] = result;
        console.log(`✅ דף עודכן`);
      } else {
        pages.push(result);
        console.log(`✅ דף נוסף`);
      }
      
      if (!done.includes(url)) {
        done.push(url);
      }
      successCount++;
    }
    
    // שמירה מיידית
    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
    
    // המתנה בין דפים
    if (i < institutionUrls.length - 1) {
      const waitTime = 2000 + Math.random() * 2000;
      await delay(waitTime);
    }
  }
  
  // פיצול והעלאה
  console.log(`\n📦 מפצל לחלקים...`);
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }
  
  console.log(`\n📤 מעלה ${chunks.length} חלקים ל-GitHub...`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(
      chunkPath,
      `🏫 ${name} - עדכון דפי מוסדות - חלק ${i + 1}/${chunks.length}`
    );
  }
  
  await uploadToGitHub(donePath, `📊 ${name} - דפים שהושלמו (עדכון מוסדות)`);
  
  // סיכום
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 סיכום עדכון דפי מוסדות:`);
  console.log(`   ✅ הצליחו: ${successCount}`);
  console.log(`   🚫 404: ${notFoundCount}`);
  console.log(`   ⚠️ כשלו: ${failCount}`);
  console.log(`   📚 סה"כ באינדקס: ${pages.length}`);
  console.log(`${"=".repeat(60)}\n`);
  
  return true;
}

// ============================================
// 🎯 עדכון דף בודד
// ============================================
export async function updateSingleUrl(name, url) {
  console.log(`\n🎯 מעדכן דף בודד: ${url}\n`);
  
  const dataDir = path.join(process.cwd(), "data");
  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);
  
  // טעינת אינדקס קיים
  let pages = [];
  if (fs.existsSync(indexPath)) {
    try {
      const indexContent = fs.readFileSync(indexPath, "utf8");
      pages = JSON.parse(indexContent);
      console.log(`📂 נטען אינדקס קיים עם ${pages.length} דפים`);
    } catch (err) {
      console.log(`⚠️ שגיאה בטעינת אינדקס: ${err.message}`);
    }
  }
  
  // טעינת done list
  let done = [];
  if (fs.existsSync(donePath)) {
    try {
      done = JSON.parse(fs.readFileSync(donePath, "utf8"));
    } catch (err) {}
  }
  
  // בדיקה אם הדף כבר באינדקס
  const existingIndex = pages.findIndex(p => p.url === url);
  if (existingIndex >= 0) {
    console.log(`📝 דף נמצא באינדקס במיקום ${existingIndex}, מעדכן...`);
  } else {
    console.log(`➕ דף חדש, מוסיף לאינדקס...`);
  }
  
  // עיבוד הדף
  console.log(`\n⚙️ מעבד דף...`);
  const result = await processPage(url);
  
  if (!result) {
    console.log(`❌ כישלון בעיבוד הדף`);
    return false;
  }
  
  if (result === "404") {
    console.log(`🚫 דף לא נמצא (404)`);
    if (existingIndex >= 0) {
      pages.splice(existingIndex, 1);
      console.log(`🗑️ הדף הוסר מהאינדקס`);
    }
    const doneIndex = done.indexOf(url);
    if (doneIndex >= 0) {
      done.splice(doneIndex, 1);
    }
  } else {
    if (existingIndex >= 0) {
      pages[existingIndex] = result;
      console.log(`✅ דף עודכן בהצלחה`);
    } else {
      pages.push(result);
      console.log(`✅ דף נוסף בהצלחה`);
    }
    
    if (!done.includes(url)) {
      done.push(url);
    }
  }
  
  // שמירה מקומית
  fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
  fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
  console.log(`💾 נשמר מקומית`);
  
  // פיצול לחלקים והעלאה
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }
  
  console.log(`\n📤 מעלה ${chunks.length} חלקים ל-GitHub...`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(
      chunkPath,
      `🔄 ${name} - עדכון דף בודד - חלק ${i + 1}/${chunks.length}`
    );
  }
  
  await uploadToGitHub(donePath, `📊 ${name} - דפים שהושלמו (עדכון)`);
  
  console.log(`\n✅ דף עודכן בהצלחה!`);
  console.log(`   📄 URL: ${url}`);
  console.log(`   📚 סה"כ דפים באינדקס: ${pages.length}`);
  
  return true;
}

// ============================================
// 🎯 ריצה ישירה מ-CLI (מעודכן!)
// ============================================
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const name = process.argv[2] || "Shabaton";
    const urlOrSitemap = process.argv[3] || "https://www.shabaton.online/sitemap.xml";
    const batchSize = Number(process.env.BATCH_SIZE) || CONFIG.BATCH_SIZE;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 ריצה ישירה של אינדוקס`);
    console.log(`   📛 שם: ${name}`);
    
    // זיהוי אם זה URL בודד או sitemap
    const isSingleUrl = !urlOrSitemap.includes('sitemap') && 
                        !urlOrSitemap.endsWith('.xml') &&
                        urlOrSitemap.startsWith('http');
    
    if (isSingleUrl) {
      console.log(`   🎯 מצב: עדכון דף בודד`);
      console.log(`   🌐 URL: ${urlOrSitemap}`);
      console.log(`${"=".repeat(60)}\n`);
      
      await updateSingleUrl(name, urlOrSitemap);
    } else {
      console.log(`   🌐 Sitemap: ${urlOrSitemap}`);
      console.log(`   📦 גודל Batch: ${batchSize}`);
      console.log(`${"=".repeat(60)}\n`);
      
      await runFullIndexing(name, urlOrSitemap, batchSize);
    }
  })();
}
