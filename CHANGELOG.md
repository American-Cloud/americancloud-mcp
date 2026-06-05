# Changelog

All notable changes to the American Cloud MCP server are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [`VERSIONING.md`](./VERSIONING.md) for how MCP versions relate to the SDK and API.

## [Unreleased]

## [0.2.0] - 2026-06-04

### Added

- `delete_vpc_tier` — delete a single tier (subnet) from a VPC, leaving the
  VPC and its other tiers in place (networking group, destructive).
- `get_vpc_tier`, `update_vpc_tier`, `restart_vpc_tier` — read, rename, and
  restart a single tier (subnet) of a VPC (networking group). Together with
  `create_vpc_tier` and `delete_vpc_tier`, tiers are now fully manageable
  through the VPC tools.

### Changed

- **Breaking:** `startPort`/`endPort` on `create_firewall_rule`,
  `create_egress_rule`, `update_egress_rule`, and `create_network_acl_rule`
  are now integers (1–65535) instead of strings, matching API platform 1.3.0.
  Port-forwarding and load-balancer ports are unchanged (still strings).
- `scale_vm` `cpu` and `memoryMb` are now strict integers (≥ 1); fractional
  values are rejected. The underlying API call sends them in the request body.
- `create_vm` `network` is now optional — omit it to have an isolated network
  created for the VM automatically.
- `create_object_storage_unit` now returns the created unit (including
  `storageUnitId`), so a follow-up `list_object_storage_units` call is no
  longer needed to discover the new unit's ID.
- Object storage unit `maxBuckets`/`limitKb` responses now use `null` to mean
  unlimited (previously the string `"unlimited"`).
- The isolated-network tools now cover standalone isolated networks only: VPC
  tiers no longer appear in `list_isolated_networks`, and `get/update/restart/
  delete_isolated_network` return not-found for tier IDs — use the
  `*_vpc_tier` tools instead. Isolated-network responses no longer include
  VPC- or ACL-related fields.
- `@americancloud/sdk` pin bumped to 1.3.0 (API platform 1.3.0).

## [0.1.1] - 2026-06-03

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
