'use strict';

var _cache = {};

module.exports = async function handler(req, res) {
  // CORS - חייב להיות השורה הראשונה
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method === 'GET')     return res.status(200).json({ status: 'ok', bot: 'shabi' });
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  var ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || '';
  var ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';

  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Missing API key' });

  try {
    var body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }

    var message = body.message || '';
    var history = body.history || [];
    var site    = body.site    || 'shabaton';

    if (!message) return res.status(400).json({ error: 'message required' });

    console.log('POST [' + site + ']: ' + message.substring(0, 60));

    // בניית context
    var context = '';
    try { context = buildContext(message); } catch(e) { console.warn('context err:', e.message); }

    var SYSTEM_PROMPT = 'שמך שבי, העוזר החכם של שבתון.\n' +
      'ענה תמיד בעברית. אופי חביב, ידידותי, לומד.\n' +
      'אל תמציא קורסים. השתמש רק במידע שסופק.\n' +
      'בסוף כל תשובה שאל שאלה שתעמיק את העזרה.\n' +
      'הצע גם קורסים בלמידה מרחוק.\n' +
      'אסור תווים בשפות זרות. לימודים פנים אל פנים = לימודים פרונטליים.\n\n' +
      'פורמט קורסים:\n' +
      '### שם המוסד\n' +
      'תיאור קצר\n' +
      '[מידע על הקורס](URL)\n\n' +
      'footer (ללא ---):\n' +
      '[כל קורסי [תחום] ב[אזור]](URL)\n' +
      '[הצטרף לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
      '[קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
      'slug: צפון=results-Zafon | מרכז=search-results-merkaz | ירושלים=results-jerusalem | דרום=results-shfea-darom | שרון=results-Sharon';

    var model = /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|אופק|תואר/.test(message)
      ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

    var userContent = context ? context + '\n\n---\nשאלת הגולש: ' + message : message;

    var claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!claudeRes.ok) {
      var errText = await claudeRes.text();
      throw new Error('Claude ' + claudeRes.status + ': ' + errText.substring(0, 100));
    }

    var data = await claudeRes.json();
    var reply = data.content && data.content[0] ? data.content[0].text : '';
    console.log('OK ' + model + ' | ' + reply.length + ' chars');

    if (ZAPIER_WEBHOOK_URL) {
      try {
        var now = new Date();
        await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }),
            time: now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }),
            site: site, question: message, answer: reply, model: model,
            needs_learning: reply.indexOf('לא נמצאו') !== -1 ? 'YES' : 'OK'
          })
        });
      } catch(ze) {}
    }

    return res.status(200).json({ reply: reply, model: model });

  } catch(e) {
    console.error('ERROR:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

// ── פונקציות עזר ──

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

function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    var p = require('path').join(process.cwd(), 'data', filename);
    _cache[filename] = JSON.parse(require('fs').readFileSync(p, 'utf8'));
  } catch(e) { _cache[filename] = null; }
  return _cache[filename];
}

function buildContext(question) {
  var region = detectRegion(question);
  var parts = [];

  try {
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
  } catch(e) {}

  try {
    var qL = question.toLowerCase();
    var stop = {'את':1,'של':1,'על':1,'עם':1,'אל':1,'כל':1,'גם':1,'לא':1,'מה':1,'מי':1,'איך':1};
    var words = qL.split(/\s+/).filter(function(w){ return w.length > 2 && !stop[w]; });
    var results = [], seen = {};
    ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json'].forEach(function(fname) {
      var data = loadJSON(fname);
      if (!data) return;
      var pages = Array.isArray(data) ? data : (data.pages || []);
      pages.forEach(function(page) {
        var url = page.url || page.link || '';
        if (seen[url] || url.indexOf('/results-') !== -1) return;
        var title = (page.title || '').toLowerCase();
        var desc = (page.description || '').toLowerCase();
        var score = 0;
        words.forEach(function(w) {
          if (title.indexOf(w) !== -1) score += 3;
          else if (desc.indexOf(w) !== -1) score += 2;
          else if ((page.text||'').toLowerCase().indexOf(w) !== -1) score += 1;
        });
        if (!score) return;
        if (region) {
          region.cities.forEach(function(c) {
            if ((title+desc).indexOf(c.toLowerCase()) !== -1) score += 5;
          });
        }
        seen[url] = 1;
        results.push({ title: page.title, url: url, description: page.description||'', score: score });
      });
    });
    results.sort(function(a,b){ return b.score - a.score; });
    var top = results.slice(0, 6);
    if (top.length) {
      parts.push('\n=== קורסים שנמצאו ===');
      top.forEach(function(c) {
        parts.push('שם: ' + c.title + '\nקישור: ' + c.url + (c.description ? '\nתיאור: ' + c.description.substring(0,120) : ''));
      });
    } else {
      parts.push('\nלא נמצאו קורסים ספציפיים.' + (region ? '\nURL: https://www.shabaton.online/' + region.slug : ''));
    }
  } catch(e) {}

  if (region) parts.push('\nאזור: ' + region.name + ' | slug: ' + region.slug);
  return parts.join('\n\n');
}
