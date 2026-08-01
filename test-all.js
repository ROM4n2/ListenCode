// ListenCode 基础单元测试 (L-2)
// 使用 Node.js 内置 assert，不依赖测试框架
const assert = require('assert');

const { parseCookieInput } = require('./out/cookie');
const { weapi, eapi, md5 } = require('./out/provider/crypto');
const { getHistory, addHistory } = require('./out/search-history');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS:', name);
  } catch (err) {
    failed += 1;
    console.error('FAIL:', name);
    console.error('  ', err.message);
  }
}

// ── parseCookieInput ──────────────────────────────────────────────

test('parseCookieInput: raw format passthrough', () => {
  assert.strictEqual(parseCookieInput('a=1; b=2'), 'a=1; b=2');
});

test('parseCookieInput: DevTools tab-separated table', () => {
  const input = 'name\tvalue\tdomain\nfoo\tbar\t.com';
  assert.strictEqual(parseCookieInput(input), 'foo=bar');
});

test('parseCookieInput: JSON array of cookies', () => {
  const input = JSON.stringify([{ name: 'a', value: '1' }, { name: 'b', value: '2' }]);
  assert.strictEqual(parseCookieInput(input), 'a=1; b=2');
});

test('parseCookieInput: JSON single object', () => {
  const input = JSON.stringify({ name: 'sid', value: 'abc' });
  assert.strictEqual(parseCookieInput(input), 'sid=abc');
});

test('parseCookieInput: empty string', () => {
  assert.strictEqual(parseCookieInput(''), '');
});

test('parseCookieInput: whitespace only', () => {
  assert.strictEqual(parseCookieInput('   \n\t  '), '');
});

test('parseCookieInput: table with header skipped', () => {
  const input = 'name\tvalue\nfoo\tbar\nbaz\tqux';
  assert.strictEqual(parseCookieInput(input), 'foo=bar; baz=qux');
});

// ── crypto: weapi ─────────────────────────────────────────────────

test('weapi: returns params and encSecKey', () => {
  const result = weapi({ s: 'test' });
  assert.ok(result.params, 'params should be truthy');
  assert.ok(result.encSecKey, 'encSecKey should be truthy');
});

test('weapi: encSecKey is 256 hex chars', () => {
  const result = weapi({ s: 'test' });
  assert.strictEqual(result.encSecKey.length, 256);
  assert.ok(/^[0-9a-f]{256}$/.test(result.encSecKey), 'encSecKey must be 256 hex chars');
});

test('weapi: params is base64 string', () => {
  const result = weapi({ s: 'hello' });
  assert.ok(/^[A-Za-z0-9+/=]+$/.test(result.params), 'params must be base64');
});

test('weapi: different inputs produce different outputs', () => {
  const a = weapi({ s: 'a' });
  const b = weapi({ s: 'b' });
  assert.notStrictEqual(a.params, b.params);
});

// ── crypto: eapi ──────────────────────────────────────────────────

test('eapi: returns uppercase hex string', () => {
  const result = eapi('/api/test', { ids: '[123]' });
  assert.ok(result, 'result should be truthy');
  assert.ok(/^[A-F0-9]+$/.test(result), 'must be uppercase hex');
});

test('eapi: same input produces same output (deterministic)', () => {
  const a = eapi('/api/song', { id: '123' });
  const b = eapi('/api/song', { id: '123' });
  assert.strictEqual(a, b);
});

test('eapi: different URLs produce different outputs', () => {
  const a = eapi('/api/a', { id: '1' });
  const b = eapi('/api/b', { id: '1' });
  assert.notStrictEqual(a, b);
});

// ── crypto: md5 ───────────────────────────────────────────────────

test('md5: known hash value', () => {
  // md5("test") = 098f6bcd4621d373cade4e832627b4f6
  assert.strictEqual(md5('test'), '098f6bcd4621d373cade4e832627b4f6');
});

test('md5: empty string hash', () => {
  assert.strictEqual(md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
});

// ── search-history ────────────────────────────────────────────────

test('getHistory: returns empty array when no history', () => {
  // VS Code globalState.get returns the default when key is missing
  const ctx = { globalState: { get: (k, d) => d, update: () => {} } };
  assert.deepStrictEqual(getHistory(ctx), []);
});

test('getHistory: returns default when key missing', () => {
  const ctx = { globalState: { get: (k, d) => d, update: () => {} } };
  assert.deepStrictEqual(getHistory(ctx), []);
});

test('addHistory: does not throw', () => {
  const ctx = { globalState: { get: () => [], update: () => {} } };
  assert.doesNotThrow(() => addHistory(ctx, 'test'));
});

test('addHistory: update is called with keyword', () => {
  let calledWith = null;
  const ctx = {
    globalState: {
      get: () => [],
      update: (k, v) => { calledWith = v; },
    },
  };
  addHistory(ctx, 'hello');
  assert.deepStrictEqual(calledWith, ['hello']);
});

// ── summary ───────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  process.exit(1);
}
console.log('All tests passed!');
