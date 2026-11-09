const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./helpers');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-build-'));
function runBuild(env) {
  try { execFileSync('python3', [path.join(ROOT, 'src/build.py')], { env: { ...process.env, ...env }, stdio: 'pipe' }); return 0; }
  catch (e) { return e.status || 1; }
}

test('build fails on bad venues json', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'bad.json'), '{');
  assert.notEqual(runBuild({ VENUES_JSON: path.join(d, 'bad.json'), OUT: path.join(d, 'out.html') }), 0);
  assert.equal(fs.existsSync(path.join(d, 'out.html')), false);
});

module.exports = { tmp, runBuild };

test('config json invalid fails build', () => {
  const d = tmp();
  assert.notEqual(runBuild({ CONFIG_JSON: '{', OUT: path.join(d, 'out.html') }), 0);
});

test('goatcounter tag only when configured', () => {
  const d = tmp();
  assert.equal(runBuild({ OUT: path.join(d, 'a.html') }), 0);
  assert.ok(!fs.readFileSync(path.join(d, 'a.html'), 'utf8').includes('gc.zgo.at'));
  assert.equal(runBuild({ CONFIG_JSON: '{"formUrl":"","formSummaryEntry":"","goatcounter":"x"}', OUT: path.join(d, 'b.html') }), 0);
  const html = fs.readFileSync(path.join(d, 'b.html'), 'utf8');
  assert.ok(html.includes('data-goatcounter="https://x.goatcounter.com/count"'));
  assert.ok(html.includes('src="//gc.zgo.at/count.js"'));
});
