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

import sys, json, re
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


def build_institutions_from_excel(excel_path):
    df = pd.read_excel(excel_path)
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
        desc = desc[:200]

        if sf_field not in field_institutions:
            field_institutions[sf_field] = {}
        if url and url not in field_institutions[sf_field]:
            field_institutions[sf_field][url] = {
                'title': name,
                'url': url,
                'description': desc,
            }

    return {k: list(v.values()) for k, v in field_institutions.items()}


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

    print(f"📝 מעדכן: {sf_path}")
    update_study_fields(sf_path, institutions)
    print("✅ סיום")
