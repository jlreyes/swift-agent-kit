const allowedAtRules = new Set(['media', 'supports', 'container', 'keyframes', '-webkit-keyframes']);
function documentRoot(node) {
  return (node.type === 'PseudoClassSelector' && node.name === 'root') || (node.type === 'TypeSelector' && ['html', 'body'].includes(node.name));
}
export function prepareCss(source, path, { postcss, cssTree, windowOnly }) {
  const css = postcss.parse(source, { from: path });
  if (windowOnly) {
    css.walkDecls('--mc-wallpaper-default', declaration => { declaration.value = 'none'; });
    css.walkRules(rule => {
      const selectors = cssTree.parse(rule.selector, { context: 'selectorList' });
      const documentOnly = selectors.children.toArray().every(selector => {
        const nodes = selector.children.toArray();
        return nodes.length === 1 && nodes[0].type === 'TypeSelector' && ['html', 'body'].includes(nodes[0].name);
      });
      if (documentOnly) rule.walkDecls(declaration => {
        if (/^(?:(?:min-|max-)?(?:width|height)|overflow(?:-[xy])?|background(?:-.+)?|view-transition-name)$/.test(declaration.prop)) declaration.remove();
      });
    });
  }
  return css.toString();
}
export function scopeCss(source, root, { postcss, cssTree }) {
  const css = postcss.parse(source);
  const keyframes = new Map();
  css.walkAtRules(rule => {
    const name = rule.name.toLowerCase();
    if (name === 'charset') { rule.remove(); return; }
    if (!allowedAtRules.has(name)) throw new Error(`Unsupported global CSS @${name}; resolve its isolation explicitly before packaging.`);
    if (name.endsWith('keyframes')) {
      const parsed = cssTree.parse(rule.params, { context: 'value' });
      const node = parsed.children.first;
      if (parsed.children.size !== 1 || !['Identifier', 'String'].includes(node?.type)) throw new Error(`Unsupported keyframe name: ${rule.params}`);
      const original = node.type === 'String' ? node.value : cssTree.ident.decode(node.name);
      const renamed = `${root}-${original}`;
      keyframes.set(original, renamed);
      if (node.type === 'String') node.value = renamed;
      else node.name = cssTree.ident.encode(renamed);
      rule.params = cssTree.generate(parsed);
    }
  });
  css.walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name.toLowerCase().endsWith('keyframes')) return;
    const selectors = cssTree.parse(rule.selector, { context: 'selectorList' });
    const includeRoot = [];
    selectors.children.forEach((selector, item, list) => {
      let hasViewTransition = false;
      cssTree.walk(selector, node => {
        if (node.type === 'PseudoElementSelector' && node.name.startsWith('view-transition')) hasViewTransition = true;
      });
      if (hasViewTransition) { list.remove(item); return; }
      let roots = 0;
      const topLevel = selector.children.toArray();
      cssTree.walk(selector, node => {
        if (!documentRoot(node)) return;
        if (!topLevel.includes(node)) throw new Error(`Nested document-root CSS needs explicit adaptation: ${rule.selector}`);
        roots += 1;
        node.type = 'IdSelector'; node.name = root; delete node.children;
      });
      if (roots === 1 && (topLevel[0]?.type !== 'IdSelector' || topLevel[0]?.name !== root || topLevel.some(node => node.type === 'Combinator' && ['+', '~'].includes(node.name)))) throw new Error(`Document-root selector can escape or contradict the preview boundary: ${rule.selector}`);
      if (roots > 1) throw new Error(`Compound document-root CSS needs explicit adaptation: ${rule.selector}`);
      const first = selector.children.first;
      if (first?.type === 'TypeSelector' && first.name === '*' && topLevel.length === 1) includeRoot.push(`#${root}`);
      if (!(first?.type === 'IdSelector' && first.name === root)) {
        selector.children.prependData({ type: 'Combinator', name: ' ' });
        selector.children.prependData({ type: 'IdSelector', name: root });
      }
    });
    if (selectors.children.isEmpty) { rule.remove(); return; }
    rule.selector = [...includeRoot, cssTree.generate(selectors)].join(',');
  });
  css.walkDecls(declaration => {
    const parsed = cssTree.parse(declaration.value, { context: 'value', parseCustomProperty: true });
    cssTree.walk(parsed, node => {
      if (node.type === 'Url' && !/^(?:data:|#)/i.test(node.value)) throw new Error(`Unembedded CSS URL remains: ${node.value}`);
    });
    const property = declaration.prop.toLowerCase().replace(/^-webkit-/, '');
    if (keyframes.size && (property === 'animation' || property === 'animation-name')) {
      const match = cssTree.lexer.matchProperty(property, parsed);
      if (match.error) throw new Error(`Cannot safely scope CSS ${declaration.prop}: ${declaration.value}; use explicit animation values instead of ambiguous or unsupported syntax.`);
      cssTree.walk(parsed, node => {
        if (node.type !== 'Identifier' && node.type !== 'String') return;
        if (!match.getTrace(node)?.some(part => part.type === 'Type' && part.name === 'keyframes-name')) return;
        const original = node.type === 'String' ? node.value : cssTree.ident.decode(node.name);
        if (!keyframes.has(original)) return;
        if (node.type === 'String') node.value = keyframes.get(original);
        else node.name = cssTree.ident.encode(keyframes.get(original));
      });
    }
    declaration.value = cssTree.generate(parsed);
  });
  return css.toString();
}
