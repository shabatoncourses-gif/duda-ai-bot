#!/usr/bin/env python3
"""
update_course_dates.py
=======================
מייצר את data/course-dates.json אוטומטית מקובץ Excel "Dates.xlsx" של הפורטל.
מתייחס רק לגיליון "גיליון1" (לא לגיליונות "מועדים שהוסרו" / "לוח עבודה").

שימוש:
  python update_course_dates.py Dates.xlsx data/course-dates.json

GitHub Action:
  python scripts/update_course_dates.py data/Dates.xlsx data/course-dates.json
"""

import sys, json, re
from datetime import date
import pandas as pd

SHEET_NAME = 'גיליון1'

VALID_URL_PREFIXES = (
    'https://www.shabaton.online/',
    'https://www.morim.boutique/',
    'https://shabaton.online/',
    'https://morim.boutique/',
)

MONTH_ABBR_TO_NUM = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
}


def normalize_month(raw):
    """
    מנרמל ערכי Month שונים מה-Excel לפורמט 'YYYY-MM'.
    מטפל בווריאציות שנמצאו בנתונים בפועל:
      - אותיות גדולות/קטנות לא אחידות: 'Jul2026' -> 'jul2026'
      - שנה עם ספרה חסרה: 'sep026' -> 'sep2026' (חסרה ה-'2' הראשונה)
    מחזיר None אם לא ניתן לפענח.
    """
    if raw is None:
        return None
    s = str(raw).strip().lower()
    m = re.match(r'^([a-z]{3})(\d{3,4})$', s)
    if not m:
        return None
    abbr, year_digits = m.group(1), m.group(2)
    if abbr not in MONTH_ABBR_TO_NUM:
        return None
    if len(year_digits) == 3:
        # שנה עם ספרה חסרה — '026' -> '2026' (מניחים שחסרה ה-'2' הראשונה)
        year_digits = '2' + year_digits
    if len(year_digits) != 4:
        return None
    return f"{year_digits}-{MONTH_ABBR_TO_NUM[abbr]}"


def is_valid_institution_url(url):
    url = str(url).strip()
    return any(url.startswith(p) for p in VALID_URL_PREFIXES)


def build_course_dates_from_excel(excel_path):
    df = pd.read_excel(excel_path, sheet_name=SHEET_NAME)

    courses_by_url = {}   # url -> {"url":..., "title":..., "openings":[...]}
    skipped_bad_url = 0
    skipped_bad_month = 0

    for _, row in df.iterrows():
        url = str(row.get('למידע על הקורסים', '')).strip()
        if not is_valid_institution_url(url):
            skipped_bad_url += 1
            continue

        month = normalize_month(row.get('Month'))
        if not month:
            skipped_bad_month += 1
            continue

        title = str(row.get('שם המוסד', '')).strip()
        course_name_raw = row.get('קורס', '')
        course_name = '' if pd.isna(course_name_raw) else str(course_name_raw).strip()
        date_text_raw = row.get('מועד פתיחה', '')
        date_text = '' if pd.isna(date_text_raw) else str(date_text_raw).strip()

        if url not in courses_by_url:
            courses_by_url[url] = {"url": url, "title": title, "openings": []}

        courses_by_url[url]["openings"].append({
            "month": month,
            "course_name": course_name,
            "date_text": date_text,
        })

    print(f"⏭️  דולגו {skipped_bad_url} שורות עם URL לא תקין")
    print(f"⏭️  דולגו {skipped_bad_month} שורות עם Month לא תקין/לא ניתן לפענוח")

    return list(courses_by_url.values())


def write_course_dates(out_path, courses):
    data = {
        "updated": date.today().isoformat(),
        "courses": courses,
    }
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total_openings = sum(len(c["openings"]) for c in courses)
    print(f"✅ נכתבו {len(courses)} מוסדות/קורסים | {total_openings} מועדי פתיחה")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python update_course_dates.py <Dates.xlsx> <course-dates.json>")
        sys.exit(1)

    excel_path = sys.argv[1]
    out_path = sys.argv[2]

    print(f"📥 קורא: {excel_path} (גיליון: {SHEET_NAME})")
    courses = build_course_dates_from_excel(excel_path)
    print(f"📊 נמצאו {len(courses)} מוסדות עם מועדי פתיחה")

    print(f"📝 כותב: {out_path}")
    write_course_dates(out_path, courses)
    print("✅ סיום")
