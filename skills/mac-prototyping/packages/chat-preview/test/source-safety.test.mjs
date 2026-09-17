import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectSource, diagnoseRuntimeCode } from '../src/source.mjs';
import { buildPreview } from '../src/build.mjs';
import { loadToolchain } from '../src/toolchain.mjs';
const { acorn } = loadToolchain(process.env.MAC_PREVIEW_TOOLCHAIN);
test('authored sendBeacon calls produce advisory hints, including computed literal properties', () => {
  for (const code of ['navigator.sendBeacon(url,data)', 'navigator["sendBeacon"](url,data)']) { const {diagnostics}=inspectSource(code, 'fixture.js', acorn); assert.equal(diagnostics.length,1); assert.equal(diagnostics[0].severity,'advisory'); assert.equal(diagnostics[0].detail,'sendBeacon'); }
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


test('local helper names and application action data remain valid despite heuristic matches', () => {
  const source='function fetch(){return "local"}const transport={sendBeacon(){return 1}};fetch();transport.sendBeacon();const command={action:"save",src:"application-key"};';
  const report=inspectSource(source,'local-helpers.js',acorn);
  assert.equal(report.diagnostics.filter(item=>item.kind==='network-api').length,2);
  assert.equal(report.diagnostics.filter(item=>item.kind==='resource-url').length,2);
  assert.ok(report.diagnostics.every(item=>item.severity==='advisory' && item.phase==='authored-js' && item.path==='local-helpers.js'));
});
test('computed JavaScript imports are hints while invalid JavaScript remains a parse error', () => {
  const report=inspectSource('import(modulePath)','dynamic.js',acorn);
  assert.equal(report.diagnostics[0].kind,'runtime-import');
  assert.equal(report.diagnostics[0].severity,'advisory');
  assert.throws(()=>inspectSource('const = broken','invalid.js',acorn),SyntaxError);
});
test('navigation observations are preserved separately from advisory JS hints', () => {
  const report=inspectSource('const link={href:"/other",action:"save"}','links.js',acorn);
  assert.deepEqual(report.navigationUrls,['/other']);
  assert.equal(report.diagnostics.length,1);
});

test('false-positive helper and data names do not prevent an actual build', async context => {
  const directory=await mkdtemp(join(tmpdir(),'chat-preview-local-hints-'));
  context.after(()=>rm(directory,{recursive:true,force:true}));
  const entry=join(directory,'preview.js');
  const output=join(directory,'preview.html');
  await writeFile(entry,'function fetch(){return "local-result"}const helpers={sendBeacon(){return "saved"}};const command={action:"save"};document.body.textContent=fetch()+helpers.sendBeacon()+command.action;');
  const report=await buildPreview({entry,output,format:'raw',toolchain:process.env.MAC_PREVIEW_TOOLCHAIN});
  assert.equal(report.authoredDiagnostics.filter(item=>item.kind==='network-api').length,2);
  assert.equal(report.authoredDiagnostics.filter(item=>item.kind==='resource-url').length,1);
  assert.ok(report.authoredDiagnostics.every(item=>item.severity==='advisory'));
  assert.ok((await readFile(output,'utf8')).length>0);
});
