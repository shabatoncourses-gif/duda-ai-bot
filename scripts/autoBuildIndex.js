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
        // בדיקת סינון
        const lower = url.toLowerCase();
        
        // גם נבדוק את הגרסה עם רווחים (במקום %20)
        const withSpaces = lower.replace(/%20/g, ' ');
        
        return !lower.includes("/tag/") && 
               !lower.includes("/author/") &&
               !lower.includes("/page/") &&
               !lower.includes("mosad-index") &&
               !lower.includes("/contact-us-phone") &&
               !withSpaces.includes("/tag/") && 
               !withSpaces.includes("/author/") &&
               !withSpaces.includes("/page/") &&
               !withSpaces.includes("mosad-index") &&
               !withSpaces.includes("/contact-us-phone");
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
async function safeFetch(url, retries = CONFIG.RETRY_ATTEMPTS) {
  const cleanUrl = normalizeUrl(url);
  
  // בדיקה אם זה דף Duda דינמי
  const isDudaDynamic = 
    cleanUrl.includes('results-') || 
    cleanUrl.includes('search-results-') || 
    cleanUrl.includes('courses-per-month');
  
  // אם זה Duda דינמי - השתמש ב-Puppeteer
  if (isDudaDynamic) {
    console.log(`   🔍 זוהה כדף Duda דינמי - משתמש ב-Puppeteer`);
    return await fetchDudaPageWithPuppeteer(cleanUrl);
  }
  
  // אחרת - fetch רגיל
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(cleanUrl, {
        headers: {
          "User-Agent": getRandomUA(),
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "he,en-US;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (res.status === 404) {
        console.log(`🚫 404: ${cleanUrl.substring(0, 70)}...`);
        return { status: 404, ok: false };
      }

      if (res.status === 403 || res.status === 429) {
        const waitTime = Math.pow(2, attempt) * 2000 + Math.random() * 2000;
        console.warn(`⏸️ חסימה (${res.status}), ממתין ${Math.round(waitTime/1000)}s...`);
        await delay(waitTime);
        continue;
      }

      if (res.status >= 500) {
        throw new Error(`שגיאת שרת ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return res;

    } catch (err) {
      const isLastAttempt = attempt === retries;
      console.warn(
        `⚠️ ניסיון ${attempt}/${retries} נכשל: ${err.message}`
      );

      if (!isLastAttempt) {
        const waitTime = Math.pow(2, attempt) * CONFIG.BASE_DELAY + Math.random() * 2000;
        await delay(waitTime);
      }
    }
  }

  // ניסיון אחרון דרך proxy
  console.log(`🔁 proxy...`);
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
    const proxyRes = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(45000),
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      return {
        ok: true,
        text: async () => json.contents,
        status: 200,
      };
    }
  } catch (proxyErr) {
    console.error(`❌ proxy failed: ${proxyErr.message}`);
  }

  return null;
}

// ============================================
// 🧠 זיהוי חכם של סוג דף
// ============================================

// פונקציה לחילוץ אזור ושאילתה מ-URL
function extractRegionAndQuery(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // בדיקה אם זה דף results
    const resultsMatch = pathname.match(/\/(results-all|search-results-merkaz|results-Zafon|results-Sharon|results-jerusalem|results-shfea-darom)\/(.*)/i);
    
    if (resultsMatch) {
      const pathPart = resultsMatch[1].toLowerCase();
      let region = '';
      
      // זיהוי האזור
      if (pathPart.includes('all')) region = 'all';
      else if (pathPart.includes('merkaz')) region = 'merkaz';
      else if (pathPart.includes('zafon')) region = 'zafon';
      else if (pathPart.includes('sharon')) region = 'sharon';
      else if (pathPart.includes('jerusalem')) region = 'jerusalem';
      else if (pathPart.includes('shfea-darom')) region = 'shfea-darom';
      
      // חילוץ השאילתה (החלק אחרי האזור)
      let query = resultsMatch[2] || '';
      
      // פענוח אם צריך
      try {
        query = decodeURIComponent(query).replace(/%20/g, ' ').trim();
      } catch {
        query = query.replace(/%20/g, ' ').trim();
      }
      
      return {
        isResultsPage: true,
        region: region,
        regionHebrew: REGION_MAP[region] || region,
        query: query
      };
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

  // דף מוסד לימוד - זיהוי משופר
  // בדיקה אם יש שם מוסד ב-URL או אם יש הרבה קישורים/כותרות
  const hasInstitutionPattern = 
    path.includes("-edu") || 
    path.includes("-college") || 
    path.includes("-university") ||
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

  // הסרת קטגוריות וקישורים פנימיים
  $("p, div, span").each((_, el) => {
    const text = $(el).text();
    if (
      text.includes("קורסים נוספים") ||
      text.includes("קטגוריות") ||
      text.includes("תגיות") ||
      (text.includes("קורסי") && text.length < 200 && $(el).find("a").length > 3)
    ) {
      $(el).remove();
    }
  });

  // הסרת meta keywords
  $('meta[name="keywords"]').remove();

  return $;
}

// ============================================
// 📝 חילוץ תוכן מתקדם
// ============================================
function extractSmartContent(html, url) {
  let $ = cheerio.load(html);
  $ = cleanDom($);

  const pageType = identifyPageType(url, $);

  // חילוץ מטא-דאטה
  const title = removeIgnoredText($("title").text().trim());
  const description = removeIgnoredText($('meta[name="description"]').attr("content")?.trim() || "");
  const h1 = removeIgnoredText($("h1").first().text().trim());
  
  const h2s = $("h2")
    .map((_, el) => removeIgnoredText($(el).text().trim()))
    .get()
    .filter((t) => t.length > 3);
  
  const h3s = $("h3")
    .map((_, el) => removeIgnoredText($(el).text().trim()))
    .get()
    .filter((t) => t.length > 3);

  // **חילוץ מיוחד לדפי Duda דינמיים**
  const isDudaPage = 
    url.includes("courses-per-month") || 
    url.includes("results-") ||
    url.includes("search-results-") ||
    pageType === "institution-page" ||
    pageType === "course-list";
  
  let dudaContent = [];
  let institutions = [];
  let coursesByInstitution = {};
  
  if (isDudaPage) {
    // **זיהוי דפי results/month - יש להם מבנה מיוחד**
    const isResultsOrMonth = url.includes("results-") || url.includes("search-results-") || url.includes("courses-per-month");
    
    if (isResultsOrMonth) {
      console.log(`   🔍 מחלץ מוסדות מדף Duda דינמי (results/month)...`);
      
      // טעינה מחדש של Cheerio עם ה-HTML המקורי (לפני cleanDom)
      // כדי לשמור על המבנה הדינמי
      const $fresh = cheerio.load(html);
      
      // Debug logs
      console.log(`   📝 אורך HTML: ${html.length} תווים`);
      console.log(`   📝 האם יש li.listItem בHTML: ${html.includes('class="listItem"')}`);
      console.log(`   📝 האם יש span.itemName בHTML: ${html.includes('class="itemName"')}`);
      console.log(`   📝 מספר li.listItem ב-Cheerio טרי: ${$fresh("li.listItem").length}`);
      console.log(`   📝 מספר span.itemName ב-Cheerio טרי: ${$fresh("span.itemName").length}`);
      
      // אסטרטגיה 1: מבנה Duda הסטנדרטי - li.listItem
      $fresh("li.listItem").each((_, el) => {
        const $item = $fresh(el);
        
        // חילוץ שם המוסד
        const institutionName = removeIgnoredText($item.find("span.itemName").first().text().trim());
        
        if (institutionName && institutionName.length > 5) {
          if (!institutions.includes(institutionName)) {
            institutions.push(institutionName);
            coursesByInstitution[institutionName] = [];
          }
          
          // חילוץ קורסים מ-itemText
          // חשוב! צריך .html() לא .text() כדי לשמור על <br>
          const coursesHTML = $item.find("span.itemText").html() || '';
          
          if (coursesHTML) {
            // פיצול לפי <br> tags
            const coursesList = coursesHTML
              .split(/<br\s*\/?>/i)  // פיצול לפי <br> או <br/>
              .map(c => {
                // הסרת tags אחרים והסרת רווחים
                return removeIgnoredText($fresh('<div>').html(c).text().trim());
              })
              .filter(c => c.length > 5);  // רק קורסים אמיתיים
            
            console.log(`      - ${institutionName.substring(0, 40)}: נמצאו ${coursesList.length} קורסים`);
            coursesByInstitution[institutionName].push(...coursesList);
          }
        }
      });
      
      console.log(`   📊 נמצאו ${institutions.length} מוסדות דרך li.listItem`);
      
      // אסטרטגיה 2: אם אין li.listItem, נסה H2 + UL (מבנה ישן יותר)
      if (institutions.length === 0) {
        console.log(`   🔄 מנסה אסטרטגיה 2: H2 + UL...`);
        
        $("h2").each((_, el) => {
          const institutionName = removeIgnoredText($(el).text().trim());
          
          if (institutionName && 
              institutionName.length > 5 && 
              institutionName.length < 150 &&
              !institutionName.includes("קורסים") &&
              !institutionName.includes("תוצאות") &&
              !institutionName.includes("לפי")) {
            
            if (!institutions.includes(institutionName)) {
              institutions.push(institutionName);
              coursesByInstitution[institutionName] = [];
            }
            
            // חילוץ קורסים מה-UL הבא
            $(el).nextAll("ul").first().find("li").each((_, li) => {
              const courseText = removeIgnoredText($(li).text().trim());
              if (courseText && courseText.length > 10) {
                coursesByInstitution[institutionName].push(courseText);
              }
            });
          }
        });
        
        console.log(`   📊 נמצאו ${institutions.length} מוסדות דרך H2`);
      }
      
      // אסטרטגיה 3: חיפוש גנרי - span עם מילות מפתח
      if (institutions.length === 0) {
        console.log(`   🔄 מנסה אסטרטגיה 3: span עם מילות מפתח...`);
        
        $("span, strong, h3, h4").each((_, el) => {
          const text = removeIgnoredText($(el).text().trim());
          
          if (text && 
              text.length > 5 && 
              text.length < 150 &&
              (text.includes("אוניברסיט") || text.includes("מכללה") || 
               text.includes("מכון") || text.includes("סמינר") ||
               text.includes("המרכז ל") || text.includes("בית ספר ל"))) {
            
            if (!institutions.includes(text)) {
              institutions.push(text);
              coursesByInstitution[text] = [];
            }
          }
        });
        
        console.log(`   📊 נמצאו ${institutions.length} מוסדות דרך span/strong`);
      }
      
      // אסטרטגיה 4 (fallback): אם אין כלום, נאסוף קורסים
      if (institutions.length === 0) {
        console.log(`   ⚠️ לא נמצאו מוסדות - אוסף קורסים כללי`);
        
        institutions.push("קורסים זמינים");
        coursesByInstitution["קורסים זמינים"] = [];
        
        $("a").each((_, el) => {
          const linkText = removeIgnoredText($(el).text().trim());
          const href = $(el).attr("href") || "";
          
          if (linkText && 
              linkText.length > 15 && 
              linkText.length < 300 &&
              !linkText.includes("קרא עוד") && 
              !linkText.includes("לפרטים") &&
              !linkText.includes("עמוד הבית") &&
              href.includes("/")) {
            coursesByInstitution["קורסים זמינים"].push(linkText);
          }
        });
      }
      
      // בניית תוכן
      console.log(`   ✅ סה"כ ${institutions.length} מוסדות`);
      institutions.forEach(inst => {
        dudaContent.push(inst);
        const courses = coursesByInstitution[inst] || [];
        if (courses.length > 0) {
          console.log(`      - ${inst.substring(0, 60)}: ${courses.length} קורסים`);
          dudaContent.push(...courses.slice(0, 50));
        }
      });
      
    } else {
      // דפי מוסדות או דפים דינמיים אחרים - חילוץ רגיל
      $("body *").each((_, el) => {
        const text = $(el).contents().filter(function() {
          return this.type === 'text';
        }).text().trim();
        
        if (text && text.length > 5 && text.length < 500) {
          dudaContent.push(text);
        }
      });
      
      // חילוץ data attributes
      $("[data-title], [data-name], [data-description]").each((_, el) => {
        const dataTitle = $(el).attr("data-title");
        const dataName = $(el).attr("data-name");
        const dataDesc = $(el).attr("data-description");
        
        if (dataTitle) dudaContent.push(dataTitle);
        if (dataName) dudaContent.push(dataName);
        if (dataDesc) dudaContent.push(dataDesc);
      });
      
      // חילוץ קישורים
      $("a").each((_, el) => {
        const linkText = $(el).text().trim();
        if (linkText && linkText.length > 10 && linkText.length < 200) {
          dudaContent.push(linkText);
        }
      });
    }
  }

  // חילוץ רשימות (ul/ol)
  const lists = [];
  $("ul, ol").each((_, list) => {
    const items = $(list)
      .find("li")
      .map((_, li) => removeIgnoredText($(li).text().trim()))
      .get()
      .filter((t) => t.length > 10 && !t.includes("קורסים נוספים"));
    
    if (items.length > 0 && items.length < 50) {
      lists.push(...items);
    }
  });

  // חילוץ טבלאות (לדפי קורסים)
  const tables = [];
  if (pageType === "course-detail" || pageType === "institution-page" || pageType === "course-list") {
    $("table").each((_, table) => {
      const rows = $(table).find("tr");
      if (rows.length > 0 && rows.length < 50) {
        rows.each((_, row) => {
          const cells = $(row)
            .find("td, th")
            .map((_, cell) => removeIgnoredText($(cell).text().trim()))
            .get()
            .join(" | ");
          if (cells) tables.push(cells);
        });
      }
    });
  }

  // חילוץ פסקאות
  const paragraphs = [];
  $("p, blockquote, article, div.content, section").each((_, el) => {
    const text = removeIgnoredText($(el).text().trim());
    if (text.length > 20 && text.length < 2000) {
      paragraphs.push(text);
    }
  });

  // בניית טקסט סופי עם משקלות
  const parts = [];
  
  // משקל גבוה לכותרות
  if (title) parts.push(title, title);
  if (h1 && h1 !== title) parts.push(h1, h1);
  if (description) parts.push(description);
  
  // כותרות משנה
  parts.push(...h2s, ...h3s);
  
  // תוכן Duda דינמי
  if (isDudaPage && dudaContent.length > 0) {
    parts.push(...dudaContent.slice(0, 30));
  }
  
  // תוכן עיקרי
  parts.push(...lists.slice(0, 20));
  parts.push(...tables.slice(0, 15));
  parts.push(...paragraphs);

  // ניקוי והסרת כפילויות
  const uniqueParts = [...new Set(parts)].filter(Boolean);
  let cleanText = uniqueParts
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/(\||›|»|·|•|→|←)/g, " ")
    .replace(/\[.*?\]/g, "")
    .trim();

  // ניקוי סופי - הסרת המשפטים המיותרים
  cleanText = removeIgnoredText(cleanText);

  return {
    url,
    title: title || h1 || "ללא כותרת",
    h1,
    h2: institutions.length > 0 ? institutions : h2s.slice(0, 5),
    h3: h3s.slice(0, 5),
    description,
    type: pageType,
    text: cleanText.slice(0, 8000),
    wordCount: cleanText.split(/\s+/).filter(w => w.length > 0).length,
    ...(institutions.length > 0 && {
      institutions: institutions,
      totalCourses: Object.values(coursesByInstitution).flat().length
    })
  };
}

// ============================================
// 🤖 עיבוד דף בודד + Embedding
// ============================================
async function processPage(url) {
  console.log(`\n🔍 מעבד: ${url}`);

  const res = await safeFetch(url);
  
  if (!res) {
    console.log(`❌ כישלון בטעינת ${url}`);
    return null;
  }

  if (res.status === 404) {
    return "404";
  }

  const html = await res.text();
  const content = extractSmartContent(html, url);

  // בדיקות תקינות - סף נמוך במיוחד לדפי רשימות ומוסדות
  const isDynamicList = 
    content.type === "course-list" || 
    url.includes("courses-per-month") ||
    url.includes("results-");
  
  const isInstitution = content.type === "institution-page";
  const isInfoPage = content.type === "info-page";
  
  // סף נמוך במיוחד לדפי רשימות דינמיים ומוסדות
  const minLength = isDynamicList ? 10 : (isInstitution ? 15 : (isInfoPage ? 20 : 30));
  const minWords = isDynamicList ? 3 : (isInstitution ? 5 : (isInfoPage ? 8 : 10));

  if (!content.text || content.text.length < minLength) {
    console.log(`⚠️ תוכן קצר מדי (${content.text.length} תווים, מינימום ${minLength}): ${url}`);
    console.log(`   סוג דף: ${content.type}`);
    console.log(`   טקסט: "${content.text.substring(0, 150)}..."`);
    return null;
  }

  if (content.wordCount < minWords) {
    console.log(`⚠️ מעט מדי מילים (${content.wordCount}, מינימום ${minWords}): ${url}`);
    console.log(`   סוג דף: ${content.type}`);
    console.log(`   טקסט: "${content.text.substring(0, 150)}..."`);
    return null;
  }

  // יצירת embedding
  try {
    const embedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: content.text,
    });

    console.log(
      `✅ הצלחה: ${content.type} | ${content.wordCount} מילים | ${content.title.slice(0, 50)}...`
    );
    
    // הצגת מוסדות אם יש
    if (content.institutions && content.institutions.length > 0) {
      console.log(`   🏫 מוסדות: ${content.institutions.length}`);
      content.institutions.slice(0, 5).forEach(inst => {
        console.log(`      - ${inst.substring(0, 60)}`);
      });
      if (content.totalCourses) {
        console.log(`   📚 קורסים: ${content.totalCourses}`);
      }
    }

    return {
      url: content.url,
      title: content.title,
      h1: content.h1,
      h2: content.h2,
      h3: content.h3,
      description: content.description,
      type: content.type,
      text: content.text.slice(0, 500),
      vector: embedding.data[0].embedding,
      wordCount: content.wordCount,
      indexedAt: new Date().toISOString(),
    };
  } catch (embeddingError) {
    console.error(`❌ שגיאת embedding עבור ${url}: ${embeddingError.message}`);
    return null;
  }
}

