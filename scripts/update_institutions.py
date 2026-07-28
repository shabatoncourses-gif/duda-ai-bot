#!/usr/bin/env python3
"""
update_institutions.py
======================
מייצר known_institutions ב-study-fields.json אוטומטית מקובץ Excel של הפורטל.

שימוש:
  python update_institutions.py מסד_דודא.xlsx data/study-fields.json

GitHub Action:
  python scripts/update_institutions.py data/מסד_דודא.xlsx data/study-fields.json
"""

import sys, os, json, re
import pandas as pd

# ── מיפוי שמות תחום Excel → שמות תחום ב-study-fields.json ──────────────
FIELD_MAP = {
    'אימון - nlp':                                    'אימון - NLP',
    'אמנות ואומנויות':                               'אמנות ואומנויות',
    'אומנות ואומניות':                               'אמנות ואומנויות',
    'אמנות ואומנוית':                                'אמנות ואומנויות',
    'אופק חדש - עוז לתמורה':                         'אופק חדש - עוז לתמורה',
    'קורסי אופק חדש - עוז לתמורה':                   'אופק חדש - עוז לתמורה',
    'אקדמי - תואר שני':                              'תואר שני בחינוך ובהוראה',
    'בישול וקונדיטוריה':                             'בישול וקונדיטוריה',
    'בריאות ותזונה נכונה':                           'בריאות ותזונה נכונה',
    'גיל רך - חינוך קדם יסודי':                     'גיל רך - חינוך קדם יסודי',
    'קורסים לגיל רך - חינוך קדם יסודי':             'גיל רך - חינוך קדם יסודי',
    'גישור, משפט':                                   'גישור',
    'גרפולוגיה ונומרולוגיה':                         'גרפולוגיה ונומרולוגיה',
    'דרמה, פסיכודרמה, תיאטרון בובות':               'דרמה, פסיכודרמה, תיאטרון בובות',
    'קורסי דרמה, פסיכודרמה, קורסי תיאטרון בובות':   'דרמה, פסיכודרמה, תיאטרון בובות',
    'הדרכת הורים, זוגיות ומשפחה':                   'הדרכת הורים, זוגיות ומשפחה',
    'הוראה מתקנת - מותאמת':                         'הוראה מתקנת - הוראה מותאמת',
    'הוראה מתקנת':                                   'הוראה מתקנת - הוראה מותאמת',
    'הנחיית קבוצות':                                 'הנחיית קבוצות',
    'העצמה והתפתחות אישית':                          'העצמה והתפתחות אישית',
    'העצמה נשית - לימודי נשים ומגדר':               'העצמה והתפתחות אישית',
    'חברה וקהילה':                                   'חברה וקהילה',
    'חינוך גופני':                                   'חינוך גופני',
    'חינוך והוראה':                                  'חינוך והוראה',
    'חינוך סביבתי, לימודי ארץ ישראל':               'חינוך סביבתי - לימודי ארץ ישראל',
    'חינוך סביבתי - לימודי ארץ ישראל':              'חינוך סביבתי - לימודי ארץ ישראל',
    'קורסי חינוך סביבתי - לימודי ארץ ישראל':        'חינוך סביבתי - לימודי ארץ ישראל',
    'טיול סיור ונופש':                               'טיולים וסיורים לימודיים',
    'טיפול ותרפיה':                                  'תרפיה וטיפול',
    'טכנולוגיה דיגיטלית ואינטרנט':                  'טכנולוגיה דיגיטלית ואינטרנט',
    'יהדות, מורשת ישראל ודתות':                     'יהדות, מורשת ישראל ודתות',
    'ייעוץ ארגוני':                                  'ייעוץ ארגוני',
    'ייעוץ חינוכי':                                  'ייעוץ חינוכי',
    'כתיבה יוצרת':                                   'כתיבה יוצרת - כתיבה עיונית - כתיבה אקדמית',
    'כתיבה יוצרת - כתיבה עיונית - כתיבה אקדמית':   'כתיבה יוצרת - כתיבה עיונית - כתיבה אקדמית',
    'קורסי כתיבה יוצרת - קורסי כתיבה עיונית - כתיבה אקדמית': 'כתיבה יוצרת - כתיבה עיונית - כתיבה אקדמית',
    'לגימלאים':                                      'קורסים לגימלאים',
    'לגמלאים':                                       'קורסים לגימלאים',
    'קורסים לגימלאים':                               'קורסים לגימלאים',
    'למידה מרחוק':                                   'למידה מרחוק',
    'לציבור הדתי':                                   'לציבור הדתי',
    'קורסים לציבור הדתי':                            'לציבור הדתי',
    'לקויות למידה וחינוך מיוחד':                    'לקויות למידה וחינוך מיוחד',
    'מדעי הרוח':                                     'מדעי הרוח',
    'מוסיקה':                                        'מוסיקה',
    'מידענות וספרנות':                               'מידענות וספרנות',
    'מיינדפולנס ומדיטציה':                           'מיינדפולנס ומדיטציה',
    'מנהל עסקים - פיננסים - יזמות':                'מנהל עסקים - פיננסים - יזמות',
    'מתמטיקה ומדעים':                                'הוראת מתמטיקה ומדעים',
    'ניהול חינוכי':                                  'ניהול חינוכי',
    'ניתוח התנהגות':                                 'ניתוח התנהגות',
    'ספורט, מחול ותנועה':                            'ספורט, מחול ותנועה',
    'עיצוב אופנה - תפירה':                          'עיצוב אופנה - תפירה',
    'עיצוב אופנה / תפירה':                           'עיצוב אופנה - תפירה',
    'עיצוב הבית':                                    'עיצוב פנים - הום סטיילינג',
    'עיצוב פנים - home styling':                     'עיצוב פנים - הום סטיילינג',
    'עריכה לשונית':                                  'עריכה לשונית',
    'פיתוח מקצועי למורים':                           'פיתוח מקצועי למורים',
    'פסיכולוגיה וייעוץ':                             'פסיכולוגיה וייעוץ',
    'צורפות ותכשיטנות':                              'צורפות ותכשיטנות',
    'צילום':                                          'צילום',
    'קורסי צילום':                                   'צילום',
    'קורסי קיץ':                                     'קורסי קיץ',
    'קורסי קיץ':                                     'קורסי קיץ',
    'איפור, טיפוח אישי וסטיילינג':                  'איפור, טיפוח אישי וסטיילינג',
    'קורסים לציבור הדתי':                            'קורסים לציבור הדתי',
    'לציבור הדתי':                                    'לציבור הדתי',
    'רפואה משלימה':                                  'רפואה משלימה',
    'שפות, הוראת שפות,תרגום':                        'שפות - הוראת שפות - תרגום',
    'תואר שלישי - דוקטורט':                         'תואר שלישי - דוקטורט',
    'תיירות':                                         'תיירות',
    'תקשורת בין-אישית':                              'תקשורת בין-אישית',
    'תרבות העשרה ואקטואליה':                         'תרבות העשרה ואקטואליה',
    'תרפיה  וטיפול':                                 'תרפיה וטיפול',
    'תרפיה וטיפול':                                  'תרפיה וטיפול',
    'איפור, טיפוח אישי וסטיילינג':                  'איפור, טיפוח אישי וסטיילינג',
}


