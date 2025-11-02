// scripts/reindex_runner.js
import { runFullIndexing } from "./autoBuildIndex.js";

(async () => {
  console.log("🚀 Starting full reindex manually...");
  try {
    await runFullIndexing("Shabaton", "https://www.shabaton.online/sitemap.xml", 100);
    await runFullIndexing("Morim", "https://www.morim.boutique/sitemap.xml", 100);
    console.log("✅ Full reindex completed successfully!");
  } catch (err) {
    console.error("💥 Fatal error:", err.message);
  }
})();
