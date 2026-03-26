// ai_chat_v2.js — CommonJS — Shabaton AI Bot
import fs from 'fs';
import path from 'path';

const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || '';
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';
const HAIKU_MODEL        = 'claude-haiku-4-5-20251001';
const SONNET_MODEL       = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = 'שמך שבי, העוזר החכם והלומד של שבתון. אתה מלווה מורים וגננות בשנת השבתון.\n\n' +
  'האופי שלך:\n' +
  '- חביב, ידידותי, סקרן ומעניין\n' +
  '- לומד מכל שיחה ומשתפר\n' +
  '- שואל שאלות הבהרה כדי לדייק את העזרה\n' +
  '- מציע אפשרויות שהגולש לא חשב עליהן\n' +
  '- זוכר מה נאמר בשיחה ומתייחס לזה\n\n' +
  'כללי הלמידה:\n' +
  '- אם הגולש שאל שאלה כללית — שאל אזור, תחום, העדפות\n' +
  '- אם מצאת קורסים — הצע גם קורסים בלמידה מרחוק בתחום\n' +
  '- אם לא מצאת — אל תוותר, הצע תחומים קרובים\n' +
  '- בסוף כל תשובה — שאל שאלה אחת שתעמיק את העזרה\n' +
  '  לדוגמה: "האם יש תחום ספציפי שמעניין אותך?" / "רוצה שאחפש גם בלמידה מרחוק?"\n\n' +
  'אל תמציא קורסים. השתמש רק במידע שסופק.\n\n' +
  'פורמט קורסים:\n' +
  '### שם המוסד\n' +
  'תיאור חם וקצר\n' +
  '[מידע על הקורס](URL)\n\n' +
  'footer תמיד (ללא ---):\n' +
  '[כל הקורסים ב[תחום] ב[אזור]](URL תחום+אזור מקודד)\n' +
  '[הצטרף לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '[קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
  'URL לפי אזור+תחום: https://www.shabaton.online/[slug]/[שם-מקודד]\n' +
  'slug: צפון=results-Zafon | מרכז=search-results-merkaz | ירושלים=results-jerusalem | דרום=results-shfea-darom | שרון=results-Sharon | כל הארץ=results-all';

// Cache
var _cache = {};
function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    var p = path.join(process.cwd(), 'data', filename);
    _cache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) {
    _cache[filename] = null;
  }
  return _cache[filename];
}

// זיהוי אזור
function detectRegion(q) {
  var qL = q.toLowerCase();
  if (/צפון|חיפה|עכו|נצרת|טבריה|נהריה|קריות|עפולה|גליל|כרמל/.test(qL))
    return { name: 'צפון', slug: 'results-Zafon', cities: ['חיפה','נצרת','עכו','טבריה','נהריה','עפולה','קריות','גליל','כרמל','טירת'] };
  if (/מרכז|תל.?אביב|רמת.?גן|פתח.?תקווה|ראשון|רחובות|חולון|בת.?ים|רמלה|לוד/.test(qL))
    return { name: 'מרכז', slug: 'search-results-merkaz', cities: ['תל אביב','רמת גן','פתח תקווה','ראשון לציון','רחובות','חולון'] };
  if (/ירושלים|בית.?שמש/.test(qL))
    return { name: 'ירושלים', slug: 'results-jerusalem', cities: ['ירושלים','בית שמש'] };
  if (/דרום|באר.?שבע|אשדוד|אשקלון/.test(qL))
    return { name: 'דרום', slug: 'results-shfea-darom', cities: ['באר שבע','אשדוד','אשקלון'] };
  if (/שרון|נתניה|הרצליה|כפר.?סבא|רעננה/.test(qL))
    return { name: 'שרון', slug: 'results-Sharon', cities: ['נתניה','הרצליה','כפר סבא','רעננה'] };
  return null;
}

// חיפוש באינדקסים
function searchIndex(question, region) {
  var qL = question.toLowerCase();
  var stopWords = { 'את':1,'של':1,'על':1,'עם':1,'אל':1,'לי':1,'הם':1,'כל':1,'גם':1,'רק':1,'אבל':1,'אם':1,'זה':1,'זו':1,'הוא':1,'היא':1,'אני':1,'כן':1,'לא':1,'מה':1,'מי':1,'איך':1,'בצפון':1,'בדרום':1,'במרכז':1,'בירושלים':1,'בשרון':1 };
  var words = qL.split(/\s+/).filter(function(w){ return w.length > 2 && !stopWords[w]; });

  var results = [];
  var seen = {};
  var indexes = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json','morim_index_part1.json'];

  for (var fi = 0; fi < indexes.length; fi++) {
    var data = loadJSON(indexes[fi]);
    if (!data) continue;
    var pages = Array.isArray(data) ? data : (data.pages || []);

    for (var pi = 0; pi < pages.length; pi++) {
      var page = pages[pi];
      var url = page.url || page.link || '';
      if (seen[url]) continue;
      if (url.indexOf('/results-') !== -1 || url.indexOf('/search-results') !== -1) continue;
      if (url.indexOf('/end_shabaton') !== -1) continue;

      var title = (page.title || '').toLowerCase();
      var desc  = (page.description || '').toLowerCase();
      var text  = (page.text || '').toLowerCase();
      var combined = title + ' ' + desc + ' ' + text;

      var score = 0;
      for (var wi = 0; wi < words.length; wi++) {
        var w = words[wi];
        if (title.indexOf(w) !== -1) score += 3;
        else if (desc.indexOf(w) !== -1) score += 2;
        else if (text.indexOf(w) !== -1) score += 1;
      }
      if (score === 0) continue;

      if (region) {
        for (var ci = 0; ci < region.cities.length; ci++) {
          if (combined.indexOf(region.cities[ci].toLowerCase()) !== -1) { score += 5; break; }
        }
      }

      seen[url] = 1;
      results.push({ title: page.title, url: url, description: page.description || '', score: score });
    }
    if (results.length >= 30) break;
  }

  results.sort(function(a,b){ return b.score - a.score; });
  return results.slice(0, 6);
}

