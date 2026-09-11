import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPreview } from '../src/build.mjs';
import { formatPreview } from '../src/format.mjs';
import { loadToolchain } from '../src/toolchain.mjs';

const tools = loadToolchain(process.env.MAC_PREVIEW_TOOLCHAIN);

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

function fragmentCss(fragment) {
  let css;
  const document = { createElement: tag => ({ tag }), head: { append: node => { css = node.textContent; } }, body: { append() {} } };
  vm.runInNewContext(fragment.match(/<script>([\s\S]*)<\/script>/)[1], { document });
  return css;
}

test('normal CSS document selectors and animation semantics survive packaging', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'chat-preview-css-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'preview.js'), 'import "./preview.css";document.body.dataset.ready="yes";');
  await writeFile(join(directory, 'preview.css'), ':ROOT,HTML,Body{min-height:100vh;background:red}*::before,*.active,*:hover,*[dir]{color:blue}button,::view-transition-old(root){opacity:.5}@keyframes linear{0%,50%{width:50px}100%{width:100px}}.motion{animation:1s linear linear;animation-name:var(--animation-name)}');
  const output = join(directory, 'preview.html');
  await buildPreview({ entry: join(directory, 'preview.js'), output, format: 'raw' });
  const css = fragmentCss(await readFile(output, 'utf8'));
  assert.match(css, /:ROOT,HTML,Body\{min-height:100vh;background:red\}/);
  assert.match(css, /\*:{1,2}before,\*\.active,\*:hover,\*\[dir\]/);
  assert.match(css, /button,::view-transition-old\(root\)/);
  assert.match(css, /@keyframes linear\{0%,50%\{width:50px\}/);
  assert.match(css, /animation:1s linear linear;animation-name:var\(--animation-name\)/);
  assert.doesNotMatch(css, /#mac-chat-preview|mac-chat-preview-linear/);
});

test('ordinary global at-rules and nested root selectors need no packager adaptation', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'chat-preview-global-css-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'preview.js'), 'import "./preview.css";document.body.dataset.ready="yes";');
  await writeFile(join(directory, 'preview.css'), '@layer product{:where(:root){--color:red}body+.outside{color:var(--color)}}@font-face{font-family:fixture;src:url(data:font/woff2;base64,YQ==)}');
  const output = join(directory, 'preview.html');
  await buildPreview({ entry: join(directory, 'preview.js'), output, format: 'raw' });
  const css = fragmentCss(await readFile(output, 'utf8'));
  assert.match(css, /@layer product/);
  assert.match(css, /:where\(:root\)/);
  assert.match(css, /body\+\.outside/);
  assert.match(css, /@font-face/);
});

test('embedded style entry loads the same component CSS without wallpaper assets', async () => {
  const directory = fileURLToPath(new URL('../../mac-chrome/styles/', import.meta.url));
  const build = entry => tools.esbuild.build({ entryPoints: [join(directory, entry)], bundle: true, write: false, metafile: true, loader: { '.svg': 'dataurl' }, external: ['/mac-assets/*'], logLevel: 'silent' });
  const [embedded, desktop] = await Promise.all([build('embedded.css'), build('index.css')]);
  const embeddedCss = embedded.outputFiles[0].text;
  const desktopCss = desktop.outputFiles[0].text;
  const componentInputs = Object.keys(embedded.metafile.inputs).filter(path => path.endsWith('.css') && !path.endsWith('/embedded.css'));
  assert.ok(componentInputs.every(path => Object.hasOwn(desktop.metafile.inputs, path)));
  assert.match(embeddedCss, /var\(--mc-wallpaper-default, none\)/);
  assert.doesNotMatch(desktopCss, /--mc-wallpaper-default: none/);
  assert.doesNotMatch(embeddedCss, /wallpaper\.svg|tahoe\.jpg|data:image\/svg/);
  assert.match(desktopCss, /--mc-wallpaper-default: url\(/);
  assert.match(desktopCss, /tahoe\.jpg/);
  assert.ok(Object.keys(desktop.metafile.inputs).some(path => path.endsWith('/desktop-wallpaper.css')));
  assert.ok(!Object.keys(embedded.metafile.inputs).some(path => path.endsWith('/desktop-wallpaper.css')));
  assert.match(embeddedCss, /html,\s*body\s*\{\s*min-width: 0;\s*min-height: 0;\s*margin: 0;\s*background: transparent;/);
});
