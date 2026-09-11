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
      const renamed = `${root}-${rule.params}`;
      keyframes.set(rule.params, renamed);
      rule.params = renamed;
    }
  });
  css.walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
    const selectors = cssTree.parse(rule.selector, { context: 'selectorList' });
    let hasViewTransition = false;
    const includeRoot = [];
    selectors.children.forEach(selector => {
      let roots = 0;
      const topLevel = selector.children.toArray();
      cssTree.walk(selector, node => {
        if (node.type === 'PseudoElementSelector' && node.name.startsWith('view-transition')) hasViewTransition = true;
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
    if (hasViewTransition) { rule.remove(); return; }
    rule.selector = [...includeRoot, cssTree.generate(selectors)].join(',');
  });
  css.walkDecls(declaration => {
    const parsed = cssTree.parse(declaration.value, { context: 'value', parseCustomProperty: true });
    cssTree.walk(parsed, node => {
      if (node.type === 'Url' && !/^(?:data:|#)/i.test(node.value)) throw new Error(`Unembedded CSS URL remains: ${node.value}`);
      if ((declaration.prop === 'animation' || declaration.prop === 'animation-name') && node.type === 'Identifier' && keyframes.has(node.name)) node.name = keyframes.get(node.name);
    });
    declaration.value = cssTree.generate(parsed);
  });
  return css.toString();
}
