#!/usr/bin/env python3
"""
build_course_bot_index.py
=========================
בונה את אינדקס הנושאים של בוט חיפוש הקורסים (course-bot/course_index.js)
מתוך data/study-fields.json – שמתעדכן ממסד דודא (Excel).

לכל נושא (למשל "מנדלה", "נגרות", "ויטראז'") האינדקס שומר באילו תחומי לימוד
מופיעים קורסים בנושא, מהמתאים ביותר. כך הבוט יודע לאן לשלוח גולש שכותב
"קורס מנדלה" גם כשהמילה לא מופיעה בשם התחום.

מקורות הנושאים:
  1. course-bot/topics.json  – רשימת נושאים שאפשר לערוך ידנית (להוסיף/למחוק).
  2. מילות המפתח של כל תחום ב-study-fields.json.
  3. (רשות) זיהוי אוטומטי של נושאים משמות הקורסים – מופעל עם AUTO_TOPICS=1.

להוספת נושא חדש: מוסיפים אותו ל-course-bot/topics.json ומריצים שוב.

שימוש:
  python scripts/build_course_bot_index.py
  python scripts/build_course_bot_index.py data/study-fields.json course-bot/topics.json course-bot/course_index.js
"""

import json, re, sys, os
from collections import defaultdict

FIELDS_PATH = sys.argv[1] if len(sys.argv) > 1 else "data/study-fields.json"
TOPICS_PATH = sys.argv[2] if len(sys.argv) > 2 else "course-bot/topics.json"
OUT_PATH    = sys.argv[3] if len(sys.argv) > 3 else "course-bot/course_index.js"

# ── שם תחום ב-study-fields.json → קוד Discipline בסקריפט items_list_duda.asp ──
# None = תחום של קהל יעד / מסגרת (לא נושא לימוד) – לא נכנס לאינדקס.
FIELD_TO_ID = {
    "אימון - NLP": 50,
    "איפור, טיפוח אישי וסטיילינג": 78,
    "אמנות ואומנויות": 6,
    "בישול וקונדיטוריה": 1,
    "בריאות ותזונה נכונה": 5,
    "קורסים לגיל רך - חינוך קדם יסודי": 51,
    "גיל רך - חינוך קדם יסודי": 51,
    "גישור": 18,
    "גרפולוגיה ונומרולוגיה": 64,
    "דרמה, פסיכודרמה, תיאטרון בובות": 19,
    "הדרכת הורים, זוגיות ומשפחה": 30,
    "הוראה מתקנת - הוראה מותאמת": 105,
    "הנחיית קבוצות": 45,
    "העצמה והתפתחות אישית": 22,
    "חברה וקהילה": 36,
    "לימודי חינוך גופני": 9,
    "חינוך גופני": 9,
    "חינוך והוראה": 21,
    "חינוך סביבתי - לימודי ארץ ישראל": 8,
    "טיולים וסיורים לימודיים": 87,
    "טכנולוגיה דיגיטלית ואינטרנט": 13,
    "יהדות, מורשת ישראל ודתות": 20,
    "ייעוץ ארגוני": 83,
    "לימודי ייעוץ חינוכי": 96,
    "ייעוץ חינוכי": 96,
    "כתיבה יוצרת - כתיבה עיונית - כתיבה אקדמית": 44,
    "לקויות למידה וחינוך מיוחד": 29,
    "קורסים במדעי הרוח": 34,
    "מדעי הרוח": 34,
    "מוסיקה": 17,
    "מידענות וספרנות": 61,
    "לימודי מיינדפולנס ומדיטציה": 106,
    "מנהל עסקים - פיננסים - יזמות": 48,
    "הוראת מתמטיקה ומדעים": 35,
    "לימודי ניהול חינוכי": 26,
    "ניהול חינוכי": 26,
    "ניתוח התנהגות": 101,
    "ספורט, מחול ותנועה": 93,
    "עיצוב אופנה - תפירה": 46,
    "עיצוב פנים - הום סטיילינג": 69,
    "עיצוב הסביבה": 28,
    "עריכה לשונית": 77,
    "פסיכולוגיה וייעוץ": 42,
    "צורפות ותכשיטנות": 75,
    "צילום": 73,
    "לימודי רפואה משלימה": 3,
    "רפואה משלימה": 3,
    "שפות - הוראת שפות - תרגום": 16,
    "תיירות": 25,
    "תקשורת בין-אישית": 52,
    "תרבות העשרה ואקטואליה": 94,
    "לימודי תרפיה וטיפול": 43,
    "תרפיה וטיפול": 43,
    "קולנוע": 103,
    # תחומי קהל יעד / מסגרת – לא נושא לימוד
    "אופק חדש - עוז לתמורה": None,
    "לימודי תואר שני בחינוך ובהוראה": None,
    "קורסים לגימלאים": None,
    "קורסים בלמידה מרחוק": None,
    "קורסים לציבור הדתי": None,
    "לציבור הדתי": None,
    "קורסים לפיתוח מקצועי למורים": None,
    "לימודי תואר שלישי - דוקטורט": None,
    "קורסי קיץ": None,
}

