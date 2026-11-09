const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { open, buildTo, ROOT } = require('./helpers');

const FIX = path.join(ROOT, 'tests/fixtures/venues.json');
const built = buildTo(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-v-')), 'index.html'), { VENUES_JSON: FIX });
const pickV = async (page, v) => { await page.click(`.opt[data-v="${v}"]`); await page.waitForTimeout(400); };
const V = (id, area, cap, checked = '2026-11-01') => ({ id, name: id, gu: '', area, cap, fee: '', food: '', open: '', url: '', checked });

test('venue sort', async () => {
  const { browser, page } = await open({ file: built });
  try {
    const list = [V('mp-1', 'mp', [30, 100]), V('gn-1', 'gn', [10, 40]), V('mp-2', 'mp', [50, 200]), V('mp-3', 'mp', [10, 30])];
    const r = await page.evaluate((L) => window.__app.venueList(L, 'mp', 20), list);
    assert.deepEqual(r.map((x) => x.v.id), ['mp-3', 'gn-1', 'mp-1', 'mp-2']);
    assert.deepEqual(r.map((x) => x.fits), [true, true, false, false]);
  } finally { await browser.close(); }
});

test('unchecked venues hidden', async () => {
  const { browser, page } = await open({ file: built });
  try {
    const list = [V('a', 'mp', [10, 40]), V('b', 'mp', [10, 40], ''), V('c', 'gn', [10, 40], '2026-09-30')];
    const r = await page.evaluate((L) => [window.__app.venueList(L, 'mp', 20).map((x) => x.v.id), window.__app.oldestChecked(L)], list);
    assert.deepEqual(r[0], ['a', 'c']);
    assert.equal(r[1], '2026-09-30');
  } finally { await browser.close(); }
});

test('venue tab render', async () => {
  const { browser, page, errors } = await open({ file: built });
  try {
    await page.click('[data-a=start]');
    for (const v of ['q1', 'seoul', 'gs', 'y', '20', 'public', 'box']) await pickV(page, v);
    await page.waitForSelector('.hero');
    await page.click('[data-a=tab][data-tab=venue]');
    const panel = page.locator('[data-panel=venue]');
    assert.equal(await panel.locator('.pv-card').count(), 2);
    assert.match(await panel.locator('.pv-card').first().textContent(), /테스트 정원/);
    assert.match(await panel.textContent(), /하객 수보다 커요/);
    assert.match(await panel.textContent(), /정보 기준일: 2026-10-20/);
    assert.doesNotMatch(await panel.textContent(), /확인 전 시설/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('no public venue cards outside seoul', async () => {
  const { browser, page } = await open({ file: built });
  try {
    await page.click('[data-a=start]');
    for (const v of ['q1', 'gg', 'sw', '20', 'public', 'box']) await pickV(page, v);
    await page.waitForSelector('.hero');
    assert.equal(await page.locator('.pv-card').count(), 0);
  } finally { await browser.close(); }
});
