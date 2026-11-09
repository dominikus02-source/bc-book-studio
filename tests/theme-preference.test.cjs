const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load({ stored = null, systemDark = false, blocked = false } = {}) {
  let value = stored;
  const writes = [], events = [];
  const root = { dataset: {}, style: {} };
  const media = { matches: systemDark };
  const storage = {
    getItem: () => { if (blocked) throw Error('Storage denied'); return value; },
    setItem: (key, next) => { if (blocked) throw Error('Storage denied'); value = next; writes.push([key, next]); },
    removeItem: key => { if (blocked) throw Error('Storage denied'); value = null; writes.push([key, null]); },
  };
  const context = {
    exports: {}, Event: class { constructor(type) { this.type = type; } },
    document: { documentElement: root },
    window: { localStorage: storage, matchMedia: () => media, dispatchEvent: event => events.push(event.type) },
    localStorage: storage, matchMedia: () => media,
  };
  const source = fs.readFileSync('lib/theme.ts', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { api: context.exports, context, root, writes, events, media };
}

test('validated preference and deterministic OS fallback', () => {
  const { api } = load();
  for (const value of [null, '', 'invalid', 'system', '<script>']) assert.equal(api.parseTheme(value), 'system');
  assert.equal(api.parseTheme('dark'), 'dark');
  assert.equal(api.parseTheme('light'), 'light');
  assert.equal(api.resolveTheme('system', true), 'dark');
  assert.equal(api.resolveTheme('system', false), 'light');
  assert.equal(api.resolveTheme('light', true), 'light');
  assert.equal(api.resolveTheme('dark', false), 'dark');
});

test('bootstrap runs before hydration without persisting a default', () => {
  for (const [stored, systemDark, expected] of [[null, true, 'dark'], [null, false, 'light'], ['dark', false, 'dark'], ['light', true, 'light'], ['bad', true, 'dark']]) {
    const { api, context, root, writes } = load({ stored, systemDark });
    vm.runInNewContext(api.themeBootstrap, context);
    assert.equal(root.dataset.theme, expected);
    assert.equal(root.style.colorScheme, expected);
    assert.equal(root.dataset.themePreference, api.parseTheme(stored));
    assert.equal(writes.length, 0);
  }
});

test('blocked storage still honors OS and permits in-memory explicit choice', () => {
  const { api, context, root, writes, events } = load({ blocked: true, systemDark: true });
  vm.runInNewContext(api.themeBootstrap, context);
  assert.equal(root.dataset.theme, 'dark');
  api.saveTheme('light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(api.readTheme(), 'light');
  assert.equal(writes.length, 0);
  assert.deepEqual(events, ['bc-theme-change']);
});

test('explicit choice persists; system resets storage and tracks media changes', () => {
  const { api, root, writes, media } = load();
  api.saveTheme('dark');
  assert.equal(api.readTheme(), 'dark');
  assert.equal(root.dataset.theme, 'dark');
  api.saveTheme('system');
  assert.equal(api.readTheme(), 'system');
  media.matches = true;
  api.applyTheme(api.readTheme());
  assert.equal(root.dataset.theme, 'dark');
  assert.deepEqual(writes, [['bcstudio-theme', 'dark'], ['bcstudio-theme', null]]);
});
