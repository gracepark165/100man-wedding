const test = require('node:test');
const assert = require('node:assert/strict');
const { open, fileUrl } = require('./helpers');

const at = async (q, fn, opts = {}) => {
  const { browser, page, errors } = await open({ url: fileUrl() + q, beforeGoto: (p) => p.clock.setFixedTime(new Date(2026, 10, 12)), ...opts });
  try { await page.waitForSelector('.coach'); await fn(page, errors); } finally { await browser.close(); }
};
const pickV = async (page, v) => { await page.click(`.opt[data-v="${v}"]`); await page.waitForTimeout(500); };

test('answering residence from coach keeps progress', () => at('?d=fall&r=seoul&s=gs&res=u&g=20&v=public&m=box', async (page) => {
  await page.locator('.coach-all summary').click();
  await page.locator('.coach-all input[data-id=share]').check();
  while ((await page.getAttribute('.coach [data-a=cdone]', 'data-id')) !== 'res-check') await page.click('.coach [data-a=cdone]');
  const before = await page.evaluate(() => Object.keys(window.__app.state.prog.done).filter((k) => k !== 'res-check' && k !== 'budget'));
  await page.click('.coach [data-a=cact]');
  await pickV(page, 'y');
  await page.waitForSelector('.coach');
  const after = await page.evaluate(() => Object.keys(window.__app.state.prog.done));
  for (const k of before) assert.ok(after.includes(k), `${k} 기록이 사라짐`);
  await page.reload(); await page.waitForSelector('.coach');
  assert.ok(await page.evaluate(() => window.__app.state.prog.done.share), '새로고침 후 기록 없음');
}));

test('focus stays after done via keyboard', () => at('?d=fall&r=gg&s=sw&g=20&v=public&m=box', async (page) => {
  await page.focus('.coach [data-a=cdone]');
  await page.keyboard.press('Enter');
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('.coach')), await page.evaluate(() => document.activeElement.tagName));
}));

test('plan checkbox keeps focus and calendar message', () => at('?d=fall&r=gg&s=sw&g=20&v=public&m=box', async (page) => {
  await page.click('[data-tab=plan]');
  await Promise.all([page.waitForEvent('download'), page.click('[data-a=ics]')]);
  const msg = await page.textContent('#icsmsg');
  assert.ok(msg.length > 0);
  await page.focus('[data-panel=plan] input[data-id=meal]');
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-id')), 'meal');
  assert.equal(await page.textContent('#icsmsg'), msg);
  assert.equal(await page.locator('.coach-all input[data-id=meal]').isChecked(), true);
}));

test('budget copy grammar', () => at('?d=q1&r=gg&s=sw&g=20&v=public&m=catering', async (page) => {
  const txt = await page.textContent('body');
  assert.doesNotMatch(txt, /만원라 /);
  assert.match(txt, /만원이라 100만원보다/);
}));
