const test = require('node:test');
const assert = require('node:assert/strict');
const { open, fileUrl } = require('./helpers');

const A = { date: 'q1', region: 'seoul', sub: 'gs', res: 'y', guests: '20', venue: 'public', meal: 'box' };
const LINK = '?d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box';
const pickV = async (page, v) => { await page.click(`.opt[data-v="${v}"]`); await page.waitForTimeout(400); };

test('encode/decode roundtrip', async () => {
  const { browser, page } = await open();
  try {
    const r = await page.evaluate((a) => {
      const q = window.__app.encodeAns(a);
      return { q, d: window.__app.decodeAns(q) };
    }, A);
    assert.equal(r.q, LINK.slice(1));
    assert.deepEqual(r.d.ans, A);
    assert.equal(r.d.ok, true);
  } finally { await browser.close(); }
});

test('share link opens result', async () => {
  const { browser, page, errors } = await open({ url: fileUrl() + LINK });
  try {
    await page.waitForSelector('.hero');
    assert.equal(await page.evaluate(() => window.__app.state.ans.res), 'y');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('invalid link', async () => {
  const { browser, page, errors } = await open({ url: fileUrl() + '?d=q1&r=seoul&s=zz&g=999&res=y' });
  try {
    const st = await page.evaluate(() => ({ view: window.__app.state.view, ans: window.__app.state.ans }));
    assert.equal(st.view, 'intro');
    assert.deepEqual(st.ans, { date: 'q1', region: 'seoul', res: 'y' });
    const nonSeoul = await page.evaluate(() => window.__app.decodeAns('d=q1&r=gg&s=sw&res=y&g=20&v=public&m=box'));
    assert.equal(nonSeoul.ok, true);
    assert.equal(nonSeoul.ans.res, undefined);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('url follows edits', async () => {
  const { browser, page } = await open({ url: fileUrl() + LINK });
  try {
    await page.waitForSelector('.hero');
    await page.click('[data-k=guests]');
    await pickV(page, '50');
    await page.waitForSelector('.hero');
    assert.match(page.url(), /[?&]g=50(&|$)/);
    await page.click('[data-a=reset]');
    assert.doesNotMatch(page.url(), /\?/);
  } finally { await browser.close(); }
});

test('share button fallback', async () => {
  const { browser, page, errors } = await open({
    url: fileUrl() + LINK,
    init: () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      window.__copied = [];
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true });
    },
  });
  try {
    await page.waitForSelector('.hero');
    await page.click('[data-a=share]');
    await page.waitForSelector('text=링크를 복사했어요');
    const copied = await page.evaluate(() => window.__copied);
    assert.equal(copied.length, 1);
    assert.ok(copied[0].endsWith(LINK), copied[0]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
