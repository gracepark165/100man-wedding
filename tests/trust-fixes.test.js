const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { open, fileUrl, runBuild, ROOT } = require('./helpers');

async function at(q, fn) {
  const { browser, page, errors } = await open({ url: fileUrl() + q, beforeGoto: (p) => p.clock.setFixedTime(new Date(2026, 10, 16)) });
  try { await page.waitForSelector('.hero'); await fn(page, errors); } finally { await browser.close(); }
}

test('decor basis only verified for public venues', () => at('?d=q1&r=seoul&s=gs&res=y&g=20&v=restaurant&m=r_single', async (page) => {
  assert.equal((await page.textContent('li[data-key=decor] .basis-tag')).trim(), '예시 단가');
  const c = await page.evaluate(() => window.__app.calc(window.__app.state.ans));
  const decor = c.rows.find((r) => r.key === 'decor');
  const others = c.rows.filter((r) => r.key !== 'register' && r.key !== 'decor');
  assert.equal(c.unverifiedAmt, c.gross);
}));

test('build fails when a row key has no cost entry', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-k-'));
  const src = fs.readFileSync(path.join(ROOT, 'src/app.src.html'), 'utf8').replace("{key:'card',name:'청첩장·기타'", "{key:'snack',name:'청첩장·기타'");
  // build.py는 src 폴더 기준이라, 소스 파일만 바꾼 사본 폴더로 빌드한다
  fs.cpSync(path.join(ROOT, 'src'), path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src/app.src.html'), src);
  const { execFileSync } = require('child_process');
  let code = 0;
  try { execFileSync('python3', [path.join(d, 'src/build.py')], { env: { ...process.env, OUT: path.join(d, 'o.html') }, stdio: 'pipe' }); } catch (e) { code = e.status || 1; }
  assert.notEqual(code, 0);
});

test('coach does not promise subsidy', () => at('?d=q1&r=seoul&s=gs&res=u&g=20&v=public&m=box', async (page) => {
  const T = await page.evaluate(() => { const a = window.__app; return a.coachTasks(a.calc(a.state.ans)); });
  const rc = T.find((t) => t.id === 'res-check');
  assert.doesNotMatch(rc.why, /지원받아요/);
  assert.match(rc.why, /공고/);
}));

test('support task says notice unconfirmed', () => at('?d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box', async (page) => {
  const T = await page.evaluate(() => { const a = window.__app; return a.coachTasks(a.calc(a.state.ans)); });
  const s = T.find((t) => t.id === 'support');
  assert.match(s.t + s.why, /공고/);
  assert.match(s.why, /확인 전/);
}));

test('korean particles after won', async () => {
  for (const q of ['?d=q1&r=gg&s=sw&g=10&v=restaurant&m=r_single', '?d=q1&r=seoul&s=gs&res=y&g=10&v=public&m=box', '?d=q1&r=gg&s=sw&g=20&v=outdoor&m=catering']) {
    await at(q, async (page) => {
      const t = await page.textContent('body');
      assert.doesNotMatch(t, /만원로 |만원가 /, q);
    });
  }
});

test('basis and scenario link styling', () => at('?d=q1&r=seoul&s=gs&res=y&g=10&v=public&m=box', async (page) => {
  const b = await page.$eval('li[data-key=meal] details.basis', (el) => { const c = getComputedStyle(el); return [c.borderTopWidth, c.backgroundColor]; });
  assert.equal(b[0], '0px');
  assert.equal(b[1], 'rgba(0, 0, 0, 0)');
  const a = await page.$eval('.scenario a.btn', (el) => { const c = getComputedStyle(el); return [c.textDecorationLine, c.justifyContent]; });
  assert.deepEqual(a, ['none', 'center']);
}));
