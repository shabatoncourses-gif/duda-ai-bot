'use strict';

var fs    = require('fs');
var path  = require('path');
var https = require('https');

var ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || '';
var ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';
var HAIKU_MODEL        = 'claude-haiku-4-5-20251001';
var SONNET_MODEL       = 'claude-sonnet-4-6';

var SYSTEM_PROMPT = 'שמך שבי, העוזר החכם של שבתון — האתר המוביל לקורסים למורים וגננות בשנת שבתון.\n' +
  'אופי: חביב, ידידותי, לומד ומשתפר. תמיד בעברית.\n' +
  'כללים:\n' +
  '- אל תמציא קורסים. השתמש רק במידע שסופק.\n' +
  '- אסור תווים/מילים בשפות זרות\n' +
  '- לימודים פרונטליים (לא "לימודים פנים")\n' +
  '- שאל שאלת הבהרה בסוף כל תשובה\n' +
  '- הצע גם קורסים בלמידה מרחוק\n\n' +
  'פורמט קורסים:\n' +
  '### שם המוסד\n' +
  'תיאור חם וקצר\n' +
  '[מידע על הקורס](URL)\n\n' +
  'footer אחרי הקורסים:\n' +
  '[כל קורסי [תחום] ב[אזור]](https://www.shabaton.online/[slug]/[תחום])\n' +
  '[הצטרף לעלון שבתון](https://www.shabaton.online/shabaton)\n' +
  '[קבוצת הוואטסאפ של שבתון](https://chat.whatsapp.com/FFak5hIoCHtKnPMEAwOlME)\n\n' +
  'slug: צפון=results-Zafon | מרכז=search-results-merkaz | ירושלים=results-jerusalem | דרום=results-shfea-darom | שרון=results-Sharon | כל הארץ=results-all';

// Cache
var _cache = {};
function loadJSON(filename) {
  if (_cache[filename] !== undefined) return _cache[filename];
  try {
    var p = path.join(process.cwd(), 'data', filename);
    _cache[filename] = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e) { _cache[filename] = null; }
  return _cache[filename];
}

// זיהוי אזור
function detectRegion(q) {
  var qL = q.toLowerCase();
  if (/צפון|חיפה|עכו|נצרת|טבריה|נהריה|קריות|עפולה|גליל|כרמל/.test(qL))
    return { name: 'צפון', slug: 'results-Zafon', cities: ['חיפה','נצרת','עכו','טבריה','נהריה','עפולה','גליל','כרמל','טירת'] };
  if (/מרכז|תל.?אביב|רמת.?גן|פתח.?תקווה|ראשון|רחובות|חולון|בת.?ים/.test(qL))
    return { name: 'מרכז', slug: 'search-results-merkaz', cities: ['תל אביב','רמת גן','פתח תקווה','ראשון לציון','רחובות'] };
  if (/ירושלים|בית.?שמש/.test(qL))
    return { name: 'ירושלים', slug: 'results-jerusalem', cities: ['ירושלים','בית שמש'] };
  if (/דרום|באר.?שבע|אשדוד|אשקלון/.test(qL))
    return { name: 'דרום', slug: 'results-shfea-darom', cities: ['באר שבע','אשדוד','אשקלון'] };
  if (/שרון|נתניה|הרצליה|כפר.?סבא|רעננה/.test(qL))
    return { name: 'שרון', slug: 'results-Sharon', cities: ['נתניה','הרצליה','כפר סבא','רעננה'] };
  return null;
}