// ============================================
// 📤 העלאה ל-GitHub
// ============================================
async function uploadToGitHub(filePath, message) {
  if (!CONFIG.GITHUB_TOKEN || !CONFIG.GITHUB_REPO) {
    console.warn("⚠️ חסרים פרטי GitHub - דילוג על העלאה");
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const encoded = Buffer.from(content).toString("base64");
    const fileName = path.basename(filePath);
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/data/${fileName}?ref=${CONFIG.GITHUB_BRANCH}`;

    const headers = {
      Authorization: `token ${CONFIG.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    };

    // בדיקה אם הקובץ קיים
    let sha = null;
    try {
      const existing = await fetch(url, { headers });
      if (existing.ok) {
        sha = (await existing.json()).sha;
      }
    } catch {}

    // העלאה/עדכון
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message,
        content: encoded,
        branch: CONFIG.GITHUB_BRANCH,
        ...(sha && { sha }),
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`HTTP ${res.status}: ${error}`);
    }

    console.log(`📤 הועלה ל-GitHub: ${fileName}`);
    return true;
  } catch (err) {
    console.error(`❌ שגיאת העלאה ל-GitHub: ${err.message}`);
    return false;
  }
}

// ============================================
// 🏗️ בניית אינדקס עם פיצול אוטומטי
// ============================================
export async function buildIndex(name, sitemapUrl, batchSize = CONFIG.BATCH_SIZE, manualUrls = []) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 מתחיל בניית אינדקס: ${name}`);
  console.log(`${"=".repeat(60)}`);

  // הכנת תיקיית data
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // נתיבי קבצים
  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);
  const failedPath = path.join(dataDir, `${baseName}_failed.json`);
  const notFoundPath = path.join(dataDir, `${baseName}_404.json`);

  // טעינת URLs מה-sitemap
  const sitemapUrls = await getUrlsFromSitemap(sitemapUrl);
  const allUrls = Array.from(new Set([...sitemapUrls, ...manualUrls]));

  console.log(`\n📊 סטטיסטיקה:`);
  console.log(`   • Sitemap: ${sitemapUrls.length} URLs`);
  console.log(`   • ידניים: ${manualUrls.length} URLs`);
  console.log(`   • סה"כ: ${allUrls.length} URLs`);

  let done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : [];
  let failed = fs.existsSync(failedPath) ? JSON.parse(fs.readFileSync(failedPath, "utf8")) : [];
  let notFound = fs.existsSync(notFoundPath) ? JSON.parse(fs.readFileSync(notFoundPath, "utf8")) : [];
  let pages = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : [];

  // 🔄 ניסיון חוזר ל-404
  const retry404 = process.env.RETRY_404 === "true";
  if (retry404 && notFound.length > 0) {
    console.log(`\n🔄 מנסה שוב ${notFound.length} דפים שהיו 404 בעבר...`);
    notFound = [];
    fs.writeFileSync(notFoundPath, JSON.stringify(notFound, null, 2));
  }

  // חישוב דפים ממתינים
  const pending = allUrls.filter(
    (u) => !done.includes(u) && !failed.includes(u) && !notFound.includes(u)
  );

  console.log(`\n📋 מצב נוכחי:`);
  console.log(`   ✅ הושלמו: ${done.length}`);
  console.log(`   ⏳ ממתינים: ${pending.length}`);
  console.log(`   🚫 404: ${notFound.length}`);
  console.log(`   ⚠️ כשלונות: ${failed.length}`);

  if (pending.length === 0) {
    console.log(`\n🎉 כל הדפים כבר עובדו!`);
    return false;
  }

  // עיבוד Batch נוכחי
  const batch = pending.slice(0, batchSize);
  console.log(`\n🔄 מעבד ${batch.length} דפים בסבב זה...`);

  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < batch.length; i++) {
    const url = batch[i];
    console.log(`\n[${i + 1}/${batch.length}] ${url}`);

    const result = await processPage(url);

    if (result && result !== "404") {
      pages.push(result);
      done.push(url);
      successCount++;
    } else if (result === "404") {
      notFound.push(url);
      notFoundCount++;
    } else {
      failed.push(url);
      failCount++;
    }

    // שמירה מיידית אחרי כל דף
    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
    fs.writeFileSync(failedPath, JSON.stringify(failed, null, 2));
    fs.writeFileSync(notFoundPath, JSON.stringify(notFound, null, 2));

    // המתנה קצרה בין דפים
    if (i < batch.length - 1) {
      await delay(1000 + Math.random() * 1000);
    }
  }

  // ============================================
  // 📦 פיצול לקבצים
  // ============================================
  console.log(`\n📦 מפצל לקבצים...`);
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(
      chunkPath,
      `🤖 ${name} - חלק ${i + 1}/${chunks.length} (${chunks[i].length} דפים)`
    );
  }

  // העלאת קבצי מצב
  await uploadToGitHub(donePath, `📊 ${name} - דפים שהושלמו`);
  await uploadToGitHub(failedPath, `⚠️ ${name} - כשלונות`);
  await uploadToGitHub(notFoundPath, `🚫 ${name} - 404`);

  // ============================================
  // 📊 סיכום
  // ============================================
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 סיכום סבב:`);
  console.log(`   ✅ הצליחו: ${successCount}`);
  console.log(`   🚫 404: ${notFoundCount}`);
  console.log(`   ⚠️ כשלו: ${failCount}`);
  console.log(`   📈 סה"כ באינדקס: ${pages.length}`);
  console.log(`   ⏳ נותרו: ${pending.length - batch.length}`);
  console.log(`${"=".repeat(60)}\n`);

  // האם יש עוד דפים?
  return pending.length > batchSize;
}

