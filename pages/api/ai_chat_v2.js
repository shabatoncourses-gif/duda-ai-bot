// שבי - עוזר שבתון AI v4
// ESM format - package.json has "type": "module"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _cache = {};

// ── System Prompt ──────────────────────────────────────
const SYSTEM_PROMPT =
  'שמך שבי, העוזר החכם והנעים של שבתון.\n' +
  'ענה תמיד בעברית בחום ובידידותיות.\n\n' +

  'כלל ברזל: תן תשובה עניינית מהמידע שסופק. לעולם אל תאמר שאינך יכול לענות.\n\n' +

  'ענה תמיד בעברית בלבד — אסור לכתוב אפילו משפט אחד באנגלית, גם לא בפתיח.\\n' +
  'לשאלות מידע על שבתון:\n' +
  '1. תחילה - תן תשובה קצרה וברורה מתוך התוכן שסופק\n' +
  '2. אחר כך - הפנה לדף הרלוונטי באתר\n' +
  '3. אל תפנה לגורמים חיצוניים\n\n' +

  'לשאלות קורסים:\n' +
  '- הצג עד 5 מוסדות מהמידע שסופק בלבד, בסדר אקראי\n' +
  '- אסור להציג מוסד שלא מופיע במידע שסופק\n' +
  '- כל מוסד: ### שם | תיאור קצר | [פנו למידע ולייעוץ אישי](URL)\n\n' +

  'פורמט קישורי מידע:\n' +
  '📋 **שם הדף**\n' +
  'תיאור קצר\n' +
  '[לפירוט ולמידע נוסף](URL)\n' +
  '"מידע וטיפים חשובים" - תמיד אחרון\n\n' +

  'footer לקורסים:\n' +
  '📚 [כל קורסי [תחום] ב[אזור]](https://www.shabaton.online/[slug-אזור]/[slug-מקודד])\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '💬 [אפשר גם לשאול בקבוצת הווטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +

  'כללי footer לקורסים:\n' +
  'יש אזור בשאלה: https://www.shabaton.online/[slug-אזור]/[slug-תחום]\n' +
  'אין אזור בשאלה: https://www.shabaton.online/results-all/[slug-תחום]\n' +
  'slug תחומים מקודדים (מ-study-fields.json):\n' +
  '  אופק חדש - עוז לתמורה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%90%D7%95%D7%A4%D7%A7%20%D7%97%D7%93%D7%A9%20-%20%D7%A2%D7%95%D7%96%20%D7%9C%D7%AA%D7%9E%D7%95%D7%A8%D7%94\n  אימון - NLP = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%90%D7%99%D7%9E%D7%95%D7%9F%20-%20NLP\n  איפור, טיפוח אישי וסטיילינג = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%90%D7%99%D7%A4%D7%95%D7%A8%2C%20%D7%98%D7%99%D7%A4%D7%95%D7%97%20%D7%90%D7%99%D7%A9%D7%99%20%D7%95%D7%A1%D7%98%D7%99%D7%99%D7%9C%D7%99%D7%A0%D7%92\n  אמנות ואומנויות = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%90%D7%9E%D7%A0%D7%95%D7%AA%20%D7%95%D7%90%D7%95%D7%9E%D7%A0%D7%95%D7%99%D7%95%D7%AA\n  תואר שני בחינוך ובהוראה = %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%AA%D7%95%D7%90%D7%A8%20%D7%A9%D7%A0%D7%99%20%D7%91%D7%97%D7%99%D7%A0%D7%95%D7%9A%20%D7%95%D7%91%D7%94%D7%95%D7%A8%D7%90%D7%94\n  בישול וקונדיטוריה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%91%D7%99%D7%A9%D7%95%D7%9C%20-%20%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A7%D7%95%D7%A0%D7%93%D7%99%D7%98%D7%95%D7%A8%D7%99%D7%94\n  בריאות ותזונה נכונה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%91%D7%A8%D7%99%D7%90%D7%95%D7%AA%20%D7%95%D7%AA%D7%96%D7%95%D7%A0%D7%94%20%D7%A0%D7%9B%D7%95%D7%A0%D7%94\n  גיל רך - חינוך קדם יסודי = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%D7%9D%20%D7%9C%D7%92%D7%99%D7%9C%20%D7%A8%D7%9A%20-%20%D7%97%D7%99%D7%A0%D7%95%D7%9A%20%D7%A7%D7%93%D7%9D%20%D7%99%D7%A1%D7%95%D7%93%D7%99\n  גישור = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%92%D7%99%D7%A9%D7%95%D7%A8\n  גרפולוגיה ונומרולוגיה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%92%D7%A8%D7%A4%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94%20%D7%95%D7%A0%D7%95%D7%9E%D7%A8%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94\n  דרמה, פסיכודרמה, תיאטרון בובות = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%93%D7%A8%D7%9E%D7%94%2C%20%D7%A4%D7%A1%D7%99%D7%9B%D7%95%D7%93%D7%A8%D7%9E%D7%94%2C%20%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%AA%D7%99%D7%90%D7%98%D7%A8%D7%95%D7%9F%20%D7%91%D7%95%D7%91%D7%95%D7%AA\n  הדרכת הורים, זוגיות ומשפחה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%94%D7%93%D7%A8%D7%9B%D7%AA%20%D7%94%D7%95%D7%A8%D7%99%D7%9D%2C%20%D7%96%D7%95%D7%92%D7%99%D7%95%D7%AA%20%D7%95%D7%9E%D7%A9%D7%A4%D7%97%D7%94\n  הוראה מתקנת - הוראה מותאמת = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%94%D7%95%D7%A8%D7%90%D7%94%20%D7%9E%D7%AA%D7%A7%D7%A0%D7%AA%20-%20%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%94%D7%95%D7%A8%D7%90%D7%94%20%D7%9E%D7%95%D7%AA%D7%90%D7%9E%D7%AA\n  הנחיית קבוצות = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%94%D7%A0%D7%97%D7%99%D7%99%D7%AA%20%D7%A7%D7%91%D7%95%D7%A6%D7%95%D7%AA\n  העצמה והתפתחות אישית = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%94%D7%A2%D7%A6%D7%9E%D7%94%20%D7%95%D7%94%D7%AA%D7%A4%D7%AA%D7%97%D7%95%D7%AA%20%D7%90%D7%99%D7%A9%D7%99%D7%AA\n  חברה וקהילה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%97%D7%91%D7%A8%D7%94%20%D7%95%D7%A7%D7%94%D7%99%D7%9C%D7%94\n  חינוך גופני = %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%97%D7%99%D7%A0%D7%95%D7%9A%20%D7%92%D7%95%D7%A4%D7%A0%D7%99\n  חינוך והוראה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%97%D7%99%D7%A0%D7%95%D7%9A%20%D7%95%D7%94%D7%95%D7%A8%D7%90%D7%94\n  חינוך סביבתי - לימודי ארץ ישראל = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%97%D7%99%D7%A0%D7%95%D7%9A%20%D7%A1%D7%91%D7%99%D7%91%D7%AA%D7%99%20-%20%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%90%D7%A8%D7%A5%20%D7%99%D7%A9%D7%A8%D7%90%D7%9C\n  טיולים וסיורים לימודיים = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%98%D7%99%D7%95%D7%9C%D7%99%D7%9D%20-%20%D7%A1%D7%99%D7%95%D7%A8%D7%99%D7%9D%20%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%D7%99%D7%9D\n  טכנולוגיה דיגיטלית ואינטרנט = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%98%D7%9B%D7%A0%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94%20%D7%93%D7%99%D7%92%D7%99%D7%98%D7%9C%D7%99%D7%AA%20%D7%95%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%A0%D7%98\n  יהדות, מורשת ישראל ודתות = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%99%D7%94%D7%93%D7%95%D7%AA%2C%20%D7%9E%D7%95%D7%A8%D7%A9%D7%AA%20%D7%99%D7%A9%D7%A8%D7%90%D7%9C%20%D7%95%D7%93%D7%AA%D7%95%D7%AA\n  ייעוץ ארגוני = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%99%D7%99%D7%A2%D7%95%D7%A5%20%D7%90%D7%A8%D7%92%D7%95%D7%A0%D7%99\n  ייעוץ חינוכי = %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%99%D7%99%D7%A2%D7%95%D7%A5%20%D7%97%D7%99%D7%A0%D7%95%D7%9B%D7%99\n  כתיבה יוצרת - כתיבה עיונית - כתיבה אקדמית = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%9B%D7%AA%D7%99%D7%91%D7%94%20%D7%99%D7%95%D7%A6%D7%A8%D7%AA%20-%20%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%9B%D7%AA%D7%99%D7%91%D7%94%20%D7%A2%D7%99%D7%95%D7%A0%D7%99%D7%AA%20-%20%D7%9B%D7%AA%D7%99%D7%91%D7%94%20%D7%90%D7%A7%D7%93%D7%9E%D7%99%D7%AA\n  קורסים לגימלאים = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%D7%9D%20%D7%9C%D7%92%D7%99%D7%9E%D7%9C%D7%90%D7%99%D7%9D\n  למידה מרחוק = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%D7%9D%20%D7%91%D7%9C%D7%9E%D7%99%D7%93%D7%94%20%D7%9E%D7%A8%D7%97%D7%95%D7%A7\n  לציבור הדתי = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%D7%9D%20%D7%9C%D7%A6%D7%99%D7%91%D7%95%D7%A8%20%D7%94%D7%93%D7%AA%D7%99\n  לקויות למידה וחינוך מיוחד = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%90%D7%91%D7%97%D7%95%D7%9F%20%D7%95%D7%98%D7%99%D7%A4%D7%95%D7%9C%20%D7%91%D7%9C%D7%A7%D7%95%D7%99%D7%95%D7%AA%20%D7%9C%D7%9E%D7%99%D7%93%D7%94%20-%20%D7%A7%D7%95%D7%A8%D7%A1%D7%99%D7%9D%20%D7%9C%D7%97%D7%99%D7%A0%D7%95%D7%9A%20%D7%9E%D7%99%D7%95%D7%97%D7%93\n  מדעי הרוח = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%D7%9D%20%D7%91%D7%9E%D7%93%D7%A2%D7%99%20%D7%94%D7%A8%D7%95%D7%97\n  מוסיקה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%9E%D7%95%D7%A1%D7%99%D7%A7%D7%94%20-%20%D7%A7%D7%95%D7%A0%D7%A6%D7%A8%D7%98%D7%99%D7%9D%20%D7%9E%D7%95%D7%93%D7%A8%D7%9B%D7%99%D7%9D\n  מידענות וספרנות = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%9E%D7%99%D7%93%D7%A2%D7%A0%D7%95%D7%AA%20%D7%95%D7%A1%D7%A4%D7%A8%D7%A0%D7%95%D7%AA\n  מיינדפולנס ומדיטציה = %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%9E%D7%99%D7%99%D7%A0%D7%93%D7%A4%D7%95%D7%9C%D7%A0%D7%A1%20%D7%95%D7%9E%D7%93%D7%99%D7%98%D7%A6%D7%99%D7%94\n  מנהל עסקים - פיננסים - יזמות = %D7%9E%D7%A0%D7%94%D7%9C%20%D7%A2%D7%A1%D7%A7%D7%99%D7%9D%20-%20%D7%A4%D7%99%D7%A0%D7%A0%D7%A1%D7%99%D7%9D%20-%20%D7%99%D7%96%D7%9E%D7%95%D7%AA\n  הוראת מתמטיקה ומדעים = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%94%D7%95%D7%A8%D7%90%D7%AA%20%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94%20%D7%95%D7%9E%D7%93%D7%A2%D7%99%D7%9D\n  ניהול חינוכי = %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%A0%D7%99%D7%94%D7%95%D7%9C%20%D7%97%D7%99%D7%A0%D7%95%D7%9B%D7%99\n  ניתוח התנהגות = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A0%D7%99%D7%AA%D7%95%D7%97%20%D7%94%D7%AA%D7%A0%D7%94%D7%92%D7%95%D7%AA\n  ספורט, מחול ותנועה = %D7%A1%D7%A4%D7%95%D7%A8%D7%98%2C%20%D7%9E%D7%97%D7%95%D7%9C%20%D7%95%D7%AA%D7%A0%D7%95%D7%A2%D7%94\n  עיצוב אופנה - תפירה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A2%D7%99%D7%A6%D7%95%D7%91%20%D7%90%D7%95%D7%A4%D7%A0%D7%94%20-%20%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%AA%D7%A4%D7%99%D7%A8%D7%94\n  עיצוב פנים - הום סטיילינג = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A2%D7%99%D7%A6%D7%95%D7%91%20%D7%A4%D7%A0%D7%99%D7%9D%20-%20%D7%94%D7%95%D7%9D%20%D7%A1%D7%98%D7%99%D7%99%D7%9C%D7%99%D7%A0%D7%92\n  עריכה לשונית = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A2%D7%A8%D7%99%D7%9B%D7%94%20%D7%9C%D7%A9%D7%95%D7%A0%D7%99%D7%AA\n  פיתוח מקצועי למורים = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%D7%9D%20%D7%9C%D7%A4%D7%99%D7%AA%D7%95%D7%97%20%D7%9E%D7%A7%D7%A6%D7%95%D7%A2%D7%99%20%D7%9C%D7%9E%D7%95%D7%A8%D7%99%D7%9D\n  פסיכולוגיה וייעוץ = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A4%D7%A1%D7%99%D7%9B%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94%20%D7%95%D7%99%D7%99%D7%A2%D7%95%D7%A5\n  צורפות ותכשיטנות = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A6%D7%95%D7%A8%D7%A4%D7%95%D7%AA%20%D7%95%D7%AA%D7%9B%D7%A9%D7%99%D7%98%D7%A0%D7%95%D7%AA\n  צילום = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A6%D7%99%D7%9C%D7%95%D7%9D\n  רפואה משלימה = %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%A8%D7%A4%D7%95%D7%90%D7%94%20%D7%9E%D7%A9%D7%9C%D7%99%D7%9E%D7%94\n  שפות - הוראת שפות - תרגום = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A9%D7%A4%D7%95%D7%AA%20-%20%D7%94%D7%95%D7%A8%D7%90%D7%AA%20%D7%A9%D7%A4%D7%95%D7%AA%20-%20%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%AA%D7%A8%D7%92%D7%95%D7%9D\n  תואר שלישי - דוקטורט = %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%AA%D7%95%D7%90%D7%A8%20%D7%A9%D7%9C%D7%99%D7%A9%D7%99%20-%20%D7%93%D7%95%D7%A7%D7%98%D7%95%D7%A8%D7%98\n  תיירות = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%AA%D7%99%D7%99%D7%A8%D7%95%D7%AA\n  תקשורת בין-אישית = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%AA%D7%A7%D7%A9%D7%95%D7%A8%D7%AA%20%D7%91%D7%99%D7%9F-%D7%90%D7%99%D7%A9%D7%99%D7%AA\n  תרבות העשרה ואקטואליה = %D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%AA%D7%A8%D7%91%D7%95%D7%AA%20%D7%94%D7%A2%D7%A9%D7%A8%D7%94%20%D7%95%D7%90%D7%A7%D7%98%D7%95%D7%90%D7%9C%D7%99%D7%94\n  תרפיה וטיפול = %D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%AA%D7%A8%D7%A4%D7%99%D7%94%20%D7%95%D7%98%D7%99%D7%A4%D7%95%D7%9C\n\n' +
  'footer לשאלות מידע:\n' +
  '📩 [הרשם לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '💬 [אפשר גם לשאול בקבוצת הווטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
  'אסור -- או ---. שאלה בסוף: ידידותית, ללא כוכביות.';


// ── זיהוי אזור מ-regions.json ──
function detectRegion(q) {
  try {
    const data = loadJSON('regions.json');
    if (!data || !data.regions) return null;
    const qL = q.toLowerCase();
    for (const region of data.regions) {
      // בדוק keywords
      if (region.keywords && region.keywords.some(k => qL.includes(k.toLowerCase()))) {
        return { name: region.name, slug: region.slug, cities: region.cities || [] };
      }
      // בדוק cities
      if (region.cities && region.cities.some(c => qL.includes(c.toLowerCase()))) {
        return { name: region.name, slug: region.slug, cities: region.cities };
      }
    }
  } catch(e) {}
  return null;
}

// ── חיפוש קורסים ──
function searchCourses(question, region) {
  const results = [], seen = new Set();
  const qL = question.toLowerCase();
  const stop = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך']);
  const words = qL.split(/\s+/).filter(w => w.length > 2 && !stop.has(w));

  const indexes = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json','morim_index_part1.json'];
  for (const fname of indexes) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', fname), 'utf8'));
      const pages = Array.isArray(data) ? data : (data.pages || []);
      for (const page of pages) {
        const url = page.url || page.link || '';
        if (seen.has(url) || url.includes('/results-')) continue;
        const title = (page.title || '').toLowerCase();
        const desc = (page.description || '').toLowerCase();
        let score = 0;
        for (const w of words) {
          if (title.includes(w)) score += 3;
          else if (desc.includes(w)) score += 2;
          else if ((page.text||'').toLowerCase().includes(w)) score += 1;
        }
        if (!score) continue;
        if (region) {
          for (const c of region.cities) {
            if ((title+desc).includes(c.toLowerCase())) { score += 5; break; }
          }
        }
        seen.add(url);
        results.push({ title: page.title, url, description: page.description||'', score });
      }
    } catch(e) {}
  }
  return results.sort((a,b) => b.score - a.score).slice(0, 10);
}

