import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPreview } from '../src/build.mjs';
import { inspectSource, diagnoseRuntimeCode } from '../src/source.mjs';
import { loadToolchain } from '../src/toolchain.mjs';
const { acorn } = loadToolchain(process.env.MAC_PREVIEW_TOOLCHAIN);
async function fixture(context, files) {
  const directory = await mkdtemp(join(tmpdir(), 'chat-preview-boundary-'));
  context.after(() => rm(directory, { recursive:true, force:true }));
  for (const [name, contents] of Object.entries(files)) { await mkdir(dirname(join(directory,name)), {recursive:true}); await writeFile(join(directory,name),contents); }
  const output = join(directory,'preview.html');
  return { directory, output, read:()=>readFile(output,'utf8'), build:options=>buildPreview({ entry:join(directory,'preview.js'),output,format:'raw',toolchain:process.env.MAC_PREVIEW_TOOLCHAIN,...options }) };
}
test('a font option does not forbid symbol-free output inside Git or imply local symbols', async context => {
  const item=await fixture(context, {'preview.js':'document.body.textContent="without icons";','.git':'gitdir: example'});
  const report=await item.build({ fontPath:join(item.directory,'does-not-exist.otf'),localSymbols:true });
  assert.equal(report.fontBytes,0); assert.equal(report.localSymbols,false); assert.deepEqual(report.symbols,[]);
  assert.ok((await item.read()).length>0);
});
test('toolkit redirection resolves the canonical module instead of the template stub', async context => {
  const item=await fixture(context, {
    'preview.js':'import {value} from "./lib/mac-chrome/index";document.body.textContent=value;',
    'lib/mac-chrome/index.ts':'export const value="template-stub-value";',
    'canonical/index.ts':'export const value="canonical-toolkit-value";',
  });
  await item.build(); assert.match(await item.read(),/template-stub-value/);
  const report=await item.build({macChromeDirectory:join(item.directory,'canonical')});
  const html=await item.read(); assert.match(html,/canonical-toolkit-value/); assert.doesNotMatch(html,/template-stub-value/);
  assert.ok(report.contributors.some(item=>item.path.endsWith('/canonical/index.ts')));
  assert.ok(!report.contributors.some(item=>item.path.includes('/lib/mac-chrome/index.ts')));
});
test('a remapped symlink cannot escape the real toolkit root', async context => {
  const item=await fixture(context, {'preview.js':'import {value} from "mac-chrome/escape";document.body.textContent=value;','canonical/keep.ts':'export {};','outside.ts':'export const value="escaped";','preview.html':'preserve previous artifact'});
  await symlink(join(item.directory,'outside.ts'),join(item.directory,'canonical/escape.ts'));
  await assert.rejects(item.build({macChromeDirectory:join(item.directory,'canonical')}),/outside macChromeDirectory through a symlink/);
  assert.equal(await item.read(),'preserve previous artifact');
});
test('literal srcset candidate lists cannot hide external URLs behind an embedded prefix', () => {
  for (const name of ['srcset','srcSet']) for (const value of ['#placeholder 1x, https://example.com/tracker.png 2x','data:image/png;base64,AAAA 1x, https://example.com/tracker.png 2x','data:image/png;base64,AAAA 1x, data:image/png;base64,BBBB 2x']) {
    const encoded=JSON.stringify(value);
    for (const source of [`const props={${name}:${encoded}};`,`image.${name}=${encoded};`,`image.setAttribute("${name}",${encoded});`]) assert.throws(()=>inspectSource(source,'fixture.js',acorn),/exactly one base64 image data URL/);
  }
});
test('one base64 image srcset candidate and optional descriptor are supported', () => {
  for (const name of ['srcset','srcSet']) for (const value of ['data:image/png;base64,AAAA','data:image/png;base64,AAAA 2x','data:image/png;base64,AAAA 800w']) {
    assert.doesNotThrow(()=>inspectSource(`const props={${name}:${JSON.stringify(value)}}`,'fixture.js',acorn));
  }
});
test('final dependency diagnostics flag unsupported literal srcset lists', () => {
  const diagnostics=diagnoseRuntimeCode('const props={srcSet:"#placeholder 1x, https://example.com/tracker.png 2x"}',acorn);
  assert.equal(diagnostics.length,1); assert.equal(diagnostics[0].kind,'resource-url');
});