// בניית context
function buildContext(question, site) {
  var region = detectRegion(question);
  var parts = [];

  var qa = loadJSON('shabaton-qa.json');
  if (qa) {
    var items = qa.qaItems || qa;
    if (Array.isArray(items)) {
      var qWords = question.split(/\s+/).filter(function(w){ return w.length > 3; });
      var relevant = items.filter(function(item) {
        var t = ((item.question || item.q || '') + ' ' + (item.answer || item.a || '')).toLowerCase();
        return qWords.some(function(w){ return t.indexOf(w.toLowerCase()) !== -1; });
      }).slice(0, 3);
      if (relevant.length > 0) {
        parts.push('=== מידע רלוונטי על שבתון ===');
        relevant.forEach(function(item) {
          var q = item.question || item.q || '';
          var a = item.answer   || item.a || '';
          if (q && a) parts.push('ש: ' + q + '\nת: ' + a);
        });
      }
    }
  }

  var courses = searchIndex(question, region);
  if (courses.length > 0) {
    parts.push('\n=== קורסים ומוסדות שנמצאו ===');
    courses.forEach(function(c) {
      parts.push('שם: ' + c.title + '\nקישור: ' + c.url + (c.description ? '\nתיאור: ' + c.description.substring(0,120) : ''));
    });
  } else {
    var regionStr = region ? ' ב' + region.name : '';
    parts.push('\n=== תוצאות חיפוש ===\nלא נמצאו קורסים ספציפיים לשאלה' + regionStr + '.');
    if (region) parts.push('קישור לכל הקורסים' + regionStr + ': https://www.shabaton.online/' + region.slug);
  }

  if (region) parts.push('\nאזור שזוהה: ' + region.name);
  return parts.join('\n\n');
}

// בחירת מודל
function chooseModel(question) {
  return /הסבר|מה ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|ש"ש|אופק חדש|תואר/.test(question)
    ? SONNET_MODEL : HAIKU_MODEL;
}

// קריאה ל-Claude
async function callClaude(question, context, history) {
  var model = chooseModel(question);
  var userContent = context ? context + '\n\n---\nשאלת הגולש: ' + question : question;

  var response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: history.slice(-6).concat([{ role: 'user', content: userContent }])
    })
  });

  if (!response.ok) {
    var errText = await response.text().catch(function(){ return 'unknown'; });
    throw new Error('Claude API ' + response.status + ': ' + errText);
  }
  var data = await response.json();
  return { reply: data.content && data.content[0] ? data.content[0].text : '', model: model };
}

// Zapier
async function logToZapier(question, reply, site, model) {
  if (!ZAPIER_WEBHOOK_URL) return;
  try {
    var now = new Date();
    // סמן שאלות ללא תשובה טובה לצורך למידה
    var noAnswer = reply.indexOf('לא נמצאו') !== -1 || reply.indexOf('מצטערים') !== -1;
    await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }),
        time: now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }),
        site: site,
        question: question,
        answer: reply,
        model: model,
        needs_learning: noAnswer ? 'YES - חסר מידע' : 'OK'
      })
    });
  } catch(e) {}
}

// Handler
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET')     { res.status(200).json({ status: 'ok' }); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'POST only' }); return; }
  if (!ANTHROPIC_API_KEY)       { res.status(500).json({ error: 'Missing API key' }); return; }

  var body = req.body || {};
  var message = body.message;
  var history = body.history || [];
  var site    = body.site    || 'shabaton';

  if (!message) { res.status(400).json({ error: 'message required' }); return; }

  try {
    console.log('POST [' + site + '] ' + message.substring(0,60));
    var context = buildContext(message, site);
    var result  = await callClaude(message, context, history);
    console.log('OK: ' + result.model + ' | ' + result.reply.length + ' chars');
    await logToZapier(message, result.reply, site, result.model);
    res.status(200).json({ reply: result.reply, model: result.model });
  } catch(e) {
    console.error('ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
};
