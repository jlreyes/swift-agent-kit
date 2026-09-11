import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export function loadToolchain(project) {
  const primary = project ? createRequire(resolve(project, '__preview_toolchain__.cjs')) : createRequire(import.meta.url);
  const resolvers = [primary];
  if (project) for (const name of ['vite', 'jsdom']) {
    try { resolvers.push(createRequire(primary.resolve(name))); } catch {}
  }
  const dependencies = {};
  for (const name of ['esbuild', 'postcss', 'css-tree', 'acorn', 'terser']) {
    for (const resolver of resolvers) {
      try { dependencies[name] = resolver(name); break; }
      catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
    }
    if (!dependencies[name]) throw new Error(`Missing build dependency ${name}. Install this package's declared dependencies, or supply toolchain pointing to an existing installation. Nothing was installed automatically.`);
  }
  return dependencies;
}
