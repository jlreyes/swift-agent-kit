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
  assert.match(html, /\/mac-assets\/dock\/finder\.png/);
  assert.match(html, /aria-label="Apple"/);
  assert.match(html, /class="sf-symbol"/);
});

test("the showcase server-renders its catalog shell", async () => {
  const html = await render("/showcase").then((response) => response.text());

  assert.match(html, /data-showcase-story="anatomy"/);
  assert.match(html, /Mac Chrome component showcase/);
  assert.match(html, /aria-label="Showcase Dock"/);
  assert.match(html, /href="\/mac-chrome-showcase\.svg"/);
  assert.match(html, /Window &amp; Toolbar/);
});
