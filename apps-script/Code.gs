/**
 * Before: веб-приложение Apps Script.
 * Принимает заявки «Обсудить» с сайта и шлёт их тебе в Telegram. На будущее: анкета после оплаты,
 * вебхук Lava.top и создание счёта.
 *
 * Минимум для запуска заявок: TG_BOT_TOKEN и TG_CHAT_ID. Остальное можно не трогать.
 *
 * Script Properties (Project Settings → Script properties):
 *   TG_BOT_TOKEN   токен бота, который пишет тебе в личку
 *   TG_CHAT_ID     твой chat_id (у тебя 7017655811)
 *   SHEET_ID       необязательно: id Google-таблицы, листы «Заявки», «Анкеты», «Оплаты» создаются сами
 *   WEBHOOK_KEY    длинный случайный секрет. URL вебхука в Lava.top: <URL веб-приложения>?key=<WEBHOOK_KEY>
 *   SITE_URL       адрес сайта, например https://before.example.ru/  (для возврата после оплаты)
 *   LAVA_API_KEY   ключ API Lava.top, только для payment.mode = "api" в config.js
 *   OFFER_START, OFFER_PRO, OFFER_TEAM   offerId продуктов в Lava.top (см. listOffers ниже)
 *
 * Деплой: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone.
 * URL веб-приложения кладётся в formEndpoint в config.js.
 * После правок кода: Deploy → Manage deployments → карандаш → Version: New version.
 *
 * Проверка связи: запустить selfTest() в редакторе, должно прийти сообщение в Telegram.
 * offerId продуктов: запустить listOffers(), смотреть Execution log.
 */

var LAVA_BASE = 'https://gate.lava.top';
var PLAN_TITLES = { start: 'Start', pro: 'Pro', team: 'Team' };

var SHEET_ONBOARDING = 'Анкеты';
var SHEET_PAYMENTS = 'Оплаты';
var HEAD_ONBOARDING = ['Когда', 'Тариф', 'Имя', 'Telegram', 'Email', 'Компания', 'Что продаёт', 'Гео', 'Порог бюджета', 'Получатели', 'Источники', 'Счёт', 'Статус оплаты', 'Страница'];
var HEAD_PAYMENTS = ['Когда', 'Событие', 'Статус', 'Email', 'Продукт', 'Сумма', 'Валюта', 'Счёт', 'Родительский счёт', 'Ошибка', 'Сырые данные'];

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

/* ---------- Точки входа ---------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'pay') return createInvoice_(p);
  return json_({ ok: true, service: 'before', time: new Date().toISOString() });
}

function doPost(e) {
  var params = (e && e.parameter) || {};
  var raw = (e && e.postData && e.postData.contents) || '';
  var body = null;
  try { body = JSON.parse(raw || '{}'); } catch (err) { body = null; }
  if (!body || typeof body !== 'object') body = Object.assign({}, params);

  if (body.eventType) return handleWebhook_(body, params);
  if (body.type === 'lead') return handleLead_(body);
  return handleOnboarding_(body);
}

/* ---------- Заявка «Обсудить» ---------- */

var SHEET_LEADS = 'Заявки';
var HEAD_LEADS = ['Когда', 'Имя', 'Связь', 'Тариф', 'Компания', 'Что продаёт', 'Страница'];

function handleLead_(d) {
  if (!String(d.name || '').trim() || !String(d.contact || '').trim()) {
    return json_({ ok: false, error: 'missing: name, contact' });
  }
  appendRow_(SHEET_LEADS, HEAD_LEADS, [
    new Date(), d.name, d.contact, d.planTitle || d.plan || '', d.company || '', d.offer || '', d.page || ''
  ]);
  var lines = [
    '<b>Новая заявка Before</b>',
    'Имя: ' + esc_(d.name),
    'Связь: ' + esc_(d.contact),
    'Тариф: ' + esc_(d.planTitle || d.plan || 'пока не выбран'),
    d.company ? 'Компания: ' + esc_(d.company) : '',
    d.offer ? ' ' : '',
    d.offer ? '<b>Что продаёт</b>\n' + esc_(cut_(d.offer, 900)) : ''
  ].filter(function (l) { return l !== ''; });
  var username = String(d.contact || '').match(/^@?([a-zA-Z0-9_]{4,32})$/) || String(d.contact || '').match(/t\.me\/([a-zA-Z0-9_]{4,32})/);
  var keyboard = username ? { inline_keyboard: [[{ text: 'Написать ' + '@' + username[1], url: 'https://t.me/' + username[1] }]] } : null;
  sendTelegram_(lines.join('\n'), keyboard);
  return json_({ ok: true });
}

