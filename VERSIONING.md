# Versioning

The MCP server carries its **own semantic version** (starting at `0.1.0`),
deliberately decoupled from the American Cloud API/SDK lockstep scheme — the
server is a hand-written product (tool names, descriptions, safety policy)
that iterates on its own cadence.

**The compatibility contract is the exact-pinned SDK dependency.** Each release
pins one `@americancloud/sdk` version in `package.json`, and SDK versions are
lockstep with the API platform version — so the pin transitively states exactly
which API surface this server was built and tested against:

> `@americancloud/mcp 0.5.0+` ↔ `@americancloud/sdk 1.4.0` ↔ API platform `1.4.0` (API `v1`)

Rules:

- **Patch** — tool description/docs fixes, internal changes. No tool surface change.
- **Minor** — new tools, new service groups, or an SDK pin bump with additive
  surface changes.
- **Major** — removed/renamed tools or changed tool argument shapes (whether
  from an SDK breaking change or our own redesign), and any move to a new API
  URL version (`/api/v2`).

While the server is pre-1.0, breaking changes ship as a **minor** bump
(standard 0.x semver: the public contract is not yet frozen), with the
breaking items called out explicitly in the changelog. The major rule above
takes over at 1.0.0.

Each release pins one exact `@americancloud/sdk` version — that pin is the
compatibility contract, and bumping it is what drives a new MCP release.
