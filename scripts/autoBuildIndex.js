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
// 🚫 דפים להתעלמות (EXCLUDED PAGES)
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
  "https://www.morim.boutique/art",
  "https://www.morim.boutique/empowering",
  "https://www.morim.boutique/cooking",
  "https://www.morim.boutique/trips",
  "https://www.morim.boutique/health",
  "https://www.morim.boutique/fashion",
  "https://www.morim.boutique/courses-jewelry",
  "https://www.shabaton.online/bekarov",
  "https://www.shabaton.online/tel-aviv",
  "https://www.shabaton.online/sharon",
  "https://www.shabaton.online/heifa",
  "https://www.shabaton.online/darom",
  "https://www.shabaton.online/jerusalm",
  "https://www.morim.boutique/about",
];

// פונקציה לבדיקה אם URL להתעלם
function isExcludedUrl(url) {
  if (EXCLUDED_PAGES.includes(url)) return true;
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    try {
      await page.waitForSelector('li.listItem', { timeout: 10000 });
      console.log(`   ✅ li.listItem נטען בהצלחה!`);
    } catch {
      console.log(`   ⚠️ לא נמצא li.listItem, ממשיכים`);
    }
    
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

process.on('beforeExit', async () => {
  if (browserInstance) {
    console.log('\n🔚 סוגר דפדפן...');
    await browserInstance.close();
    browserInstance = null;
  }
});

// ============================================
// 🧹 משפטים להתעלמות
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
// 🌐 טיפול ב-URLs
// ============================================
function normalizeUrl(url) {
  try {
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
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
    const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
    const urls = matches
      .map((m) => {
        let url = m[1].trim();
        
        try {
          url = url
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/ /g, '%20');
          
          return url;
        } catch (err) {
          console.warn(`⚠️ בעיה בעיבוד URL: ${url.substring(0, 60)}...`);
          return url.replace(/ /g, '%20');
        }
      })
      .filter(Boolean)
      .filter((url) => {
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
// 🔄 Fetch מתקדם עם retry + Puppeteer
// ============================================
async function fetchPageWithRetry(url, maxRetries = CONFIG.RETRY_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
// 🕵️ זיהוי דפי results - תוקן!
// ============================================
async function detectIfResultsPage(url, html) {
  try {
    const $ = cheerio.load(html);
    
    // ⚡ CRITICAL: בדיקת מבנה קודם!
    // אם יש itemName + itemText = זו רשימת מוסדות, לא results!
    const hasInstitutionStructure = 
      $("li.listItem .itemName").length > 0 && 
      $("li.listItem .itemText").length > 0;
    
    if (hasInstitutionStructure) {
      console.log(`   🏫 זוהה מבנה institution list (itemName + itemText)`);
      return { isResultsPage: false };  // זה institution list!
    }
    
    // רק אחרי שבדקנו שאין מבנה institution - בודקים URL
    if (url.includes('/results') || 
        url.includes('/search-results') || 
        url.includes('/courses-per-month')) {
      console.log(`   📋 זוהה כ-results (לפי URL)`);
      return { isResultsPage: true };
    }
    
    // בדיקה נוספת: האם יש li.listItem עם הרבה קישורים?
    const hasList = $('li.listItem').length > 0;
    
    if (hasList) {
      let avgLinksPerItem = 0;
      const items = $('li.listItem');
      
      items.each((_, item) => {
        const links = $(item).find('a').length;
        avgLinksPerItem += links;
      });
      
      avgLinksPerItem = avgLinksPerItem / items.length;
      
      if (avgLinksPerItem > 3) {
        console.log(`   📋 זוהה כ-results (ממוצע ${avgLinksPerItem.toFixed(1)} קישורים לפריט)`);
        return { isResultsPage: true };
      }
    }
    
    return { isResultsPage: false };
    
  } catch (err) {
    return { isResultsPage: false };
  }
}

function identifyPageType(url, $) {
  const lower = url.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();

  // בדיקת מבנה institution קודם!
  const hasInstitutionStructure = $("li.listItem .itemName").length > 0 && 
                                   $("li.listItem .itemText").length > 0;
  
  if (hasInstitutionStructure && $("li.listItem").length >= 1) {
    return "institution-page";
  }

  if (path.includes("/courses-per-month") || path.includes("per-month")) {
    return "course-list";
  }

  if (path.includes("/results") || path.includes("/search-results")) {
    return "course-list";
  }

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

  const hasInstitutionPattern = 
    path.includes("-edu") || 
    path.includes("-college") || 
    path.includes("-university") ||
    path.includes("_teachers") ||
    path.includes("haifa-") ||
    path.includes("tau-") ||
    path.includes("huji-") ||
    (($("ul li a").length > 5 || $("a").length > 10) && $("h2, h3").length > 2);
  
  if (hasInstitutionPattern) {
    return "institution-page";
  }

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
// 🧹 סינון אלמנטים לא רלוונטיים
// ============================================
function cleanDom($) {
  const removeSelectors = [
    "header", "footer", "nav", ".navbar", ".nav", ".menu",
    ".breadcrumb", ".breadcrumbs", ".sidebar", ".widget",
    "script", "style", "noscript", "iframe", "form",
    ".cookie", ".popup", ".modal", ".advertisement", ".ad",
    ".social-share", ".comments", ".newsletter", ".subscription",
  ];

  removeSelectors.forEach((sel) => $(sel).remove());
  return $;
}

// ============================================
// 📝 חילוץ תוכן מתקדם - תוקן!
// ============================================
function extractSmartContent(html, url) {
  let $ = cheerio.load(html);
  $ = cleanDom($);

  const pageType = identifyPageType(url, $);

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
    // ⚡ בדיקת מבנה institution
    const hasInstitutionStructure = 
      $("li.listItem .itemName").length > 0 && 
      $("li.listItem .itemText").length > 0;
    
    // אם יש מבנה institution - מחלצים מוסדות!
    if (hasInstitutionStructure) {
      console.log(`   🔍 מחלץ רשימת מוסדות (institution list)...`);
      
      const $fresh = cheerio.load(html);
      
      console.log(`   📝 אורך HTML: ${html.length} תווים`);
      console.log(`   📝 מספר li.listItem: ${$fresh("li.listItem").length}`);
      console.log(`   📝 מספר span.itemName: ${$fresh("span.itemName").length}`);
      
      $fresh("li.listItem").each((_, el) => {
        const $item = $fresh(el);
        
        const institutionName = removeIgnoredText($item.find("span.itemName").first().text().trim());
        
        if (institutionName && institutionName.length > 5) {
          if (!institutions.includes(institutionName)) {
            institutions.push(institutionName);
            coursesByInstitution[institutionName] = [];
          }
          
          const coursesHTML = $item.find("span.itemText").html() || '';
          
          if (coursesHTML) {
            const coursesList = coursesHTML
              .split(/<br\s*\/?.*?>/i)
              .map(c => {
                return removeIgnoredText($fresh('<div>').html(c).text().trim());
              })
              .filter(c => c.length > 5);
            
            console.log(`      - ${institutionName.substring(0, 40)}: ${coursesList.length} קורסים`);
            coursesByInstitution[institutionName].push(...coursesList);
          }
        }
      });
      
      console.log(`   📊 נמצאו ${institutions.length} מוסדות`);
      
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
      // דפים דינמיים אחרים (ללא מבנה institution)
      $("body *").each((_, el) => {
        const text = $(el).contents().filter(function() {
          return this.type === 'text';
        }).text().trim();
        
        if (text && text.length > 5 && text.length < 500) {
          dudaContent.push(text);
        }
      });
      
      $("[data-title], [data-name], [data-description]").each((_, el) => {
        const dataTitle = $(el).attr("data-title");
        const dataName = $(el).attr("data-name");
        const dataDesc = $(el).attr("data-description");
        
        if (dataTitle) dudaContent.push(dataTitle);
        if (dataName) dudaContent.push(dataName);
        if (dataDesc) dudaContent.push(dataDesc);
      });
      
      $("a").each((_, el) => {
        const linkText = $(el).text().trim();
        if (linkText && linkText.length > 10 && linkText.length < 200) {
          dudaContent.push(linkText);
        }
      });
    }
  }

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

  const paragraphs = [];
  $("p, blockquote, article, div.content, section").each((_, el) => {
    const text = removeIgnoredText($(el).text().trim());
    if (text.length > 20 && text.length < 2000) {
      paragraphs.push(text);
    }
  });

  const parts = [];
  
  if (title) parts.push(title, title);
  if (h1 && h1 !== title) parts.push(h1, h1);
  if (description) parts.push(description);
  
  parts.push(...h2s, ...h3s);
  
  if (isDudaPage && dudaContent.length > 0) {
    parts.push(...dudaContent.slice(0, 30));
  }
  
  parts.push(...lists.slice(0, 20));
  parts.push(...tables.slice(0, 15));
  parts.push(...paragraphs);

  const uniqueParts = [...new Set(parts)].filter(Boolean);
  let cleanText = uniqueParts
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/(\||›|»|·|•|→|←)/g, " ")
    .replace(/\[.*?\]/g, "")
    .trim();

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
// 📊 טיפול בדפי RESULTS (לא בשימוש כרגע)
// ============================================
function extractResultsPageCourses(html) {
  const $ = cheerio.load(html);
  const courses = [];

  console.log(`   🔍 מחפש li.listItem...`);
  const listItems = $("li.listItem");
  console.log(`   📦 נמצאו ${listItems.length} פריטים`);

  listItems.each((idx, item) => {
    try {
      const $item = $(item);
      
      console.log(`\n   📌 פריט ${idx + 1}/${listItems.length}:`);

      const courseName = $item.find("h3, .course-title, .dmNewParagraph").first().text().trim();
      
      if (!courseName || courseName.length < 5) {
        console.log(`      ⚠️ אין שם קורס`);
        return;
      }
      
      console.log(`      📚 קורס: ${courseName.substring(0, 60)}`);
      
      const institutions = [];
      
      console.log(`      🔗 מחפש קישורים...`);
      const links = $item.find("a");
      console.log(`         מצאתי ${links.length} קישורים`);
      
      links.each((_, link) => {
        const linkText = $(link).text().trim();
        
        if (linkText && 
            linkText.length > 3 && 
            linkText.length < 100 &&
            !linkText.includes("לפרטים") &&
            !linkText.includes("more") &&
            !linkText.includes("קרא עוד") &&
            linkText !== courseName) {
          
          institutions.push(linkText);
          console.log(`         ✅ ${linkText.substring(0, 40)}`);
        }
      });
      
      console.log(`      📊 סה"כ מקישורים: ${institutions.length}`);
      
      if (institutions.length < 2) {
        console.log(`      💡 מנסה שיטה 2 (טקסטים)...`);
        
        const textElements = $item.find("span, div, p");
        
        textElements.each((_, el) => {
          const text = $(el).text().trim();
          
          if (text && 
              text.length > 5 && 
              text.length < 150 &&
              !text.includes(courseName) &&
              !text.match(/^\d+$/) &&
              !text.match(/^\d{1,2}[\/\-\.]\d{1,2}/)) {
            
            const looksLikeInstitution = 
              text.includes("אוניברסיטת") || 
              text.includes("מכללת") ||
              text.includes("המכללה") ||
              text.includes("האוניברסיטה") ||
              text.includes("בית") ||
              text.includes("סמינר") ||
              text.includes("המרכז") ||
              text.length > 15;
            
            if (looksLikeInstitution && !institutions.includes(text)) {
              institutions.push(text);
              console.log(`         ✅ ${text.substring(0, 40)}`);
            }
          }
        });
      }

      let dates = [];
      $item.find("p, span, div").each((_, el) => {
        const text = $(el).text();
        const dateMatches = text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g);
        if (dateMatches) {
          dates.push(...dateMatches);
        }
      });

      if (institutions.length > 0) {
        courses.push({
          courseName,
          institutions: institutions.slice(0, 11),
          institutionCount: institutions.length,
          dates: dates.length > 0 ? dates : [],
        });
        console.log(`      ✅ נוסף עם ${institutions.length} מוסדות`);
      } else {
        console.log(`      ❌ לא נמצאו מוסדות`);
      }
      
    } catch (err) {
      console.error(`      ⚠️ שגיאה: ${err.message}`);
    }
  });

  console.log(`\n   📊 סיכום: ${courses.length} קורסים`);
  
  if (courses.length > 0) {
    console.log(`\n   📋 קורסים שחולצו:`);
    courses.slice(0, 3).forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.courseName.substring(0, 50)}`);
      console.log(`         מוסדות (${c.institutionCount}): ${c.institutions.slice(0, 3).join(", ")}`);
    });
  }
  
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
      console.log(`   ❌ כישלון בטעינה`);
      return null;
    }

    if (response.status === 404) {
      console.log(`   🚫 404`);
      return "404";
    }

    const html = await response.text();
    const detectionResult = await detectIfResultsPage(url, html);

    let extractedContent;

    if (detectionResult.isResultsPage) {
      console.log(`   📋 דף results (ללא מבנה institution)`);
      extractedContent = extractSmartContent(html, url);
      // אין courses כי זה לא באמת results - זה institution list
    } else {
      console.log(`   📄 דף רגיל (או institution list)`);
      extractedContent = extractSmartContent(html, url);
    }

    if (!extractedContent.text || extractedContent.text.length < 50) {
      console.log(`   ⚠️ אין תוכן (${extractedContent.text.length} תווים)`);
      return null;
    }

    console.log(`   📝 ${extractedContent.wordCount} מילים | ${extractedContent.text.length} תווים`);

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

    // אם יש institutions (מ-extractSmartContent)
    if (extractedContent.institutions && extractedContent.institutions.length > 0) {
      pageData.institutions = extractedContent.institutions;
      pageData.totalCourses = extractedContent.totalCourses;
    }

    console.log(`   ✅ הושלם`);
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
    console.log(`⚠️ GitHub לא מוגדר`);
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
      console.log(`✅ הועלה: ${relativePath}`);
      return true;
    } else {
      const errorText = await putRes.text();
      console.error(`❌ שגיאה: ${putRes.status}`);
      console.error(`   ${errorText.substring(0, 200)}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ שגיאה: ${err.message}`);
    return false;
  }
}

// ============================================
// 🔄 אינדוקס אוטומטי
// ============================================
async function buildIndex(name, sitemapUrl, batchSize, manualPages = []) {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);

  let done = [];
  if (fs.existsSync(donePath)) {
    try {
      done = JSON.parse(fs.readFileSync(donePath, "utf8"));
      console.log(`📂 נטען done: ${done.length}`);
    } catch (err) {
      console.log(`⚠️ שגיאה: ${err.message}`);
    }
  }

  let pages = [];
  if (fs.existsSync(indexPath)) {
    try {
      pages = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      console.log(`📂 נטען אינדקס: ${pages.length}`);
    } catch (err) {
      console.log(`⚠️ שגיאה: ${err.message}`);
    }
  }

  const allUrls = await getUrlsFromSitemap(sitemapUrl);
  if (allUrls.length === 0) {
    console.error("❌ לא נמצאו URLs");
    return false;
  }

  const combinedUrls = [...new Set([...manualPages, ...allUrls])];
  console.log(`📝 סה"כ URLs: ${combinedUrls.length}`);

  const pending = combinedUrls.filter((u) => !done.includes(u));
  console.log(`⏳ נותרו: ${pending.length}`);

  if (pending.length === 0) {
    console.log(`✅ הכל עובד!`);
    return false;
  }

  const batch = pending.slice(0, batchSize);
  console.log(`\n🎯 מעבד ${batch.length} דפים...\n`);

  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;

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

    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));

    if (i < batch.length - 1) {
      const waitTime = 2000 + Math.random() * 3000;
      await delay(waitTime);
    }
  }

  console.log(`\n📦 מפצל...`);
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }

  console.log(`\n📤 מעלה ${chunks.length} חלקים...\n`);

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(
      chunkPath,
      `🔄 ${name} - חלק ${i + 1}/${chunks.length}`
    );
  }

  await uploadToGitHub(donePath, `📊 ${name} - done`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 סיכום:`);
  console.log(`   ✅ הצליחו: ${successCount}`);
  console.log(`   🚫 404: ${notFoundCount}`);
  console.log(`   ⚠️ כשלו: ${failCount}`);
  console.log(`   📈 סה"כ: ${pages.length}`);
  console.log(`   ⏳ נותרו: ${pending.length - batch.length}`);
  console.log(`${"=".repeat(60)}\n`);

  const remainingPending = pending.length - batch.length;
  const shouldContinue = remainingPending > 0 && successCount > 0;
  
  if (!shouldContinue && successCount === 0) {
    console.log(`⚠️ כל הניסיונות נכשלו - עוצר!`);
  }
  
  return shouldContinue;
}

