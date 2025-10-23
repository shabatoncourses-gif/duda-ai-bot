import OpenAI from "openai";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  console.log("📥 התקבלה בקשה חדשה ל-API/chat");

  try {
    // בדיקת סוג הבקשה
    if (req.method !== "POST") {
      console.log("⚠️ הבקשה אינה מסוג POST");
      return res.status(405).json({ error: "יש להשתמש בבקשת POST בלבד" });
    }

    const { message } = req.body || {};
    if (!message) {
      console.log("⚠️ חסר message בבקשה");
      return res.status(400).json({ error: "חסר שדה message בגוף הבקשה" });
    }

    // בדיקת מפתח OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.log("❌ שגיאה: לא נמצא מפתח OPENAI_API_KEY במשתני הסביבה!");
      return res.status(500).json({ error: "לא הוגדר מפתח OpenAI" });
    }

    // יצירת לקוח OpenAI
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    console.log("✅ מפתח OpenAI נטען בהצלחה");

    // קריאת הקבצים
    const dataDir = path.join(process.cwd(), "data");
    const shabatonPath = path.join(dataDir, "shabaton.json");
    const morimPath = path.join(dataDir, "morim.json");

    console.log("📂 טוען קבצי תוכן...");
    const shabatonData = JSON.parse(fs.readFileSync(shabatonPath, "utf8"));
    const morimData = JSON.parse(fs.readFileSync(morimPath, "utf8"));

    console.log("✅ קובצי תוכן נטענו בהצלחה");

    // בניית הקונטקסט
    const context = `
      מידע מאתר שבתון:
      ${shabatonData.content.join("\n")}
      
      מידע מאתר מורים בוטיק:
      ${morimData.content.join("\n")}
    `;

    console.log("💬 שולח בקשה ל-OpenAI...");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "ענה בעברית בלבד, אך ורק לפי המידע שסופק מטעמי שבתון ומורים בוטיק. אם אין מידע רלוונטי, אמור שאין מידע באתר."
        },
        { role: "user", content: `${context}\n\nשאלה: ${message}` }
      ],
      temperature: 0.4
    });

    console.log("✅ התקבלה תשובה מ-OpenAI");

    const reply = response.choices?.[0]?.message?.content || "לא התקבלה תשובה";
    console.log("🟢 תשובה שנשלחת למשתמש:", reply);

    res.status(200).json({ reply });
  } catch (error) {
    console.error("❌ שגיאה כללית:", error);
    res.status(500).json({ error: "שגיאה בעיבוד הבקשה", details: error.message });
  }
}
