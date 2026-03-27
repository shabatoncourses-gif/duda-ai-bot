'use strict';

var fs   = require('fs');
var path = require('path');

var ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || '';
var ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';

var SONNET_MODEL = 'claude-sonnet-4-6';
var HAIKU_MODEL  = 'claude-haiku-4-5-20251001';

function chooseModel(q) {
  return /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|ש"ש|אופק|תואר/.test(q)
    ? SONNET_MODEL : HAIKU_MODEL;
}

var SYSTEM_PROMPT = [
  'שמך שבי, העוזר החכם של שבתון.',
  'ענה תמיד בעברית. אופי חביב וידידותי.',
  'אל תמציא קורסים - השתמש רק במידע שסופק.',
  'בסוף כל תשובה שאל שאלה שתעמיק את העזרה.',
  'הצע גם קורסים בלמידה מרחוק.',
  '',
  'פורמט קורסים:',
  '### שם המוסד',
  'תיאור קצר',
  '[מידע על הקורס](URL)',
  '',
  'footer אחרי הקורסים:',
  '[כל קורסי [תחום] ב[אזור]](https://www.shabaton.online/[slug]/[תחום])',
  '[הצטרף לעלון שבתון](https://www.shabaton.online/shabaton)',
  '[קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)',
  '',
  'slug: צפון=results-Zafon | מרכז=search-results-merkaz | ירושלים=results-jerusalem | דרום=results-shfea-darom | שרון=results-Sharon'
].join('\n');

var _cache = {};
function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    _cache[filename] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', filename), 'utf8'));
  } catch(e) { _cache[filename] = null; }
  return _cache[filename];
}

function detectRegion(q) {
  if (/צפון|חיפה|עכו|נצרת|טבריה|נהריה|גליל|כרמל/.test(q))
    return { name: 'צפון', slug: 'results-Zafon', cities: ['חיפה','נצרת','עכו','טבריה','גליל','כרמל','טירת'] };
  if (/מרכז|תל.?אביב|רמת.?גן|פתח.?תקווה|ראשון|רחובות/.test(q))
    return { name: 'מרכז', slug: 'search-results-merkaz', cities: ['תל אביב','רמת גן','פתח תקווה','ראשון לציון','רחובות'] };
  if (/ירושלים|בית.?שמש/.test(q))
    return { name: 'ירושלים', slug: 'results-jerusalem', cities: ['ירושלים'] };
  if (/דרום|באר.?שבע|אשדוד/.test(q))
    return { name: 'דרום', slug: 'results-shfea-darom', cities: ['באר שבע','אשדוד'] };
  if (/שרון|נתניה|הרצליה|כפר.?סבא/.test(q))
    return { name: 'שרון', slug: 'results-Sharon', cities: ['נתניה','הרצליה','כפר סבא'] };
  return null;
}

function searchIndex(question, region) {
  var qL = question.toLowerCase();
  var stop = {'את':1,'של':1,'על':1,'עם':1,'אל':1,'כל':1,'גם':1,'לא':1,'מה':1,'מי':1,'איך':1};
  var words = qL.split(/\s+/).filter(function(w){ return w.length > 2 && !stop[w]; });
  var results = [], seen = {};
  var indexes = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json'];
  for (var fi = 0; fi < indexes.length; fi++) {
    var data = loadJSON(indexes[fi]);
    if (!data) continue;
    var pages = Array.isArray(data) ? data : (data.pages || []);
    for (var pi = 0; pi < pages.length; pi++) {
      var page = pages[pi];
      var url = page.url || page.link || '';
      if (seen[url] || url.indexOf('/results-') !== -1) continue;
      var title = (page.title || '').toLowerCase();
      var desc = (page.description || '').toLowerCase();
      var score = 0;
      for (var wi = 0; wi < words.length; wi++) {
        if (title.indexOf(words[wi]) !== -1) score += 3;
        else if (desc.indexOf(words[wi]) !== -1) score += 2;
        else if ((page.text||'').toLowerCase().indexOf(words[wi]) !== -1) score += 1;
      }
      if (!score) continue;
      if (region) {
        for (var ci = 0; ci < region.cities.length; ci++) {
          if ((title+desc).indexOf(region.cities[ci].toLowerCase()) !== -1) { score += 5; break; }
        }
      }
      seen[url] = 1;
      results.push({ title: page.title, url: url, description: page.description || '', score: score });
    }
  }
  results.sort(function(a,b){ return b.score - a.score; });
  return results.slice(0, 6);
}

function buildContext(question) {
  var region = detectRegion(question);
  var parts = [];

  // חיפוש ב-QA
  var qa = loadJSON('shabaton-qa.json');
  if (qa) {
    var items = Array.isArray(qa) ? qa : (qa.qaItems || []);
    var qw = question.split(/\s+/).filter(function(w){ return w.length > 3; });
    var rel = items.filter(function(item) {
      var t = ((item.question||item.q||'') + ' ' + (item.answer||item.a||'')).toLowerCase();
      return qw.some(function(w){ return t.indexOf(w.toLowerCase()) !== -1; });
    }).slice(0, 3);
    if (rel.length) {
      parts.push('=== מידע על שבתון ===');
      rel.forEach(function(item) {
        var q = item.question||item.q||'', a = item.answer||item.a||'';
        if (q && a) parts.push("ש: " + q + "\nת: " + a);
      });
    }
  }

  var courses = searchIndex(question, region);
  if (courses.length) {
    parts.push('=== קורסים שנמצאו ===');
    courses.forEach(function(c) {
      parts.push('שם: ' + c.title + '\nקישור: ' + c.url + (c.description ? '\nתיאור: ' + c.description.substring(0,120) : ''));
    });
  } else {
    parts.push('לא נמצאו קורסים ספציפיים.' + (region ? '\nאזור: ' + region.name + '\nURL: https://www.shabaton.online/' + region.slug : ''));
  }
  if (region) parts.push('אזור: ' + region.name + ' | slug: ' + region.slug);
  return parts.join('\n\n');
}

module.exports = async function handler(req, res) {
  // CORS - חייב להיות ראשון
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).json({ ok: true }); return; }
  if (req.method === 'GET') { res.status(200).json({ status: 'ok', bot: 'shabi' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!ANTHROPIC_API_KEY) { res.status(500).json({ error: 'Missing API key' }); return; }

  try {
    var body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    var message = body.message || '';
    var history = body.history || [];
    var site = body.site || 'shabaton';
    if (!message) { res.status(400).json({ error: 'message required' }); return; }

    console.log('POST: ' + message.substring(0, 60));
    var context = buildContext(message);

    var claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: chooseModel(message),
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: history.slice(-6).concat([{
          role: 'user',
          content: context + '\n\n---\nשאלת הגולש: ' + message
        }])
      })
    });

    if (!claudeRes.ok) {
      var errText = await claudeRes.text();
      throw new Error('Claude ' + claudeRes.status + ': ' + errText.substring(0, 200));
    }

    var data = await claudeRes.json();
    var reply = data.content && data.content[0] ? data.content[0].text : '';
    console.log('OK: ' + reply.length + ' chars');

    // Zapier
    if (ZAPIER_WEBHOOK_URL) {
      try {
        await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site: site, question: message, answer: reply, needs_learning: (reply.indexOf('לא נמצאו') !== -1 ? 'YES' : 'OK') })
        });
      } catch(ze) {}
    }

    res.status(200).json({ reply: reply, model: chooseModel(message) });

  } catch(e) {
    console.error('ERROR: ' + e.message);
    res.status(500).json({ error: e.message });
  }
};
