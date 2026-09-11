import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { loadToolchain } from '../src/toolchain.mjs';

async function fixture(context, files) {
  const directory = await mkdtemp(join(tmpdir(), 'chat-preview-toolchain-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, source] of Object.entries(files)) {
    const path = join(directory, 'node_modules', name, 'index.js');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source);
  }
  return realpath(directory);
}
const fallbackTools = {
  vite: 'module.exports = {};',
  'vite/node_modules/esbuild': 'module.exports = {installation:"fallback"};',
  acorn: 'module.exports = {installation:"primary-acorn"};',
  terser: 'module.exports = {installation:"primary-terser"};',
};

test('a missing transitive dependency in a resolved tool propagates instead of loading fallback', async context => {
  const directory = await fixture(context, {
    ...fallbackTools,
    esbuild: 'module.exports = require("./missing-transitive-dependency.cjs");',
  });
  assert.throws(() => loadToolchain(directory), error => {
    assert.equal(error.code, 'MODULE_NOT_FOUND');
    assert.match(error.message, /missing-transitive-dependency\.cjs/);
    assert.equal(error.requireStack[0], join(directory, 'node_modules/esbuild/index.js'));
    assert.doesNotMatch(error.message, /Missing build dependency/);
    return true;
  });
});

test('a missing requested tool still resolves from an available fallback installation', async context => {
  const directory = await fixture(context, fallbackTools);
  const tools = loadToolchain(directory);
  assert.equal(tools.esbuild.installation, 'fallback');
  assert.equal(tools.acorn.installation, 'primary-acorn');
  assert.equal(tools.terser.installation, 'primary-terser');
});
