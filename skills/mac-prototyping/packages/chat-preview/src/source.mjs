export function walk(node, visitor, ancestors = []) {
  if (node === null || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node, ancestors);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visitor, [...ancestors, node]));
    else if (value !== null && typeof value === 'object') walk(value, visitor, [...ancestors, node]);
  }
}
const propertyName = node => node?.name ?? node?.value;
const isEmbeddedUrl = value => /^(?:data:|#)/i.test(value);
const isSourceSet = name => name === 'srcSet' || name === 'srcset';
const supportedSourceSet = value => /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}(?:\s+(?:[1-9][0-9]*w|(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)x))?$/i.test(value.trim());
const embeddedResource = (name, value) => isSourceSet(name) ? supportedSourceSet(value) : isEmbeddedUrl(value);
export function inspectSource(source, path, acorn) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const navigationUrls = new Set();
  const diagnostics = [];
  const hint = (kind, node, detail) => diagnostics.push({ severity: 'advisory', phase: 'authored-js', path, kind, line: node.loc.start.line, column: node.loc.start.column, detail, expression: source.slice(node.start, node.end).slice(0, 180) });
  const inspectResource = (name, value, node) => {
    if (!['src', 'poster', 'srcSet', 'srcset', 'action'].includes(name) || value?.type !== 'Literal' || typeof value.value !== 'string' || !value.value) return;
    if (isSourceSet(name) && !supportedSourceSet(value.value)) {
      hint('resource-url', node, `${name} is outside the helper's single-base64-image check. Verify its actual candidate URLs at runtime.`);
    } else if (!embeddedResource(name, value.value)) {
      hint('resource-url', node, `${name} may reference a resource: ${value.value.slice(0, 120)}. Property names alone do not establish network behavior.`);
    }
  };
  walk(ast, node => {
    if (node.type === 'Property' && propertyName(node.key) === 'href' && typeof node.value?.value === 'string' && !isEmbeddedUrl(node.value.value)) navigationUrls.add(node.value.value);
    if (node.type === 'Property') inspectResource(propertyName(node.key), node.value, node);
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') inspectResource(propertyName(node.left.property), node.right, node);
    if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && propertyName(node.callee.property) === 'setAttribute') inspectResource(node.arguments[0]?.value, node.arguments[1], node);
    const called = node.callee?.type === 'MemberExpression' ? propertyName(node.callee.property) : node.callee?.name;
    if (['CallExpression', 'NewExpression'].includes(node.type) && ['fetch', 'sendBeacon', 'WebSocket', 'EventSource', 'XMLHttpRequest', 'Worker', 'SharedWorker'].includes(called)) hint('network-api', node, called);
    if (node.type === 'ImportExpression' && (node.source.type !== 'Literal' || typeof node.source.value !== 'string')) hint('runtime-import', node, 'Computed import target needs runtime verification.');
  });
  return { navigationUrls: [...navigationUrls], diagnostics };
}
export function collectSymbols(source, getSymbol, acorn, additionalSymbols) {
  if (additionalSymbols !== undefined && (!Array.isArray(additionalSymbols) || additionalSymbols.some(name => typeof name !== 'string'))) throw new Error('additionalSymbols must be an explicit array of possible dynamic symbol names.');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const automatic = new Set();
  const valid = name => { const glyph = getSymbol(name); return typeof glyph === 'string' && glyph.length > 0; };
  walk(ast, node => {
    const name = node.type === 'Literal' ? node.value : node.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0].value.cooked : undefined;
    if (typeof name === 'string' && valid(name)) automatic.add(name);
  });
  const names = new Set(automatic);
  for (const name of additionalSymbols ?? []) {
    if (!valid(name)) throw new Error(`Unknown symbol in additionalSymbols: ${name}`);
    names.add(name);
  }
  return { symbols: [...names].sort().map(name => ({ name, glyph: getSymbol(name) })), automatic: [...automatic].sort(), collectionMode: 'recognized-literals-with-explicit-additions' };
}
export function symbolModule(symbols) {
  const dictionary = Object.fromEntries(symbols.map(({ name, glyph }) => [name, glyph]));
  return `const symbols=${JSON.stringify(dictionary)};export function getSymbol(name){if(!Object.prototype.hasOwnProperty.call(symbols,name))throw new Error('[mac-chat-preview] Symbol outside the packaged set: '+name+'. Declare every dynamic symbol in additionalSymbols.');return symbols[name]}`;
}


export function diagnoseRuntimeCode(source, acorn) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const diagnostics = [];
  const resources = new Set(['src', 'srcset', 'srcSet', 'poster', 'action']);
  const networkApis = new Set(['fetch', 'sendBeacon', 'WebSocket', 'EventSource', 'XMLHttpRequest', 'Worker', 'SharedWorker']);
  const describe = (kind, node, detail) => diagnostics.push({ severity: 'advisory', phase: 'emitted-js', kind, line: node.loc.start.line, column: node.loc.start.column, detail, expression: source.slice(node.start, node.end).slice(0, 180) });
  const resource = (name, value, node) => {
    if (typeof value?.value === 'string') {
      if (value.value && !embeddedResource(name, value.value)) describe('resource-url', node, `${name}: ${value.value.slice(0, 120)}`);
    } else describe('computed-resource', node, `${name} is computed; verify every relevant state with network blocked.`);
  };
  walk(ast, node => {
    if (['CallExpression', 'NewExpression'].includes(node.type)) {
      const called = node.callee?.type === 'MemberExpression' ? propertyName(node.callee.property) : node.callee?.name;
      if (networkApis.has(called)) describe('network-api', node, called);
      if (called === 'setAttribute' && resources.has(node.arguments[0]?.value)) resource(node.arguments[0].value, node.arguments[1], node);
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && resources.has(propertyName(node.left.property))) resource(propertyName(node.left.property), node.right, node);
    if (node.type === 'Property' && resources.has(propertyName(node.key))) resource(propertyName(node.key), node.value, node);
    if (node.type === 'ImportExpression') describe('runtime-import', node, 'Import remains in the emitted script.');
  });
  return diagnostics;
}
