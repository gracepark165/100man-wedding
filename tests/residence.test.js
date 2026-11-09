const test = require('node:test');
const assert = require('node:assert/strict');
const { open, pick, heading } = require('./helpers');

const RES_Q = '두 분 중 한 분이라도 서울에 주민등록이 되어 있나요?';
const BASE = { date: 'q1', region: 'seoul', sub: 'gs', guests: '20', venue: 'public', meal: 'box' };
const pickV = async (page, v) => { await page.click(`.opt[data-v="${v}"]`); await page.waitForTimeout(400); };
async function seoulResult(page, res) {
  await page.click('[data-a=start]');
  for (const v of ['q1', 'seoul', 'gs', res, '20', 'public', 'box']) await pickV(page, v);
  await page.waitForSelector('.hero');
}

test('res question only for seoul', async () => {
  const { browser, page, errors } = await open();
  try {
    await page.click('[data-a=start]');
    await pickV(page, 'q1'); await pickV(page, 'seoul'); await pickV(page, 'gs');
    assert.equal(await heading(page), RES_Q);
    assert.equal(await page.locator('.prog .dot').count(), 7);
    await page.click('[data-a=back]'); await page.click('[data-a=back]');
    await pickV(page, 'gg'); await pickV(page, 'sw');
    assert.equal(await heading(page), '하객은 몇 명쯤 모실 건가요?');
    assert.equal(await page.locator('.prog .dot').count(), 6);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('support by residence', async () => {
  const { browser, page } = await open();
  try {
    const r = await page.evaluate((B) => ['y', 'n', 'u'].map((res) => window.__app.calc({ ...B, res })), BASE);
    const [y, n, u] = r;
    assert.equal(y.support, Math.min(100, y.gross));
    assert.equal(n.support, 0); assert.equal(n.supportMaybe, 0);
    assert.equal(u.support, 0); assert.ok(u.supportMaybe > 0); assert.equal(u.total, u.gross);
    const steps = await page.evaluate((B) => [window.__app.steps(B), window.__app.steps({ ...B, region: 'gg' })], BASE);
    assert.deepEqual(steps[0], ['date', 'region', 'sub', 'res', 'guests', 'venue', 'meal']);
    assert.deepEqual(steps[1], ['date', 'region', 'sub', 'guests', 'venue', 'meal']);
  } finally { await browser.close(); }
});

test('budget rows by residence', async () => {
  for (const [res, has, hasNot] of [['u', '조건 충족 시', null], ['n', '비품비 지원 대상이 아니에요', '-'], ['y', '서울시 비품비 지원', null]]) {
    const { browser, page, errors } = await open();
    try {
      await seoulResult(page, res);
      const txt = await page.textContent('[data-panel=budget]');
      assert.ok(txt.includes(has), `${res}: "${has}" 없음`);
      if (res === 'n') assert.ok(!(await page.locator('[data-panel=budget] .ra', { hasText: /^-/ }).count()), 'n인데 지원 차감 줄이 있음');
      assert.ok(await page.locator('[data-k=res]').count(), '요약에 거주지 칸 없음');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('edit region to/from seoul', async () => {
  const { browser, page, errors } = await open();
  try {
    await page.click('[data-a=start]');
    for (const v of ['q1', 'gg', 'sw', '20', 'public', 'box']) await pickV(page, v);
    await page.waitForSelector('.hero');
    assert.equal(await page.locator('[data-k=res]').count(), 0);
    await page.click('[data-k=region]');
    await pickV(page, 'seoul'); await pickV(page, 'gs');
    assert.equal(await heading(page), RES_Q);
    await pickV(page, 'y');
    await page.waitForSelector('.hero');
    await page.click('[data-k=region]');
    await pickV(page, 'bs'); await pickV(page, 'hd');
    await page.waitForSelector('.hero');
    assert.equal(await page.evaluate(() => window.__app.state.ans.res), undefined);
    assert.equal(await page.locator('[data-k=res]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
