import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  input: { type: 'string' }, dependencies: { type: 'string' }, 'output-directory': { type: 'string' },
  width: { type: 'string', default: '1024' }, 'menu-hidden': { type: 'boolean', default: false }, 'window-static': { type: 'boolean', default: false },
} });
if (!values.input || !values.dependencies || !values['output-directory']) throw new Error('Usage: node verify.mjs --input /path/preview.html --dependencies /path/to/test-project --output-directory /private/output [--width 1024] [--menu-hidden] [--window-static]');
const width = Number(values.width);
if (!Number.isInteger(width) || width < 320 || width > 2000) throw new Error('Width must be 320–2000');
const inputPath = resolve(values.input);
const source = await readFile(inputPath, 'utf8');
const requestedOutput = resolve(values['output-directory']);
let existingParent = requestedOutput;
while (!existsSync(existingParent)) existingParent = dirname(existingParent);
const outputRoot = resolve(realpathSync(existingParent), relative(existingParent, requestedOutput));
for (let ancestor = outputRoot; ; ancestor = dirname(ancestor)) {
  if (existsSync(resolve(ancestor, '.git'))) {
    throw new Error('--output-directory must be outside every Git repository so private screenshots and generated artifacts cannot be committed.');
  }
  if (dirname(ancestor) === ancestor) break;
}
const dependencyRequire = createRequire(resolve(values.dependencies, '__showcase_verify__.cjs'));
let playwrightPath;
for (const packageName of ['playwright', '@playwright/test']) {
  try { playwrightPath = dependencyRequire.resolve(packageName); break; }
  catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
}
if (!playwrightPath) throw new Error('--dependencies must point to a project with Playwright and its Chromium/WebKit browsers already installed.');
const { chromium, webkit } = dependencyRequire(playwrightPath);
await mkdir(outputRoot, { recursive: true });
const storyNames = ['App Anatomy', 'Window & Toolbar', 'Navigation & Split View', 'Lists & Collections', 'Controls & Forms', 'Menus & Popovers', 'Presentation & Feedback', 'Finder', 'Chooser', 'Setup Assistant', 'Chat'];
const observations = await Promise.all(Object.entries({ chromium, webkit }).map(async ([engineName, engine]) => {
  const browser = await engine.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10_000);
  const result = { engineName, browserVersion: browser.version(), width, checks: [], errors: [], requests: [], console: [], screenshots: [] };
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) result.console.push({ type: message.type(), text: message.text() }); });
  await page.route('**/*', route => { result.requests.push(route.request().url()); return route.abort(); });
  async function screenshot(name) {
    const path = resolve(outputRoot, `${engineName}-${name}.png`);
    const bytes = await page.screenshot({ path, fullPage: true });
    result.screenshots.push({ name, path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  let recover;
  async function check(name, run) {
    try { const detail = await run(); result.checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) }); console.log(`${engineName}: PASS ${name}`); }
    catch (error) {
      result.checks.push({ name, passed: false, error: error.message });
      console.log(`${engineName}: FAIL ${name}: ${error.message}`);
      await screenshot(`failure-${result.checks.length}`);
      if (!recover || name === 'opaque iframe and initial window') throw error;
      await recover();
    }
  }
  try {
    await page.setContent('<style>html,body{margin:0}</style><iframe sandbox="allow-scripts" style="display:block;border:0;width:100%;height:880px"></iframe>');
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';img-src data:;font-src data:;connect-src 'none'">`;
    async function loadPreview() {
      await page.locator('iframe').evaluate((iframe, html) => new Promise(resolve => { iframe.addEventListener('load', resolve, { once: true }); iframe.srcdoc = html; }), `<!doctype html><meta charset="utf-8">${csp}<style>html,body{margin:0}</style>${source}`);
    }
    await loadPreview();
    const frame = page.frames()[1];
    const catalog = frame.getByRole('region', { name: 'Mac Chrome component showcase', exact: true });
    const dock = frame.getByRole('navigation', { name: 'Showcase Dock', exact: true });
    const catalogDock = dock.getByRole('button', { name: 'Mac Chrome', exact: true });
    recover = async () => {
      if (await frame.getByRole('dialog').count() || await frame.getByRole('alertdialog').count()) await page.keyboard.press('Escape');
      if (values['window-static']) {
        const back = frame.getByRole('button', { name: 'Back to Catalog', exact: true });
        if (await back.isVisible()) await back.click();
      } else await catalogDock.click();
      await catalog.waitFor();
    };
    const catalogSource = catalog.locator('[aria-label="Component catalog"].mc-sidebar-tree');
    async function selectStory(name) {
      await catalogSource.getByText(name, { exact: true }).click();
      await catalog.getByRole('main', { name: `${name} story`, exact: true }).waitFor();
    }
    await check('opaque iframe and initial window', async () => {
      await catalog.waitFor();
      const origin = await frame.evaluate(() => location.origin);
      assert.equal(origin, 'null');
      assert.equal(await catalog.getAttribute('data-embedded-window'), 'true');
      await screenshot('initial');
      return { origin };
    });
    await check('menu bar follows preview option', async () => {
      assert.equal(await frame.locator('.mac-menu-bar').isVisible(), !values['menu-hidden']);
      if (values['window-static']) assert.equal(await dock.count(), 0);
      else await dock.waitFor();
    });
    for (const [index, name] of storyNames.entries()) {
      await check(`story ${name}`, async () => { await selectStory(name); await screenshot(`story-${index + 1}`); });
    }
    await check('controlled preferences', async () => {
      await selectStory('Controls & Forms');
      const form = catalog.getByRole('form', { name: 'Example preferences' });
      await form.getByRole('textbox', { name: 'Workspace name' }).fill('Embedded Showcase');
      await form.getByRole('radio', { name: 'Compact', exact: true }).click();
      await form.getByText('Install automatically', { exact: true }).click();
      await form.getByText('Share diagnostics', { exact: true }).click();
      assert.equal(await form.getByRole('checkbox', { name: 'Install automatically' }).isChecked(), false);
      assert.equal(await form.getByRole('switch', { name: 'Share diagnostics' }).isChecked(), true);
      await form.getByRole('button', { name: 'Save', exact: true }).click();
      assert.equal(await form.getByRole('textbox', { name: 'Workspace name' }).inputValue(), 'Embedded Showcase');
      await form.getByText('Preferences saved', { exact: true }).waitFor();
      await form.getByRole('button', { name: 'Restore Defaults' }).click();
      assert.equal(await form.getByRole('textbox', { name: 'Workspace name' }).inputValue(), 'Mac Chrome');
      assert.equal(await form.getByRole('checkbox', { name: 'Install automatically' }).isChecked(), true);
      assert.equal(await form.getByRole('switch', { name: 'Share diagnostics' }).isChecked(), false);
    });
    await check('command menu and interactive popover', async () => {
      await selectStory('Menus & Popovers');
      await catalog.getByRole('button', { name: 'Actions', exact: true }).click();
      await frame.getByRole('menu', { name: 'Example actions' }).getByRole('menuitem', { name: /New Folder/ }).click();
      await catalog.getByText('New Folder selected', { exact: true }).waitFor();
      const trigger = catalog.getByRole('button', { name: 'Component information' });
      await trigger.press('Enter');
      const popover = frame.getByRole('dialog', { name: 'Component information' });
      await popover.waitFor();
      assert.equal(await popover.evaluate(element => !!element.closest('.mc-embedded-presentation')), true);
      const option = popover.getByRole('checkbox', { name: 'Example option' });
      await popover.getByText('Example option', { exact: true }).click();
      assert.equal(await option.isChecked(), false);
      await screenshot('popover');
      await page.keyboard.press('Escape');
      await popover.waitFor({ state: 'hidden' });
      await frame.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Component information');
    });
    await check('attached sheet create, cancel and focus', async () => {
      await selectStory('Presentation & Feedback');
      const trigger = catalog.getByRole('button', { name: 'Create Project…' });
      await trigger.press('Enter');
      let sheet = frame.getByRole('dialog', { name: 'Create Project', exact: true });
      await sheet.waitFor();
      assert.equal(await sheet.evaluate(element => element.closest('[data-modal-kind]')?.getAttribute('data-modal-scope')), 'window');
      await sheet.getByRole('textbox', { name: 'Project name' }).fill('Embedded Project');
      await screenshot('sheet');
      await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
      await sheet.waitFor({ state: 'hidden' });
      await frame.waitForFunction(() => document.activeElement?.textContent === 'Create Project…');
      await trigger.press('Enter');
      sheet = frame.getByRole('dialog', { name: 'Create Project', exact: true });
      assert.equal(await sheet.getByRole('textbox', { name: 'Project name' }).inputValue(), 'Embedded Project');
      await sheet.getByRole('button', { name: 'Create', exact: true }).click();
      await sheet.waitFor({ state: 'hidden' });
      await catalog.getByText('Created Embedded Project.', { exact: true }).waitFor();
      await frame.waitForFunction(() => document.activeElement?.textContent === 'Create Project…');
    });
    await check('attached alert', async () => {
      await catalog.getByRole('button', { name: 'Delete Draft…' }).press('Enter');
      const alert = frame.getByRole('alertdialog', { name: 'Delete the draft project?' });
      await alert.waitFor();
      assert.equal(await alert.evaluate(element => element.closest('[data-modal-kind]')?.getAttribute('data-modal-scope')), 'window');
      await screenshot('alert');
      await alert.getByRole('button', { name: 'Delete', exact: true }).click();
      await alert.waitFor({ state: 'hidden' });
      await catalog.getByText('Deleted the draft project.', { exact: true }).waitFor();
    });
    for (const [story, windowName] of [['Finder', 'Finder showcase'], ['Chooser', 'Chooser showcase'], ['Setup Assistant', 'Setup Assistant showcase'], ['Chat', 'Chat showcase']]) {
      await check(`recipe ${story}`, async () => {
        await selectStory(story);
        const launch = catalog.getByRole('button', { name: 'Open Example Window' });
        await launch.press('Enter');
        const recipe = frame.getByRole('region', { name: windowName, exact: true });
        await recipe.waitFor();
        assert.equal(await recipe.getAttribute('data-key-window'), 'true');
        if (story === 'Chat') {
          await recipe.getByRole('textbox', { name: 'Message', exact: true }).fill('Offline showcase message');
          await recipe.getByRole('button', { name: 'Send message', exact: true }).click();
          await recipe.getByRole('log', { name: 'Conversation' }).getByText('Offline showcase message', { exact: false }).waitFor();
          if (values['window-static']) await recipe.getByRole('textbox', { name: 'Message', exact: true }).fill('Retained recipe draft');
        }
        await screenshot(`recipe-${story.toLowerCase().replaceAll(' ', '-')}`);
        if (values['window-static']) {
          if (story === 'Setup Assistant') {
            await recipe.getByRole('button', { name: 'Continue', exact: true }).click();
            await recipe.getByRole('button', { name: 'Back', exact: true }).click();
          }
          const windowId = await recipe.getAttribute('data-window-id');
          await recipe.getByRole('button', { name: 'Back to Catalog', exact: true }).press('Enter');
          await recipe.waitFor({ state: 'hidden' });
          await catalog.getByRole('main', { name: `${story} story`, exact: true }).waitFor();
          assert.equal(await catalog.getAttribute('data-key-window'), 'true');
          await frame.waitForFunction(() => document.activeElement?.textContent === 'Open Example Window');
          await launch.press('Enter');
          await recipe.waitFor();
          assert.equal(await recipe.getAttribute('data-window-id'), windowId);
          if (story === 'Chat') {
            assert.equal(await recipe.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Retained recipe draft');
            await recipe.getByRole('log', { name: 'Conversation' }).getByText('Offline showcase message', { exact: false }).waitFor();
          }
          await recipe.getByRole('button', { name: 'Back to Catalog', exact: true }).press('Enter');
          await recipe.waitFor({ state: 'hidden' });
          await frame.waitForFunction(() => document.activeElement?.textContent === 'Open Example Window');
        } else {
          await recipe.getByRole('button', { name: 'Close window', exact: true }).click();
          await recipe.waitFor({ state: 'hidden' });
          await catalogDock.click();
        }
        await catalog.waitFor();
      });
    }
    if (values['window-static']) {
      await check('static window fills preview with inert traffic lights', async () => {
        await selectStory('Controls & Forms');
        const field = catalog.getByRole('textbox', { name: 'Workspace name' });
        await field.fill('Static window state');
        const windowId = await catalog.getAttribute('data-window-id');
        const controls = catalog.locator('.traffic-lights');
        assert.equal(await controls.locator('button').count(), 0);
        for (const control of ['close', 'minimize', 'zoom']) {
          await controls.locator(`.traffic-${control}`).click();
          assert.equal(await catalog.isVisible(), true);
          assert.equal(await catalog.getAttribute('data-window-id'), windowId);
          assert.equal(await field.inputValue(), 'Static window state');
          assert.equal(await catalog.evaluate(element => element.classList.contains('mc-zoomed')), false);
        }
        assert.equal(await dock.count(), 0);
        const rootBounds = await frame.locator('.mc-embedded-presentation').boundingBox();
        const windowBounds = await catalog.boundingBox();
        const menuBounds = values['menu-hidden'] ? null : await frame.locator('.mac-menu-bar').boundingBox();
        const menuHeight = menuBounds?.height ?? 0;
        assert.ok(rootBounds && windowBounds);
        assert.ok(Math.abs(windowBounds.x - rootBounds.x) <= 1);
        assert.ok(Math.abs(windowBounds.y - rootBounds.y - menuHeight) <= 1);
        assert.ok(Math.abs(windowBounds.width - rootBounds.width) <= 1);
        assert.ok(Math.abs(windowBounds.height - rootBounds.height + menuHeight) <= 1);
        return { rootBounds, windowBounds, menuHeight };
      });
    } else await check('traffic lights zoom, minimize, restore, close', async () => {
      await selectStory('Controls & Forms');
      const field = catalog.getByRole('textbox', { name: 'Workspace name' });
      await field.fill('Retained state');
      const before = await catalog.boundingBox();
      await catalog.getByRole('button', { name: 'Zoom window', exact: true }).click();
      await frame.waitForFunction(() => document.querySelector('[aria-label="Mac Chrome component showcase"]')?.classList.contains('mc-zoomed'));
      const zoomed = await catalog.boundingBox();
      assert.ok(zoomed.width >= before.width && zoomed.height >= before.height);
      await catalog.getByRole('button', { name: 'Zoom window', exact: true }).click();
      await frame.waitForFunction(() => !document.querySelector('[aria-label="Mac Chrome component showcase"]')?.classList.contains('mc-zoomed'));
      await catalog.getByRole('button', { name: 'Minimize window', exact: true }).click();
      await catalog.waitFor({ state: 'hidden' });
      const thumbnail = dock.getByRole('button', { name: 'Mac Chrome component showcase', exact: true });
      await thumbnail.waitFor();
      assert.equal(await catalogDock.evaluate(element => element.classList.contains('is-running')), true);
      const preview = thumbnail.locator('img');
      await preview.waitFor();
      await preview.evaluate(async image => { await image.decode(); });
      const previewImage = await preview.evaluate(image => /^data:image\/(png|jpeg|webp);base64,/.test(image.src) && image.naturalWidth > 0 && image.naturalHeight > 0);
      assert.equal(previewImage, true, 'Minimization must capture a decodable raster thumbnail');
      await screenshot('minimized');
      await thumbnail.click();
      await catalog.waitFor();
      assert.equal(await field.inputValue(), 'Retained state');
      await catalog.getByRole('button', { name: 'Close window', exact: true }).click();
      await catalog.waitFor({ state: 'hidden' });
      await catalogDock.click();
      await catalog.waitFor();
      assert.equal(await field.inputValue(), 'Retained state');
      return { previewImage };
    });
    if (!values['menu-hidden']) {
      if (!values['window-static']) await check('Window menu minimize and thumbnail restore', async () => {
        await selectStory('Controls & Forms');
        const field = catalog.getByRole('textbox', { name: 'Workspace name' });
        await field.fill('Window menu retained state');
        await frame.getByRole('button', { name: 'Window', exact: true }).click();
        await frame.getByRole('menuitem', { name: 'Minimize', exact: true }).click();
        await catalog.waitFor({ state: 'hidden' });
        const thumbnail = dock.getByRole('button', { name: 'Mac Chrome component showcase', exact: true });
        await thumbnail.waitFor();
        assert.equal(await catalogDock.evaluate(element => element.classList.contains('is-running')), true);
        const preview = thumbnail.locator('img');
        await preview.waitFor();
        await preview.evaluate(async image => { await image.decode(); });
        assert.equal(await preview.evaluate(image => /^data:image\/(png|jpeg|webp);base64,/.test(image.src) && image.naturalWidth > 0 && image.naturalHeight > 0), true, 'Window menu minimization must capture a decodable raster thumbnail');
        await screenshot('menu-minimized');
        await thumbnail.click();
        await catalog.waitFor();
        assert.equal(await field.inputValue(), 'Window menu retained state');
      });
      await check('menu-bar app and desktop alert', async () => {
        await frame.getByRole('button', { name: 'Showcase activity', exact: true }).press('Enter');
        await frame.getByRole('button', { name: 'Clear Activity…', exact: true }).click();
        const alert = frame.getByRole('alertdialog', { name: 'Clear the activity notes?' });
        await alert.waitFor();
        assert.equal(await alert.evaluate(element => element.closest('[data-modal-kind]')?.getAttribute('data-modal-scope')), 'desktop');
        await screenshot('desktop-alert');
        await alert.getByRole('button', { name: 'Clear', exact: true }).click();
        await alert.waitFor({ state: 'hidden' });
        await catalog.getByText('Showcase activity cleared by the menu-bar app.', { exact: true }).waitFor();
      });
    }
    await check('final window fits frame', async () => {
      const geometry = await frame.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth }));
      assert.ok(geometry.scrollWidth <= geometry.viewportWidth);
      return geometry;
    });
    await screenshot('final');
    if (!values['menu-hidden']) {
      await check('Mark as Read closes and restores keyboard access', async () => {
        await loadPreview();
        const freshFrame = page.frames()[1];
        const freshCatalog = freshFrame.getByRole('region', { name: 'Mac Chrome component showcase', exact: true });
        await freshCatalog.waitFor();
        const trigger = freshFrame.getByRole('button', { name: 'Showcase activity', exact: true });
        const popover = freshFrame.getByRole('dialog', { name: 'Showcase activity', exact: true });
        await trigger.press('Enter');
        await popover.getByText('2 component notes are ready.', { exact: true }).waitFor();
        await popover.getByRole('button', { name: 'Mark as Read', exact: true }).press('Enter');
        await popover.waitFor({ state: 'hidden' });
        await freshFrame.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Showcase activity');
        await freshCatalog.getByText('Showcase activity marked as read.', { exact: true }).waitFor();
        await trigger.press('Enter');
        await popover.getByText('You’re all caught up.', { exact: true }).waitFor();
        assert.equal(await popover.getByRole('button', { name: 'Mark as Read', exact: true }).isDisabled(), true);
        assert.equal(await popover.getByRole('button', { name: 'Clear Activity…', exact: true }).isDisabled(), true);
        await screenshot('activity-read');
        await page.keyboard.press('Escape');
        await popover.waitFor({ state: 'hidden' });
        await freshFrame.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Showcase activity');
        assert.equal(await freshCatalog.evaluate(element => !!element.closest('[inert], [aria-hidden="true"]')), false);
        await freshCatalog.locator('[aria-label="Component catalog"].mc-sidebar-tree').getByText('Controls & Forms', { exact: true }).click();
        const field = freshCatalog.getByRole('textbox', { name: 'Workspace name' });
        await field.fill('Keyboard access restored');
        assert.equal(await field.inputValue(), 'Keyboard access restored');
        assert.equal(await field.evaluate(element => element === document.activeElement), true);
      });
    }
  } catch (error) {
    result.failure = error.message;
    await screenshot('failure');
  } finally {
    result.passed = !result.failure && result.checks.every(check => check.passed) && result.errors.length === 0 && result.requests.length === 0 && !result.console.some(message => message.type === 'error');
    await browser.close();
  }
  return result;
}));
const result = { inputPath, inputBytes: Buffer.byteLength(source), inputSha256: createHash('sha256').update(source).digest('hex'), menuBarExpected: !values['menu-hidden'], windowManagementExpected: !values['window-static'], observations };
await writeFile(resolve(outputRoot, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ inputPath, inputBytes: result.inputBytes, resultsPath: resolve(outputRoot, 'results.json'), observations: observations.map(({ engineName, passed, checks, errors, requests, console: consoleMessages, failure }) => ({ engineName, passed, completedChecks: checks.length, errors, requests, console: consoleMessages, failedChecks: checks.filter(check => !check.passed).map(check => check.name), failure })) }, null, 2));
if (observations.some(result => !result.passed)) process.exitCode = 1;
