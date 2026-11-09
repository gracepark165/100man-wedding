const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { open, fileUrl, buildTo } = require('./helpers');

const LINK = '?d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box';
const CARD = '공공예식장 신청부터 예식까지, 카카오톡으로 같이 준비해 드려요 (무료 시범 운영)';
const configured = buildTo(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-c-')), 'index.html'),
  { CONFIG_JSON: '{"formUrl":"https://example.com/f","formSummaryEntry":"entry.1","goatcounter":""}' });
const pickV = async (page, v) => { await page.click(`.opt[data-v="${v}"]`); await page.waitForTimeout(400); };

test('apply card hidden without config', async () => {
  const { browser, page } = await open({ url: fileUrl() + LINK });
  try {
    await page.waitForSelector('.hero');
    assert.equal(await page.locator('[data-a=apply]').count(), 0);
  } finally { await browser.close(); }
});

test('apply card with config', async () => {
  const { browser, page, errors } = await open({ url: fileUrl(configured) + LINK });
  try {
    await page.waitForSelector('.hero');
    assert.match(await page.textContent('body'), new RegExp(CARD.replace(/[()]/g, '\\$&')));
    const href = await page.getAttribute('[data-a=apply]', 'href');
    assert.ok(href.startsWith('https://example.com/f?usp=pp_url&entry.1='), href);
    const summary = decodeURIComponent(href.split('entry.1=')[1]);
    assert.ok(summary.includes('하객: 20명 내외'), summary);
    assert.ok(summary.includes('거주지: 네, 서울에 살아요'), summary);
    assert.equal(await page.getAttribute('[data-a=apply]', 'target'), '_blank');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('track calls', async () => {
  const { browser, page, errors } = await open({
    url: fileUrl(configured),
    init: () => {
      window.__calls = [];
      window.goatcounter = { count: (e) => window.__calls.push(e.path) };
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
    },
  });
  try {
    await page.click('[data-a=start]');
    for (const v of ['q1', 'gg', 'sw', '20', 'public', 'box']) await pickV(page, v);
    await page.waitForSelector('.hero');
    await page.click('[data-a=share]');
    await page.click('[data-a=apply]');
    assert.deepEqual(await page.evaluate(() => window.__calls), ['start', 'result', 'share', 'apply']);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