def normalize(s):
    s = str(s).strip()
    s = re.sub(r'\s+', ' ', s)
    s = s.replace(' / ', ' - ').replace('/', ' - ')
    return s.lower()


VALID_URL_PREFIXES = (
    'https://www.shabaton.online/',
    'https://www.morim.boutique/',
    'https://shabaton.online/',
    'https://morim.boutique/',
)

def is_valid_institution_url(url):
    """Only accept shabaton.online or morim.boutique URLs."""
    return any(str(url).startswith(p) for p in VALID_URL_PREFIXES)


def smart_truncate(s, limit=800):
    """
    חותך תיאור ארוך, אבל מנסה לחתוך בגבול שורה (\\n) קרוב לסוף, ולא באמצע מילה/קורס.
    המגבלה הקודמת (200 תווים) קטעה בפועל קורסים שלמים שמופיעים בסוף רשימות ארוכות
    (לדוגמה: "טבע ובריאות ביערות הכרמל" של עתיד ירוק, שמופיע אחרי תו 200).
    """
    if len(s) <= limit:
        return s
    cut = s[:limit]
    last_nl = cut.rfind('\n')
    if last_nl > limit * 0.5:
        return cut[:last_nl].rstrip()
    return cut.rstrip()


def build_institutions_from_excel(excel_path):
    df = pd.read_excel(excel_path, sheet_name='גיליון1')
    field_institutions = {}  # {sf_field_name: {url: entry}}

    for _, row in df.iterrows():
        excel_field_raw = str(row.get('DisciplineName', '')).strip()
        excel_field_norm = normalize(excel_field_raw)

        # ── match to known sf field ──
        sf_field = FIELD_MAP.get(excel_field_norm) or FIELD_MAP.get(excel_field_raw.lower())
        if not sf_field:
            continue

        url  = str(row.get('CompanyDudaURL', '')).strip()
        name = str(row.get('CompanyName', '')).strip()
        desc = str(row.get('ItemsShortSummery', '')).strip() if str(row.get('ItemsShortSummery','')) != 'nan' else ''
        desc = smart_truncate(desc, 800)

        # CompanySnifim — רשימת מיקומים/סניפים (למשל "מודיעין, תל אביב, למידה מרחוק")
        # חיוני לסינון לפי עיר/אזור: בלעדיו, אי אפשר לזהות "קורס במודיעין".
        snifim_raw = str(row.get('CompanySnifim', '')).strip()
        locations = []
        if snifim_raw and snifim_raw != 'nan':
            locations = [s.strip() for s in snifim_raw.split(',') if s.strip()]

        if sf_field not in field_institutions:
            field_institutions[sf_field] = {}
        if url and url not in field_institutions[sf_field] and is_valid_institution_url(url):
            entry = {
                'title': name,
                'url': url,
                'description': desc,
            }
            if locations:
                entry['locations'] = locations
            field_institutions[sf_field][url] = entry

    return {k: list(v.values()) for k, v in field_institutions.items()}


