import { gzipSync } from 'node:zlib';

export function validateRoot(root) {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(root)) throw new Error('root must be a simple HTML identifier.');
}
export function formatPreview({ root, css, script, format = 'gzip', maxBytes = 1_000_000 }) {
  validateRoot(root);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 1_000_000) throw new Error('maxBytes must be an integer from 1 to 1,000,000.');
  const payload = JSON.stringify({ css, script }).replaceAll('<', '\\u003c');
  const install = "const s=document.createElement('style');s.textContent=p.css;document.head.append(s);const j=document.createElement('script');j.textContent=p.script;document.body.append(j);";
  const raw = `<div id="${root}"></div>\n<script>(()=>{const p=${payload};${install}})();</script>\n`;
  let fragment = raw;
  let gzipBytes = null;
  let base64Bytes = null;
  if (format === 'gzip') {
    const compressed = gzipSync(JSON.stringify({ css, script }), { level: 9 });
    const payload = compressed.toString('base64');
    gzipBytes = compressed.length;
    base64Bytes = payload.length;
    const bootstrap = `(async()=>{try{if(typeof DecompressionStream!=='function')throw new Error('This browser cannot decompress the preview. Request raw output.');const b=Uint8Array.from(atob('${payload}'),c=>c.charCodeAt(0));const p=JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text());${install}}catch(e){document.getElementById('${root}').textContent='Preview could not load: '+e.message;console.error(e);}})();`;
    fragment = `<div id="${root}"></div>\n<script>${bootstrap}</script>\n`;
  } else if (format !== 'raw') throw new Error('format must be gzip or raw.');
  const bytes = Buffer.byteLength(fragment);
  if (bytes > maxBytes) throw new Error(`Final fragment is ${bytes} raw UTF-8 bytes; maximum is ${maxBytes.toLocaleString('en-US')}. Output was not written.`);
  return { fragment, sizes: { bytes, rawBytes: Buffer.byteLength(raw), cssBytes: Buffer.byteLength(css), jsBytes: Buffer.byteLength(script), gzipBytes, base64Bytes, bootstrapBytes: base64Bytes === null ? null : bytes - base64Bytes, maxBytes } };
}
