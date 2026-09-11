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
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const navigationUrls = new Set();
  const inspectResource = (name, value) => {
    if (!['src', 'poster', 'srcSet', 'srcset', 'action'].includes(name) || value?.type !== 'Literal' || typeof value.value !== 'string' || !value.value) return;
    if (isSourceSet(name) && !supportedSourceSet(value.value)) throw new Error(`${path}: literal ${name} supports exactly one base64 image data URL with an optional density or width descriptor. Candidate lists and other URL forms require explicit adaptation.`);
    if (!embeddedResource(name, value.value)) throw new Error(`${path}: authored ${name} URL must be embedded or imported: ${value.value}`);
  };
  walk(ast, node => {
    if (node.type === 'Property' && propertyName(node.key) === 'href' && typeof node.value?.value === 'string' && !isEmbeddedUrl(node.value.value)) navigationUrls.add(node.value.value);
    if (node.type === 'Property') inspectResource(propertyName(node.key), node.value);
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') inspectResource(propertyName(node.left.property), node.right);
    if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && propertyName(node.callee.property) === 'setAttribute') inspectResource(node.arguments[0]?.value, node.arguments[1]);
    const called = node.callee?.type === 'MemberExpression' ? propertyName(node.callee.property) : node.callee?.name;
    if (['CallExpression', 'NewExpression'].includes(node.type) && ['fetch', 'sendBeacon', 'WebSocket', 'EventSource', 'XMLHttpRequest', 'Worker', 'SharedWorker'].includes(called)) throw new Error(`${path}: runtime ${called} is not self-contained.`);
    if (node.type === 'ImportExpression' && (node.source.type !== 'Literal' || typeof node.source.value !== 'string')) throw new Error(`${path}: runtime import() is not supported in a self-contained preview.`);
  });
  return [...navigationUrls];
}
function finiteStrings(node, bindings, visiting = new Set()) {
  if (!node) return null;
  if (node.type === 'Literal') return typeof node.value === 'string' ? [node.value] : null;
  if (node.type === 'Identifier') {
    if (visiting.has(node.name) || !bindings.has(node.name)) return null;
    return finiteStrings(bindings.get(node.name), bindings, new Set([...visiting, node.name]));
  }
  if (node.type === 'ConditionalExpression') {
    const a = finiteStrings(node.consequent, bindings, visiting);
    const b = finiteStrings(node.alternate, bindings, visiting);
    return a && b ? [...a, ...b] : null;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return [node.quasis[0].value.cooked];
  if (node.type === 'MemberExpression') {
    let object = node.object;
    if (object?.type !== 'ObjectExpression') return null;
    if (object.properties.some(property => property.type !== 'Property' || property.kind !== 'init' || property.method)) return null;
    const key = node.computed ? (node.property.type === 'Literal' ? node.property.value : null) : node.property.name;
    const choices = key === null ? object.properties : [object.properties.findLast(property => !property.computed && propertyName(property.key) === key)].filter(Boolean);
    if (object.properties.some(property => property.computed)) return null;
    if (choices.length === 0) return null;
    const values = choices.map(property => finiteStrings(property.value, bindings, visiting));
    return values.every(Boolean) ? values.flat() : null;
  }
  return null;
}
export function collectSymbols(source, getSymbol, acorn, additionalSymbols) {
  if (additionalSymbols !== undefined && (!Array.isArray(additionalSymbols) || additionalSymbols.some(name => typeof name !== 'string'))) throw new Error('additionalSymbols must be an explicit array of possible dynamic symbol names.');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const bindings = new Map();
  const declarations = new Map();
  const assigned = new Set();
  const componentAliases = new Set();
  const aliasPairs = [];
  const names = new Set();
  const dynamic = [];
  const valid = name => { const glyph = getSymbol(name); return typeof glyph === 'string' && glyph.length > 0; };
  const bindPattern = pattern => {
    if (!pattern) return;
    if (pattern.type === 'Identifier') declarations.set(pattern.name, (declarations.get(pattern.name) ?? 0) + 1);
    else if (pattern.type === 'RestElement') bindPattern(pattern.argument);
    else if (pattern.type === 'AssignmentPattern') bindPattern(pattern.left);
    else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(bindPattern);
    else if (pattern.type === 'ObjectPattern') pattern.properties.forEach(property => bindPattern(property.type === 'RestElement' ? property.argument : property.value));
  };
  walk(ast, node => {
    if (node.type === 'VariableDeclarator') {
      bindPattern(node.id);
      if (node.id.type === 'Identifier') {
        bindings.set(node.id.name, node.init);
        if (node.init?.type === 'Identifier') aliasPairs.push([node.id.name, node.init.name]);
      }
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      bindPattern(node.id);
      node.params.forEach(bindPattern);
    }
    if (node.type === 'CatchClause') bindPattern(node.param);
    if (['ClassDeclaration', 'ClassExpression'].includes(node.type)) bindPattern(node.id);
    if (node.type === 'Literal' && typeof node.value === 'string' && valid(node.value)) names.add(node.value);
    if (node.type === 'Identifier' && /^SystemSymbol\d*$/.test(node.name)) componentAliases.add(node.name);
    if (['AssignmentExpression', 'UpdateExpression'].includes(node.type)) {
      let target = node.left ?? node.argument;
      while (target?.type === 'MemberExpression') target = target.object;
      if (target?.type === 'Identifier') assigned.add(target.name);
      else walk(target, part => { if (part.type === 'Identifier') assigned.add(part.name); });
    }
  });
  for (const name of bindings.keys()) if (declarations.get(name) !== 1 || assigned.has(name)) bindings.delete(name);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [alias, original] of aliasPairs) if (componentAliases.has(original) && !componentAliases.has(alias)) { componentAliases.add(alias); changed = true; }
  }
  const isSymbolComponent = node => node?.type === 'Identifier' && componentAliases.has(node.name);
  const check = (expression, node) => {
    const possible = finiteStrings(expression, bindings);
    if (possible === null) { dynamic.push({ line: node.loc.start.line, expression: source.slice(expression?.start ?? node.start, expression?.end ?? node.end).slice(0, 180) }); return; }
    for (const name of possible) {
      if (!valid(name)) throw new Error(`Unknown statically named SystemSymbol: ${name}`);
      names.add(name);
    }
  };
  walk(ast, (node, ancestors) => {
    if (node.type !== 'CallExpression') return;
    if (isSymbolComponent(node.arguments[0])) {
      const props = node.arguments[1];
      if (props?.type !== 'ObjectExpression' || props.properties.some(property => property.type === 'SpreadElement' || property.computed)) { check(null, node); return; }
      check(props.properties.findLast(property => propertyName(property.key) === 'name')?.value, node);
    }
    if (/^getSymbol\d*$/.test(node.callee?.name ?? '')) {
      const enclosing = ancestors.findLast(ancestor => ['FunctionDeclaration', 'FunctionExpression'].includes(ancestor.type));
      if (/^systemSymbolGlyph\d*$/.test(enclosing?.id?.name ?? '')) return;
      check(node.arguments[0], node);
    }
  });
  if (dynamic.length && additionalSymbols === undefined) throw new Error(`Unbounded SystemSymbol names need an explicit additionalSymbols array covering every runtime value. Dynamic expressions: ${dynamic.map(item => item.expression).join('; ')}`);
  for (const name of additionalSymbols ?? []) {
    if (!valid(name)) throw new Error(`Unknown symbol in additionalSymbols: ${name}`);
    names.add(name);
  }
  return { symbols: [...names].sort().map(name => ({ name, glyph: getSymbol(name) })), dynamic, automatic: [...names].filter(name => !(additionalSymbols ?? []).includes(name)).sort() };
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
  const describe = (kind, node, detail) => diagnostics.push({ kind, line: node.loc.start.line, column: node.loc.start.column, detail, expression: source.slice(node.start, node.end).slice(0, 180) });
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
