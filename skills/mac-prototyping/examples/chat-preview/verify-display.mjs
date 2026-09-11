import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchZoomBrowser } from './zoom/browser.mjs';
import { displayEvidence, dragLogical, logicalRect, near, sameFrame, settle } from './zoom/geometry.mjs';

const { values } = parseArgs({ options: {
  input: { type: 'string' }, dependencies: { type: 'string' },
  'output-directory': { type: 'string' }, width: { type: 'string', default: '1440' },
} });
if (!values.input || !values.dependencies || !values['output-directory']) {
  throw new Error('Usage: node verify-display.mjs --input /path/showcase.html --dependencies /path/test-project --output-directory /private/evidence [--width 1440]');
}
const width = Number(values.width);
if (!Number.isInteger(width) || width < 640 || width > 2400) throw new Error('--width must be an integer from 640 to 2400.');
const source = await readFile(resolve(values.input), 'utf8');
const output = resolve(values['output-directory']);
let existingParent = output;
while (!existsSync(existingParent)) existingParent = dirname(existingParent);
const outputRoot = resolve(realpathSync(existingParent), relative(existingParent, output));
for (let ancestor = outputRoot; ; ancestor = dirname(ancestor)) {
  const bareRepository = ['HEAD', 'objects', 'refs'].every(name => existsSync(resolve(ancestor, name)));
  if (existsSync(resolve(ancestor, '.git')) || bareRepository) throw new Error('--output-directory must be outside Git repositories.');
  if (dirname(ancestor) === ancestor) break;
}
const dependencyRequire = createRequire(resolve(values.dependencies, '__display_verify__.cjs'));
let playwright;
for (const packageName of ['playwright', '@playwright/test']) {
  try { playwright = dependencyRequire(packageName); break; }
  catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
}
if (!playwright) throw new Error('--dependencies must contain installed Playwright and Chromium/WebKit browsers.');
await mkdir(outputRoot, { recursive: true });

const zoomFactors = [0.8, 1, 1.25, 2];
const hosts = [{ width, height: 900 }, { width: Math.min(1000, Math.floor(width * 0.75)), height: 700 }];
const documentUrl = 'http://mac-display.test/';
const inputSha256 = createHash('sha256').update(source).digest('hex');

