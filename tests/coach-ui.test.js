const test = require('node:test');
const assert = require('node:assert/strict');
const { open, fileUrl, heading } = require('./helpers');

const fixedAt = (d) => (p) => p.clock.setFixedTime(d);
const NOW = new Date(2026, 10, 10);
const SEOUL_Y = '?d=fall&r=seoul&s=gs&res=y&g=20&v=public&m=box';
const SEOUL_U = '?d=fall&r=seoul&s=gs&res=u&g=20&v=public&m=box';
const OVER = '?d=q1&r=gg&s=sw&g=20&v=public&m=catering';
const todoTitles = (page) => page.evaluate(() => {
  const a = window.__app; const c = a.calc(a.state.ans);
  return a.coachOrder(a.coachTasks(c), a.state.prog).todo.map((t) => t.t);
});
const title = (page) => page.textContent('.coach h2');
const progText = (page) => page.textContent('.coach .coach-prog');

async function at(q, fn, opts = {}) {
  const { browser, page, errors } = await open({ url: fileUrl() + q, beforeGoto: fixedAt(opts.now || NOW), ...opts });
  try { await page.waitForSelector('.coach'); await fn(page, errors); } finally { await browser.close(); }
}

test('card shows first todo', () => at(SEOUL_Y, async (page, errors) => {
  const t = await todoTitles(page);
  assert.equal(await title(page), t[0]);
  assert.match(await page.textContent('.coach'), /왜 지금\?/);
  assert.match(await progText(page), /^완료 0 \//);
  assert.deepEqual(errors, []);
}));

test('done advances', () => at(SEOUL_Y, async (page) => {
  const t = await todoTitles(page);
  await page.click('.coach [data-a=cdone]');
  assert.equal(await title(page), t[1]);
  assert.match(await progText(page), /^완료 1 \//);
  assert.deepEqual(await page.evaluate(() => window.__calls), ['done']);
  await page.reload(); await page.waitForSelector('.coach');
  assert.equal(await title(page), t[1]);
}, { init: () => { window.__calls = []; window.goatcounter = { count: (e) => window.__calls.push(e.path) }; } }));

test('skip moves to end', () => at(SEOUL_Y, async (page) => {
  const t = await todoTitles(page);
  await page.click('.coach [data-a=cskip]');
  assert.equal(await title(page), t[1]);
  assert.match(await progText(page), /^완료 0 \//);
  await page.click('.coach-all summary');
  // 건너뛴 일은 자기 묶음 안에서 미완료 줄 맨 뒤에 온다
  const rows = await page.locator('.coach-all ul').evaluateAll((uls, t0) => uls.map((ul) => [...ul.querySelectorAll('li:not(.done) .t')].map((e) => e.textContent)).find((L) => L.includes(t0)), t[0]);
  assert.equal(rows[rows.length - 1], t[0]);
  assert.deepEqual(await page.evaluate(() => window.__calls), ['skip']);
}, { init: () => { window.__calls = []; window.goatcounter = { count: (e) => window.__calls.push(e.path) }; } }));

test('sync with plan tab', () => at(SEOUL_Y, async (page) => {
  const id = await page.getAttribute('.coach [data-a=cdone]', 'data-id');
  await page.click('.coach [data-a=cdone]');
  await page.click('[data-tab=plan]');
  if (await page.locator(`[data-panel=plan] input[data-id="${id}"]`).count())
    assert.equal(await page.locator(`[data-panel=plan] input[data-id="${id}"]`).isChecked(), true);
  await page.locator('[data-panel=plan] input[data-id=final]').check();
  assert.equal(await page.locator('.coach-all input[data-id=final]').isChecked(), true);
  assert.match(await progText(page), /^완료 2 \//);
}));

test('action: budget tab', () => at(OVER, async (page) => {
  await page.click('.coach [data-a=cact]');
  assert.equal(await page.getAttribute('[data-tab=budget]', 'aria-selected'), 'true');
}));

test('action: residence question and consult link', () => at(SEOUL_U, async (page) => {
  while ((await page.getAttribute('.coach [data-a=cdone]', 'data-id')) !== 'res-check') await page.click('.coach [data-a=cdone]');
  await page.click('.coach [data-a=cact]');
  assert.equal(await heading(page), '두 분 중 한 분이라도 서울에 주민등록이 되어 있나요?');
}));

test('consult link', () => at(SEOUL_Y, async (page) => {
  await page.click('.coach-all summary');
  const href = await page.evaluate(() => {
    const a = window.__app; return a.coachTasks(a.calc(a.state.ans)).find((t) => t.id === 'consult').act.href;
  });
  assert.equal(href, 'https://wedding.seoulwomen.or.kr');
  while ((await page.getAttribute('.coach [data-a=cdone]', 'data-id')) !== 'consult') await page.click('.coach [data-a=cskip]');
  assert.equal(await page.getAttribute('.coach a.coach-act', 'href'), href);
  assert.equal(await page.getAttribute('.coach a.coach-act', 'target'), '_blank');
}));

test('overdue label', () => at('?d=y2026&r=gg&s=sw&g=20&v=public&m=box', async (page) => {
  if ((await page.getAttribute('.coach [data-a=cdone]', 'data-id')) === 'budget') await page.click('.coach [data-a=cdone]');
  assert.match(await page.textContent('.coach'), /늦었어요, 오늘 바로 해요/);
}));

test('all done', () => at(SEOUL_Y, async (page) => {
  for (let i = 0; i < 20 && await page.locator('.coach [data-a=cdone]').count(); i++) await page.click('.coach [data-a=cdone]');
  assert.match(await page.textContent('.coach'), /준비를 모두 마쳤어요\. 축하해요!/);
}));

test('groups render', () => at(SEOUL_Y, async (page) => {
  await page.click('.coach-all summary');
  const heads = await page.locator('.coach-all h3').allTextContents();
  assert.ok(heads.length >= 1);
  for (const h of heads) assert.ok(['지금', '이번 달', '나중에'].includes(h), h);
  const groups = await page.evaluate(() => {
    const a = window.__app; return [...new Set(a.coachTasks(a.calc(a.state.ans)).map(a.coachGroup))];
  });
  assert.equal(heads.length, groups.length);
}));

test('storage blocked coach', () => at(SEOUL_Y, async (page, errors) => {
  const t = await todoTitles(page);
  await page.click('.coach [data-a=cdone]');
  assert.equal(await title(page), t[1]);
  await page.click('.coach [data-a=cskip]');
  assert.deepEqual(errors, []);
}, { blockStorage: true }));

test('past wedding', () => at('?d=q1&r=gg&s=sw&g=20&v=public&m=box', async (page, errors) => {
  assert.ok((await title(page)).length > 0);
  assert.deepEqual(errors, []);
}, { now: new Date(2027, 2, 1) }));