def apply_manual_overlay(institutions_by_field, overlay_path):
    """
    מחיל תוספות/תיקוני טקסט ידניים על תיאורי מוסדות, אחרי שנבנו מהאקסל.
    תומך גם ב-fieldAdditions: שיוך מוסד קיים לשדה נוסף שהוא לא מסווג אליו באקסל.

    למה זה קיים: study-fields.json נבנה מחדש במלואו מהאקסל בכל הרצה — כל
    תיקון ידני שנעשה ישירות בקובץ (למשל הוספת "שילוב אומנויות" לתיאור מוסד
    שלא הכיל את המילה, או הוספת מוסד לשדה נוסף) נמחק בהרצה הבאה. הפתרון:
    לתעד תיקונים כאלה פעם אחת ב-manual-description-tags.json, והם יוחלו
    אוטומטית כאן, בכל הרצה, לצמיתות.
    """
    if not os.path.exists(overlay_path):
        return institutions_by_field

    with open(overlay_path, 'r', encoding='utf-8') as f:
        overlay = json.load(f)

    applied = 0
    for tag in overlay.get('tags', []):
        url, prepend = tag.get('url'), tag.get('prependText', '')
        field_scope = tag.get('field')  # אופציונלי - אם קיים, מגביל לשדה הזה בלבד
        if not url or not prepend:
            continue
        for field_name, field_entries in institutions_by_field.items():
            if field_scope and field_name != field_scope:
                continue
            for entry in field_entries:
                if entry.get('url') == url and prepend not in entry.get('description', ''):
                    entry['description'] = prepend + '\n' + entry.get('description', '')
                    applied += 1

    for fix in overlay.get('textFixes', []):
        url = fix.get('url')
        field_scope = fix.get('field')
        find, replace = fix.get('find', ''), fix.get('replace', '')
        if not url or not find:
            continue
        for field_name, field_entries in institutions_by_field.items():
            if field_scope and field_name != field_scope:
                continue
            for entry in field_entries:
                if entry.get('url') == url and find in entry.get('description', ''):
                    entry['description'] = entry['description'].replace(find, replace)
                    applied += 1

    # fieldAdditions: שיוך מוסד לשדה נוסף שהוא לא מופיע בו באקסל המקורי
    # (לדוגמה: מוסד שמציע תוכן רלוונטי לשדה מסוים בין שאר הקורסים שלו,
    # אבל לא סווג לשדה הזה באקסל). מוצא עותק קיים של המוסד (מכל שדה שהוא)
    # ומשכפל אותו לתוך רשימת המוסדות של השדה היעד, אם הוא עוד לא שם.
    for addition in overlay.get('fieldAdditions', []):
        url = addition.get('url')
        target_field = addition.get('field')
        if not url or not target_field:
            continue
        source_entry = None
        for field_entries in institutions_by_field.values():
            for entry in field_entries:
                if entry.get('url') == url:
                    source_entry = entry
                    break
            if source_entry:
                break
        if not source_entry:
            print(f"⚠️  fieldAdditions: לא נמצא מוסד קיים עם url={url} להעתקה לשדה '{target_field}'")
            continue
        target_entries = institutions_by_field.setdefault(target_field, [])
        if not any(e.get('url') == url for e in target_entries):
            target_entries.append(dict(source_entry))
            applied += 1

    if applied:
        print(f"🏷️  הוחלו {applied} תוספות/תיקונים ידניים מ-{os.path.basename(overlay_path)}")
    else:
        print(f"🏷️  overlay נטען ({os.path.basename(overlay_path)}) — לא נדרשו שינויים (כבר מעודכן, או URL/שדה לא נמצאו)")

    return institutions_by_field


