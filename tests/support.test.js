const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { open, fileUrl, buildTo, runBuild, ROOT } = require('./helpers');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-s-'));
const base = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/support.json'), 'utf8'));
function buildWith(mut) {
  const d = tmp(), sj = base(); mut(sj);
  fs.writeFileSync(path.join(d, 'support.json'), JSON.stringify(sj));
  return buildTo(path.join(d, 'index.html'), { SUPPORT_JSON: path.join(d, 'support.json') });
}
const Y = '?d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box';
const NOW = (p) => p.clock.setFixedTime(new Date(2026, 10, 16));
async function at(url, fn) {
  const { browser, page, errors } = await open({ url, beforeGoto: NOW });
  try { await page.waitForSelector('.hero'); await fn(page, errors); } finally { await browser.close(); }
}
const C = (page) => page.evaluate(() => window.__app.calc(window.__app.state.ans));

test('total is pre-support', () => at(fileUrl() + Y, async (page) => {
  const c = await C(page);
  assert.equal(c.total, c.gross);
  assert.equal(c.supportScenario, Math.min(100, c.eligibleAmt));
  assert.equal(c.scenarioTotal, c.gross - c.supportScenario);
  assert.equal(c.support, undefined);
}));

test('scenario box unconfirmed', () => at(fileUrl() + Y, async (page) => {
  const c = await C(page);
  const box = await page.textContent('[data-panel=budget] .scenario');
  assert.match(box, /지원이 확정되면 /);
  assert.match(box, /공고 확인 전/);
  assert.match(await page.textContent('.hsay'), new RegExp(c.gross + '만원'));
}));

test('scenario box confirmed', () => at(fileUrl(buildWith((s) => { s.years['2027'] = { apply: '2027-05-01 ~ 2027-11-30', checked: '2026-11-13', url: 'https://example.com/s' }; })) + Y, async (page) => {
  assert.match(await page.textContent('.scenario'), /2027년 공고 기준/);
}));

test('unknown residence tag', () => at(fileUrl() + Y.replace('res=y', 'res=u'), async (page) => {
  assert.match(await page.textContent('.scenario'), /거주 조건 확인 필요/);
}));

test('no scenario when not eligible', async () => {
  await at(fileUrl() + Y.replace('res=y', 'res=n'), async (page) => {
    assert.equal(await page.locator('.scenario').count(), 0);
    assert.match(await page.textContent('[data-panel=budget]'), /비품비 지원 대상이 아니에요/);
  });
  await at(fileUrl() + '?d=q1&r=gg&s=sw&g=20&v=public&m=box', async (page) => {
    assert.equal(await page.locator('.scenario').count(), 0);
  });
});

test('scenario capped by eligible items', () => at(fileUrl(buildWith((s) => { s.eligibleItems = ['staff']; })) + Y, async (page) => {
  const c = await C(page);
  assert.ok(c.eligibleAmt > 0 && c.eligibleAmt < 100, String(c.eligibleAmt));
  assert.equal(c.supportScenario, c.eligibleAmt);
}));

test('share link shows scenario', () => at(fileUrl() + Y, async (page) => {
  assert.match(await page.textContent('.hdata'), /지원 확정 시 /);
}));

test('period text from data', () => at(fileUrl() + Y, async (page) => {
  const body = await page.evaluate(() => document.body.innerHTML);
  assert.doesNotMatch(body, /2026년 신청 기간은/);
  await page.click('[data-tab=venue]');
  assert.match(await page.textContent('[data-panel=venue]'), /2027년 공고는 아직 확인 전이에요/);
}));

test('budget task uses pre-support', () => at(fileUrl() + Y, async (page) => {
  const r = await page.evaluate(() => {
    const a = window.__app, c = a.calc(a.state.ans); return a.coachOrder(a.coachTasks(c), { done: {}, skip: [] }).todo[0];
  });
  assert.equal(r.id, 'budget');
  assert.match(r.why, /지원 전 합계가/);
  assert.match(r.why, /지원이 확정되면/);
}));

test('build fails on bad support json', () => {
  const d = tmp(); fs.writeFileSync(path.join(d, 'bad.json'), '{');
  assert.notEqual(runBuild({ SUPPORT_JSON: path.join(d, 'bad.json'), OUT: path.join(d, 'o.html') }), 0);
  const sj = base(); delete sj.eligibleItems; fs.writeFileSync(path.join(d, 'miss.json'), JSON.stringify(sj));
  assert.notEqual(runBuild({ SUPPORT_JSON: path.join(d, 'miss.json'), OUT: path.join(d, 'o2.html') }), 0);
});