// ── loadJSON ──
const _jsonCache = {};
function loadJSON(filename) {
  if (_jsonCache[filename] !== undefined) return _jsonCache[filename];
  try {
    const p = path.join(process.cwd(), 'data', filename);
    _jsonCache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) { _jsonCache[filename] = null; }
  return _jsonCache[filename];
}

function detectInfoPages(question) {
  const q = question.toLowerCase();
  const pages = [
    { kw: ['לידה','מענק לידה','דמי לידה','חופשת לידה','הריון'], url: 'https://www.shabaton.online/birth_shabatgon' },
    { kw: ['מענק','גובה המענק','חישוב מענק','תלוש מענק'], url: 'https://www.shabaton.online/shabaton-maanak' },
    { kw: ['ביטוח לאומי','ביטל'], url: 'https://www.shabaton.online/btl_shabaton' },
    { kw: ['תוכנית לימודים','ש"ש','לימודי חובה','לימודי השלמה','שעות רשות','שעות חובה','שעות השלמה','שעות פנויות'], url: 'https://www.shabaton.online/shabaton-hova-hashlama' },
    { kw: ['תוכנית לימודים','כמה שעות','שעות לימוד','מה לומדים'], url: 'https://www.shabaton.online/learning_programs_shabaton' },
    { kw: ['טפסים','מסמכים'], url: 'https://www.shabaton.online/forms_shabaton' },
    { kw: ['לוח זמנים','מועדים','תאריכים'], url: 'https://www.shabaton.online/luz_shabaton' },
    { kw: ['חצי שבתון','שבתון מלא','שבתון חלקי'], url: 'https://www.shabaton.online/halforfull_shabaton' },
    { kw: ['בקשת שבתון','איך מבקשים','יציאה לשבתון','איך יוצאים'], url: 'https://www.shabaton.online/shabaton_request' },
    { kw: ['תשלומים','עלויות','שכר לימוד'], url: 'https://www.shabaton.online/Payments_shabaton' },
    { kw: ['חזרה משבתון','סיום שבתון','חזרה לעבודה'], url: 'https://www.shabaton.online/end_shabaton' },
    { kw: ['זכויות','זכאות','מי זכאי','תנאים לשבתון'], url: 'https://www.shabaton.online/important' },
  ];
  return [...new Set(
    pages.filter(p => p.kw.some(k => q.includes(k))).map(p => p.url)
  )];
}

