// Obavijesti adminu na Telegram (isti bot kao za shop). U .env:
//   TELEGRAM_BOT_TOKEN=1234567890:AAH...   TELEGRAM_CHAT_ID=123456789
const token = String(process.env.TELEGRAM_BOT_TOKEN || '').replace(/\s+/g, '').replace(/^bot/i, '');
const chat = String(process.env.TELEGRAM_CHAT_ID || '').replace(/\s+/g, '');
export const telegramEnabled = () => !!(token && chat);

export async function telegram(text) {
  if (!telegramEnabled()) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 3500), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) console.error('Telegram:', r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) { console.error('Telegram:', e.message); return false; }
}
