// 🔍 בדיקת דף בודד - איך הוא מתאנדקס
// שימוש: node test-page.js "URL"
// דוגמה: node test-page.js "https://www.shabaton.online/shabaton-maanak"

import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

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

function cleanDom($) {
  // הסרת אלמנטים בסיסיים
  const removeSelectors = [
    "header", 
    "nav", ".navbar", ".nav", ".menu", ".navigation",
    ".breadcrumb", ".breadcrumbs", 
    "script", "style", "noscript", "iframe",
    ".cookie", ".popup", ".modal", ".advertisement", ".ad", ".ads",
    ".social-share", ".social", ".comments",
  ];

  removeSelectors.forEach((sel) => {
    try {
      $(sel).remove();
    } catch (err) {}
  });
  
  // הסרת footer text
  $("*").each((_, el) => {
    const text = $(el).text().trim();
    
    if ((text.includes("כל הזכויות שמורות") && text.length < 200) ||
        (text === "info@shabaton.co.il") ||
        (text.includes("2025 - 2004") && text.length < 100)) {
      $(el).remove();
    }
  });
  
  return $;
}

function extractContent($) {
  // h2
  const h2s = $("h2")
    .map((_, el) => removeIgnoredText($(el).text().trim()))
    .get()
    .filter((t) => t && t.length > 3);
  
  // h3 - עם סינון תפריטים
  const h3s = $("h3")
    .map((_, el) => {
      const text = removeIgnoredText($(el).text().trim());
      
      const isMenuOrCTA = 
        text === "למידה מרחוק" ||
        text === "ייעוץ לימודים" ||
        text === "קורסי הורות ומשפחה" ||
        text === "הוראה מתקנת" ||
        text === "טיולים וסיורים לימודיים" ||
        text === "אימון ,NLP" ||
        text === "NLP ,אימון" ||
        text === "קורסים לציבור הדתי" ||
        text === "אמנות, העצמה, טיולים ופנאי" ||
        text === "ספורט ובריאות" ||
        text === "הנחיית קבוצות" ||
        text === "חשוב בשבתון" ||
        text.includes("מתכננים שבתון") ||
        text.includes("הרשמו לקבלת מידע") ||
        text.length < 10;
      
      if (isMenuOrCTA) {
        return null;
      }
      
      return text;
    })
    .get()
    .filter((t) => t && t.length > 10);
  
  // פסקאות - עם סינון CTAs
  const paragraphs = [];
  $("p, blockquote, article, div.content, section").each((_, el) => {
    const text = removeIgnoredText($(el).text().trim());
    
    const isCTA = 
      text.startsWith(">>") ||
      text.includes("תואר שני בחינוך") ||
      text.includes("לימודי תעודה, קורסים והשתלמויות") ||
      text.includes("מתלבטים מה ללמוד") ||
      text.includes("טופס ייעוץ") ||
      text.includes("מצאו קורסים נוספים") ||
      text.includes("פנו ישירות ליועצי") ||
      text.includes("Write a short description") ||
      text.includes("נרשמתם בהצלחה") ||
      text.includes("יש לקבל אישור של קרן") ||
      text.includes("מתכננים שבתון? בשבתון ? הרשמו") ||
      text.includes("מעוניינים במידע חשוב") ||
      text === "חשוב בשבתון" ||
      text === "NLP ,אימון" ||
      text === "אימון ,NLP" ||
      text.includes("מסלולי לימוד קורסים והשתלמויות");
    
    if (!isCTA && text.length > 20 && text.length < 2000) {
      paragraphs.push(text);
    }
  });
  
  return { h2s, h3s, paragraphs };
}

