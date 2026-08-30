import assert from "node:assert/strict";
import test from "node:test";

// Imports the built worker (dist/server/index.js — run `npm run build` first,
// which `npm test` does) and asserts on the server-rendered HTML, without
// booting a dev server. Mirrors the toolkit's rendered-html test pattern.
async function render(pathname, headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

const routes = [
  ["/", "Mac Prototype", "Mac prototype surfaces"],
  ["/example", "Example · Mac Prototype", "Documents"],
  ["/showcase", "Showcase · Mac Prototype", "Library"],
];

for (const [pathname, title, content] of routes) {
  test(`server-renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/title>`, "i"));
    assert.match(html, new RegExp(content, "i"));
  });
}

test("the example surface renders the mac shell", async () => {
  const html = await render("/example").then((response) => response.text());

  assert.match(html, /aria-label="Mac Dock"/);
  assert.match(html, /class="mac-menu-bar"/);
  assert.match(html, /aria-label="Finder"/);
  assert.match(html, /class="p0-app-icon p0-app-icon--(?:asset|tile)"/);
  assert.match(html, /data-system-symbol="face\.smiling"/);
  assert.doesNotMatch(html, /\/mac-assets\/dock\/finder\.png/);
  const usesBundledDefaultSymbols = /data-system-symbol="app\.gift\.fill"/.test(html);
  const usesScaffoldAssetFallbacks = /\/mac-assets\/dock\/app-store\.png/.test(html);
  assert.equal(usesBundledDefaultSymbols || usesScaffoldAssetFallbacks, true);
  if (usesBundledDefaultSymbols) {
    assert.doesNotMatch(html, /\/mac-assets\/dock\/(?:app-store|chrome|downloads|trash)\.png/);
  }
  assert.match(html, /aria-label="Apple"/);
  assert.match(html, /class="mc-system-symbol" data-system-symbol="doc\.text"/);
  assert.match(html, /data-system-symbol="apple\.logo"/);
  assert.match(html, /data-status-icon="battery" aria-label="Battery" role="img"/);
});

test("the showcase server-renders its catalog shell", async () => {
  const html = await render("/showcase").then((response) => response.text());

  assert.match(html, /data-showcase-story="anatomy"/);
  assert.match(html, /Mac Chrome component showcase/);
  assert.match(html, /aria-label="Showcase Dock"/);
  assert.match(html, /aria-label="Showcase activity"/);
  assert.match(html, /data-window-resizable="true"/);
  assert.match(html, /data-window-resize-handle="se"/);
  assert.match(html, /href="\/mac-chrome-showcase\.svg"/);
  assert.match(html, /Window &amp; Toolbar/);
});

test("only the showcase opts into fixed-desktop phone review metadata", async () => {
  const defaultHtml = await render("/example").then((response) => response.text());
  const showcaseHtml = await render("/showcase").then((response) => response.text());

  assert.match(defaultHtml, /<meta name="viewport" content="width=device-width, initial-scale=1"\s*\/>/);
  assert.doesNotMatch(defaultHtml, /width=1200/);
  assert.match(
    showcaseHtml,
    /<meta name="viewport" content="width=1200, initial-scale=1, minimum-scale=0\.25, maximum-scale=4, user-scalable=yes"\s*\/>/,
  );
  assert.match(showcaseHtml, /data-mobile-review-mode="fixed-desktop"/);
});