# תחומים רחבים שמכילים קורסים מכל הסוגים – מקבלים עדיפות נמוכה
CATCH_ALL = {22, 36, 51, 28, 45, 30, 21, 94, 29, 19, 50, 8, 87}

# מילים כלליות שלא יהפכו לנושא
STOP = set("""
קורס קורסים סדנה סדנא סדנאות סדנת לימודי לימודים תואר תעודה תעודת מתחילים מתקדמים מתקדם למתחילים למתקדמים
מורים למורים מורות ולמורים הוראה להוראה שבתון בשבתון שנת שנתי שנתית מכללה המכללה סטודיו אוניברסיטת אוניברסיטה
המרכז מרכז היחידה תוכנית תכנית התכנית מסלול מסלולי הכשרת הכשרה השתלמות השתלמויות השתלמויות פיתוח מקצועי
מפגשים מפגש שיעורים יסודות בסיסי בסיסית מורחב מקיף מרוכז מרוכזת מעשית מעשי מקצועי מקצועית חדש חדשה
עבור בנושא דרך שילוב כלים כלי ככלי ובין ועוד גם עם של על את בין לכל כל אנשי עובדי הוראה חינוכי חינוכית
טיפול תנועה הנחיה ייעוץ אימון ניהול חוסן צמיחה תקווה הדרכה יצירה משפחה מודעות יחסים העצמה התפתחות
ריפוי עיצוב סיפורים ערכים אמנויות אומנויות אומנות אמנות תרפיה שיקום כתיבה קריאה הבעה שפה תקשורת עריכה
ילדים ונוער נוער מבוגרים הורים אישי אישית קבוצתי קבוצות בגיל הגיל לגיל קיץ חורף אביב מיני חוויה חוויתי
למידה לימוד ללמוד המשך הסבה פרויקט פרויקטים אישיים טכניקות טכניקה בשיטת שיטת השיטה גישה מבוא
""".split())

# שמות מקומות ומילים כלליות נוספות שלא ייחשבו נושא כשהן מזוהות אוטומטית
AUTO_STOP = set("""
ירושלים אילת גליל גולן נגב עוטף חיפה תל אביב רעננה נתניה רחובות אשדוד באר שבע מודיעין צפון דרום מרכז שרון
דתי דתיים דתית חרדי חרדית גימלאים גמלאים מרחוק אונליין זום מקוון קיץ
בשביל בלתי בעבודה בעיר בכיף במגוון בראי בהשראת בחוג אשכול אשכולות גישת דיאלוג מגמות מגמת מקצועות מחלקה
""".split())
PREFIXES = "בהולכשמ"

HEB = re.compile(r"[֐-׿]")

def norm(t):
    t = (t or "").lower()
    t = re.sub("[֑-ׇ​-‏﻿]", "", t)   # ניקוד ותווים נסתרים
    t = t.replace("״", '"').replace("׳", "'").replace("’", "'")
    t = re.sub(r"[-–_,.!?;:()/\\|]", " ", t)
    return " " + re.sub(r"\s+", " ", t).strip() + " "

def stem(k):
    s = re.sub(r"(ות|ים|ה)$", "", k)
    return s if len(s) >= 4 else k

def contains(text, k):
    nk = norm(k).strip()
    if not nk:
        return False
    if re.fullmatch(r"[a-z.]{1,3}", nk):                  # ai, nlp – מילה שלמה
        return (" " + nk + " ") in text
    return nk in text or (len(stem(nk)) >= 4 and stem(nk) in text)