// ============================================
// 🔁 ריצה מלאה עם לולאה
// ============================================
export async function runFullIndexing(name, sitemapUrl, batchSize = CONFIG.BATCH_SIZE) {
  console.log(`\n🏁 מתחיל אינדוקס מלא ל-${name}\n`);

  // דפי מידע ידניים (סטטיים)
  const manualUrls = [
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

  console.log(`📘 נוספו ${manualUrls.length} דפי מידע ידניים\n`);

  let round = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`\n🔄 סבב ${round}`);
    hasMore = await buildIndex(name, sitemapUrl, batchSize, manualUrls);

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
// 🎯 ריצה ישירה מ-CLI
// ============================================
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const name = process.argv[2] || "Shabaton";
    const sitemap = process.argv[3] || "https://www.shabaton.online/sitemap.xml";
    const batchSize = Number(process.env.BATCH_SIZE) || CONFIG.BATCH_SIZE;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 ריצה ישירה של אינדוקס`);
    console.log(`   📛 שם: ${name}`);
    console.log(`   🌐 Sitemap: ${sitemap}`);
    console.log(`   📦 גודל Batch: ${batchSize}`);
    console.log(`${"=".repeat(60)}\n`);

    await runFullIndexing(name, sitemap, batchSize);
  })();
}