async function verifyEngine(engine) {
  const result = { engine, inputSha256, configurations: [], errors: [] };
  for (const baseDpr of [1, 2]) {
    const configuration = { baseDpr, checks: [], screenshots: [], pageErrors: [] };
    result.configurations.push(configuration);
    try {
      await using browser = await launchZoomBrowser(playwright, engine, { baseDpr, ...hosts[0] });
      configuration.browserVersion = browser.version;
      const page = browser.page;
      page.setDefaultTimeout(8_000);
      page.on('pageerror', error => configuration.pageErrors.push(error.message));
      await page.route(documentUrl, route => route.fulfill({ contentType: 'text/html', body: source }));
      await page.goto(documentUrl);
      const window = page.locator('.mac-window[data-window-id]:visible').first();
      await window.waitFor();
      await settle(page);
      const initial = await logicalRect(window);
      configuration.initial = initial;
      const isCatalog = await window.getAttribute('aria-label') === 'Mac Chrome component showcase';

      async function screenshot(name) {
        const filename = `${engine}-dpr${baseDpr}-${name}.png`;
        const bytes = await page.screenshot({ path: resolve(outputRoot, filename), fullPage: true });
        configuration.screenshots.push({ filename, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
      async function check(name, run) {
        try {
          const detail = await run();
          configuration.checks.push({ name, passed: true, detail });
          console.log(`${engine} DPR ${baseDpr}: PASS ${name}`);
        } catch (error) {
          configuration.checks.push({ name, passed: false, error: error.message });
          console.log(`${engine} DPR ${baseDpr}: FAIL ${name}: ${error.message}`);
          await screenshot(`failure-${configuration.checks.length}`);
        }
      }
      async function zoomTo(zoom) {
        await browser.setZoom(zoom);
        await page.waitForFunction(expected => Math.abs(devicePixelRatio - expected) < 0.01, baseDpr * zoom);
        await settle(page);
      }

      await check('authored initial window', async () => {
        assert.equal(await window.getAttribute('data-window-resizable'), 'true', 'Input must be a managed desktop showcase.');
        if (isCatalog) sameFrame(initial, { x: 170, y: 38, width: 1100, height: 632 });
        else assert.ok(initial.width > 0 && initial.height > 0, 'Initial window must have positive dimensions.');
        return initial;
      });
      await screenshot('initial');
      for (const host of hosts) {
        await browser.resizeHost(host.width, host.height);
        for (const zoom of zoomFactors) {
          await check(`logical geometry, host ${host.width}×${host.height}, zoom ${zoom}`, async () => {
            await zoomTo(zoom);
            const evidence = await displayEvidence(page, window);
            assert.equal(evidence.display.width, 1440, 'Logical desktop width');
            assert.equal(evidence.display.height, 900, 'Logical desktop height');
            near(evidence.display.dpr, baseDpr * zoom, 'Actual page-zoom DPR', 0.01);
            near(evidence.display.visualScale, 1, 'Visual viewport must not use pinch zoom', 0.01);
            near(evidence.display.viewportWidth, host.width / zoom, 'Actual CSS viewport width', 1.1);
            sameFrame(evidence.window, initial);
            assert.ok(evidence.display.paintedWidth <= evidence.display.viewportWidth + 1, 'Desktop must fit available width.');
            return evidence;
          });
        }
      }

      for (const zoom of [0.8, 2]) {
        await page.goto(documentUrl);
        await window.waitFor();
        await zoomTo(zoom);
        await check(`logical drag and owned frame retention, zoom ${zoom}`, async () => {
          const before = await logicalRect(window);
          const handle = window.locator('[data-window-drag-handle]').first();
          assert.ok(await handle.count(), 'Managed window must provide a drag handle.');
          const input = await dragLogical(page, handle, 40, 20);
          const after = await logicalRect(window);
          near(after.x - before.x, input.actual.x, 'Logical drag x');
          near(after.y - before.y, input.actual.y, 'Logical drag y');
          near(after.width, before.width, 'Dragged width');
          near(after.height, before.height, 'Dragged height');
          await browser.resizeHost(hosts[0].width, hosts[0].height);
          await zoomTo(zoom === 2 ? 0.8 : 2);
          sameFrame(await logicalRect(window), after);
          await browser.resizeHost(hosts[1].width, hosts[1].height);
          await settle(page);
          sameFrame(await logicalRect(window), after);
          return { input, before, after };
        });
      }

      await page.goto(documentUrl);
      await window.waitFor();
      await zoomTo(1.25);
      if (isCatalog) {
        await check('representative split divider', async () => {
          const divider = window.locator('.mc-navigation-separator:not(.mc-inspector-separator)').first();
          await divider.waitFor();
          const before = await logicalRect(divider);
          const input = await dragLogical(page, divider, 20, 0);
          const after = await logicalRect(divider);
          near(after.x - before.x, input.actual.x, 'Logical split movement', 2);
          return { input, before, after };
        });
        await check('representative menu collision', async () => {
          const catalog = window.locator('[aria-label="Component catalog"].mc-sidebar-tree');
          await catalog.getByText('Menus & Popovers', { exact: true }).click();
          await window.getByRole('button', { name: 'Actions', exact: true }).click();
          const menu = page.getByRole('menu', { name: 'Example actions', exact: true });
          await menu.waitFor();
          const menuBox = await menu.boundingBox();
          const canvasBox = await page.locator('.desktop-canvas').first().boundingBox();
          assert.ok(menuBox && canvasBox, 'Menu and desktop must be visible.');
          assert.ok(menuBox.x >= canvasBox.x - 1 && menuBox.y >= canvasBox.y - 1, 'Menu starts within the desktop.');
          assert.ok(menuBox.x + menuBox.width <= canvasBox.x + canvasBox.width + 1, 'Menu fits the desktop width.');
          assert.ok(menuBox.y + menuBox.height <= canvasBox.y + canvasBox.height + 1, 'Menu fits the desktop height.');
          await screenshot('menu');
          await page.keyboard.press('Escape');
          return { menu: menuBox, desktop: canvasBox };
        });
      } else {
        configuration.checks.push({ name: 'canonical split and menu examples', skipped: true, reason: 'Input does not contain the canonical component catalog.' });
      }
      await screenshot('final');
      assert.deepEqual(configuration.pageErrors, [], 'Artifact emitted browser page errors.');
    } catch (error) {
      result.errors.push({ baseDpr, message: error.message });
    }
  }
  return result;
}

const results = await Promise.all(['chromium', 'webkit'].map(verifyEngine));
const report = {
  input: resolve(values.input), inputSha256, zoomFactors, hosts,
  limitations: ['Base DPR is emulated; physical macOS display settings are not changed.', 'WebKit page zoom uses a version-sensitive private Playwright protocol session.'],
  results,
};
await writeFile(resolve(outputRoot, 'display-results.json'), `${JSON.stringify(report, null, 2)}\n`);
const failed = results.some(result => result.errors.length || result.configurations.some(configuration => configuration.checks.some(check => check.passed === false)));
console.log(`Display verification ${failed ? 'FAILED' : 'PASSED'}: ${resolve(outputRoot, 'display-results.json')}`);
process.exitCode = failed ? 1 : 0;
