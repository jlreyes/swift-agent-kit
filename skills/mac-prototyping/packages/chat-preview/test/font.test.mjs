import assert from 'node:assert/strict';
import { access, chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { buildSymbolFont } from '../src/font.mjs';

const symbols = [{ name: 'folder', glyph: String.fromCodePoint(0x100215) }];

async function fixture(t, mode = 'success') {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'font-module-test-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fontPath = join(directory, 'source font.otf');
  const python = join(directory, 'fake-python');
  const log = join(directory, 'calls.jsonl');
  await writeFile(fontPath, 'test source');
  await writeFile(python, `#!${process.execPath}\n` + `
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
const mode = ${JSON.stringify(mode)};
if (mode === 'missing-tools' && args[0] === '-c') {
  process.stderr.write('Install fontTools and Brotli in the supplied Python environment'); process.exit(1);
}
if (mode === 'missing-glyph' && args[0] === '-c') {
  process.stderr.write('Source font has no mapping for: U+100215'); process.exit(1);
}
if (args[0] === '-m') {
  const output = args.find(arg => arg.startsWith('--output-file=')).slice(14);
  fs.writeFileSync(output, mode === 'bad-font' ? 'invalid' : 'wOF2fixture');
  if (mode === 'subset-error') { process.stderr.write('subset failed'); process.exit(1); }
}
`);
  await chmod(python, 0o700);
  return { directory, fontPath, python, log };
}

async function calls(log) {
  return (await readFile(log, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
}

function outputPath(args) {
  return args.find((argument) => argument.startsWith('--output-file=')).slice(14);
}

test('resolves source, checks mappings before subsetting, embeds WOFF2, and removes temporary output', async (t) => {
  const f = await fixture(t);
  const alias = join(f.directory, 'source-alias.otf');
  await symlink(f.fontPath, alias);
  const result = await buildSymbolFont({ ...f, fontPath: alias, symbols: [...symbols, ...symbols], family: 'PreviewSymbols' });
  assert.equal(result.sourcePath, f.fontPath);
  assert.equal(result.bytes, 11);
  assert.equal(result.base64Bytes, 16);
  assert.match(result.css, /--font-sf-symbols:"PreviewSymbols"/);
  assert.match(result.css, /data:font\/woff2;base64,d09GMmZpeHR1cmU=/);
  assert.equal(result.outputPath, undefined);
  const [inspection, subset] = await calls(f.log);
  assert.equal(inspection[0], '-c');
  assert.match(inspection[1], /getBestCmap/);
  assert.deepEqual(inspection.slice(2), [f.fontPath, '100215']);
  assert.deepEqual(subset.slice(0, 6), ['-m', 'fontTools.subset', f.fontPath, '--unicodes=U+100215', '--flavor=woff2', '--no-subset-tables+=trak']);
  await assert.rejects(access(dirname(outputPath(subset))), { code: 'ENOENT' });
});

test('explicit private output is retained outside Git', async (t) => {
  const f = await fixture(t);
  const result = await buildSymbolFont({ ...f, symbols, outputDirectory: join(f.directory, 'private') });
  assert.equal((await readFile(result.outputPath)).toString(), 'wOF2fixture');
});

test('rejects Git worktree output including a symlink into ignored-style directories', async (t) => {
  const f = await fixture(t);
  const repository = join(f.directory, 'repository');
  await mkdir(repository);
  await writeFile(join(repository, '.git'), 'gitdir: elsewhere');
  const alias = join(f.directory, 'alias');
  await symlink(repository, alias);
  await assert.rejects(buildSymbolFont({ ...f, symbols, outputDirectory: join(alias, 'private', 'nested') }), /outside every Git repository/);
  await assert.rejects(access(f.log), { code: 'ENOENT' });
});

for (const [mode, expected] of [['missing-tools', /fontTools and Brotli/], ['missing-glyph', /no mapping for: U\+100215/]]) {
  test(`${mode} fails before subsetting`, async (t) => {
    const f = await fixture(t, mode);
    await assert.rejects(buildSymbolFont({ ...f, symbols }), expected);
    assert.equal((await calls(f.log)).length, 1);
  });
}

for (const [mode, expected] of [['subset-error', /Font subset failed: subset failed/], ['bad-font', /did not produce a WOFF2/]]) {
  test(`${mode} cleans temporary output`, async (t) => {
    const f = await fixture(t, mode);
    await assert.rejects(buildSymbolFont({ ...f, symbols }), expected);
    const [, subset] = await calls(f.log);
    await assert.rejects(access(dirname(outputPath(subset))), { code: 'ENOENT' });
  });
}

test('reports missing font and Python without installing anything', async (t) => {
  const f = await fixture(t);
  await assert.rejects(buildSymbolFont({ ...f, symbols, fontPath: join(f.directory, 'absent') }), /Cannot read local source font/);
  await assert.rejects(buildSymbolFont({ ...f, symbols, python: join(f.directory, 'absent-python') }), /Python executable not found/);
});

test('rejects invalid names, glyphs, empty manifests, and CSS injection before invoking Python', async (t) => {
  const f = await fixture(t);
  const invalid = [
    { symbols: [] },
    { symbols: [{ name: 'folder', glyph: 'ab' }] },
    { symbols: [{ name: '', glyph: 'a' }] },
    { symbols: [{ name: 'folder', glyph: '\uD800' }] },
    { symbols: [symbols[0], { name: 'folder', glyph: 'a' }] },
    { family: 'bad";}body{' },
    { outputDirectory: '' },
    { python: '' },
  ];
  for (const changes of invalid) await assert.rejects(buildSymbolFont({ ...f, symbols, ...changes }));
  await assert.rejects(access(f.log), { code: 'ENOENT' });
});

test('optional real fontTools integration', { skip: !process.env.CHAT_PREVIEW_TEST_FONT }, async () => {
  const result = await buildSymbolFont({
    fontPath: process.env.CHAT_PREVIEW_TEST_FONT,
    python: process.env.CHAT_PREVIEW_TEST_PYTHON ?? 'python3',
    symbols,
  });
  assert.ok(result.bytes > 100);
  assert.match(result.css, /data:font\/woff2;base64,/);
});


test('rejects bare repository output through a symlink before invoking font tools', async t => {
  const f=await fixture(t);
  const repository=join(f.directory,'bare');
  await mkdir(join(repository,'objects'),{recursive:true});
  await mkdir(join(repository,'refs'),{recursive:true});
  await writeFile(join(repository,'HEAD'),'ref: refs/heads/main\n');
  const alias=join(f.directory,'bare-alias');
  await symlink(repository,alias);
  await assert.rejects(buildSymbolFont({...f,symbols,outputDirectory:join(alias,'private','nested')}),/including bare repositories/);
  await assert.rejects(access(f.log),{code:'ENOENT'});
});