// ============================================
// 🚀 ריצה מלאה
// ============================================
export async function runFullIndexing(name, sitemapUrl, batchSize = CONFIG.BATCH_SIZE) {
  console.log(`\n🏁 מתחיל אינדוקס: ${name}\n`);

  let round = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`\n🔄 סבב ${round}`);
    hasMore = await buildIndex(name, sitemapUrl, batchSize, STATIC_INFO_PAGES);

    if (hasMore) {
      const waitTime = 8000 + Math.random() * 4000;
      console.log(`⏳ ממתין ${Math.round(waitTime / 1000)}s...\n`);
      await delay(waitTime);
      round++;
    }
  }

  console.log(`\n🎉 אינדוקס ${name} הסתיים!\n`);
}

// ============================================
// 📄 עדכון דפים סטטיים
// ============================================
export async function updateStaticPages(name) {
  console.log(`\n📄 מעדכן דפים סטטיים...\n`);
  
  const dataDir = path.join(process.cwd(), "data");
  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);
  
  let pages = [];
  if (fs.existsSync(indexPath)) {
    try {
      pages = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      console.log(`📂 נטען: ${pages.length} דפים`);
    } catch (err) {
      console.log(`⚠️ שגיאה: ${err.message}`);
    }
  }
  
  let done = [];
  if (fs.existsSync(donePath)) {
    try {
      done = JSON.parse(fs.readFileSync(donePath, "utf8"));
    } catch (err) {}
  }
  
  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;
  
  for (let i = 0; i < STATIC_INFO_PAGES.length; i++) {
    const url = STATIC_INFO_PAGES[i];
    console.log(`\n[${i + 1}/${STATIC_INFO_PAGES.length}] ${url}`);
    
    const existingIndex = pages.findIndex(p => p.url === url);
    const result = await processPage(url);
    
    if (!result) {
      failCount++;
    } else if (result === "404") {
      notFoundCount++;
      if (existingIndex >= 0) {
        pages.splice(existingIndex, 1);
      }
      const doneIndex = done.indexOf(url);
      if (doneIndex >= 0) {
        done.splice(doneIndex, 1);
      }
    } else {
      if (existingIndex >= 0) {
        pages[existingIndex] = result;
      } else {
        pages.push(result);
      }
      
      if (!done.includes(url)) {
        done.push(url);
      }
      successCount++;
    }
    
    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
    
    if (i < STATIC_INFO_PAGES.length - 1) {
      await delay(1000 + Math.random() * 1000);
    }
  }
  
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(chunkPath, `📄 ${name} - סטטי - חלק ${i + 1}/${chunks.length}`);
  }
  
  await uploadToGitHub(donePath, `📊 ${name} - done (סטטי)`);
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 סיכום:`);
  console.log(`   ✅ הצליחו: ${successCount}`);
  console.log(`   🚫 404: ${notFoundCount}`);
  console.log(`   ⚠️ כשלו: ${failCount}`);
  console.log(`   📚 סה"כ: ${pages.length}`);
  console.log(`${"=".repeat(60)}\n`);
  
  return true;
}

