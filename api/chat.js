import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  try {
    const { message } = req.body;

    // טוענים את הנתונים משני האתרים
    const shabatonData = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data/shabaton.json"), "utf8")
    );
    const morimData = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data/morim.json"), "utf8")
    );

    const context = `
      מידע מאתר שבתון:
      ${shabatonData.content.join("\n")}
      
      מידע מאתר מורים בוטיק:
      ${morimData.content.join("\n")}
    `;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "ענה בעברית בלבד, אך ורק לפי המידע שסופק מטעמי שבתון ומורים בוטיק. אם אין מידע רלוונטי, אמור שאין מידע באתר."
        },
        { role: "user", content: `${context}\n\nשאלה: ${message}` }
      ],
      temperature: 0.4
    });

    res.status(200).json({
      reply: response.choices[0].message.content
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "שגיאה בעיבוד הבקשה" });
  }
}
