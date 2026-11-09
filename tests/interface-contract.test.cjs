const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const postcss = require('postcss');
const css = postcss.parse(fs.readFileSync('app/interface.css', 'utf8'));
function tokens(selector) {
  const result = {};
  css.walkRules(selector, rule => rule.walkDecls(decl => { result[decl.prop] = decl.value; }));
  return result;
}
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(n => parseInt(n, 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a,b) => b-a);
  return (values[0]+.05)/(values[1]+.05);
}
for (const selector of [':root', ':root[data-theme="dark"]']) {
  test(`${selector}: text and focus token contrast (not a page-wide a11y audit)`, () => {
    const t = tokens(selector);
    for (const text of ['--ink', '--muted']) for (const bg of ['--panel', '--bg']) assert.ok(contrast(t[text], t[bg]) >= 4.5, `${text}/${bg}`);
    assert.ok(contrast(t['--accent-ink'], t['--soft']) >= 4.5);
    assert.ok(contrast(t['--focus'], t['--panel']) >= 3);
  });
}
test('semantic aliases bridge reviewer and editor palette to theme tokens', () => {
  const t = tokens(':root');
  assert.equal(t['--card'], 'var(--panel)');
  assert.equal(t['--foreground'], 'var(--ink)');
});
test('public header rules do not leak into studio chrome', () => {
  const legacy = fs.readFileSync('app/globals.css', 'utf8').split('/* Landing and account UI */')[1].split('/* QA quality:')[0];
  postcss.parse(legacy).walkRules(rule => {
    assert.ok(!rule.selectors.includes(".topbar"));
    assert.ok(!rule.selectors.includes(".brand"));
  });
});
test('new chrome stylesheet leaves manuscript, print, canvas content and exports alone', () => {
  css.walkRules(rule => {
    assert.ok(!/writing-preview-paper|\.ProseMirror|book-layout-canvas|@page/.test(rule.selector), rule.selector);
  });
  assert.ok(fs.readFileSync('app/interface.css', 'utf8').includes('prefers-reduced-motion'));
});
test('dashboard has a single theme owner, no mount-time persistence overwrite', () => {
  const source = fs.readFileSync('app/studio/dashboard.tsx','utf8');
  assert.ok(source.includes('<ThemeControl/>'));
  assert.ok(!source.includes('localStorage.setItem("bcstudio-theme"'));
  assert.ok(source.includes('main.inert=true'));
  assert.ok(source.includes('menuRef.current?.focus()'));
});