// ============================================
// 🏫 עדכון דפי מוסדות
// ============================================
export async function updateInstitutionPages(name, sitemapUrl) {
  console.log(`\n🏫 מעדכן דפי מוסדות...\n`);
  
  const dataDir = path.join(process.cwd(), "data");
  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);
  
  let pages = [];
  if (fs.existsSync(indexPath)) {
    try {
      pages = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      console.log(`📂 נטען: ${pages.length}`);
    } catch (err) {
      console.log(`⚠️ שגיאה: ${err.message}`);
    }
  }
  
  let done = [];
  if (fs.existsSync(donePath)) {
    try {
      done = JSON.parse(fs.readFileSync(donePath, "utf8"));
    } catch (err) {}
  }
  
  const allUrls = await getUrlsFromSitemap(sitemapUrl);
  if (allUrls.length === 0) {
    console.error("❌ לא נמצאו URLs");
    return false;
  }
  
  const institutionUrls = allUrls.filter(url => {
    if (STATIC_INFO_PAGES.includes(url)) return false;
    if (url.includes('/results-') || 
        url.includes('/search-results-') || 
        url.includes('/courses-per-month-')) return false;
    if (isExcludedUrl(url)) return false;
    return true;
  });
  
  console.log(`🏫 נמצאו ${institutionUrls.length} דפי מוסדות`);
  
  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;
  
  for (let i = 0; i < institutionUrls.length; i++) {
    const url = institutionUrls[i];
    console.log(`\n[${i + 1}/${institutionUrls.length}] ${url}`);
    
    const existingIndex = pages.findIndex(p => p.url === url);
    const result = await processPage(url);
    
    if (!result) {
      failCount++;
    } else if (result === "404") {
      notFoundCount++;
      if (existingIndex >= 0) {
        pages.splice(existingIndex, 1);
      }
      const doneIndex = done.indexOf(url);
      if (doneIndex >= 0) {
        done.splice(doneIndex, 1);
      }
    } else {
      if (existingIndex >= 0) {
        pages[existingIndex] = result;
      } else {
        pages.push(result);
      }
      
      if (!done.includes(url)) {
        done.push(url);
      }
      successCount++;
    }
    
    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
    
    if (i < institutionUrls.length - 1) {
      const waitTime = 2000 + Math.random() * 2000;
      await delay(waitTime);
    }
  }
  
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(chunkPath, `🏫 ${name} - מוסדות - חלק ${i + 1}/${chunks.length}`);
  }
  
  await uploadToGitHub(donePath, `📊 ${name} - done (מוסדות)`);
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 סיכום:`);
  console.log(`   ✅ הצליחו: ${successCount}`);
  console.log(`   🚫 404: ${notFoundCount}`);
  console.log(`   ⚠️ כשלו: ${failCount}`);
  console.log(`   📚 סה"כ: ${pages.length}`);
  console.log(`${"=".repeat(60)}\n`);
  
  return true;
}

