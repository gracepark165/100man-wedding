const test = require('node:test');
const assert = require('node:assert/strict');
const { open, fileUrl } = require('./helpers');

const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
async function withPage(fn, url) {
  const { browser, page, errors } = await open({ url, beforeGoto: (p) => p.clock.setFixedTime(new Date(2026, 10, 16)) });
  try { await fn(page, errors); } finally { await browser.close(); }
}
const due = (page, y, m, d, n) => page.evaluate(([y, m, d, n]) => {
  const x = window.__app.dueDate(new Date(y, m - 1, d), n); return [x.getFullYear(), x.getMonth() + 1, x.getDate()].join('-');
}, [y, m, d, n]);

test('due dates', () => withPage(async (page) => {
  assert.equal(await due(page, 2027, 2, 13, 7), '2027-2-6');
  assert.equal(await due(page, 2027, 2, 13, 21), '2027-1-23');
  assert.equal(await due(page, 2027, 2, 13, 180), '2026-8-17');
}));

test('leap year', () => withPage(async (page) => {
  assert.equal(await due(page, 2028, 3, 7, 7), '2028-2-29');
}));

test('year boundary', () => withPage(async (page) => {
  assert.equal(await due(page, 2027, 1, 10, 21), '2026-12-20');
}));

test('labels', () => withPage(async (page) => {
  const L = await page.evaluate(() => [7, 14, 21, 30, 45, 60, 75, 90, 180, 0].map(window.__app.dueLabel));
  assert.deepEqual(L, ['1주 전', '2주 전', '3주 전', '1개월 전', '1개월 반 전', '2개월 전', '2개월 반 전', '3개월 전', '6개월 전', '예식일 전후']);
}));

test('tasks use days', () => withPage(async (page, errors) => {
  await page.waitForSelector('.hero');
  const r = await page.evaluate(() => {
    const a = window.__app, T = a.coachTasks(a.calc(a.state.ans)), f = (id) => T.find((t) => t.id === id).due;
    return [f('final'), f('staff')].map((d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-'));
  });
  assert.deepEqual(r, ['2027-2-6', '2027-1-23']);
  await page.click('[data-tab=plan]');
  assert.match(await page.textContent('[data-panel=plan]'), /2월 6일/);
  assert.deepEqual(errors, []);
}, fileUrl() + '?d=q1&r=gg&s=sw&g=20&v=public&m=box'));
