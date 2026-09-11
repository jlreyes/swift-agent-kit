#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { buildPreview } from './src/build.mjs';

const { values } = parseArgs({ options: {
  component: { type: 'boolean' }, 'mac-chrome-directory': { type: 'string' }, config: { type: 'string' }, entry: { type: 'string' }, output: { type: 'string' },
  dependencies: { type: 'string' }, toolchain: { type: 'string' }, root: { type: 'string' },
  'asset-root': { type: 'string' }, font: { type: 'string' }, python: { type: 'string' },
  'additional-symbols': { type: 'string' }, 'local-symbols': { type: 'boolean' },
  format: { type: 'string' }, 'max-bytes': { type: 'string' }, 'keep-desktop-css': { type: 'boolean' },
  help: { type: 'boolean' },
} });
if (values.help) {
  console.log('mac-chat-preview --entry preview.tsx --output /private/output/preview.html [--component] [--mac-chrome-directory toolkit] [--font /local/SF-Pro-Text-Regular.otf] [--config preview.config.json] [--format gzip|raw] [--dependencies project] [--toolchain project] [--additional-symbols names.json] [--python executable] [--asset-root public] [--root mac-chat-preview] [--max-bytes 1000000] [--local-symbols] [--keep-desktop-css]');
} else {
  try {
    let config = {};
    if (values.config) {
      const configPath = resolve(values.config);
      config = JSON.parse(await readFile(configPath, 'utf8'));
      if (config === null || typeof config !== 'object' || Array.isArray(config)) throw new Error('config must contain an object.');
      for (const key of ['entry', 'output', 'dependencies', 'toolchain', 'assetRoot', 'fontPath', 'macChromeDirectory']) if (config[key]) config[key] = resolve(dirname(configPath), config[key]);
    }
    const names = { 'mac-chrome-directory': 'macChromeDirectory', 'asset-root': 'assetRoot', font: 'fontPath', 'local-symbols': 'localSymbols' };
    for (const key of ['entry', 'output', 'dependencies', 'toolchain', 'component', 'mac-chrome-directory', 'root', 'asset-root', 'font', 'python', 'format', 'local-symbols']) if (values[key] !== undefined) config[names[key] ?? key] = values[key];
    if (values['additional-symbols']) config.additionalSymbols = JSON.parse(await readFile(values['additional-symbols'], 'utf8'));
    if (values['max-bytes']) config.maxBytes = Number(values['max-bytes']);
    if (values['keep-desktop-css']) config.windowOnly = false;
    console.log(JSON.stringify(await buildPreview(config), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
