# shopwise-storefront

The Shopwise store: Nuxt app plus the Nitro BFF that is its only way into the services. Today it covers sign in,
registration and catalog browse/search. Conventions: `AGENTS.md`.

Run it from `shopwise-platform`: `tilt up -- --only=identity,catalog,storefront`, seed identity and catalog once
(see the platform README), then open http://localhost:3000.

Checks: `pnpm check`.