/* ---------- Анкета с сайта ---------- */

function handleOnboarding_(d) {
  var required = ['name', 'telegram', 'offer', 'recipients'];
  var missing = required.filter(function (k) { return !String(d[k] || '').trim(); });
  if (missing.length) return json_({ ok: false, error: 'missing: ' + missing.join(', ') });

  var plan = d.planTitle || PLAN_TITLES[d.plan] || d.plan || '';
  appendRow_(SHEET_ONBOARDING, HEAD_ONBOARDING, [
    new Date(), plan, d.name, d.telegram, d.email || '', d.company || '', d.offer, d.geo || '',
    d.budget || '', d.recipients, d.sources || '', d.invoiceId || '', d.paymentStatus || '', d.page || ''
  ]);

  var lines = [
    '<b>Анкета Before</b>',
    'Тариф: ' + esc_(plan),
    'Имя: ' + esc_(d.name),
    'Telegram: ' + esc_(d.telegram),
    'Email: ' + esc_(d.email || 'не указан'),
    d.company ? 'Компания: ' + esc_(d.company) : '',
    '',
    '<b>Что продаёт</b>',
    esc_(cut_(d.offer, 900)),
    '',
    'Гео: ' + esc_(d.geo || 'не указано'),
    'Порог бюджета: ' + esc_(d.budget || 'не указан'),
    'Карточки слать: ' + esc_(d.recipients),
    d.sources ? 'Где пишут клиенты: ' + esc_(cut_(d.sources, 600)) : '',
    d.invoiceId ? 'Счёт: <code>' + esc_(d.invoiceId) + '</code>' + (d.paymentStatus ? ' (' + esc_(d.paymentStatus) + ')' : '') : 'Счёт: не передан, сверить по email'
  ];
  sendTelegram_(lines.filter(function (l) { return l !== ''; }).join('\n'));
  return json_({ ok: true });
}

/* ---------- Вебхук Lava.top ---------- */

function handleWebhook_(w, params) {
  var key = prop_('WEBHOOK_KEY');
  if (key && params.key !== key) return json_({ ok: false, error: 'forbidden' });

  var buyer = (w.buyer && w.buyer.email) || w.email || '';
  var product = (w.product && (w.product.title || w.product.name)) || '';
  var amount = w.amount != null ? w.amount : ((w.receipt && w.receipt.amount) || '');
  var currency = w.currency || (w.receipt && w.receipt.currency) || '';

  appendRow_(SHEET_PAYMENTS, HEAD_PAYMENTS, [
    new Date(), w.eventType || '', w.status || '', buyer, product, amount, currency,
    w.contractId || '', w.parentContractId || '', w.errorMessage || '', JSON.stringify(w).slice(0, 45000)
  ]);

  var titles = {
    'payment.success': 'Оплата прошла',
    'payment.failed': 'Оплата не прошла',
    'subscription.recurring.payment.success': 'Продление прошло',
    'subscription.recurring.payment.failed': 'Продление не прошло',
    'subscription.cancelled': 'Подписка отменена'
  };
  var title = titles[w.eventType] || ('Событие Lava.top: ' + w.eventType);
  sendTelegram_([
    '<b>' + esc_(title) + '</b>',
    'Продукт: ' + esc_(product || 'не указан'),
    'Сумма: ' + esc_(String(amount) + ' ' + currency),
    'Email: ' + esc_(buyer || 'не указан'),
    'Счёт: <code>' + esc_(w.contractId || '') + '</code>',
    w.errorMessage ? 'Ошибка: ' + esc_(w.errorMessage) : ''
  ].filter(function (l) { return l !== ''; }).join('\n'));

  return json_({ ok: true });
}

/* ---------- Счёт в Lava.top (payment.mode = "api") ---------- */

