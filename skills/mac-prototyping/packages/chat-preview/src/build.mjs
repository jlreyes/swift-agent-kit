import { readFile, writeFile, mkdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadToolchain } from './toolchain.mjs';
import { inspectSource, collectSymbols, symbolModule, diagnoseRuntimeCode } from './source.mjs';
import { formatPreview, validateRoot } from './format.mjs';
import { buildSymbolFont } from './font.mjs';

const mediaLoaders = Object.fromEntries(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'mp3', 'mp4', 'webm', 'wav', 'ogg'].map(extension => ['.' + extension, 'dataurl']));
async function ensurePrivateOutput(output) {
  let current = dirname(output);
  while (true) {
    try { current = await realpath(current); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; const parent = dirname(current); if (parent === current) throw error; current = parent; }
  }
  while (true) {
    try { await stat(resolve(current, '.git')); throw new Error('A preview containing a private local font must be written outside every Git repository. Choose a private output directory.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try {
      const [head, objects, refs] = await Promise.all(['HEAD', 'objects', 'refs'].map(name => stat(resolve(current, name))));
      if (head.isFile() && objects.isDirectory() && refs.isDirectory()) throw new Error('A preview containing a private local font must be written outside every Git repository, including bare repositories. Choose a private output directory.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(current); if (parent === current) break; current = parent;
  }
}
async function atomicWrite(output, contents) {
  await mkdir(dirname(output), { recursive: true });
  const temporary = resolve(dirname(output), `.${randomUUID()}.preview.tmp`);
  try { await writeFile(temporary, contents, { flag: 'wx', mode: 0o600 }); await rename(temporary, output); }
  finally { await rm(temporary, { force: true }); }
}
export async function buildPreview(options) {
  if (!options?.entry || !options.output) throw new Error('entry and output are required.');
  const entry = resolve(options.entry);
  const output = resolve(options.output);
  if (entry === output) throw new Error('output must differ from entry.');
  const root = options.root ?? 'mac-chat-preview';
  validateRoot(root);
  const dependencies = resolve(options.dependencies ?? dirname(entry));
  const projectRequire = createRequire(resolve(dependencies, '__preview_resolver__.cjs'));
  const modules = loadToolchain(options.toolchain);
  const { build, transform } = modules.esbuild;
  const acorn = modules.acorn;
  const assetRoot = options.assetRoot ? await realpath(resolve(options.assetRoot)) : null;
  let importsSymbols = false;
  let packagedSymbols = null;
  const sourceCache = new Map();
  const navigationUrls = new Set();
  const authoredDiagnostics = [];
  const plugin = { name: 'self-contained-mac-preview', setup(builder) {
    if (options.macChromeDirectory) builder.onResolve({ filter: /(?:^mac-chrome(?:\/|$)|(?:^|\/)(?:lib|packages)\/mac-chrome(?:\/|$))/ }, async args => {
      const match = args.path.match(/(?:^mac-chrome|(?:^|\/)(?:lib|packages)\/mac-chrome)(?:\/(.*))?$/);
      if (!match) return;
      const rootPath = await realpath(resolve(options.macChromeDirectory));
      const requested = resolve(rootPath, match[1] || 'index');
      const inside = path => { const within = relative(rootPath, path); return within !== '..' && !within.startsWith('..' + sep) && !isAbsolute(within); };
      if (!inside(requested)) throw new Error('mac-chrome import escapes macChromeDirectory.');
      for (const suffix of ['', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.cjs', '/index.ts', '/index.tsx', '/index.mjs', '/index.js', '/index.jsx', '/index.cjs']) {
        let path;
        try { path = await realpath(requested + suffix); }
        catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) continue; throw error; }
        if (!inside(path)) throw new Error('mac-chrome import resolves outside macChromeDirectory through a symlink.');
        if ((await stat(path)).isFile()) return { path };
      }
      throw new Error(`Cannot resolve mac-chrome import ${args.path} inside macChromeDirectory.`);
    });
    builder.onResolve({ filter: /^symbolist$/ }, () => { importsSymbols = true; return { path: 'symbolist', namespace: 'preview-symbols' }; });
    builder.onLoad({ filter: /.*/, namespace: 'preview-symbols' }, () => ({ contents: packagedSymbols === null ? 'export function getSymbol(name){return globalThis.__MAC_PREVIEW_SYMBOL_PROBE__(name)}' : symbolModule(packagedSymbols), loader: 'js' }));
    builder.onResolve({ filter: /^(?:react|react-dom)(?:\/|$)/ }, args => ({ path: projectRequire.resolve(args.path) }));
    builder.onResolve({ filter: /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i }, args => {
      if (args.path.startsWith('data:')) return;
      if (/^data:/i.test(args.path)) return builder.resolve('data:' + args.path.slice(5), { kind: args.kind, resolveDir: args.resolveDir, importer: args.importer });
      throw new Error(`External import is not self-contained: ${args.path} (${args.importer})`);
    });
    builder.onResolve({ filter: /^\// }, async args => {
      if (args.kind !== 'url-token') return;
      if (assetRoot === null) throw new Error(`Root-relative CSS asset needs assetRoot: ${args.path}`);
      const assetUrl = new URL(args.path, 'https://preview.invalid');
      const pathname = decodeURIComponent(assetUrl.pathname);
      const path = await realpath(resolve(assetRoot, '.' + pathname));
      const within = relative(assetRoot, path);
      if (within === '..' || within.startsWith('..' + sep) || isAbsolute(within)) throw new Error(`Asset escapes assetRoot: ${args.path}`);
      return { path, suffix: assetUrl.hash };
    });
    builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async args => {
      if (args.path.includes(`${sep}node_modules${sep}`)) return;
      if (sourceCache.has(args.path)) return sourceCache.get(args.path);
      const contents = await readFile(args.path, 'utf8');
      const suffix = extname(args.path).slice(1);
      const loader = ['tsx', 'jsx', 'ts'].includes(suffix) ? suffix : 'js';
      const inspection = inspectSource((await transform(contents, { loader, jsx: 'automatic', target: 'es2022' })).code, args.path, acorn);
      for (const url of inspection.navigationUrls) navigationUrls.add(url);
      authoredDiagnostics.push(...inspection.diagnostics);
      const result = { contents, loader, resolveDir: dirname(args.path) };
      sourceCache.set(args.path, result);
      return result;
    });
  } };
  const input = options.component ? { stdin: { contents: `import {createRoot} from 'react-dom/client';import Component from ${JSON.stringify(entry)};const root=document.getElementById(${JSON.stringify(root)});if(!root)throw new Error('Preview root is missing');createRoot(root).render(<Component/>);`, resolveDir: dirname(entry), sourcefile: 'chat-preview-mount.jsx', loader: 'jsx' } } : { entryPoints: [entry] };
  const settings = {
    ...input, outfile: output.replace(/\.html?$/i, '') + '.js', bundle: true,
    write: false, metafile: true, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic',
    nodePaths: [dependencies, resolve(dependencies, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'inline', loader: mediaLoaders, plugins: [plugin], logLevel: 'silent',
  };
  const probe = await build({ ...settings, minify: false });
  let symbolReport = { symbols: [], automatic: [], collectionMode: 'recognized-literals-with-explicit-additions' };
  if (importsSymbols) {
    const originalSymbolist = projectRequire('symbolist');
    const probeScript = probe.outputFiles.find(file => file.path.endsWith('.js'))?.text;
    symbolReport = collectSymbols(probeScript, originalSymbolist.getSymbol, acorn, options.additionalSymbols);
    packagedSymbols = symbolReport.symbols;
    if (packagedSymbols.length && !options.fontPath && !options.localSymbols) throw new Error('This preview uses SystemSymbol. Supply fontPath for an embedded subset, or explicitly select localSymbols for a preview that depends on viewer-installed SF Pro.');
  }
  const result = await build({ ...settings, minify: true });
  const javascript = result.outputFiles.find(file => file.path.endsWith('.js'))?.text;
  if (!javascript) throw new Error('esbuild did not produce JavaScript.');
  const reactRoots = new Set(Object.keys(result.metafile.inputs).flatMap(path => {
    const marker = '/node_modules/react/'; const index = path.lastIndexOf(marker);
    return index < 0 ? [] : [path.slice(0, index + marker.length - 1)];
  }));
  if (reactRoots.size > 1) throw new Error('Multiple React installations remain in the bundle. Resolve all React imports from one dependencies project.');
  const external = Object.values(result.metafile.outputs).flatMap(item => item.imports).filter(item => item.external && !item.path.startsWith('data:'));
  if (external.length) throw new Error(`External imports remain: ${external.map(item => item.path).join(', ')}`);
  let css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
  let font = null;
  if (options.fontPath && symbolReport.symbols.length) {
    await ensurePrivateOutput(output);
    font = await buildSymbolFont({ fontPath: options.fontPath, symbols: symbolReport.symbols, family: `${root}-symbols`, python: options.python ?? 'python3' });
    css += '\n' + font.css;
  }
  const minified = await modules.terser.minify(javascript, { compress: { passes: 2 }, mangle: true, format: { comments: 'some' }, ecma: 2022 });
  if (!minified.code) throw new Error('Terser did not produce JavaScript.');
  const runtimeDiagnostics = diagnoseRuntimeCode(minified.code, acorn);
  const formatted = formatPreview({ root, css, script: minified.code, format: options.format ?? 'gzip', maxBytes: options.maxBytes ?? 1_000_000 });
  await atomicWrite(output, formatted.fragment);
  const contributors = Object.values(result.metafile.outputs).flatMap(item => Object.entries(item.inputs)).map(([path, item]) => ({ path, bytes: item.bytesInOutput })).sort((a, b) => b.bytes - a.bytes).slice(0, 20);
  return {
    output, root, authoredDiagnostics, runtimeDiagnostics, authoredNavigationUrls: [...navigationUrls], format: options.format ?? 'gzip', ...formatted.sizes,
    symbols: symbolReport.symbols.map(({ name }) => name), automaticSymbols: symbolReport.automatic,
    symbolCollectionMode: symbolReport.collectionMode, fontBytes: font?.bytes ?? 0,
    localSymbols: Boolean(options.localSymbols && !font && symbolReport.symbols.length), reactInstallations: [...reactRoots], contributors,
    limitations: ['Symbol collection includes recognized literals and explicit additionalSymbols. Supply every full name computed only at runtime and exercise those states; the packaged lookup throws for names outside that set.', 'JavaScript resource and API-call heuristics are advisory hints, not an isolation boundary. They can miss aliases and flag harmless application data. The delivery host owns runtime restrictions.', 'Deliver one preview per isolated document permitting inline scripts/styles and data images/fonts. CSS retains its document-level semantics. Use the host runtime policy; the fragment does not create a sandbox or enforce a network policy.'],
  };
}