// ── שליפת תוכן מדף אתר ───────────────────────────────
async function fetchPageContent(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShabatonBot/1.0)' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // מצא את התוכן הרלוונטי
    const markers = ['שבתון', 'מענק', 'לידה', 'זכויות'];
    let start = 0;
    for (const m of markers) {
      const i = text.indexOf(m);
      if (i > 100) { start = Math.max(0, i - 100); break; }
    }
    return text.substring(start, start + 2500);
  } catch(e) { return null; }
}

// ── בניית context ─────────────────────────────────────
async function buildContext(message) {
  const region = detectRegion(message);
  const parts = [];

  // סריקת דפי אתר רלוונטיים בזמן אמת
  const infoUrls = detectInfoPages(message);
  if (infoUrls.length > 0) {
    const contents = await Promise.all(
      infoUrls.slice(0, 2).map(url => fetchPageContent(url))
    );
    contents.forEach((content, i) => {
      if (content) parts.push(`=== מידע מ-${infoUrls[i]} ===\n${content}`);
    });
  }

  // חיפוש קורסים באינדקסים
  const stop = new Set(['את','של','על','עם','אל','כל','גם','לא','מה','מי','איך']);
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  const results = [], seen = new Set();
  ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json'].forEach(fname => {
    const data = loadJSON(fname);
    if (!data) return;
    const pages = Array.isArray(data) ? data : (data.pages || []);
    pages.forEach(page => {
      const url = page.url || page.link || '';
      if (seen.has(url) || url.includes('/results-')) return;
      const title = (page.title || '').toLowerCase();
      const desc  = (page.description || '').toLowerCase();
      let score = 0;
      words.forEach(w => {
        if (title.includes(w)) score += 3;
        else if (desc.includes(w)) score += 2;
        else if ((page.text||'').toLowerCase().includes(w)) score += 1;
      });
      if (!score) return;
      if (region) region.cities.forEach(c => { if ((title+desc).includes(c.toLowerCase())) score += 5; });
      seen.add(url);
      results.push({ title: page.title, url, description: page.description||'', score });
    });
  });
  results.sort((a,b) => b.score - a.score);
  const top = results.slice(0, 8);
  if (top.length) {
    parts.push('\n=== קורסים שנמצאו ===');
    top.forEach(c => parts.push(`שם: ${c.title}\nקישור: ${c.url}${c.description ? '\nתיאור: '+c.description.substring(0,120) : ''}`));
  }

  if (region) parts.push(`\nאזור: ${region.name} | slug: ${region.slug}`);
  return { context: parts.join('\n\n'), isInfo: infoUrls.length > 0 };
}

