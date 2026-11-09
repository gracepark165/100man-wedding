const test = require('node:test');
const assert = require('node:assert/strict');
const { open, pick, heading } = require('./helpers');

async function toResult(page, n = 1) {
  await page.click('[data-a=start]');
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector('.hero, .opt');
    if (await page.locator('.hero').count()) return;
    await pick(page, n);
  }
  throw new Error('결과 화면에 도달하지 못함');
}

test('back-navigation: jump from result edits one item', async () => {
  const { browser, page, errors } = await open();
  try {
    await toResult(page);
    await page.click('[data-k=guests]');
    assert.equal(await heading(page), '하객은 몇 명쯤 모실 건가요?');
    await pick(page, 3);
    await page.waitForSelector('.hero');
    assert.equal(await page.textContent('[data-k=guests] .v'), '50명 내외');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('back-navigation: dots and browser back', async () => {
  const { browser, page, errors } = await open();
  try {
    await page.click('[data-a=start]');
    // 시기·지역(부산, 서울 아님)·세부·하객 → 장소 질문
    for (let i = 0; i < 4; i++) await pick(page, 2);
    assert.equal(await heading(page), '어디서 하실 건가요?');
    await page.locator('button.dot').nth(1).click();
    assert.equal(await heading(page), '어느 지역에서 하세요?');
    await page.goBack();
    await page.waitForTimeout(150);
    assert.equal(await heading(page), '어디서 하실 건가요?');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

module.exports = { toResult };

test('window.__app exposes state, calc, firstMissing', async () => {
  const { browser, page } = await open();
  try {
    const r = await page.evaluate(() => ({
      calc: typeof window.__app.calc, fm: typeof window.__app.firstMissing, view: window.__app.state.view,
      total: window.__app.calc({ date: 'q1', region: 'seoul', sub: 'gs', guests: '20', venue: 'public', meal: 'box' }).total,
    }));
    assert.equal(r.calc, 'function');
    assert.equal(r.fm, 'function');
    assert.equal(r.view, 'intro');
    assert.equal(typeof r.total, 'number');
  } finally { await browser.close(); }
});
