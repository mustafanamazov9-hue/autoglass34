// Netlify Function: POST /.netlify/functions/submit -> заявка с сайта сообщением в Telegram-бота.
// Переменные окружения (Site configuration -> Environment variables): BOT_TOKEN и CHAT_ID.

const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ').slice(0, max) : '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const reply = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'method' }, { Allow: 'POST' });

  let body = {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    body = JSON.parse(raw || '{}');
  } catch {}
  if (!body || typeof body !== 'object') body = {};

  // Скрытое поле-ловушка для ботов: люди его не видят и не заполняют.
  if (body.website) return reply(200, { ok: true });

  const lead = {
    name: clean(body.name, 80),
    phone: clean(body.phone, 40),
    car: clean(body.car, 80),
    service: clean(body.service, 120),
    date: clean(body.date, 30),
    comment: clean(body.comment, 1000),
  };
  const digits = lead.phone.replace(/\D/g, '').length;
  if (lead.name.length < 2 || lead.car.length < 2 || digits !== 11) {   // российский номер: ровно 11 цифр
    return reply(400, { ok: false, error: 'invalid' });
  }

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;
  if (!token || !chatId) {
    console.error('BOT_TOKEN или CHAT_ID не заданы');
    return reply(500, { ok: false, error: 'config' });
  }

  const text = [
    '<b>Новая заявка с сайта AUTOGLASS 34</b>\n',
    `Имя: ${esc(lead.name)}`,
    `Телефон: ${esc(lead.phone)}`,
    `Авто: ${esc(lead.car)}`,
    lead.service && `Услуга: ${esc(lead.service)}`,
    lead.date && `Желаемая дата: ${esc(lead.date)}`,
    lead.comment && `Комментарий: ${esc(lead.comment)}`,
  ].filter(Boolean).join('\n');

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!tg.ok) {
      console.error('Telegram ответил', tg.status);
      return reply(502, { ok: false, error: 'telegram' });
    }
  } catch (e) {
    console.error('Не удалось связаться с Telegram:', e.message);
    return reply(502, { ok: false, error: 'telegram' });
  }

  return reply(200, { ok: true });
};
