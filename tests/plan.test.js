const test = require('node:test');
const assert = require('node:assert/strict');
const { open, fileUrl } = require('./helpers');

const FALL = '?d=fall&r=gg&s=sw&g=20&v=public&m=box';
const planTab = async (page) => { await page.waitForSelector('.hero'); await page.click('[data-a=tab][data-tab=plan]'); };

test('checks persist', async () => {
  const { browser, page, errors } = await open({ url: fileUrl() + FALL });
  try {
    await planTab(page);
    const first = page.locator('.task input').first();
    const i = await first.getAttribute('data-i');
    await first.check();
    await page.reload();
    await planTab(page);
    assert.equal(await page.locator(`.task input[data-i="${i}"]`).isChecked(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('storage blocked', async () => {
  const { browser, page, errors } = await open({ url: fileUrl() + FALL, blockStorage: true });
  try {
    await planTab(page);
    await page.locator('.task input').first().check();
    assert.match(await page.textContent('#pgtext'), /^1 \//);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ics format', async () => {
  const { browser, page } = await open();
  try {
    const ics = await page.evaluate(() => window.__app.buildIcs([{ t: '장소, 예약', d: 'a;b', due: new Date(2027, 0, 5) }]));
    assert.ok(ics.includes('DTSTART;VALUE=DATE:20270105'));
    assert.ok(ics.includes('DTEND;VALUE=DATE:20270106'));
    assert.ok(ics.includes('SUMMARY:장소\\, 예약'));
    assert.ok(ics.includes('DESCRIPTION:a\;b'));
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.split('\r\n').slice(0, -1).every((l) => !l.includes('\n')));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  } finally { await browser.close(); }
});

test('ics download', async () => {
  const { browser, page, errors } = await open({ url: fileUrl() + FALL });
  try {
    await planTab(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a=ics]')]);
    assert.equal(dl.suggestedFilename(), 'wedding-plan.ics');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ics all past', async () => {
  const { browser, page, errors } = await open({
    url: fileUrl() + '?d=q1&r=gg&s=sw&g=20&v=public&m=box',
    beforeGoto: (p) => p.clock.setFixedTime(new Date(2027, 2, 1)),
  });
  try {
    await planTab(page);
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.click('[data-a=ics]');
    await page.waitForSelector('text=남은 할 일이 없어 캘린더에 넣을 일정이 없어요.');
    assert.equal(downloaded, false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
