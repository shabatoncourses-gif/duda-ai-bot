#!/usr/bin/env python3
"""
update_contact_phones.py
=========================
מייצר את data/contact-phones.json מתוך גיליון3 ("גיליון3") בקובץ
פרטי_קשר_כל_המוסדות.xlsx — מיפוי שם-מוסד/איש-קשר -> קישור לדף יצירת-קשר
טלפוני בפורטל שבתון (https://www.shabaton.online/contact-us-phone/{מספר סידורי}).

למה גיליון3 ולא גיליון1: גיליון3 הוא הרשימה הנקייה-לחיפוש (109 שורות, בלי
כל השדות המנהליים של גיליון1) — והחשוב מכך: הוא כולל גם alias-ים של
*אנשי-קשר* בנוסף לשמות-המוסדות (למשל "קטרינה" בנוסף ל-"AquAerobic",
עם אותו מספר סידורי) — בדיוק בשביל מקרים שבהם גולש שואל על איש-קשר
בשמו הפרטי ולא בשם המוסד. גיליון1 לא מכיל את ה-alias-ים האלה בכלל.

שתי שכבות התאמה בפלט:
  1. contacts — מפתח=שם מדויק (או "עוגן" — המקטע הראשון לפני מפריד) -> url.
     התאמה מהירה ומדויקת, נבדקת ראשונה ב-JS.
  2. fuzzyEntries — רשימת {name, url, words, strongWords}, כש-words היא
     רשימת ה"מילים הייחודיות" בשם (אחרי הסרת מילים גנריות + מילים
     שחוזרות בכמה מוסדות אחרים), ו-strongWords תת-קבוצה מתוכן שכל אחת
     מהן ייחודית-לחלוטין למוסד הזה בכל המאגר. משמשת כשכבת-גיבוי לזיהוי
     גם כשהגולש כתב רק חלק מהשם, לא ברצף מדויק — למשל "כרמית יומן
     ויזואלי" בשביל "כרמית לייבוביץ - יומן ויזואלי" (מדלג על "לייבוביץ"),
     או אפילו "יפית" לבד בשביל "ד'ר יפית מורדוף - ...". הדרישה בצד ה-JS:
     לפחות מילה אחת מ-strongWords, *או* לפחות 2 מילים מתוך words.

שימוש:
  python update_contact_phones.py פרטי_קשר_כל_המוסדות.xlsx data/contact-phones.json

GitHub Action:
  python scripts/update_contact_phones.py data/פרטי_קשר_כל_המוסדות.xlsx data/contact-phones.json
"""

import sys, json, re
import pandas as pd

BASE_URL = 'https://www.shabaton.online/contact-us-phone/'
SHEET_NAME = 'גיליון3'

# מילים גנריות מפורשות — מונחים מוסדיים כלליים שלא מזהים מוסד ספציפי,
# לפי בקשה מפורשת ("לא מדובר על מילים כלליות כמו מכללת / השתלמויות /
# אוניברסיטה / בית ספר וכדומה") + תוספות סבירות מאותה משפחה.
EXPLICIT_STOPWORDS = {
    'מכללת', 'מכללה', 'המכללה', 'האקדמית', 'אקדמית', 'אקדמי', 'האקדמי',
    'השתלמויות', 'השתלמות', 'אוניברסיטה', 'אוניברסיטת', 'האוניברסיטה',
    'בית', 'ביה"ס', "ביה'ס", 'ספר', 'מרכז', 'המרכז', 'מכון', 'המכון',
    'לימודי', 'לימודים', 'תעודה', 'יחידה', 'היחידה', 'עש', 'ע"ש', "ע'ש",
    'דר', "ד'ר", 'פרופ', "פרופ'", 'בהנהלת', 'בניהולה', 'בניהולו',
    'בהובלת', 'שיטת', 'לפיתוח', 'פיתוח', 'פרופסיונלי', 'מקצועי',
    'עובדי', 'הוראה', 'ולימודי',
}

# מילים קצרות מדי כדי לזהות משהו ספציפי (מילות-חיבור וכו')
MIN_WORD_LEN = 2

WORD_SPLIT_RE = re.compile(r"[-–,/'\"׳״()]+|\s+")


def tokenize(name):
    words = [w.strip() for w in WORD_SPLIT_RE.split(name) if w.strip()]
    return [w for w in words if len(w) >= MIN_WORD_LEN]


def anchor_of(name):
    """
    מחלץ את ה'עוגן' — המקטע הראשון לפני מפריד (- / – / ,) — מתוך שם ארוך.
    אותה טכניקה בדיוק כמו getInstitutionNameIndex ב-ai_chat_v2.js: ברוב
    המקרים זה השם הקצר-והנפוץ שבו אנשים בפועל מתייחסים למוסד (למשל
    "AquAerobic" מתוך "AquAerobic - פעילות גופנית במים..."), ולא כל התיאור
    הארוך. משמש כ-alias נוסף לחיפוש, כי חיפוש-טלפון תלוי בכך שהודעת
    המשתמש *מכילה* את השם המדויק — שם ארוך מדי כמעט אף פעם לא יופיע
    מילה-במילה בהודעה קצרה של גולש.
    """
    anchor = re.split(r'[-–,]', name)[0].strip()
    return anchor


