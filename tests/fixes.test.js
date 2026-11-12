const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { open, fileUrl, buildTo } = require('./helpers');

const configured = (formUrl) => buildTo(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-f-')), 'index.html'),
  { CONFIG_JSON: JSON.stringify({ formUrl, formSummaryEntry: 'entry.1', goatcounter: '' }) });
const LINK = '?d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box';

test('malformed percent in link does not blank the page', async () => {
  const { browser, page, errors } = await open({ url: fileUrl() + '?d=q1&r=seoul&utm_content=50%&x=%E0%A4%A' });
  try {
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => window.__app.state.view), 'intro');
    assert.deepEqual(await page.evaluate(() => window.__app.state.ans), { date: 'q1', region: 'seoul' });
  } finally { await browser.close(); }
});

test('demo result is complete and shares', async () => {
  const { browser, page, errors } = await open();
  try {
    await page.click('[data-a=demo]');
    await page.waitForSelector('.hero');
    assert.equal(await page.evaluate(() => window.__app.firstMissing()), -1);
    assert.ok(await page.locator('[data-k=res]').count());
    const q = await page.evaluate(() => window.__app.encodeAns(window.__app.state.ans));
    assert.equal(await page.evaluate((s) => window.__app.decodeAns(s).ok, q), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ics uid stable by task id', async () => {
  const { browser, page } = await open();
  try {
    const ics = await page.evaluate(() => window.__app.buildIcs([{ t: 'a', d: 'b', due: new Date(2027, 0, 5), id: 'venue' }]));
    assert.ok(ics.includes('UID:venue-20270105@100man-wedding'), ics);
  } finally { await browser.close(); }
});

test('checks reload after browser back to another result', async () => {
  const FALL = '?d=fall&r=gg&s=sw&g=20&v=public&m=box';
  const { browser, page, errors } = await open({ url: fileUrl() + FALL });
  try {
    await page.waitForSelector('.hero');
    await page.click('[data-tab=plan]');
    await page.locator('.task input').first().check();       // A의 체크
    await page.click('[data-a=edit]');                         // 질문 처음부터 다시 보기
    await page.click('.opt[data-v="spring"]');                 // 날짜를 B로
    await page.waitForTimeout(400);
    await page.goBack(); await page.waitForTimeout(150);
    await page.goBack();                                       // A 결과 기록으로 돌아감 (답은 B)
    await page.waitForSelector('.hero');
    const st = await page.evaluate(() => ({ date: window.__app.state.ans.date, n: Object.values(window.__app.state.prog.done).filter(Boolean).length }));
    assert.equal(st.date, 'spring');
    assert.equal(st.n, 0, 'B 결과인데 A의 체크가 남아 있음');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('apply url with existing query in formUrl', async () => {
  const f = configured('https://docs.google.com/forms/d/e/X/viewform?usp=sf_link');
  const { browser, page } = await open({ url: fileUrl(f) + LINK });
  try {
    await page.waitForSelector('.hero');
    const href = await page.getAttribute('[data-a=apply]', 'href');
    assert.ok(href.startsWith('https://docs.google.com/forms/d/e/X/viewform?usp=pp_url&entry.1='), href);
    assert.equal(href.split('?').length, 2);
  } finally { await browser.close(); }
});

test('apply button looks like a button', async () => {
  const f = configured('https://example.com/f');
  const { browser, page } = await open({ url: fileUrl(f) + LINK });
  try {
    await page.waitForSelector('.hero');
    const s = await page.$eval('[data-a=apply]', (el) => { const c = getComputedStyle(el); return { td: c.textDecorationLine, jc: c.justifyContent, d: c.display }; });
    assert.equal(s.td, 'none');
    assert.equal(s.d, 'flex');
    assert.equal(s.jc, 'center');
  } finally { await browser.close(); }
});