def update_study_fields(sf_path, institutions_by_field):
    with open(sf_path, 'r', encoding='utf-8') as f:
        sf = json.load(f)

    updated = 0
    not_matched = []

    for field in sf.get('studyFields', []):
        fname = field.get('name', '').strip()
        if fname in institutions_by_field:
            field['known_institutions'] = institutions_by_field[fname]
            updated += 1
        else:
            not_matched.append(fname)

    with open(sf_path, 'w', encoding='utf-8') as f:
        json.dump(sf, f, ensure_ascii=False, indent=2)

    total = len(sf.get('studyFields', []))
    total_inst = sum(len(f.get('known_institutions', [])) for f in sf.get('studyFields', []))

    print(f"✅ עודכנו {updated}/{total} תחומים | {total_inst} רשומות מוסד-תחום")
    if not_matched:
        print(f"⚠️  תחומים ללא מיפוי ({len(not_matched)}): {', '.join(not_matched[:5])}")

    return updated


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python update_institutions.py <excel.xlsx> <study-fields.json>")
        sys.exit(1)

    excel_path = sys.argv[1]
    sf_path    = sys.argv[2]

    print(f"📥 קורא: {excel_path}")
    institutions = build_institutions_from_excel(excel_path)
    print(f"📊 נמצאו {sum(len(v) for v in institutions.values())} רשומות ב-{len(institutions)} תחומים")

    overlay_path = os.path.join(os.path.dirname(sf_path) or '.', 'manual-description-tags.json')
    institutions = apply_manual_overlay(institutions, overlay_path)

    print(f"📝 מעדכן: {sf_path}")
    update_study_fields(sf_path, institutions)
    print("✅ סיום")
