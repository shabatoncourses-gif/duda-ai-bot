import { buildIndex } from "../scripts/autoBuildIndex.js";

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting index build inside Vercel function...");

    await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml");
    await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml");

    res.status(200).json({
      success: true,
      message: "🎉 Index build completed successfully on Vercel!"
    });
  } catch (error) {
    console.error("❌ Error during build:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
