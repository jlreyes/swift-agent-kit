import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
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
test('literal srcset candidate lists produce advisory hints even behind embedded prefixes', () => {
  for (const name of ['srcset','srcSet']) for (const value of ['#placeholder 1x, https://example.com/tracker.png 2x','data:image/png;base64,AAAA 1x, https://example.com/tracker.png 2x','data:image/png;base64,AAAA 1x, data:image/png;base64,BBBB 2x']) {
    const encoded=JSON.stringify(value);
    for (const source of [`const props={${name}:${encoded}};`,`image.${name}=${encoded};`,`image.setAttribute("${name}",${encoded});`]) { const {diagnostics}=inspectSource(source,'fixture.js',acorn); assert.equal(diagnostics.length,1); assert.equal(diagnostics[0].kind,'resource-url'); assert.equal(diagnostics[0].severity,'advisory'); }
  }
});
test('one base64 image srcset candidate and optional descriptor need no helper hint', () => {
  for (const name of ['srcset','srcSet']) for (const value of ['data:image/png;base64,AAAA','data:image/png;base64,AAAA 2x','data:image/png;base64,AAAA 800w']) {
    assert.deepEqual(inspectSource(`const props={${name}:${JSON.stringify(value)}}`,'fixture.js',acorn).diagnostics,[]);
  }
});
test('final dependency diagnostics flag unsupported literal srcset lists', () => {
  const diagnostics=diagnoseRuntimeCode('const props={srcSet:"#placeholder 1x, https://example.com/tracker.png 2x"}',acorn);
  assert.equal(diagnostics.length,1); assert.equal(diagnostics[0].kind,'resource-url');
});

function stylesFromRawFragment(fragment) {
  const appended=[];
  const document={createElement:tag=>({tag}),head:{append:node=>appended.push(node)},body:{append:node=>appended.push(node)}};
  const script=fragment.match(/<script>([\s\S]*)<\/script>/)[1];
  vm.runInNewContext(script,{document});
  return appended.find(node=>node.tag==='style').textContent;
}
test('root CSS asset suffixes retain fragments while query keys cannot corrupt embedded bytes', async context => {
  const svg='<svg xmlns="http://www.w3.org/2000/svg"><symbol id="check"><path d="M0 0h1v1z"/></symbol></svg>';
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pS2sAAAAASUVORK5CYII=','base64');
  const item=await fixture(context,{'preview.js':'import "./preview.css";document.body.dataset.ready="yes";','preview.css':'.svg{background:url("/icons.svg?v=1#check")}.png{background:url("/image.png?v=1")}.space{background:url("/space%20image.png?v=2")}','icons.svg':svg,'image.png':png,'space image.png':png});
  await item.build({assetRoot:item.directory});
  const css=stylesFromRawFragment(await item.read());
  const urls=[...css.matchAll(/url\((["']?)(data:image\/.+?)\1\)/g)].map(match=>match[2]);
  assert.equal(urls.length,3);
  const svgUrl=urls.find(value=>value.startsWith('data:image/svg+xml'));
  assert.equal(new URL(svgUrl).hash,'#check');
  assert.equal(await (await fetch(svgUrl)).text(),svg);
  for (const url of urls.filter(value=>value.startsWith('data:image/png'))) {
    assert.equal(new URL(url).search,'');
    assert.doesNotMatch(url,/\?v=/);
    assert.deepEqual(Buffer.from(await (await fetch(url)).arrayBuffer()),png);
  }
});
test('private-font artifacts are rejected inside bare repositories before font extraction', async context => {
  const item=await fixture(context,{
    'preview.js':'import {getSymbol} from "symbolist";document.body.textContent=getSymbol("folder");',
    'node_modules/symbolist/package.json':'{"name":"symbolist","main":"index.cjs"}',
    'node_modules/symbolist/index.cjs':'exports.getSymbol=name=>name==="folder"?"\\u{100215}":undefined;',
    'bare/HEAD':'ref: refs/heads/main\n',
    'bare/objects/keep':'',
    'bare/refs/keep':'',
  });
  await assert.rejects(item.build({output:join(item.directory,'bare','private','preview.html'),fontPath:join(item.directory,'missing-font.otf')}),/including bare repositories/);
});

test('mixed-case data schemes embed CSS images and bundle JavaScript modules', async context => {
  const svg='<svg xmlns="http://www.w3.org/2000/svg"/>';
  const image='DATA:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  const module='DaTa:text/javascript;base64,'+Buffer.from('export default "embedded-module-value"').toString('base64');
  const item=await fixture(context,{
    'preview.js':`import value from ${JSON.stringify(module)};import "./preview.css";globalThis.embeddedValue=value;`,
    'preview.css':`.image{background:url("${image}")}`,
  });
  await item.build();
  const html=await item.read();
  const css=stylesFromRawFragment(html);
  const url=css.match(/url\((?:["']?)(data:[^"')]+)(?:["']?)\)/)[1];
  assert.equal(await (await fetch(url)).text(),svg);
  const runtime=vm.createContext({});
  runtime.document={createElement:tag=>({tag}),head:{append(){}},body:{append(node){vm.runInContext(node.textContent,runtime)}}};
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],runtime);
  assert.equal(runtime.embeddedValue,'embedded-module-value');
  assert.doesNotMatch(html,/DaTa:text\/javascript/);
  assert.doesNotMatch(html,/import\(/);
  await writeFile(join(item.directory,'preview.js'),'import "HTTPS://example.com/remote.js";');
  await assert.rejects(item.build(),/External import is not self-contained/);
});