// חיפוש
function searchIndex(question, region) {
  var qL = question.toLowerCase();
  var stop = {'את':1,'של':1,'על':1,'עם':1,'אל':1,'כל':1,'גם':1,'רק':1,'אבל':1,'אם':1,'זה':1,'לא':1,'מה':1,'מי':1,'איך':1,'בצפון':1,'בדרום':1,'במרכז':1,'בירושלים':1};
  var words = qL.split(/\s+/).filter(function(w){ return w.length > 2 && !stop[w]; });
  var results = [], seen = {};
  var indexes = ['shabaton_index_part1.json','shabaton_index_part2.json','shabaton_index.json','morim_index.json','morim_index_part1.json'];
  for (var fi = 0; fi < indexes.length; fi++) {
    var data = loadJSON(indexes[fi]);
    if (!data) continue;
    var pages = Array.isArray(data) ? data : (data.pages || []);
    for (var pi = 0; pi < pages.length; pi++) {
      var page = pages[pi];
      var url = page.url || page.link || '';
      if (seen[url] || url.indexOf('/results-') !== -1 || url.indexOf('/end_shabaton') !== -1) continue;
      var title = (page.title || '').toLowerCase();
      var desc  = (page.description || '').toLowerCase();
      var text  = (page.text || '').toLowerCase();
      var score = 0;
      for (var wi = 0; wi < words.length; wi++) {
        if (title.indexOf(words[wi]) !== -1) score += 3;
        else if (desc.indexOf(words[wi]) !== -1) score += 2;
        else if (text.indexOf(words[wi]) !== -1) score += 1;
      }
      if (!score) continue;
      if (region) {
        for (var ci = 0; ci < region.cities.length; ci++) {
          if ((title+desc+text).indexOf(region.cities[ci].toLowerCase()) !== -1) { score += 5; break; }
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

// Context
function buildContext(question, site) {
  var region = detectRegion(question);
  var parts = [];
  var qa = loadJSON('shabaton-qa.json');
  if (qa) {
    var items = Array.isArray(qa) ? qa : (qa.qaItems || []);
    var qw = question.split(/\s+/).filter(function(w){ return w.length > 3; });
    var rel = items.filter(function(item) {
      var t = ((item.question||item.q||'') + ' ' + (item.answer||item.a||'')).toLowerCase();
      return qw.some(function(w){ return t.indexOf(w.toLowerCase()) !== -1; });
    }).slice(0,3);
    if (rel.length) {
      parts.push('=== מידע על שבתון ===');
      rel.forEach(function(item){ if(item.question||item.q) parts.push('ש: '+(item.question||item.q)+'\nת: '+(item.answer||item.a||'')); });
    }
  }
  var courses = searchIndex(question, region);
  if (courses.length) {
    parts.push('\n=== קורסים שנמצאו ===');
    courses.forEach(function(c){ parts.push('שם: '+c.title+'\nקישור: '+c.url+(c.description?'\nתיאור: '+c.description.substring(0,120):'')); });
  } else {
    parts.push('\n=== תוצאות חיפוש ===\nלא נמצאו קורסים ספציפיים.'+(region?'\nקישור לאזור: https://www.shabaton.online/'+region.slug:''));
  }
  if (region) parts.push('\nאזור: '+region.name);
  return parts.join('\n\n');
}

// HTTP request helper (במקום fetch)
function httpsPost(hostname, path, headers, body) {
  return new Promise(function(resolve, reject) {
    var data = JSON.stringify(body);
    var opts = {
      hostname: hostname,
      path: path,
      method: 'POST',
      headers: Object.assign({ 'Content-Length': Buffer.byteLength(data) }, headers)
    };
    var req = https.request(opts, function(res) {
      var chunks = [];
      res.on('data', function(c){ chunks.push(c); });
      res.on('end', function(){
        var text = Buffer.concat(chunks).toString();
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: function(){ return Promise.resolve(text); }, json: function(){ return Promise.resolve(JSON.parse(text)); } });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Claude
function chooseModel(q) {
  return /הסבר|ההבדל|השוואה|תהליך|זכאות|תנאים|חישוב|מסלול|שעות|ש"ש|אופק|תואר/.test(q) ? SONNET_MODEL : HAIKU_MODEL;
}

async function callClaude(question, context, history) {
  var model = chooseModel(question);
  var userContent = context ? context + '\n\n---\nשאלת הגולש: ' + question : question;
  var res = await httpsPost('api.anthropic.com', '/v1/messages',
    { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    { model: model, max_tokens: 800, system: SYSTEM_PROMPT, messages: history.slice(-6).concat([{ role:'user', content: userContent }]) }
  );
  if (!res.ok) { var t = await res.text(); throw new Error('Claude '+res.status+': '+t.substring(0,200)); }
  var data = await res.json();
  return { reply: data.content && data.content[0] ? data.content[0].text : '', model: model };
}

// Zapier
async function logToZapier(question, reply, site, model) {
  if (!ZAPIER_WEBHOOK_URL) return;
  try {
    var now = new Date();
    var noAnswer = reply.indexOf('לא נמצאו') !== -1 || reply.indexOf('מצטערים') !== -1;
    await httpsPost('hooks.zapier.com', '/hooks/catch/5499574/uxvbm4i/',
      { 'Content-Type': 'application/json' },
      { date: now.toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'}),
        time: now.toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}),
        site: site, question: question, answer: reply, model: model,
        needs_learning: noAnswer ? 'YES' : 'OK' }
    );
  } catch(e) {}
}

// Handler
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET')  { res.status(200).json({ status:'ok', bot:'shabi' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error:'POST only' }); return; }
  if (!ANTHROPIC_API_KEY)    { res.status(500).json({ error:'Missing API key' }); return; }

  var body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }

  var message = body.message;
  var history = body.history || [];
  var site    = body.site    || 'shabaton';
  if (!message) { res.status(400).json({ error:'message required' }); return; }

  try {
    console.log('POST ['+site+'] '+message.substring(0,60));
    var context = buildContext(message, site);
    var result  = await callClaude(message, context, history);
    console.log('OK: '+result.model+' | '+result.reply.length+' chars');
    await logToZapier(message, result.reply, site, result.model);
    res.status(200).json({ reply: result.reply, model: result.model });
  } catch(e) {
    console.error('ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
};
