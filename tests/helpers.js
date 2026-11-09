const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FILE = path.join(ROOT, 'index.html');
const fileUrl = (f) => 'file://' + (f || DEFAULT_FILE);

/* 설정을 바꿔 임시 파일로 빌드한다. 저장소의 index.html은 건드리지 않는다. */
function buildTo(out, env = {}) {
  execFileSync('python3', [path.join(ROOT, 'src/build.py')], { env: { ...process.env, ...env, OUT: out }, stdio: 'pipe' });
  return out;
}

async function open(opts = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com|gc\.zgo\.at/, (r) => r.abort());
  if (opts.blockStorage) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } });
    });
  }
  if (opts.init) await page.addInitScript(opts.init);
  if (opts.beforeGoto) await opts.beforeGoto(page);
  await page.goto(opts.url || fileUrl(opts.file));
  return { browser, page, errors };
}

async function pick(page, n) {
  await page.locator('.opt').nth(n).click();
  await page.waitForTimeout(400);
}

const heading = (page) => page.textContent('h1.q');

module.exports = { open, pick, heading, fileUrl, buildTo, ROOT };
