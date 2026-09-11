import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function launchZoomBrowser(playwright, engine, { baseDpr, width, height }) {
  if (engine === 'chromium') {
    const directory = await mkdtemp(join(tmpdir(), 'mac-display-zoom-'));
    const extension = join(directory, 'extension');
    let context;
    try {
      await mkdir(extension);
      await cp(new URL('./extension/', import.meta.url), extension, { recursive: true });
      context = await playwright.chromium.launchPersistentContext(join(directory, 'profile'), {
        channel: 'chromium', headless: true, viewport: null, reducedMotion: 'reduce',
        args: [`--force-device-scale-factor=${baseDpr}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      });
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 10_000 });
      const page = context.pages()[0] ?? await context.newPage();
      const session = await context.newCDPSession(page);
      const { windowId } = await session.send('Browser.getWindowForTarget');
      const resizeHost = (nextWidth, nextHeight) => session.send('Browser.setContentsSize', { windowId, width: nextWidth, height: nextHeight });
      await resizeHost(width, height);
      return {
        page,
        version: context.browser().version(),
        resizeHost,
        async setZoom(zoom) {
          await worker.evaluate(async ({ url, zoom }) => {
            const tab = (await chrome.tabs.query({})).find(candidate => candidate.url === url);
            if (!tab?.id) throw new Error('The isolated page-zoom tab is unavailable.');
            await chrome.tabs.setZoom(tab.id, zoom);
            const actual = await chrome.tabs.getZoom(tab.id);
            if (Math.abs(actual - zoom) > 0.0001) throw new Error(`Browser zoom is ${actual}; requested ${zoom}.`);
          }, { url: page.url(), zoom });
        },
        async [Symbol.asyncDispose]() {
          try { await context.close(); }
          finally { await rm(directory, { recursive: true, force: true }); }
        },
      };
    } catch (error) {
      try { await context?.close(); }
      finally { await rm(directory, { recursive: true, force: true }); }
      throw error;
    }
  }

  const browser = await playwright.webkit.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: baseDpr, reducedMotion: 'reduce' });
    // Playwright exposes no public WebKit page-zoom API. Fail explicitly when
    // this installed version cannot reach its browser's page-zoom protocol.
    const pageImplementation = page._connection?.toImpl?.(page);
    const pageProxyId = pageImplementation?.delegate?._pageProxySession?.sessionId;
    const browserSession = browser._connection?.toImpl?.(browser)?._browserSession;
    if (!pageProxyId || !browserSession) throw new Error('Installed Playwright does not expose the WebKit page-zoom protocol session.');
    return {
      page,
      version: browser.version(),
      resizeHost: (nextWidth, nextHeight) => page.setViewportSize({ width: nextWidth, height: nextHeight }),
      async setZoom(zoomFactor) {
        try { await browserSession.send('Playwright.setPageZoomFactor', { pageProxyId, zoomFactor }); }
        catch (cause) { throw new Error('Installed WebKit does not support Playwright.setPageZoomFactor; CSS zoom and pinch are not substitutes.', { cause }); }
      },
      [Symbol.asyncDispose]: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
