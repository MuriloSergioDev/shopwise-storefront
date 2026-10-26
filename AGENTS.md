# shopwise-storefront

The shopper-facing Nuxt app and its Nitro BFF. The BFF is the only public entry: the browser calls `/api/*` here,
the BFF calls services. Service URLs and JWTs never reach the browser.

## Stack

Nuxt 4 (`app/`, `server/`, `shared/`), Nuxt UI 4 (Tailwind 4), `nuxt-auth-utils` for the session, `zod` for
validation, strict TypeScript. Contract types come from `@shopwise/contracts` (pnpm git dependency) via
`shared/types/contracts.ts`; never hand-write a service's response type.

## Layout

- `server/api/<area>/…` — BFF routes. Validate input with zod (`readValidatedBody`, `getValidatedQuery`,
  `getValidatedRouterParams`), call services only through `serviceFetch`, return contract shapes.
- `server/utils/services.ts` — `serviceFetch(event, service, path, options)`: base URL from runtime config,
  `Bearer` token when given, forwards `traceparent`, maps failures through `toBffError` (4xx pass through with the
  service's message; anything else is a 502 that hides service internals). `startSession` seals a token pair.
- `app/composables/` — one `useFetch` wrapper per BFF route with a stable key. Pages `await` them.
- `app/pages/` — `index`, `products/index` (search, facets, pagination; all state lives in the URL query),
  `products/[slug]`, `login`, `register` (guest-only middleware).

## Rules

- **Session**: `user` (id, email, name, roles) is visible to the browser; tokens live in `secure`, which never
  leaves the server. Shapes in `shared/types/auth.d.ts`. Sign out through `POST /api/auth/logout` (revokes the
  refresh token), not nuxt-auth-utils' `DELETE /api/_auth/session`.
- **Refresh tokens rotate and reuse revokes the whole family.** Nothing calls an authenticated service yet. The first
  route that does (cart, P2) must refresh near expiry and share one in-flight refresh per refresh token, or parallel
  requests will sign the customer out.
- **Caching**: SSR pages are never cached (they render the signed-in user). Only public catalog reads have
  `routeRules` cache entries. Cached handlers drop request headers (including `traceparent`), and the search
  endpoint must stay uncached: keep cache patterns one segment deep (`/api/catalog/products/*`, not `/**`).
- No prices yet: pricing (P2) owns them, keyed by SKU.

## Run

Under Tilt from `shopwise-platform`: `tilt up -- --only=identity,catalog,storefront` → http://localhost:3000.
Alone: `pnpm dev` (needs identity on :8101 and catalog on :8102; override with `NUXT_IDENTITY_URL` /
`NUXT_CATALOG_URL`). Demo accounts come from identity's seeder.

## Checks

`pnpm check` = prettier, eslint, `nuxt typecheck`, vitest. Vitest projects:

- `test/unit` — plain Node, pure helpers.
- `test/nuxt` — Nuxt environment, components and pages (`mountSuspended`, `registerEndpoint`).
- `test/bff` — builds the app and calls the real Nitro server against a fake identity + catalog
  (`test/bff/upstream.ts`). Every BFF route gets a test here.

Install note: `pnpm-workspace.yaml` allowlists build scripts; `@shopwise/contracts` is set to `false` so pnpm doesn't
run its `prepare` (lefthook) when installing it from git.
