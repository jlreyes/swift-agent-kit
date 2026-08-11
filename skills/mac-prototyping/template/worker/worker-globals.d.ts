/**
 * Dependency-free shims for the Cloudflare runtime globals that
 * worker/index.ts references, so `tsc --noEmit` passes without vendoring
 * @cloudflare/workers-types. Only what the worker actually touches is
 * declared; switch to the real types package if the worker grows.
 */

/** Service binding (the ASSETS static-assets binding). */
interface Fetcher {
  fetch(input: Request | URL | string, init?: RequestInit): Promise<Response>;
}

/**
 * D1 binding. The template worker only passes it through to the vinext
 * handler; `prepare` is declared so the name identifies the binding without
 * being an empty interface. Use @cloudflare/workers-types for real D1 work.
 */
interface D1Database {
  prepare(query: string): unknown;
}