def build_contacts_from_excel(excel_path):
    df = pd.read_excel(excel_path, sheet_name=SHEET_NAME)
    rows = []
    for _, row in df.iterrows():
        name = str(row.get('CompanyName', '')).strip()
        url_raw = row.get('Url')
        if not name or name == 'nan' or pd.isna(url_raw):
            continue
        rows.append((name, f'{BASE_URL}{int(url_raw)}'))

    # ── שכבה 1: contacts (שם מדויק + עוגן) ──
    # מעבר ראשון: לכל עוגן אפשרי, אוספים את *כל* ה-url-ים שהוא מתאים
    # אליהם בכל המאגר. רק עוגן שמתאים ל-url יחיד ויחיד בלבד (על פני כל
    # השורות) בטוח להוספה כ-alias. חובה מעבר-ראשון-שלם לפני שמחליטים —
    # אחרת המופע *הראשון* של עוגן מתנגש מתווסף לפני שההתנגשות מתגלה
    # (באג שנצפה בפועל: "סמינר הקיבוצים" נוסף מהשורה הראשונה, וההתנגשות
    # מול השורה השנייה לא הסירה אותו בדיעבד).
    anchor_urls = {}
    for name, url in rows:
        anchor = anchor_of(name)
        if anchor and anchor != name and len(anchor) >= 3:
            anchor_urls.setdefault(anchor, set()).add(url)

    contacts = {}
    dupes = []
    for name, url in rows:
        if name in contacts:
            dupes.append(name)
        contacts[name] = url

    skipped_anchor_collisions = [a for a, urls in anchor_urls.items() if len(urls) > 1]
    for anchor, urls in anchor_urls.items():
        if len(urls) == 1:
            contacts[anchor] = next(iter(urls))

    if dupes:
        print(f"⚠️  שמות כפולים בגיליון (נשמרה השורה האחרונה): {', '.join(dupes)}")
    if skipped_anchor_collisions:
        print(f"⚠️  עוגנים מעורפלים בין מוסדות שונים (לא נוספו כ-alias): {', '.join(sorted(skipped_anchor_collisions))}")

    # ── שכבה 2: fuzzyEntries (מילים ייחודיות, נגזרות מתדירות המילה בכל המאגר) ──
    # מילה נחשבת "גנרית" (ולא מסייעת לזהות מוסד ספציפי) אם היא ב-
    # EXPLICIT_STOPWORDS, *או* אם היא מופיעה תחת 3 מוסדות שונים (url-ים
    # שונים) או יותר — וזה גם מטפל אוטומטית במוסדות-רב-תוכניות (וינגייט/
    # הרצוג/תלפיות וכו'): השם המשותף לכל תת-התוכניות שלהם חוזר הרבה,
    # ולכן מסונן, ומה שנשאר הוא בדיוק החלק המבדיל בין התוכניות.
    #
    # תדירות נמדדת לפי מספר ה-url-ים השונים שהמילה מופיעה תחתם — לא לפי
    # מספר השורות — כדי שלא תתנפח מלאכותית בגלל שורות-alias של אנשי-קשר
    # (כמו "יפית מורדוף" בנוסף לשורת המוסד המלאה) שמצביעות על אותו url.
    #
    # strongWords: מילים ייחודיות-לחלוטין (url אחד בלבד בכל המאגר, ואורך
    # 3+) — מספיקות *לבדן* כדי להתאים (למשל "יפית" או "כרמית"). שאר
    # המילים הייחודיות (מופיעות תחת 2 url-ים) נדרשות בזוג, כדי לא להתאים
    # על סמך מילה בודדת שעלולה להיות מעורפלת.
    word_urls = {}
    for name, url in rows:
        for w in set(x.lower() for x in tokenize(name)):
            word_urls.setdefault(w, set()).add(url)

    fuzzy_entries = []
    for name, url in rows:
        distinctive = [
            w for w in tokenize(name)
            if w.lower() not in EXPLICIT_STOPWORDS and len(word_urls.get(w.lower(), ())) < 3
        ]
        if not distinctive:
            continue
        strong = [w for w in distinctive if len(word_urls.get(w.lower(), ())) == 1 and len(w) >= 3]
        fuzzy_entries.append({'name': name, 'url': url, 'words': distinctive, 'strongWords': strong})

    return contacts, fuzzy_entries


def write_contacts_json(contacts, fuzzy_entries, out_path):
    output = {
        'version': '1.1',
        'description': (
            'מיפוי שם-מוסד/איש-קשר -> קישור לדף יצירת-קשר טלפוני בפורטל שבתון '
            '(contact-us-phone). נבנה מתוך גיליון3 של פרטי_קשר_כל_המוסדות.xlsx. '
            'משמש למניעת חשיפת מספרי טלפון ישירות בצ׳אט — במקום זאת מפנים לדף הייעודי. '
            'contacts = התאמה מדויקת (שם מלא/עוגן). fuzzyEntries = שכבת-גיבוי לפי '
            'מילים ייחודיות, לזיהוי חלקי (למשל "כרמית יומן ויזואלי" בלי "לייבוביץ").'
        ),
        'contacts': contacts,
        'fuzzyEntries': fuzzy_entries,
    }
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python update_contact_phones.py <excel.xlsx> <contact-phones.json>")
        sys.exit(1)

    excel_path = sys.argv[1]
    out_path = sys.argv[2]

    print(f"📥 קורא: {excel_path} (גיליון: {SHEET_NAME})")
    contacts, fuzzy_entries = build_contacts_from_excel(excel_path)
    print(f"📊 נמצאו {len(contacts)} רשומות מדויקות + {len(fuzzy_entries)} רשומות fuzzy")

    print(f"📝 כותב: {out_path}")
    write_contacts_json(contacts, fuzzy_entries, out_path)
    print("✅ סיום")
