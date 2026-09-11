import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readHostProfile(directory) {
  if (!directory) throw new Error('--visualize-skill must point to the installed visualization skill directory.');
  const names = ['scripts/render.py', 'assets/visualize.css', 'assets/visualize.html'];
  const files = await Promise.all(names.map(name => readFile(resolve(directory, name), 'utf8')));
  const profile = JSON.parse(execFileSync('python3', ['-c', 'import json,runpy,sys; module=runpy.run_path(sys.argv[1]); print(json.dumps({"policy":module["_FRAME_CSP"],"resourceDomains":module["_RESOURCE_SOURCES"].split()}))', resolve(directory, names[0])], { encoding: 'utf8' }));
  const { policy, resourceDomains } = profile;
  assert.equal(typeof policy, 'string');
  assert.ok(Array.isArray(resourceDomains) && resourceDomains.length > 0);
  assert.ok(files[2].includes('<!--__INLINE_VISUALIZATION_FRAGMENT__-->'));
  const helperUrls = [...files[2].matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
  for (const url of helperUrls) assert.ok(profile.resourceDomains.includes(new URL(url).origin), 'Host helper must use an approved resource domain');
  return {
    policy, baseCss: files[1], innerKit: files[2], helperUrls,
    approvedResourceOrigin: profile.resourceDomains.find(domain => domain.startsWith('https://')),
    evidence: {
      kind: 'visualization-skill-profile-reconstruction',
      files: names.map((name, index) => ({ name, sha256: createHash('sha256').update(files[index]).digest('hex') })),
      profile,
      limitations: [
        'The remotely loaded inner Skybridge implementation and live host messaging are not exercised.',
        'Distinct synthetic origins reconstruct the observed outer iframe sandbox flags.',
        'Host-owned Floating UI and Lucide CDN scripts receive local empty responses; their optional helpers are not validated.',
        'The profile permits approved CDN resources. Blocked API connections do not imply that all network resources are forbidden.',
      ],
    },
  };
}

export async function installHostPreview(page, profile, { height = 880, authoredRequests = [], hostRequests = [], probeRequests = [] } = {}) {
  const parentUrl = 'https://host-preview.invalid/';
  const documentOrigin = 'https://visualization-preview.invalid';
  const positiveUrl = `${profile.approvedResourceOrigin}/__mac_preview_allowed_resource__.js`;
  let documentHtml = '';
  let revision = 0;
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === parentUrl) return route.fulfill({ contentType: 'text/html', body: `<style>html,body{margin:0}</style><iframe sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" style="display:block;border:0;width:100%;height:${height}px"></iframe>` });
    if (url.startsWith(`${documentOrigin}/fragment?`)) return route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': profile.policy }, body: documentHtml });
    if (profile.helperUrls.includes(url)) {
      hostRequests.push(url);
      return route.fulfill({ contentType: 'text/javascript', body: '/* Host-owned optional helper intentionally omitted in profile reconstruction. */' });
    }
    if (url === positiveUrl) {
      probeRequests.push(url);
      return route.fulfill({ contentType: 'text/javascript', body: 'globalThis.__approvedResourceLoaded = true;' });
    }
    authoredRequests.push(url);
    return route.abort();
  });
  await page.goto(parentUrl);
  async function load(source) {
    documentHtml = `<!doctype html><meta charset="utf-8"><style>${profile.baseCss}</style>${profile.innerKit.replace('<!--__INLINE_VISUALIZATION_FRAGMENT__-->', () => `${source}<style>html,body{overflow-y:hidden!important;scrollbar-width:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important}</style>`)}`;
    const url = `${documentOrigin}/fragment?revision=${++revision}`;
    await page.locator('iframe').evaluate((iframe, nextUrl) => new Promise(resolve => { iframe.addEventListener('load', resolve, { once: true }); iframe.src = nextUrl; }), url);
    return page.frames().find(frame => frame.url() === url);
  }
  return { load, documentOrigin, positiveUrl };
}

export async function verifyRuntimePolicy(frame, positiveUrl) {
  const result = await frame.evaluate(async allowedUrl => {
    const violations = [];
    const listener = event => violations.push({ directive: event.effectiveDirective, blockedURI: event.blockedURI });
    document.addEventListener('securitypolicyviolation', listener);
    const targets = { fetch: 'https://blocked-preview.invalid/fetch', xhr: 'https://blocked-preview.invalid/xhr', websocket: 'wss://blocked-preview.invalid/socket' };
    const attempts = await Promise.all([
      fetch(new Request(targets.fetch)).then(() => ({ api: 'fetch', blocked: false }), error => ({ api: 'fetch', blocked: true, error: error.name })),
      new Promise(resolve => { const request = new XMLHttpRequest(); request.open('GET', targets.xhr); request.onload = () => resolve({ api: 'xhr', blocked: false }); request.onerror = () => resolve({ api: 'xhr', blocked: true }); request.send(); }),
      new Promise(resolve => { try { const socket = new WebSocket(targets.websocket); socket.onopen = () => { socket.close(); resolve({ api: 'websocket', blocked: false }); }; socket.onerror = () => resolve({ api: 'websocket', blocked: true }); } catch (error) { resolve({ api: 'websocket', blocked: true, error: error.name }); } }),
    ]);
    await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = allowedUrl; script.onload = resolve; script.onerror = () => reject(new Error('Approved resource did not load')); document.head.append(script); });
    await new Promise(resolve => setTimeout(resolve, 0));
    document.removeEventListener('securitypolicyviolation', listener);
    return { attempts, violations, targets, approvedResourceLoaded: globalThis.__approvedResourceLoaded === true };
  }, positiveUrl);
  assert.ok(result.attempts.every(attempt => attempt.blocked), 'Each direct connection API must fail');
  for (const target of Object.values(result.targets)) {
    assert.ok(result.violations.some(event => event.directive === 'connect-src' && event.blockedURI === target), `Missing host-profile connect-src evidence for ${target}`);
  }
  assert.equal(result.approvedResourceLoaded, true, 'Approved CDN resource must remain allowed by the reconstructed profile');
  return result;
}
