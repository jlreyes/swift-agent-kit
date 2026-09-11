import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectSymbols, inspectSource, diagnoseRuntimeCode } from '../src/source.mjs';
import { buildPreview } from '../src/build.mjs';
import { loadToolchain } from '../src/toolchain.mjs';
const { acorn } = loadToolchain(process.env.MAC_PREVIEW_TOOLCHAIN);
const glyphs = { folder: '\u{100215}', gearshape: '\u{1008CB}' };
const getSymbol = name => Object.hasOwn(glyphs, name) ? glyphs[name] : undefined;
const analyze = (source, additional) => collectSymbols(source, getSymbol, acorn, additional);

test('shadowed icon-table parameters cannot inherit an outer finite binding', () => {
  assert.throws(() => analyze('const icons={a:"folder"};function render(icons){jsx(SystemSymbol,{name:icons[selected]})}'), /additionalSymbols/);
});
test('shadowed scalar bindings conservatively require an explicit declaration', () => {
  assert.throws(() => analyze('const icon="folder";function render(icon){jsx(SystemSymbol,{name:icon})}'), /additionalSymbols/);
  assert.throws(() => analyze('const icon="folder";function render({icon}){jsx(SystemSymbol,{name:icon})}'), /additionalSymbols/);
  assert.deepEqual(analyze('const icon="folder";jsx(SystemSymbol,{name:icon})').symbols, [{name:'folder',glyph:glyphs.folder}]);
});
test('alias mutation and function escape cannot prove a named table finite', () => {
  for (const mutation of ['const alias=table;alias.a=runtimeName;', 'mutate(table);']) {
    const code = `const table={a:"folder"};${mutation}jsx(SystemSymbol,{name:table[selected]});`;
    assert.throws(() => analyze(code), /additionalSymbols/);
    assert.deepEqual(analyze(code, ['gearshape']).symbols.map(item => item.name), ['folder','gearshape']);
  }
});
test('duplicate name props follow the last property', () => {
  assert.throws(() => analyze('jsx(SystemSymbol,{name:"folder",name:runtimeName})'), /additionalSymbols/);
  assert.doesNotThrow(() => analyze('jsx(SystemSymbol,{name:runtimeName,name:"folder"})'));
  assert.throws(() => analyze('jsx(SystemSymbol,{name:"folder",[key]:runtimeName})'), /additionalSymbols/);
});
test('component aliases stay conservatively recognized despite shadowing', () => {
  assert.throws(() => analyze('const Icon=SystemSymbol;function other(){const Icon=Unrelated}jsx(Icon,{name:runtimeName})'), /additionalSymbols/);
});
test('authored sendBeacon calls are rejected, including computed literal properties', () => {
  for (const code of ['navigator.sendBeacon(url,data)', 'navigator["sendBeacon"](url,data)']) assert.throws(() => inspectSource(code, 'fixture.js', acorn), /sendBeacon/);
});
test('runtime diagnostics flag common network calls and computed resource assignments', () => {
  const diagnostics = diagnoseRuntimeCode('fetch(url);navigator.sendBeacon(url,data);new WebSocket(endpoint);image.src=variable;image.setAttribute("src",other);const props={poster:posterUrl};', acorn);
  assert.deepEqual(diagnostics.filter(item => item.kind === 'network-api').map(item => item.detail), ['fetch','sendBeacon','WebSocket']);
  assert.equal(diagnostics.filter(item => item.kind === 'computed-resource').length, 3);
});
test('dependency network code and variable resource URLs appear in the build report', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'chat-preview-network-'));
  context.after(() => rm(directory, { recursive:true, force:true }));
  const files = {
    'preview.js': 'import {start} from "network-fixture";const address=globalThis.url;const image=document.createElement("img");image.src=address;globalThis.start=start;',
    'node_modules/network-fixture/package.json': '{"name":"network-fixture","main":"index.js"}',
    'node_modules/network-fixture/index.js': 'export function start(url){return navigator.sendBeacon(url,"fixture")}',
  };
  for (const [name, contents] of Object.entries(files)) { await mkdir(dirname(join(directory,name)), {recursive:true}); await writeFile(join(directory,name),contents); }
  const output=join(directory,'preview.html');
  const report=await buildPreview({ entry:join(directory,'preview.js'),output,format:'raw',toolchain:process.env.MAC_PREVIEW_TOOLCHAIN });
  assert.ok(report.runtimeDiagnostics.some(item => item.kind === 'network-api' && item.detail === 'sendBeacon'));
  assert.ok(report.runtimeDiagnostics.some(item => item.kind === 'computed-resource'));
  assert.match(await readFile(output,'utf8'), /sendBeacon/);
});
