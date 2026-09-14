// Сборка PDF из deck/deck.html. Цены, контакт и время ответа берутся из config.js.
// Запуск:  node deck/render.mjs        (из папки before)
//          node deck/render.mjs --png  (плюс PNG каждой страницы в deck/preview)
import { chromium } from '/Users/vladshuma/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'Before.pdf');

const cfgSrc = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const pick = (re, fb) => (cfgSrc.match(re)?.[1] ?? fb);
const money = n => Number(n).toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';

const tgLink = pick(/telegram:\s*"([^"]+)"/, 'https://t.me/USERNAME');
const handle = '@' + tgLink.replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/\/$/, '');
const vars = {
  '{{PRICE_START}}': money(pick(/start:\s*\{[^}]*price:\s*(\d+)/, 10000)),
  '{{PRICE_PRO}}': money(pick(/pro:\s*\{[^}]*price:\s*(\d+)/, 25000)),
  '{{PRICE_TEAM}}': money(pick(/team:\s*\{[^}]*price:\s*(\d+)/, 50000)),
  '{{RESPONSE}}': pick(/responseTime:\s*"([^"]+)"/, '3 часов'),
  '{{TG_HANDLE}}': handle,
  '{{TG_LINK}}': tgLink.replace(/^https?:\/\//, ''),
  '{{TG_URL}}': tgLink
};

let html = fs.readFileSync(path.join(here, 'deck.html'), 'utf8');
for (const [k, v] of Object.entries(vars)) html = html.split(k).join(v);

const mime = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '/deck.html') {
    res.writeHead(200, { 'content-type': mime['.html'] }).end(html);
    return;
  }
  const file = path.join(root, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = async scale => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: scale });
  await page.goto(`${base}/deck.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return page;
};

const page = await open(1);
await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true });

if (process.argv.includes('--png')) {
  const dir = path.join(here, 'preview');
  fs.mkdirSync(dir, { recursive: true });
  const shot = await open(2);
  const pages = await shot.$$('.slide');
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: path.join(dir, `p${i + 1}.png`) });
  }
  console.log(`PNG: ${pages.length} стр. → deck/preview`);
}

await browser.close();
server.close();
console.log(`PDF: ${out} (${(fs.statSync(out).size / 1048576).toFixed(2)} МБ), контакт ${handle}`);
