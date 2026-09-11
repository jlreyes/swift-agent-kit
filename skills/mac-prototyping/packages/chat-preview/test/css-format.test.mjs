import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { formatPreview } from '../src/format.mjs';
import { scopeCss } from '../src/css.mjs';
import { loadToolchain } from '../src/toolchain.mjs';

const tools = loadToolchain(process.env.MAC_PREVIEW_TOOLCHAIN);
const scope = css => scopeCss(css, 'preview', { postcss: tools.postcss, cssTree: tools['css-tree'] });

test('raw payload preserves executable tagged-template raw text and exact CSS text', () => {
  const css = '.x::after{content:"</StYlE>\\\\text"}';
  const script = 'globalThis.result=String.raw`</ScRiPt>\\n${"value"}`;';
  const result = formatPreview({ root: 'preview', css, script, format: 'raw' });
  assert.equal((result.fragment.match(/<\/script/gi) ?? []).length, 1);
  assert.doesNotMatch(result.fragment, /<\/style/i);
  const appended = [];
  const context = vm.createContext({ document: {
    createElement: tag => ({ tag }),
    head: { append: node => appended.push(node) },
    body: { append: node => { appended.push(node); vm.runInContext(node.textContent, context); } },
  } });
  vm.runInContext(result.fragment.match(/<script>(.*)<\/script>/s)[1], context);
  assert.deepEqual(appended.map(node => [node.tag, node.textContent]), [['style', css], ['script', script]]);
  assert.equal(context.result, '</ScRiPt>\\nvalue');
});

test('raw budget and gzip comparison include semantics-preserving JSON and installer overhead', () => {
  const input = { root: 'preview', css: '.x{content:"é <"}', script: 'globalThis.result="</script>";' };
  const raw = formatPreview({ ...input, format: 'raw' });
  const gzip = formatPreview(input);
  assert.equal(raw.sizes.bytes, Buffer.byteLength(raw.fragment));
  assert.equal(raw.sizes.rawBytes, raw.sizes.bytes);
  assert.equal(gzip.sizes.rawBytes, raw.sizes.bytes);
  assert.equal(formatPreview({ ...input, format: 'raw', maxBytes: raw.sizes.bytes }).sizes.bytes, raw.sizes.bytes);
  assert.throws(() => formatPreview({ ...input, format: 'raw', maxBytes: raw.sizes.bytes - 1 }), /maximum/);
});

test('unsupported view-transition selectors do not remove ordinary selector siblings', () => {
  assert.equal(scope('.button,::view-transition-old(root),.other{color:red}'), '#preview .button,#preview .other{color:red}');
  assert.equal(scope('::view-transition-old(root),::view-transition-new(root){opacity:0}'), '');
});

test('animation grammar renames name slots without changing timing and other keywords', () => {
  const css = '@keyframes linear{to{opacity:1}}@keyframes reverse{to{opacity:0}}.x{animation:1s linear linear,2s reverse reverse;animation-name:linear,reverse}';
  const output = scope(css);
  assert.match(output, /animation:1s linear preview-linear,2s reverse preview-reverse/);
  assert.match(output, /animation-name:preview-linear,preview-reverse/);
  assert.match(output, /@keyframes preview-linear/);
});

test('prefixed animations and quoted keyframe names retain their references', () => {
  const output = scope('@-webkit-keyframes fade{to{opacity:1}}@keyframes "linear"{to{opacity:0}}.x{-webkit-animation:fade 1s linear;-webkit-animation-name:fade;animation:"linear" 2s linear}');
  assert.match(output, /@-webkit-keyframes preview-fade/);
  assert.match(output, /-webkit-animation:preview-fade 1s linear/);
  assert.match(output, /-webkit-animation-name:preview-fade/);
  assert.match(output, /animation:"preview-linear"\s*2s linear/);
});

test('escaped keyframe names match animation references by decoded identifier', () => {
  assert.match(scope('@keyframes f\\61 de{to{opacity:1}}.x{animation:fade 1s}'), /animation:preview-fade 1s/);
});

test('ambiguous variable animation names fail rather than producing broken scoped CSS', () => {
  for (const property of ['animation', 'animation-name', '-webkit-animation', '-webkit-animation-name']) {
    assert.throws(() => scope(`@keyframes fade{to{opacity:1}}.x{${property}:var(--motion)}`), /Cannot safely scope CSS/);
  }
});
