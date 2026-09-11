import assert from 'node:assert/strict';
import { installHostPreview, readHostProfile, verifyRuntimePolicy } from './host-profile.mjs';
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  input: { type: 'string' }, 'visualize-skill': { type: 'string' }, dependencies: { type: 'string' }, 'output-directory': { type: 'string' },
  width: { type: 'string', default: '1024' },
} });
if (!values.input || !values.dependencies || !values['output-directory'] || !values['visualize-skill']) throw new Error('Usage: node verify-second-consumer.mjs --input /path/preview.html --dependencies /path/to/test-project --output-directory /private/output --visualize-skill /path/to/visualize-skill [--width 1024]');
const width = Number(values.width);
if (!Number.isInteger(width) || width < 320 || width > 2000) throw new Error('Width must be 320–2000');
const inputPath = resolve(values.input);
const source = await readFile(inputPath, 'utf8');
const hostProfile = await readHostProfile(values['visualize-skill']);
const requestedOutput = resolve(values['output-directory']);
let existingParent = requestedOutput;
while (!existsSync(existingParent)) existingParent = dirname(existingParent);
const outputRoot = resolve(realpathSync(existingParent), relative(existingParent, requestedOutput));
for (let ancestor = outputRoot; ; ancestor = dirname(ancestor)) {
  const isBareRepository = ['HEAD', 'objects', 'refs'].every(name => existsSync(resolve(ancestor, name)));
  if (existsSync(resolve(ancestor, '.git')) || isBareRepository) {
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
const observations = await Promise.all(Object.entries({ chromium, webkit }).map(async ([engineName, engine]) => {
  const result = { engineName, browserVersion: null, checks: [], errors: [], console: [], requests: [], hostRequests: [], probeRequests: [], screenshots: [] };
  let browser;
  let page;
  let phase = 'interaction';
  async function screenshot(name) {
    if (!page) return;
    const path = resolve(outputRoot, `${engineName}-${name}.png`);
    const bytes = await page.screenshot({ path, fullPage: true });
    result.screenshots.push({ name, path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  async function check(name, run) {
    const detail = await run();
    result.checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) });
    console.log(`${engineName}: PASS ${name}`);
  }
  try {
    browser = await engine.launch({ headless: true });
    result.browserVersion = browser.version();
    page = await browser.newPage({ viewport: { width, height: 440 }, reducedMotion: 'no-preference' });
    page.setDefaultTimeout(10_000);
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) result.console.push({ phase, type: message.type(), text: message.text() }); });
    const host = await installHostPreview(page, hostProfile, { height: 420, authoredRequests: result.requests, hostRequests: result.hostRequests, probeRequests: result.probeRequests });
    const frame = await host.load(source);
    const window = frame.getByRole('region', { name: 'Document settings', exact: true });
    await check('independent consumer under visualization profile', async () => {
      await window.waitFor();
      await frame.evaluate(() => document.fonts.ready);
      assert.equal(await frame.evaluate(() => location.origin), host.documentOrigin);
      assert.equal(await window.locator('.traffic-lights button').count(), 0);
      await screenshot('initial');
    });
    await check('unmodified root properties and variable-selected keyframes', async () => {
      const css = await frame.locator('.second-consumer-indicator').evaluate(element => {
        const style = getComputedStyle(element);
        return { rootMotion: getComputedStyle(document.documentElement).getPropertyValue('--second-consumer-motion').trim(), color: style.backgroundColor, animationName: style.animationName, keyframes: element.getAnimations().flatMap(animation => animation.effect?.getKeyframes() ?? []) };
      });
      assert.equal(css.rootMotion, 'second-consumer-pulse');
      assert.equal(css.color, 'rgb(90, 50, 170)');
      assert.equal(css.animationName, 'second-consumer-pulse');
      assert.ok(css.keyframes.some(keyframe => Math.abs(Number(keyframe.opacity) - 0.4) < 0.001));
      assert.ok(css.keyframes.some(keyframe => Number(keyframe.opacity) === 1));
      return css;
    });
    await check('form pointer and keyboard submission', async () => {
      const field = window.getByRole('textbox', { name: 'Document title', exact: true });
      await field.fill('Portable notes');
      await window.getByRole('button', { name: 'Save', exact: true }).click();
      await window.getByRole('status').getByText('Saved Portable notes.', { exact: true }).waitFor();
      await field.fill('Keyboard notes');
      await field.press('Enter');
      await window.getByRole('status').getByText('Saved Keyboard notes.', { exact: true }).waitFor();
    });
    await check('interactive popover and focus return', async () => {
      const trigger = window.getByRole('button', { name: 'Reminder options', exact: true });
      await trigger.press('Enter');
      const popover = frame.getByRole('dialog', { name: 'Reminder options', exact: true });
      await popover.getByText('Enable reminders', { exact: true }).click();
      assert.equal(await popover.getByRole('checkbox', { name: 'Enable reminders' }).isChecked(), true);
      await screenshot('popover');
      await page.keyboard.press('Escape');
      await popover.waitFor({ state: 'hidden' });
      await frame.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Reminder options');
      await window.getByText('Reminders enabled.', { exact: true }).waitFor();
    });
    await check('reduced motion disables decorative animation', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await frame.waitForFunction(() => getComputedStyle(document.querySelector('.second-consumer-indicator')).animationName === 'none');
      assert.equal(await frame.locator('.second-consumer-indicator').evaluate(element => element.getAnimations().length), 0);
      await screenshot('final');
    });
    phase = 'policy-probe';
    await check('connection APIs blocked while approved resources stay allowed', async () => verifyRuntimePolicy(frame, host.positiveUrl));
    assert.equal(result.probeRequests.length, 1);
  } catch (error) {
    result.failure = error.message;
    try { await screenshot('failure'); } catch (screenshotError) { result.errors.push(screenshotError.message); }
  } finally {
    try { await browser?.close(); } catch (closeError) { result.errors.push(closeError.message); }
    const unexpectedConsole = result.console.filter(message => message.type === 'error' && !(message.phase === 'policy-probe' && message.text.includes('blocked-preview.invalid')));
    result.passed = !result.failure && result.errors.length === 0 && result.requests.length === 0 && unexpectedConsole.length === 0;
  }
  return result;
}));
const result = { inputPath, inputBytes: Buffer.byteLength(source), inputSha256: createHash('sha256').update(source).digest('hex'), width, hostProfile: hostProfile.evidence, observations };
await writeFile(resolve(outputRoot, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ inputPath, inputBytes: result.inputBytes, resultsPath: resolve(outputRoot, 'results.json'), observations: observations.map(({ engineName, passed, failure, checks, errors, requests, hostRequests, probeRequests, console }) => ({ engineName, passed, completedChecks: checks.length, failure, errors, requests, hostRequests, probeRequests, console })) }, null, 2));
if (observations.some(result => !result.passed)) process.exitCode = 1;
