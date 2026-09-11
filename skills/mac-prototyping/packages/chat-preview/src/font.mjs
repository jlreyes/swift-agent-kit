import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const runFile = promisify(execFile);
const inspectFont = `
import sys
try:
    import brotli
    from fontTools.ttLib import TTFont
except ImportError as error:
    sys.exit("Install fontTools and Brotli in the supplied Python environment: " + str(error))
try:
    with TTFont(sys.argv[1]) as font:
        cmap = font.getBestCmap() or {}
        missing = [value for value in sys.argv[2].split(',') if int(value, 16) not in cmap]
        if missing:
            sys.exit("Source font has no mapping for: " + ', '.join('U+' + value for value in missing))
except Exception as error:
    sys.exit("Cannot read source font: " + str(error))
`;

async function invokePython(python, args, stage) {
  try {
    return await runFile(python, args, { timeout: 60_000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Python executable not found: ${python}. Supply an installed Python with fontTools and Brotli.`, { cause: error });
    }
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
    throw new Error(`${stage} failed: ${detail}`, { cause: error });
  }
}

async function outsideRepository(directory) {
  let current = resolve(directory);
  while (true) {
    try {
      current = await realpath(current);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
  while (true) {
    try {
      await access(join(current, '.git'));
      throw new Error('Font outputDirectory must be outside every Git repository, including ignored directories.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export async function buildSymbolFont({
  fontPath,
  symbols,
  family = 'MacChatPreviewSymbols',
  python = 'python3',
  outputDirectory,
}) {
  if (typeof fontPath !== 'string' || !fontPath.trim()) throw new Error('fontPath must identify a local source font.');
  if (typeof python !== 'string' || !python.trim()) throw new Error('python must identify an installed Python executable.');
  if (typeof family !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(family)) throw new Error('font family must contain only ASCII letters, digits, underscores, and hyphens, starting with a letter.');
  if (!Array.isArray(symbols) || symbols.length === 0) throw new Error('symbols must contain at least one {name, glyph} entry.');
  const byName = new Map();
  const codepoints = new Set();
  for (const symbol of symbols) {
    if (!symbol || typeof symbol.name !== 'string' || !symbol.name.trim() || typeof symbol.glyph !== 'string' || [...symbol.glyph].length !== 1) {
      throw new Error('Each symbol needs a nonempty name and exactly one Unicode glyph.');
    }
    const point = symbol.glyph.codePointAt(0);
    if (point >= 0xD800 && point <= 0xDFFF) throw new Error(`Invalid Unicode scalar for symbol ${symbol.name}.`);
    if (byName.has(symbol.name) && byName.get(symbol.name) !== symbol.glyph) throw new Error(`Conflicting glyphs for symbol ${symbol.name}.`);
    byName.set(symbol.name, symbol.glyph);
    codepoints.add(point.toString(16).toUpperCase());
  }
  let sourcePath;
  try {
    sourcePath = await realpath(fontPath);
    if (!(await stat(sourcePath)).isFile()) throw new Error('Path is not a file.');
  } catch (error) {
    throw new Error(`Cannot read local source font ${fontPath}: ${error.message}`, { cause: error });
  }
  if (outputDirectory !== undefined) {
    if (typeof outputDirectory !== 'string' || !outputDirectory.trim()) throw new Error('outputDirectory must identify a private directory outside Git.');
    await outsideRepository(outputDirectory);
    await mkdir(outputDirectory, { recursive: true });
  }
  if (outputDirectory === undefined) await outsideRepository(tmpdir());
  const unicodeValues = [...codepoints].sort((a, b) => Number.parseInt(a, 16) - Number.parseInt(b, 16));
  await invokePython(python, ['-c', inspectFont, sourcePath, unicodeValues.join(',')], 'Source font inspection');
  const temporaryDirectory = await mkdtemp(join(outputDirectory ?? tmpdir(), 'mac-chat-symbols-'));
  let retain = false;
  try {
    const outputPath = join(temporaryDirectory, 'symbols.woff2');
    await invokePython(python, [
      '-m', 'fontTools.subset', sourcePath,
      `--unicodes=${unicodeValues.map((value) => `U+${value}`).join(',')}`,
      '--flavor=woff2',
      '--no-subset-tables+=trak',
      `--output-file=${outputPath}`,
    ], 'Font subset');
    const font = await readFile(outputPath);
    if (font.length < 4 || font.subarray(0, 4).toString('ascii') !== 'wOF2') throw new Error('Font subset did not produce a WOFF2 font.');
    const encoded = font.toString('base64');
    const result = {
      css: `@font-face{font-family:"${family}";src:url("data:font/woff2;base64,${encoded}") format("woff2");font-style:normal;font-weight:400;font-display:block;}\n:root{--font-sf-symbols:"${family}";}`,
      bytes: font.length,
      base64Bytes: Buffer.byteLength(encoded),
      sourcePath,
      ...(outputDirectory === undefined ? {} : { outputPath }),
    };
    retain = outputDirectory !== undefined;
    return result;
  } finally {
    if (!retain) await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
