import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import vm from 'node:vm';
import { buildPreview } from '../src/build.mjs';
import { formatPreview } from '../src/format.mjs';
import { collectSymbols, symbolModule } from '../src/source.mjs';
import { loadToolchain } from '../src/toolchain.mjs';

const toolchain = process.env.MAC_PREVIEW_TOOLCHAIN;
const tools = loadToolchain(toolchain);
const glyphs = { folder: '\u{100215}', gearshape: '\u{1008CB}', 'info.circle': '\u{100174}' };
const getSymbol = name => Object.hasOwn(glyphs, name) ? glyphs[name] : undefined;

function symbols(source, additional) { return collectSymbols(source, getSymbol, tools.acorn, additional); }

test('collects both conditional states and finite symbol tables', () => {
  const source = 'jsx(SystemSymbol,{name:({first:"folder",second:"gearshape"})[selected]});jsx(SystemSymbol,{name:open?"info.circle":"folder"});';
  assert.deepEqual(symbols(source).symbols.map(item => item.name), ['folder', 'gearshape', 'info.circle']);
});
test('named tables conservatively require a declaration even when initialized with literals', () => {
  assert.throws(() => symbols('var table={one:"folder",two:"gearshape"};jsx(SystemSymbol,{name:table[selected]});'), /additionalSymbols/);
  assert.deepEqual(symbols('var table={one:"folder",two:"gearshape"};jsx(SystemSymbol,{name:table[selected]});', []).symbols.map(item => item.name), ['folder','gearshape']);
  assert.throws(() => symbols('var table={one:"folder"};table.extra=externalValue;jsx(SystemSymbol,{name:table[selected]});'), /additionalSymbols/);
});
test('unbounded symbols require an explicit dynamic declaration', () => {
  assert.throws(() => symbols('jsx(SystemSymbol,{name:settings.icon});'), /additionalSymbols/);
  assert.deepEqual(symbols('jsx(SystemSymbol,{name:settings.icon});', ['folder']).symbols, [{ name: 'folder', glyph: glyphs.folder }]);
  assert.throws(() => symbols('jsx(SystemSymbol,{name:settings.icon});', ['unknown']), /Unknown symbol/);
});
test('static invalid symbols and spread props cannot silently pass', () => {
  assert.throws(() => symbols('jsx(SystemSymbol,{name:"not-a-symbol"});'), /Unknown statically/);
  assert.throws(() => symbols('jsx(SystemSymbol,{...props});'), /additionalSymbols/);
});
test('packaged dictionary preserves codepoints and rejects unknown dynamic names', async () => {
  const source = symbolModule([{ name: 'folder', glyph: glyphs.folder }]);
  const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.equal(module.getSymbol('folder'), glyphs.folder);
  assert.throws(() => module.getSymbol('gearshape'), /outside the packaged set/);
  assert.throws(() => module.getSymbol('__proto__'), /outside the packaged set/);
});
test('gzip budget includes base64, root, and executable bootstrap overhead', () => {
  const result = formatPreview({ root: 'preview', css: '.x{color:red}', script: 'globalThis.result=42;' });
  assert.equal(result.sizes.bytes, result.sizes.base64Bytes + result.sizes.bootstrapBytes);
  assert.throws(() => formatPreview({ root: 'preview', css: '.x{color:red}', script: 'globalThis.result=42;', maxBytes: result.sizes.bytes - 1 }), /maximum/);
  const payload = result.fragment.match(/atob\('([^']+)'\)/)[1];
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(payload, 'base64')).toString()), { css: '.x{color:red}', script: 'globalThis.result=42;' });
});
test('gzip bootstrap runs without eval and reports unsupported decoding', async () => {
  const result = formatPreview({ root: 'preview', css: 'abc', script: 'globalThis.result=42;' });
  const appended = [];
  const root = {};
  const document = { createElement: tag => ({ tag }), head: { append: node => appended.push(node) }, body: { append: node => appended.push(node) }, getElementById: () => root };
  const script = result.fragment.match(/<script>(.*)<\/script>/s)[1];
  await vm.runInNewContext(script, { document, DecompressionStream, Blob, Response, Uint8Array, atob, console });
  assert.deepEqual(appended.map(node => [node.tag, node.textContent]), [['style', 'abc'], ['script', 'globalThis.result=42;']]);
  await vm.runInNewContext(script, { document, console: { error() {} } });
  assert.match(root.textContent, /Request raw output/);
});