async function testPage(url) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🔍 בדיקת דף: ${url}`);
  console.log(`${"=".repeat(70)}\n`);
  
  console.log("🌐 טוען דף עם Puppeteer...");
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // המתנה לתוכן עיקרי
    try {
      await page.waitForSelector('h1, .content, main, article', { timeout: 5000 });
      console.log("✅ תוכן עיקרי נטען");
    } catch {
      console.log("⚠️  לא נמצא h1/content, ממשיכים");
    }
    
    // המתנה נוספת
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    
    const html = await page.content();
    await browser.close();
    
    console.log(`✅ HTML נטען: ${html.length.toLocaleString()} תווים\n`);
    
    // ניתוח
    let $ = cheerio.load(html);
    
    const titleBefore = $("title").text().trim();
    const descBefore = $('meta[name="description"]').attr("content")?.trim() || "";
    const h1Before = $("h1").first().text().trim();
    
    console.log(`${"=".repeat(70)}`);
    console.log("📊 לפני cleanDom:");
    console.log(`${"=".repeat(70)}\n`);
    
    console.log(`🏷️  Title: "${titleBefore}"`);
    console.log(`📝 Description: "${descBefore}"`);
    console.log(`📌 h1: "${h1Before}"`);
    console.log(`\n📦 אלמנטים:`);
    console.log(`   h2: ${$("h2").length}`);
    console.log(`   h3: ${$("h3").length}`);
    console.log(`   p: ${$("p").length}`);
    console.log(`   ul: ${$("ul").length}`);
    console.log(`   li: ${$("li").length}`);
    
    // בדיקת institution structure
    const hasInstitutionStructure = 
      $("li.listItem .itemName").length > 0 && 
      $("li.listItem .itemText").length > 0;
    
    if (hasInstitutionStructure) {
      console.log(`\n🏫 זוהה מבנה institution list!`);
      console.log(`   li.listItem: ${$("li.listItem").length}`);
      console.log(`   itemName: ${$("li.listItem .itemName").length}`);
      console.log(`   itemText: ${$("li.listItem .itemText").length}`);
    }
    
    // cleanDom
    console.log(`\n${"=".repeat(70)}`);
    console.log("🧹 מריץ cleanDom ומחלץ תוכן...");
    console.log(`${"=".repeat(70)}\n`);
    
    $ = cleanDom($);
    
    const h1After = $("h1").first().text().trim();
    const { h2s, h3s, paragraphs } = extractContent($);
    
    const allText = paragraphs.join(" ");
    const wordCount = allText.split(/\s+/).filter(w => w.length > 0).length;
    
    console.log(`📌 h1: "${h1After}"`);
    console.log(`\n📌 h2 (${h2s.length}):`);
    h2s.slice(0, 5).forEach((h, i) => console.log(`   ${i+1}. "${h}"`));
    if (h2s.length > 5) console.log(`   ... ועוד ${h2s.length - 5}`);
    
    console.log(`\n📌 h3 (${h3s.length}):`);
    h3s.slice(0, 5).forEach((h, i) => console.log(`   ${i+1}. "${h}"`));
    if (h3s.length > 5) console.log(`   ... ועוד ${h3s.length - 5}`);
    
    console.log(`\n📝 טקסט:`);
    console.log(`   פסקאות: ${paragraphs.length}`);
    console.log(`   מילים: ${wordCount}`);
    console.log(`   תווים: ${allText.length.toLocaleString()}`);
    
    if (allText.length > 0) {
      console.log(`\n   🔤 100 תווים ראשונים:`);
      console.log(`   "${allText.substring(0, 100)}..."`);
    }
    
    // סיכום JSON
    console.log(`\n${"=".repeat(70)}`);
    console.log("📋 מה ישמר באינדקס:");
    console.log(`${"=".repeat(70)}\n`);
    
    const result = {
      url: url,
      title: titleBefore,
      h1: h1After,
      h2: h2s,
      h3: h3s,
      description: descBefore,
      type: hasInstitutionStructure ? "institution-page" : "info-page",
      wordCount: wordCount
    };
    
    console.log(JSON.stringify(result, null, 2));
    
    console.log(`\n${"=".repeat(70)}`);
    console.log("✅ סיום");
    console.log(`${"=".repeat(70)}\n`);
    
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// CLI
const url = process.argv[2];

if (!url) {
  console.error("\n❌ חסר URL!\n");
  console.log("שימוש:");
  console.log('  node test-page.js "https://www.shabaton.online/shabaton-maanak"\n');
  process.exit(1);
}

testPage(url).catch(err => {
  console.error("\n❌ שגיאה:", err.message);
  process.exit(1);
});
