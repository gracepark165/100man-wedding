const test = require('node:test');
const assert = require('node:assert/strict');
const { open, fileUrl } = require('./helpers');

const NOW = new Date(2026, 10, 10);
const fixed = (p) => p.clock.setFixedTime(NOW);
const SEOUL = { date: 'fall', region: 'seoul', sub: 'gs', guests: '20', venue: 'public', meal: 'box' };
const ALWAYS = ['share', 'venue', 'meal', 'attire', 'invite', 'staff', 'count', 'final', 'register'];
const ids = (page, a) => page.evaluate((a) => window.__app.coachTasks(window.__app.calc(a)).map((t) => t.id), a);
const order = (page, a, prog) => page.evaluate(([a, prog]) => {
  const r = window.__app.coachOrder(window.__app.coachTasks(window.__app.calc(a)), prog || { done: {}, skip: [] });
  return { todo: r.todo.map((t) => ({ id: t.id, act: t.act })), done: r.done.map((t) => t.id) };
}, [a, prog]);

async function withPage(fn, opts = {}) {
  const { browser, page, errors } = await open({ beforeGoto: fixed, ...opts });
  try { await fn(page, errors); } finally { await browser.close(); }
}

test('conditional tasks', () => withPage(async (page) => {
  const u = await ids(page, { ...SEOUL, res: 'u' });
  assert.ok(u.includes('res-check') && u.includes('consult') && !u.includes('support'), u.join());
  const y = await ids(page, { ...SEOUL, res: 'y' });
  assert.ok(y.includes('support') && !y.includes('res-check') && y.includes('consult'), y.join());
  const g = await ids(page, { ...SEOUL, region: 'gg', sub: 'sw' });
  for (const x of ['res-check', 'consult', 'support']) assert.ok(!g.includes(x), x);
  for (const L of [u, y, g]) for (const x of ALWAYS) assert.ok(L.includes(x), x);
}));

test('budget first', () => withPage(async (page) => {
  const r = await order(page, { date: 'q1', region: 'gg', sub: 'sw', guests: '20', venue: 'public', meal: 'catering' });
  assert.equal(r.todo[0].id, 'budget');
  assert.equal(r.todo[0].act.type, 'tab');
  assert.equal(r.todo[0].act.tab, 'budget');
}));

test('res-check right after budget', () => withPage(async (page) => {
  const r = await order(page, { ...SEOUL, res: 'u' });
  assert.equal(r.todo.filter((t) => t.id !== 'budget')[0].id, 'res-check');
}));

test('urgent before rest', () => withPage(async (page) => {
  const r = (await order(page, { ...SEOUL, region: 'gg', sub: 'sw', date: 'y2026' })).todo.map((t) => t.id);
  assert.ok(r.indexOf('share') < r.indexOf('venue'), r.join());
  assert.equal(r[r.length - 1], 'register', r.join());
}));

test('skip goes last', () => withPage(async (page) => {
  const r = (await order(page, SEOUL, { done: {}, skip: ['share'] })).todo.map((t) => t.id);
  assert.equal(r[r.length - 1], 'share');
}));

test('all skipped', () => withPage(async (page) => {
  const all = await ids(page, SEOUL);
  const skip = ['meal', ...all.filter((x) => x !== 'meal')];
  const r = await order(page, SEOUL, { done: {}, skip });
  assert.equal(r.todo[0].id, 'meal');
}));

test('orphan ids ignored', () => withPage(async (page, errors) => {
  const r = await order(page, { ...SEOUL, region: 'gg', sub: 'sw' }, { done: { 'res-check': true, nope: true }, skip: ['nope'] });
  assert.equal(r.done.length, 0);
  assert.deepEqual(errors, []);
}));

test('groups', () => withPage(async (page) => {
  const g = await page.evaluate(() => [
    { id: 'budget' }, { id: 'meal', dd: 10 }, { id: 'meal', dd: -3 }, { id: 'register', dd: -3 }, { id: 'meal', dd: 30 }, { id: 'meal', dd: 90 },
  ].map(window.__app.coachGroup));
  assert.deepEqual(g, ['now', 'now', 'now', 'month', 'month', 'later']);
}));

test('prog persists by id', () => withPage(async (page) => {
  await page.goto(fileUrl() + '?d=fall&r=gg&s=sw&g=20&v=public&m=box');
  await page.waitForSelector('.hero');
  await page.click('[data-tab=plan]');
  await page.locator('[data-panel=plan] input[data-id=meal]').check();
  await page.reload();
  await page.waitForSelector('.hero');
  await page.click('[data-tab=plan]');
  assert.equal(await page.locator('[data-panel=plan] input[data-id=meal]').isChecked(), true);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.ok(keys.some((k) => k.startsWith('coach:')), keys.join());
  assert.ok(!keys.some((k) => k.startsWith('chk:')), keys.join());
}));

test('ics uid by id', () => withPage(async (page) => {
  const ics = await page.evaluate(() => window.__app.buildIcs([{ id: 'meal', t: 'a', d: 'b', due: new Date(2027, 0, 5) }]));
  assert.ok(ics.includes('UID:meal-20270105@100man-wedding'), ics);
}));
