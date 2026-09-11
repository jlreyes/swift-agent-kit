import { readFile, writeFile, mkdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadToolchain } from './toolchain.mjs';
import { prepareCss, scopeCss } from './css.mjs';
import { inspectSource, collectSymbols, symbolModule } from './source.mjs';
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
  if (options.fontPath) await ensurePrivateOutput(output);
  const dependencies = resolve(options.dependencies ?? dirname(entry));
  const projectRequire = createRequire(resolve(dependencies, '__preview_resolver__.cjs'));
  const modules = loadToolchain(options.toolchain);
  const { build, transform } = modules.esbuild;
  const postcss = modules.postcss;
  const cssTree = modules['css-tree'];
  const acorn = modules.acorn;
  const cssOptions = { postcss, cssTree, windowOnly: options.windowOnly ?? true };
  const assetRoot = options.assetRoot ? await realpath(resolve(options.assetRoot)) : null;
  let importsSymbols = false;
  let packagedSymbols = null;
  const sourceCache = new Map();
  const navigationUrls = new Set();
  const plugin = { name: 'self-contained-mac-preview', setup(builder) {
    if (options.macChromeDirectory) builder.onResolve({ filter: /(?:^mac-chrome(?:\/|$)|(?:^|\/)(?:lib|packages)\/mac-chrome(?:\/|$))/ }, args => {
      const match = args.path.match(/(?:^mac-chrome|(?:^|\/)(?:lib|packages)\/mac-chrome)(?:\/(.*))?$/);
      if (!match) return;
      const rootPath = resolve(options.macChromeDirectory);
      const path = resolve(rootPath, match[1] || 'index.ts');
      const within = relative(rootPath, path);
      if (within.startsWith('..' + sep) || within === '..' || isAbsolute(within)) throw new Error('mac-chrome import escapes macChromeDirectory.');
      return { path };
    });
    builder.onResolve({ filter: /^symbolist$/ }, () => { importsSymbols = true; return { path: 'symbolist', namespace: 'preview-symbols' }; });
    builder.onLoad({ filter: /.*/, namespace: 'preview-symbols' }, () => ({ contents: packagedSymbols === null ? 'export function getSymbol(name){return globalThis.__MAC_PREVIEW_SYMBOL_PROBE__(name)}' : symbolModule(packagedSymbols), loader: 'js' }));
    builder.onResolve({ filter: /^(?:react|react-dom)(?:\/|$)/ }, args => ({ path: projectRequire.resolve(args.path) }));
    builder.onResolve({ filter: /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i }, args => {
      if (args.path.startsWith('data:')) return;
      throw new Error(`External import is not self-contained: ${args.path} (${args.importer})`);
    });
    builder.onResolve({ filter: /^\// }, async args => {
      if (args.kind !== 'url-token') return;
      if (assetRoot === null) throw new Error(`Root-relative CSS asset needs assetRoot: ${args.path}`);
      const path = await realpath(resolve(assetRoot, '.' + args.path));
      const within = relative(assetRoot, path);
      if (within === '..' || within.startsWith('..' + sep) || isAbsolute(within)) throw new Error(`Asset escapes assetRoot: ${args.path}`);
      return { path };
    });
    builder.onLoad({ filter: /\.css$/ }, async args => ({ contents: prepareCss(await readFile(args.path, 'utf8'), args.path, cssOptions), loader: 'css', resolveDir: dirname(args.path) }));
    builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async args => {
      if (args.path.includes(`${sep}node_modules${sep}`)) return;
      if (sourceCache.has(args.path)) return sourceCache.get(args.path);
      const contents = await readFile(args.path, 'utf8');
      const suffix = extname(args.path).slice(1);
      const loader = ['tsx', 'jsx', 'ts'].includes(suffix) ? suffix : 'js';
      for (const url of inspectSource((await transform(contents, { loader, jsx: 'automatic', target: 'es2022' })).code, args.path, acorn)) navigationUrls.add(url);
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
  let symbolReport = { symbols: [], dynamic: [], automatic: [] };
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
  let css = scopeCss(result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '', root, { postcss, cssTree });
  let font = null;
  if (options.fontPath && symbolReport.symbols.length) {
    font = await buildSymbolFont({ fontPath: options.fontPath, symbols: symbolReport.symbols, family: `${root}-symbols`, python: options.python ?? 'python3' });
    css += '\n' + font.css.replace(/:root\b/g, '#' + root);
  }
  const minified = await modules.terser.minify(javascript, { compress: { passes: 2 }, mangle: true, format: { comments: 'some' }, ecma: 2022 });
  if (!minified.code) throw new Error('Terser did not produce JavaScript.');
  const formatted = formatPreview({ root, css, script: minified.code, format: options.format ?? 'gzip', maxBytes: options.maxBytes ?? 1_000_000 });
  await atomicWrite(output, formatted.fragment);
  const contributors = Object.values(result.metafile.outputs).flatMap(item => Object.entries(item.inputs)).map(([path, item]) => ({ path, bytes: item.bytesInOutput })).sort((a, b) => b.bytes - a.bytes).slice(0, 20);
  return {
    output, root, authoredNavigationUrls: [...navigationUrls], format: options.format ?? 'gzip', ...formatted.sizes,
    symbols: symbolReport.symbols.map(({ name }) => name), automaticSymbols: symbolReport.automatic,
    dynamicSymbolExpressions: symbolReport.dynamic, fontBytes: font?.bytes ?? 0,
    localSymbols: Boolean(options.localSymbols && !font), reactInstallations: [...reactRoots], contributors,
    limitations: ['Static analysis conservatively includes recognized symbol literals. Unbounded computed names require an explicit complete additionalSymbols declaration.', 'Exercise every relevant state with network blocked; static source inspection cannot prove arbitrary runtime behavior.', 'Use an isolated iframe permitting inline scripts/styles and data images/fonts. Keep portals inside the preview root.'],
  };
}