async function fixture(context, files) {
  const directory = await mkdtemp(join(tmpdir(), 'chat-preview-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await Promise.all(Object.entries(files).map(async ([name, contents]) => { await mkdir(dirname(join(directory, name)), { recursive: true }); await writeFile(join(directory, name), contents); }));
  return { directory, read: () => readFile(join(directory, 'preview.html'), 'utf8'), build: options => buildPreview({ entry: join(directory, 'preview.js'), output: join(directory, 'preview.html'), toolchain, format: 'raw', ...options }) };
}
const script = 'import "./preview.css"; document.getElementById("mac-chat-preview").textContent="Fixture";';
const pixel = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

test('packaging fixtures', { concurrency: true }, async context => {
  await Promise.all([
    context.test('preserves resets, document roots, and animation names', async current => {
      const item = await fixture(current, { 'preview.js': script, 'preview.css': ':root{--color:red}body{margin:0}*{box-sizing:border-box}@keyframes fade{from{opacity:0}to{opacity:1}}.x{animation:fade 1s}' });
      await item.build();
      const html = await item.read();
      assert.match(html, /:root\{--color:red\}/);
      assert.match(html, /\*\{box-sizing:border-box\}/);
      assert.match(html, /@keyframes fade/);
      assert.match(html, /animation:fade 1s/);
    }),
    context.test('preserves authored document geometry and embeds explicitly imported wallpaper', async current => {
      const item = await fixture(current, { 'preview.js': script, 'preview.css': ':root{--mc-wallpaper-default:url("/pixel.svg")}html,body{min-width:100%;min-height:100%;margin:0}body{background:black;color:red;font-family:system-ui}', 'pixel.svg': pixel });
      await item.build({ assetRoot: item.directory }); const html = await item.read();
      assert.match(html, /min-width:100%;min-height:100%/); assert.match(html, /color:red/); assert.match(html, /--mc-wallpaper-default:url/); assert.match(html, /data:image\/svg\+xml/);
    }),
    context.test('embeds imported image and root-relative CSS image', async current => {
      const item = await fixture(current, { 'preview.js': 'import image from "./pixel.svg";import "./preview.css";document.body.dataset.image=image;', 'preview.css': '.x{background:url("/pixel.svg")}', 'pixel.svg': pixel });
      await item.build({ assetRoot: item.directory }); assert.match(await item.read(), /data:image\/svg\+xml/);
    }),
    context.test('reports authored resource URLs and network calls without blocking packaging', async current => {
      for (const content of ['document.body.append(Object.assign(document.createElement("img"),{src:"./file.png"}));', 'window.fetch("https://example.com")']) {
        const item = await fixture(current, { 'preview.js': content }); const report=await item.build(); assert.ok(report.authoredDiagnostics.length>0); assert.ok(report.authoredDiagnostics.every(item=>item.severity==='advisory')); assert.ok((await item.read()).length>0);
      }
    }),
    context.test('rejects external CSS resource imports that cannot be embedded', async current => {
      for (const css of ['.x{background:url("https://example.com/x.png")}', '@import "https://example.com/styles.css";']) {
        const item = await fixture(current, { 'preview.js': script, 'preview.css': css }); await assert.rejects(item.build(), /External import/);
      }
    }),
    context.test('budget failure preserves previous artifact', async current => {
      const item = await fixture(current, { 'preview.js': 'document.body.textContent="a reasonably long string";', 'preview.html': 'preserve me' });
      await assert.rejects(item.build({ maxBytes: 10 }), /maximum/); assert.equal(await item.read(), 'preserve me');
    }),
    context.test('symbol use requires an embedded font or explicit local dependency', async current => {
      const item = await fixture(current, {
        'preview.js': 'import {getSymbol} from "symbolist";document.body.textContent=getSymbol("folder");',
        'node_modules/symbolist/package.json': '{"name":"symbolist","main":"index.cjs"}',
        'node_modules/symbolist/index.cjs': 'exports.getSymbol=name=>name==="folder"?"\\u{100215}":undefined;',
      });
      await assert.rejects(item.build(), /Supply fontPath/);
      const report = await item.build({ localSymbols: true }); assert.deepEqual(report.symbols, ['folder']);
      await assert.rejects(item.build({ fontPath: join(item.directory, 'missing.otf') }), /Cannot read local source font/);
    }),
    context.test('font-backed output cannot be written inside a repository', async current => {
      const item = await fixture(current, { 'preview.js': 'import {getSymbol} from "symbolist";document.body.textContent=getSymbol("folder");', 'node_modules/symbolist/package.json': '{"name":"symbolist","main":"index.cjs"}', 'node_modules/symbolist/index.cjs': 'exports.getSymbol=name=>name==="folder"?"\\u{100215}":undefined;', '.git': 'gitdir: elsewhere', 'preview.html': 'unchanged' });
      await assert.rejects(item.build({ fontPath: '/missing/font.otf' }), /outside every Git repository/);
      assert.equal(await item.read(), 'unchanged');
    }),
    context.test('mixed case closing script sequence cannot escape its script element', async current => {
      const item = await fixture(current, { 'preview.js': 'document.body.textContent="</ScRiPt><b>escaped</b>";' });
      await item.build(); assert.equal(((await item.read()).match(/<\/script/gi) ?? []).length, 1);
    }),
  ]);
});