// ============================================
// 🎯 עדכון דף בודד
// ============================================
export async function updateSingleUrl(name, url) {
  console.log(`\n🎯 מעדכן: ${url}\n`);
  
  const dataDir = path.join(process.cwd(), "data");
  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);
  
  let pages = [];
  if (fs.existsSync(indexPath)) {
    try {
      const indexContent = fs.readFileSync(indexPath, "utf8");
      pages = JSON.parse(indexContent);
      console.log(`📂 נטען: ${pages.length}`);
    } catch (err) {
      console.log(`⚠️ שגיאה: ${err.message}`);
    }
  }
  
  let done = [];
  if (fs.existsSync(donePath)) {
    try {
      done = JSON.parse(fs.readFileSync(donePath, "utf8"));
    } catch (err) {}
  }
  
  const existingIndex = pages.findIndex(p => p.url === url);
  
  const result = await processPage(url);
  
  if (!result) {
    console.log(`❌ כישלון`);
    return false;
  }
  
  if (result === "404") {
    console.log(`🚫 404`);
    if (existingIndex >= 0) {
      pages.splice(existingIndex, 1);
    }
    const doneIndex = done.indexOf(url);
    if (doneIndex >= 0) {
      done.splice(doneIndex, 1);
    }
  } else {
    if (existingIndex >= 0) {
      pages[existingIndex] = result;
      console.log(`✅ עודכן`);
    } else {
      pages.push(result);
      console.log(`✅ נוסף`);
    }
    
    if (!done.includes(url)) {
      done.push(url);
    }
  }
  
  fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
  fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
  
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(chunkPath, `🔄 ${name} - עדכון - חלק ${i + 1}/${chunks.length}`);
  }
  
  await uploadToGitHub(donePath, `📊 ${name} - done`);
  
  console.log(`\n✅ הושלם!`);
  console.log(`   📚 סה"כ: ${pages.length}`);
  
  return true;
}

// ============================================
// 🎯 ריצה ישירה מ-CLI
// ============================================
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const name = process.argv[2] || "Shabaton";
    const urlOrSitemap = process.argv[3] || "https://www.shabaton.online/sitemap.xml";
    const batchSize = Number(process.env.BATCH_SIZE) || CONFIG.BATCH_SIZE;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 ריצה ישירה`);
    console.log(`   📛 שם: ${name}`);
    
    const isSingleUrl = !urlOrSitemap.includes('sitemap') && 
                        !urlOrSitemap.endsWith('.xml') &&
                        urlOrSitemap.startsWith('http');
    
    if (isSingleUrl) {
      console.log(`   🎯 מצב: דף בודד`);
      console.log(`   🌐 URL: ${urlOrSitemap}`);
      console.log(`${"=".repeat(60)}\n`);
      
      await updateSingleUrl(name, urlOrSitemap);
    } else {
      console.log(`   🌐 Sitemap: ${urlOrSitemap}`);
      console.log(`   📦 Batch: ${batchSize}`);
      console.log(`${"=".repeat(60)}\n`);
      
      await runFullIndexing(name, urlOrSitemap, batchSize);
    }
  })();
}
