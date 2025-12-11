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
  
  // ⚡ הסרת grid/cards עם כותרות
  const cardsWithImages = $("div").filter((_, div) => {
    const $div = $(div);
    const hasImage = $div.find("img").length > 0;
    const hasH3 = $div.find("h3").length === 1;
    const hasLink = $div.find("a").length > 0;
    return hasImage && hasH3 && hasLink;
  });
  
  if (cardsWithImages.length >= 4) {
    console.log(`   🎴 זוהה grid של ${cardsWithImages.length} cards - מוסר h3`);
    cardsWithImages.find("h3").remove();
  }
  
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
    .map((_, el) => {
      let text = removeIgnoredText($(el).text().trim());
      // ניקוי \n ומרכאות
      text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/\\"/g, '"').replace(/\"/g, "'").trim();
      return text;
    })
    .get()
    .filter((t) => t && t.length > 3);
  
  // h3 - עם סינון חכם
  const h3s = $("h3")
    .map((_, el) => {
      const $el = $(el);
      let text = removeIgnoredText($el.text().trim());
      // ניקוי \n ומרכאות
      text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/\\"/g, '"').replace(/\"/g, "'").trim();
      
      // רשימת מילות מפתח שיכולות להיות תפריט או תוכן
      const ambiguousKeywords = [
        "הוראה מתקנת",
        "NLP",
        "אימון",
        "הנחיית קבוצות",
        "למידה מרחוק",
        "ייעוץ לימודים",
        "קורסי הורות",
        "טיולים וסיורים"
      ];
      
      // בדיקה: האם זה תפריט או תוכן?
      const hasLink = $el.find("a").length > 0 || $el.closest("nav, .menu, .navigation").length > 0;
      const isShort = text.length < 20;
      const isExactMatch = ambiguousKeywords.some(keyword => text === keyword);
      
      // זה תפריט אם:
      // 1. יש לו קישור פנימי
      // 2. הוא קצר (פחות מ-20 תווים) וזה התאמה מדויקת
      const isMenuHeader = hasLink || (isShort && isExactMatch);
      
      // CTAs ברורים (תמיד למחוק)
      const isClearCTA = 
        text === "חשוב בשבתון" ||
        text.includes("מתכננים שבתון") ||
        text.includes("הרשמו לקבלת מידע") ||
        text === "אימון ,NLP" ||
        text === "NLP ,אימון" ||
        text === "קורסי הורות ומשפחה" ||
        text === "קורסים לציבור הדתי" ||
        text === "אמנות, העצמה, טיולים ופנאי" ||
        text === "ספורט ובריאות" ||
        text === "טיולים וסיורים לימודיים" ||
        text.length < 10;
      
      if (isMenuHeader || isClearCTA) {
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
      text.includes("AudioEye enabled") ||
      text.includes("optimized for accessibility") ||
      text.startsWith("This website is AudioEye") ||
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
    
    const titleBefore = $("title").text().trim()
      .replace(/\n/g, ' ')
      .replace(/close carousel/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
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
    
    // ⚡ h1 עם ניקוי \n ומרכאות
    let h1After = $("h1").first().text().trim();
    h1After = h1After.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/\\"/g, '"').replace(/\"/g, "'").trim();
    
    const { h2s, h3s, paragraphs } = extractContent($);
    
    // ⚡ חילוץ רשימות
    const lists = [];
    const seenItems = new Set();  // למניעת כפילויות
    
    $("ul, ol").each((_, list) => {
      const items = $(list).find("li")
        .map((_, li) => {
          let text = $(li).text().trim();
          // ניקוי ירידות שורה
          text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
          return text;
        })
        .get()
        .filter(t => t && t.length > 10 && t.length < 200);
      
      if (items.length > 0 && items.length < 50) {
        items.forEach(item => {
          if (!seenItems.has(item)) {
            seenItems.add(item);
            lists.push(item);
          }
        });
      }
    });
    
    // ⚡ חילוץ טבלאות
    const tables = [];
    $("table").each((_, table) => {
      const rows = $(table).find("tr");
      if (rows.length > 0 && rows.length < 50) {
        rows.each((_, row) => {
          const allCells = $(row).find("td, th")
            .map((_, cell) => {
              const $cell = $(cell);
              let html = $cell.html() || '';
              
              // המרת <br> ל-\n
              html = html.replace(/<br\s*\/?>/gi, '\n');
              
              // חילוץ טקסט
              let text = $('<div>').html(html).text().trim();
              text = text.replace(/\\"/g, '"').replace(/\"/g, "'");
              
              return text;
            })
            .get()
            .filter(cell => {
              const isContact = 
                cell === "צרו קשר" ||
                cell === "צור קשר" ||
                cell === "פרטים" ||
                cell === "לפרטים" ||
                cell === "הרשמה" ||
                cell === "להרשמה" ||
                cell === "מועד פתיחה" ||
                cell === "קורס" ||
                cell.includes("פנו למידע") ||
                cell.includes("פנו לייעוץ") ||
                cell.includes("ליעוץ אישי") ||
                cell.includes("למידע נוסף");
              return !isContact && cell.length > 0;
            });
          
          if (allCells.length === 0) return;
          
          // ⚡ זיהוי מצב
          const firstCell = allCells[0] || '';
          const hasDoubleLinesBreak = /\n\s*\n/.test(firstCell);
          
          if (hasDoubleLinesBreak) {
            // מצב 1: קורסים נפרדים (גישות)
            const courses = firstCell.split(/\n\s*\n/).filter(c => c.trim());
            
            courses.forEach(course => {
              const lines = course.split('\n').map(l => l.trim()).filter(l => l);
              const courseText = lines.join(' ').replace(/\s+/g, ' ').trim();
              
              if (courseText && courseText.length >= 10) {
                tables.push(courseText);
              }
            });
          } else if (firstCell.includes('\n')) {
            // מצב 2: רשימת תאריכים (חדווה)
            const cleanedCells = allCells.map(cell => {
              const lines = cell.split('\n')
                .map(l => l.trim())
                .filter(l => l && l.length > 0);
              return lines.join(', ');
            });
            
            const rowText = cleanedCells.join(' | ').replace(/\s+/g, ' ').trim();
            
            if (rowText && rowText.length >= 10) {
              tables.push(rowText);
            }
          } else {
            // מצב 3: שורה רגילה
            const rowText = allCells.join(' | ').replace(/\s+/g, ' ').trim();
            
            if (rowText && rowText.length >= 10) {
              tables.push(rowText);
            }
          }
        });
      }
    });
    
    const allText = paragraphs.join(" ");
    const wordCount = allText.split(/\s+/).filter(w => w.length > 0).length;
    
    console.log(`📌 h1: "${h1After}"`);
    console.log(`\n📌 h2 (${h2s.length}):`);
    h2s.slice(0, 5).forEach((h, i) => console.log(`   ${i+1}. "${h}"`));
    if (h2s.length > 5) console.log(`   ... ועוד ${h2s.length - 5}`);
    
    console.log(`\n📌 h3 (${h3s.length}):`);
    h3s.slice(0, 5).forEach((h, i) => console.log(`   ${i+1}. "${h}"`));
    if (h3s.length > 5) console.log(`   ... ועוד ${h3s.length - 5}`);
    
    // ⚡ הצגת רשימות
    if (lists.length > 0) {
      console.log(`\n📋 רשימות (${lists.length} פריטים):`);
      lists.slice(0, 8).forEach((item, i) => console.log(`   • ${item.substring(0, 60)}${item.length > 60 ? '...' : ''}`));
      if (lists.length > 8) console.log(`   ... ועוד ${lists.length - 8} פריטים`);
    }
    
    // ⚡ הצגת טבלאות
    if (tables.length > 0) {
      console.log(`\n📊 טבלאות (${tables.length} שורות):`);
      tables.slice(0, 5).forEach((row, i) => console.log(`   ${i+1}. ${row.substring(0, 70)}${row.length > 70 ? '...' : ''}`));
      if (tables.length > 5) console.log(`   ... ועוד ${tables.length - 5} שורות`);
    }
    
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
    
    // בדיקת institution structure מתקדמת
    let institutions = [];
    let coursesByInstitution = {};
    let institutionLinks = {};  // ⚡ חדש
    
    if (hasInstitutionStructure) {
      // אסטרטגיה 1: li.listItem
      $("li.listItem").each((_, item) => {
        const $item = $(item);
        
        // חילוץ שם המוסד - בלי כפילויות
        let institutionName = $item.find(".itemName").text().trim();
        
        // ⚡ הסרת כפילויות - אסטרטגיה 1: חלוקה למילים
        const words = institutionName.split(/\s+/);
        const halfLength = Math.floor(words.length / 2);
        
        if (words.length >= 6 && words.length % 2 === 0) {
          const firstHalf = words.slice(0, halfLength).join(' ');
          const secondHalf = words.slice(halfLength).join(' ');
          
          if (firstHalf === secondHalf) {
            institutionName = firstHalf;
          }
        }
        
        // ⚡ הסרת כפילויות - אסטרטגיה 2: חלוקה לתווים
        if (institutionName.length >= 20 && institutionName.length % 2 === 0) {
          const halfLen = Math.floor(institutionName.length / 2);
          const firstHalfText = institutionName.substring(0, halfLen);
          const secondHalfText = institutionName.substring(halfLen);
          
          if (firstHalfText === secondHalfText) {
            institutionName = firstHalfText;
          }
        }
        
        // ⚡ הסרת כפילויות - אסטרטגיה 3: חיפוש חזרתיות
        const len = institutionName.length;
        for (let i = 3; i <= len / 2; i++) {
          const pattern = institutionName.substring(0, i);
          const rest = institutionName.substring(i);
          
          if (pattern === rest || pattern === rest.trim()) {
            institutionName = pattern;
            break;
          }
        }
        
        if (institutionName && institutionName.length > 5) {
          // ⚡ חילוץ קישור למוסד
          const institutionLink = $item.find("a").first().attr("href") || "";
          
          if (!institutions.includes(institutionName)) {
            institutions.push(institutionName);
            coursesByInstitution[institutionName] = [];
            
            if (institutionLink) {
              institutionLinks[institutionName] = institutionLink;
            }
          }
          
          // חילוץ קורסים - עם פיצול נכון
          const coursesHTML = $item.find(".itemText").html() || '';
          
          if (coursesHTML) {
            // פיצול לפי <br> או ירידת שורה
            let coursesList = coursesHTML
              .split(/<br\s*\/?.*?>/i)
              .map(c => {
                const cleanText = $('<div>').html(c).text().trim();
                // פיצול נוסף לפי ירידת שורה בטקסט
                return cleanText.split(/\n+/).map(line => line.trim()).filter(line => line.length > 5);
              })
              .flat()
              .filter(c => c.length > 10 && c.length < 500);
            
            // אם לא נמצאו קורסים מפוצלים, נסה לחלץ מהטקסט
            if (coursesList.length === 0 || coursesList.length === 1) {
              const fullText = $item.find(".itemText").text().trim();
              // חיפוש אחר מילות מפתח שמסמנות קורס חדש
              const courseMarkers = /(?:^|\n|\.)\s*([א-ת][^.]+?(?:תואר|קורס|הכשר|תוכנית|השתלמות|לימוד)[^.]*)/g;
              const matches = [...fullText.matchAll(courseMarkers)];
              
              if (matches.length > 1) {
                coursesList = matches
                  .map(m => m[1].trim())
                  .filter(c => c.length > 10);
              }
            }
            
            coursesByInstitution[institutionName].push(...coursesList);
          }
        }
      });
      
      // אסטרטגיה 2: h2 + ul
      if (institutions.length === 0) {
        $("h2").each((_, el) => {
          const institutionName = $(el).text().trim();
          
          if (institutionName && 
              institutionName.length > 5 && 
              institutionName.length < 150 &&
              !institutionName.includes("קורסים") &&
              !institutionName.includes("תוצאות")) {
            
            if (!institutions.includes(institutionName)) {
              institutions.push(institutionName);
              coursesByInstitution[institutionName] = [];
            }
            
            $(el).nextAll("ul").first().find("li").each((_, li) => {
              const courseText = $(li).text().trim();
              if (courseText && courseText.length > 10) {
                coursesByInstitution[institutionName].push(courseText);
              }
            });
          }
        });
      }
    }
    
    // ⚡ תיקון h1 לדפי institution
    let finalH1 = h1After;
    if (institutions.length > 0 && (!finalH1 || finalH1.includes("מצאו עוד קורסים"))) {
      finalH1 = titleBefore;
      
      // ⚡ אם יש h2 עם מיקום - הוסף אותו ל-h1
      if (h2s.length > 0 && h2s[0].includes("ב")) {
        finalH1 = `${titleBefore} ${h2s[0]}`;
      }
    }
    
    const result = {
      url: url,
      title: titleBefore,
      h1: finalH1,
      h2: h2s,  // ⚡ תמיד הכותרות המקוריות!
      h3: h3s,
      description: descBefore,
      type: hasInstitutionStructure ? "institution-page" : "info-page",
      wordCount: wordCount,
      // ⚡ bulletPoints רק אם זה לא דף institution
      ...(lists.length > 0 && institutions.length === 0 && {
        bulletPoints: lists.slice(0, 20)
      }),
      // ⚡ טבלאות
      ...(tables.length > 0 && {
        tables: tables.slice(0, 20)
      }),
      ...(institutions.length > 0 && {
        institutions: institutions,
        totalCourses: Object.values(coursesByInstitution).flat().length,
        coursesByInstitution: coursesByInstitution,
        institutionLinks: institutionLinks
      })
    };
    
    console.log(JSON.stringify(result, null, 2));
    
    // אם יש מוסדות, הצג אותם בצורה נוחה לקריאה
    if (result.coursesByInstitution && Object.keys(result.coursesByInstitution).length > 0) {
      console.log(`\n${"=".repeat(70)}`);
      console.log("🏫 פירוט מוסדות וקורסים:");
      console.log(`${"=".repeat(70)}\n`);
      
      Object.entries(result.coursesByInstitution).forEach(([institution, courses]) => {
        const link = result.institutionLinks && result.institutionLinks[institution];
        console.log(`📚 ${institution.substring(0, 60)}${institution.length > 60 ? '...' : ''}`);
        if (link) {
          console.log(`   🔗 ${link}`);
        }
        console.log(`   (${courses.length} קורסים):`);
        courses.slice(0, 5).forEach(course => {
          console.log(`   • ${course.substring(0, 70)}${course.length > 70 ? '...' : ''}`);
        });
        if (courses.length > 5) {
          console.log(`   ... ועוד ${courses.length - 5} קורסים\n`);
        } else {
          console.log('');
        }
      });
    }
    
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
