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
export function inspectSource(source, path, acorn) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const navigationUrls = new Set();
  walk(ast, node => {
    if (node.type === 'Property' && propertyName(node.key) === 'href' && typeof node.value?.value === 'string' && !isEmbeddedUrl(node.value.value)) navigationUrls.add(node.value.value);
    if (node.type === 'Property' && ['src', 'poster', 'srcSet', 'action'].includes(propertyName(node.key))
      && node.value?.type === 'Literal' && typeof node.value.value === 'string' && node.value.value && !isEmbeddedUrl(node.value.value)) {
      throw new Error(`${path}: authored ${propertyName(node.key)} URL must be embedded or imported: ${node.value.value}`);
    }
    const called = node.callee?.type === 'MemberExpression' ? propertyName(node.callee.property) : node.callee?.name;
    if (['CallExpression', 'NewExpression'].includes(node.type) && ['fetch', 'WebSocket', 'EventSource', 'XMLHttpRequest', 'Worker', 'SharedWorker'].includes(called)) throw new Error(`${path}: runtime ${called} is not self-contained.`);
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
    const seen = new Set();
    while (object?.type === 'Identifier' && bindings.has(object.name) && !seen.has(object.name)) {
      seen.add(object.name); object = bindings.get(object.name);
    }
    if (object?.type !== 'ObjectExpression') return null;
    if (object.properties.some(property => property.type !== 'Property' || property.kind !== 'init' || property.method)) return null;
    const key = node.computed ? (node.property.type === 'Literal' ? node.property.value : null) : node.property.name;
    const choices = key === null ? object.properties : object.properties.filter(property => propertyName(property.key) === key);
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
  const names = new Set();
  const dynamic = [];
  const valid = name => { const glyph = getSymbol(name); return typeof glyph === 'string' && glyph.length > 0; };
  walk(ast, node => {
    if (node.type === 'VariableDeclaration') for (const declaration of node.declarations) {
      if (declaration.id.type === 'Identifier') bindings.set(declaration.id.name, declaration.init);
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && valid(node.value)) names.add(node.value);
  });
  walk(ast, node => {
    if (!['AssignmentExpression', 'UpdateExpression'].includes(node.type)) return;
    let target = node.left ?? node.argument;
    while (target?.type === 'MemberExpression') target = target.object;
    if (target?.type === 'Identifier') bindings.delete(target.name);
  });
  const isSymbolComponent = (node, seen = new Set()) => {
    if (node?.type !== 'Identifier') return false;
    if (/^SystemSymbol\d*$/.test(node.name)) return true;
    if (seen.has(node.name)) return false;
    return isSymbolComponent(bindings.get(node.name), new Set([...seen, node.name]));
  };
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
      if (props?.type !== 'ObjectExpression' || props.properties.some(property => property.type === 'SpreadElement')) { check(null, node); return; }
      check(props.properties.find(property => propertyName(property.key) === 'name')?.value, node);
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