// ── בחירת מודל ────────────────────────────────────────
function chooseModel(q) {
  return /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|אופק|תואר|זכויות/.test(q)
    ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
}

// ── Handler ────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method === 'GET')     return res.status(200).json({ status: 'ok', bot: 'shabi-v4' });
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || '';
  const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Missing API key' });

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    const message = body.message || '';
    const history = body.history || [];
    const site    = body.site    || 'shabaton';
    if (!message) return res.status(400).json({ error: 'message required' });

    console.log(`POST [${site}]: ${message.substring(0,60)}`);

    const { context, isInfo } = await buildContext(message);
    const isCourseQ = ['קורס','לימוד','לימודים','מוסד','מכללה','אוניברסיטה','השתלמות'].some(k => message.includes(k));
    const isInfoQuestion = !!(isInfo && !isCourseQ);
    const model   = chooseModel(message);
    let userContent = context
      ? `${context}\n\n---\nשאלת הגולש: ${message}`
      : message;
    if (isInfoQuestion) {
      userContent = `חפש באתר shabaton.online מידע על: ${message}\n\nאחרי החיפוש, ענה בעברית בצורה מפורטת ומדויקת לפי המידע שמצאת.`;
    }

    // הפעל web_search לכל שאלת מידע (לא שאלת קורסים)
    const courseKW = ['קורס','קורסים','לימוד','לימודים','מוסד','מכללה','אוניברסיטה','השתלמות','תואר'];
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model, max_tokens: 2500, system: SYSTEM_PROMPT,
        messages: [...history.slice(-6), { role: 'user', content: userContent }],
        ...(isInfoQuestion ? {
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          tool_choice: { type: 'auto' }
        } : {})
      })
    });

    if (!claudeRes.ok) {
      const t = await claudeRes.text();
      throw new Error('Claude ' + claudeRes.status + ': ' + t.substring(0,100));
    }
    const data = await claudeRes.json();
    // טיפול בתגובת web_search - agentic loop
    let reply = '';
    let loopData = data;
    let loopMessages = [...history.slice(-6), { role: 'user', content: userContent }];
    
    for (let i = 0; i < 3; i++) {
      // אסוף טקסט
      if (loopData.content) {
        for (const block of loopData.content) {
          if (block.type === 'text') reply += block.text;
        }
      }
      // בדוק אם יש tool_use שצריך לטפל בו
      const toolUseBlocks = loopData.content?.filter(b => b.type === 'tool_use') || [];
      if (toolUseBlocks.length === 0) break;
      
      // בנה tool_results
      const toolResults = toolUseBlocks.map(tu => ({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: tu.name === 'web_search' ? '(search results will be provided by API)' : ''
      }));
      
      // שלח המשך
      loopMessages = [...loopMessages,
        { role: 'assistant', content: loopData.content },
        { role: 'user', content: toolResults }
      ];
      
      const nextRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 2500, system: SYSTEM_PROMPT, messages: loopMessages,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }] })
      });
      if (!nextRes.ok) break;
      loopData = await nextRes.json();
      reply = ''; // reset - נשתמש בתשובה החדשה
    }
    
    if (!reply) reply = loopData.content?.[0]?.text || '';
    console.log(`OK ${model} | ${reply.length} chars`);

    if (ZAPIER_WEBHOOK_URL) {
      try {
        const now = new Date();
        await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: now.toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'}),
            time: now.toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}),
            site, question: message, answer: reply, model,
            needs_learning: reply.includes('לא נמצאו') ? 'YES' : 'OK'
          })
        });
      } catch(ze) {}
    }

    return res.status(200).json({ reply, model });

  } catch(e) {
    console.error('ERROR:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
