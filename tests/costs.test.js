const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { open, fileUrl, runBuild, ROOT } = require('./helpers');

const COSTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/costs.json'), 'utf8'));
const Y = '?d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box';
async function at(fn) {
  const { browser, page, errors } = await open({ url: fileUrl() + Y });
  try { await page.waitForSelector('.hero'); await fn(page, errors); } finally { await browser.close(); }
}

test('basis tags', () => at(async (page) => {
  const n = await page.locator('[data-panel=budget] .rows li[data-key]').count();
  assert.equal(await page.locator('[data-panel=budget] .rows li[data-key] .basis-tag').count(), n);
  assert.equal((await page.textContent('li[data-key=decor] .basis-tag')).trim(), '보도 · 2026-11-09');
  assert.equal((await page.textContent('li[data-key=meal] .basis-tag')).trim(), '예시 단가');
}));

test('unverified total', () => at(async (page) => {
  const c = await page.evaluate(() => window.__app.calc(window.__app.state.ans));
  const want = c.rows.filter((r) => COSTS[r.key] && (COSTS[r.key].basis === '예시' || !COSTS[r.key].checked)).reduce((s, r) => s + r.amt, 0);
  assert.equal(c.unverifiedAmt, want);
  assert.match(await page.textContent('[data-panel=budget]'), new RegExp('미확인 비용 ' + want + '만원'));
}));

test('estimate notice', () => at(async (page) => {
  assert.match(await page.textContent('[data-panel=budget] .status'), /예시 단가가 포함된 추정치예요/);
}));

test('basis details', () => at(async (page, errors) => {
  await page.click('li[data-key=decor] details.basis summary');
  const a = page.locator('li[data-key=decor] details.basis a');
  assert.equal(await a.getAttribute('target'), '_blank');
  assert.match(await page.textContent('li[data-key=decor] details.basis'), /필수/);
  assert.deepEqual(errors, []);
}));

function buildCosts(mut) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-c-')), c = JSON.parse(JSON.stringify(COSTS)); mut(c);
  fs.writeFileSync(path.join(d, 'c.json'), JSON.stringify(c));
  return runBuild({ COSTS_JSON: path.join(d, 'c.json'), OUT: path.join(d, 'o.html') });
}
test('build fails on missing cost key', () => { assert.notEqual(buildCosts((c) => { delete c.meal; }), 0); });
test('build fails on bad basis', () => { assert.notEqual(buildCosts((c) => { c.meal.basis = '추측'; }), 0); });