function createInvoice_(p) {
  var apiKey = prop_('LAVA_API_KEY');
  var offers = { start: prop_('OFFER_START'), pro: prop_('OFFER_PRO'), team: prop_('OFFER_TEAM') };
  var plan = String(p.plan || '').toLowerCase();
  var email = String(p.email || '').trim();

  if (!apiKey) return json_({ ok: false, error: 'LAVA_API_KEY не задан' });
  if (!offers[plan]) return json_({ ok: false, error: 'offerId для тарифа «' + plan + '» не задан' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, error: 'bad email' });

  var site = prop_('SITE_URL') || String(p['return'] || '');
  var ret = site ? site + (site.indexOf('?') > -1 ? '&' : '?') + 'plan=' + plan + '&paid=1' : '';

  var payload = {
    email: email,
    offerId: offers[plan],
    currency: 'RUB',
    periodicity: 'MONTHLY',
    buyerLanguage: 'RU',
    clientUtm: { utm_source: 'before-site', utm_content: plan }
  };

  // Поля возврата описаны в портале разработчика Lava.top; если API их не принимает, вторая попытка без них.
  var res = ret
    ? lavaPost_('/api/v2/invoice', apiKey, Object.assign({}, payload, { successful_return_url: ret, failure_return_url: site, cancel_return_url: site }))
    : lavaPost_('/api/v2/invoice', apiKey, payload);
  if (res.code >= 400 && ret) res = lavaPost_('/api/v2/invoice', apiKey, payload);
  if (res.code >= 400) return json_({ ok: false, error: 'Lava.top ' + res.code + ': ' + res.text.slice(0, 300) });

  var data = {};
  try { data = JSON.parse(res.text); } catch (err) { data = {}; }
  if (!data.paymentUrl) return json_({ ok: false, error: 'Lava.top не вернул paymentUrl' });

  appendRow_(SHEET_PAYMENTS, HEAD_PAYMENTS, [
    new Date(), 'invoice.created', data.status || '', email, PLAN_TITLES[plan] || plan,
    (data.receipt && data.receipt.amount) || '', 'RUB', data.id || '', '', '', JSON.stringify(data).slice(0, 45000)
  ]);
  return json_({ ok: true, paymentUrl: data.paymentUrl, invoiceId: data.id || '' });
}

function lavaPost_(path, key, body) {
  var r = UrlFetchApp.fetch(LAVA_BASE + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Api-Key': key, 'Accept': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  return { code: r.getResponseCode(), text: r.getContentText() };
}

/** Показать offerId всех продуктов: запустить в редакторе, смотреть Execution log. */
function listOffers() {
  var r = UrlFetchApp.fetch(LAVA_BASE + '/api/v2/products', {
    headers: { 'X-Api-Key': prop_('LAVA_API_KEY'), 'Accept': 'application/json' },
    muteHttpExceptions: true
  });
  var data = {};
  try { data = JSON.parse(r.getContentText()); } catch (err) { Logger.log(r.getContentText()); return; }
  (data.items || []).forEach(function (item) {
    var d = item.data || item;
    Logger.log('%s', d.title || d.name || '');
    (d.offers || []).forEach(function (o) {
      Logger.log('   offerId: %s   %s   %s', o.id, o.name || '', JSON.stringify(o.prices || []));
    });
  });
}

/** Проверка связи с Telegram: запустить в редакторе. */
function selfTest() {
  sendTelegram_('<b>Before</b>\nСвязь есть. Анкеты и оплаты будут приходить сюда.');
}

/* ---------- Служебное ---------- */

function appendRow_(name, headers, row) {
  var id = prop_('SHEET_ID');
  if (!id) return;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(id);
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(headers);
      sh.setFrozenRows(1);
    }
    sh.appendRow(row);
  } catch (err) {
    Logger.log('appendRow_ %s: %s', name, err);
  } finally {
    try { lock.releaseLock(); } catch (ignore) { /* пусто */ }
  }
}

function sendTelegram_(text, keyboard) {
  var token = prop_('TG_BOT_TOKEN');
  var chat = prop_('TG_CHAT_ID');
  if (!token || !chat) return;
  var payload = { chat_id: chat, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true };
  if (keyboard) payload.reply_markup = keyboard;
  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cut_(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
