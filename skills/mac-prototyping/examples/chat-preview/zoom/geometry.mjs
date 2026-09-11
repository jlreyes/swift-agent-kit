import assert from 'node:assert/strict';

export async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export function near(actual, expected, label, tolerance = 1.1) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual}; expected ${expected} ± ${tolerance}`);
}

export function sameFrame(actual, expected) {
  for (const key of ['x', 'y', 'width', 'height']) near(actual[key], expected[key], `Window ${key}`);
}

export async function logicalRect(locator) {
  return locator.evaluate(element => {
    const canvas = element.closest('.desktop-canvas');
    if (!canvas) throw new Error('Element has no logical desktop owner.');
    const outer = canvas.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const scaleX = outer.width / canvas.offsetWidth;
    const scaleY = outer.height / canvas.offsetHeight;
    return { x: (rect.x - outer.x) / scaleX, y: (rect.y - outer.y) / scaleY, width: rect.width / scaleX, height: rect.height / scaleY };
  });
}

export async function displayEvidence(page, window) {
  const display = await page.locator('.desktop-canvas').first().evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    return {
      width: canvas.offsetWidth, height: canvas.offsetHeight,
      paintedWidth: rect.width, paintedHeight: rect.height,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      dpr: devicePixelRatio, visualScale: visualViewport.scale,
      documentZoom: getComputedStyle(document.documentElement).zoom,
      bodyZoom: getComputedStyle(document.body).zoom,
    };
  });
  return { display, window: await logicalRect(window) };
}

export async function dragLogical(page, target, dx, dy) {
  const box = await target.boundingBox();
  assert.ok(box, 'Pointer target must be visible.');
  const scale = await target.evaluate(element => {
    const canvas = element.closest('.desktop-canvas');
    const rect = canvas.getBoundingClientRect();
    return { x: rect.width / canvas.offsetWidth, y: rect.height / canvas.offsetHeight };
  });
  const recorder = await page.evaluateHandle(() => {
    const events = [];
    const listen = event => events.push({ type: event.type, x: event.clientX, y: event.clientY });
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) window.addEventListener(type, listen, true);
    return { events, stop() { for (const type of ['pointerdown', 'pointermove', 'pointerup']) window.removeEventListener(type, listen, true); } };
  });
  try {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    try { await page.mouse.move(x + dx * scale.x, y + dy * scale.y, { steps: 8 }); }
    finally { await page.mouse.up(); }
    await settle(page);
    const events = await recorder.evaluate(record => record.events);
    const start = events.find(event => event.type === 'pointerdown');
    const last = events.filter(event => event.type === 'pointermove').at(-1);
    assert.ok(start && last, 'Browser must deliver the pointer gesture.');
    // WebKit rounds some injected pointer coordinates. Compare geometry with
    // delivered input while separately bounding that rounding to one CSS pixel.
    const actual = { x: (last.x - start.x) / scale.x, y: (last.y - start.y) / scale.y };
    near(actual.x * scale.x, dx * scale.x, 'Delivered pointer x', 1.1);
    near(actual.y * scale.y, dy * scale.y, 'Delivered pointer y', 1.1);
    return { requested: { x: dx, y: dy }, actual, scale };
  } finally {
    await recorder.evaluate(record => record.stop());
    await recorder.dispose();
  }
}
