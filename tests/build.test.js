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
