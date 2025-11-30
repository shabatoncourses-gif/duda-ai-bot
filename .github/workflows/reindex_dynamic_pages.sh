#!/bin/bash

# סקריפט למחיקת דפים דינמיים מרשימת הדפים שהושלמו
# כך הם יעובדו מחדש בהרצה הבאה

DONE_FILE="data/shabaton_done.json"

if [ ! -f "$DONE_FILE" ]; then
  echo "❌ קובץ $DONE_FILE לא נמצא"
  exit 1
fi

echo "📋 יוצר גיבוי של $DONE_FILE..."
cp "$DONE_FILE" "${DONE_FILE}.backup"

echo "🔍 מוחק דפים דינמיים מהרשימה..."

# שמירת הקובץ המקורי
original_count=$(cat "$DONE_FILE" | jq '. | length')

# מחיקת כל הדפים שמכילים results- או courses-per-month
cat "$DONE_FILE" | jq '[.[] | select(
  (contains("results-") | not) and 
  (contains("search-results-") | not) and 
  (contains("courses-per-month-") | not)
)]' > "${DONE_FILE}.tmp"

mv "${DONE_FILE}.tmp" "$DONE_FILE"

new_count=$(cat "$DONE_FILE" | jq '. | length')
removed=$((original_count - new_count))

echo "✅ הושלם!"
echo "   📊 דפים במקור: $original_count"
echo "   📊 דפים אחרי: $new_count"
echo "   🗑️ נמחקו: $removed דפים דינמיים"
echo ""
echo "🚀 עכשיו הרץ:"
echo "   node scripts/autoBuildIndex.js Shabaton https://www.shabaton.online/sitemap.xml"
echo ""
echo "   הדפים הדינמיים יעובדו מחדש!"
