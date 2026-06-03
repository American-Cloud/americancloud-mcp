# Changelog

All notable changes to the American Cloud MCP server are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [`VERSIONING.md`](./VERSIONING.md) for how MCP versions relate to the SDK and API.

## [Unreleased]

### Changed

- Normalize the `bin` path in `package.json` (`./dist/index.js` → `dist/index.js`),
  silencing an `npm publish` warning. No functional change — npm already
  normalized the published `bin`.

## [0.1.0] - 2026-06-03

### Added

- Initial server: stdio transport, `--services` filtering, env-based
  authentication, stderr-only logging.
- **Read-only by default** — the server registers only read tools unless
  `--allow-writes` is passed, so an assistant can't create/modify/delete
  resources out of the box.
- Full tool coverage of the American Cloud public API — 170 tools across seven
  groups (compute, storage, networking, kubernetes, databases, wordpress, dns)
  plus a built-in `get_server_info`, each wrapping one SDK method.