def main():
    data = json.load(open(FIELDS_PATH, encoding="utf-8"))
    fields = data.get("studyFields", data)

    texts, sizes, unknown = {}, {}, []
    titles_by_field = defaultdict(list)
    field_kw = defaultdict(set)
    for f in fields:
        name = (f.get("slug") or f.get("name") or "").strip()
        if name not in FIELD_TO_ID:
            unknown.append(name)
            continue
        fid = FIELD_TO_ID[name]
        if fid is None:
            continue
        insts = f.get("known_institutions", []) or []
        parts = []
        for i in insts:
            desc = i.get("description", "") or ""
            for t in re.split(r"\s*/\s*|\n", desc):
                t = t.strip()
                if t:
                    titles_by_field[fid].append(t)
            parts.append(i.get("title", "") + " " + desc)
        texts[fid] = texts.get(fid, " ") + norm(" ".join(parts))
        sizes[fid] = sizes.get(fid, 0) + len(insts)
        for k in f.get("keywords", []) or []:
            if HEB.search(k) and len(k) >= 3 and k not in STOP:
                field_kw[fid].add(k.strip())

    # 1) נושאים מהרשימה הידנית
    try:
        topics = set(json.load(open(TOPICS_PATH, encoding="utf-8")))
    except FileNotFoundError:
        topics = set()
    manual = set(topics)

    # 2) מילות המפתח של התחומים
    for kws in field_kw.values():
        topics |= kws

    # 3) נושאים חדשים: מילים בעברית שחוזרות בשמות של לפחות 2 קורסים, ב-3 תחומים לכל היותר
    word_titles = defaultdict(set)
    word_fields = defaultdict(set)
    for fid, ts in titles_by_field.items():
        for t in ts:
            for w in set(norm(t).split()):
                w = w.strip("\"'")
                if len(w) < 4 or not HEB.search(w) or w in STOP:
                    continue
                if w[0] in "והבלמש" and w[1:] in STOP:          # "ולמורים", "בשבתון"
                    continue
                word_titles[w].add(t)
                word_fields[w].add(fid)
    all_words = set(word_titles)
    def prefixed(w):   # "בפסיפס", "לאבחון" – צורה עם אות שימוש של מילה שכבר קיימת
        return w[0] in PREFIXES and (w[1:] in all_words or w[1:] in topics or len(w) <= 4)
    auto = {w for w in word_titles
            if len(word_titles[w]) >= 3 and len(word_fields[w]) <= 2
            and w not in AUTO_STOP and not prefixed(w)
            and not any(contains(norm(m), w) for m in manual)}
    if os.environ.get("AUTO_TOPICS") == "1":   # זיהוי אוטומטי – כבוי כברירת מחדל (מייצר הרבה רעש)
        topics |= auto
    else:
        auto = set()

    old_index = None
    if os.path.exists(OUT_PATH):
        m0 = re.search(r"window\.SHB_COURSE_IDX = (\{.*\});", open(OUT_PATH, encoding="utf-8").read())
        old_index = json.loads(m0.group(1)) if m0 else None

    # בניית האינדקס
    index = {}
    for k in sorted(topics):
        if k in STOP or k in AUTO_STOP or len(k) < 3:
            continue
        hits = [fid for fid, txt in texts.items() if contains(txt, k)]
        # נושא שמופיע בשם/מילות המפתח של תחום – שייך קודם כל לתחום הזה
        own = [fid for fid in hits if k in field_kw.get(fid, set())]
        if not hits:
            continue
        focused = sorted([h for h in hits if h not in CATCH_ALL and h not in own], key=lambda h: sizes.get(h, 0))
        broad   = sorted([h for h in hits if h in CATCH_ALL and h not in own], key=lambda h: sizes.get(h, 0))
        ranked = (own + focused + broad)[:3]
        single = len(own) == 1 or (not own and len(focused) == 1)
        index[k] = ranked + ([0] if single else [])

    # נושא ידני שלא נמצא הפעם בנתונים – נשמר לפי האינדקס הקודם (אם היה)
    if old_index:
        for k in manual:
            if k not in index and k in old_index:
                index[k] = old_index[k]

    # כתיבת הקובץ – בקידוד ASCII כדי שיעבוד בכל דף, גם בלי הגדרת charset
    body = json.dumps(index, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    old = old_index
    os.makedirs(os.path.dirname(OUT_PATH) or ".", exist_ok=True)
    with open(OUT_PATH, "w", encoding="ascii") as fh:
        fh.write("/* Shabaton course-bot topic index - generated by scripts/build_course_bot_index.py. Do not edit by hand. */\n")
        fh.write("window.SHB_COURSE_IDX = " + body + ";\n")

    # סיכום ללוג
    print(f"✅ נבנה אינדקס עם {len(index)} נושאים מ-{len(texts)} תחומים ({sum(sizes.values())} רשומות מוסדות)")
    print(f"   נושאים ידניים: {len(manual)} | ממילות מפתח: {sum(len(v) for v in field_kw.values())} | זוהו אוטומטית: {len(auto)}")
    if auto:
        print(f"   נושאים שזוהו אוטומטית משמות הקורסים: {sorted(auto)}")
    if old is not None:
        added = sorted(set(index) - set(old)); removed = sorted(set(old) - set(index))
        print(f"   נושאים חדשים: {len(added)} {added[:40]}")
        print(f"   נושאים שירדו: {len(removed)} {removed[:40]}")
    if unknown:
        print(f"⚠️  תחומים ב-study-fields.json שאין להם קוד Discipline (הוסיפו ל-FIELD_TO_ID): {unknown}")

if __name__ == "__main__":
    main()
