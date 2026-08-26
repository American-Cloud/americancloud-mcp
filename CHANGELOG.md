# Changelog

All notable changes to the American Cloud MCP server are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [`VERSIONING.md`](./VERSIONING.md) for how MCP versions relate to the SDK and API.

## [Unreleased]

## [0.5.0] - 2026-08-26

### Added

- `get_wordpress_change_package_estimate` — preview what it costs to move the
  managed WordPress site to another package before you commit to it. It returns
  the prorated charge for the rest of the current billing period, the difference
  in monthly rate, any account discount, and the period the charge covers. It
  changes nothing and charges nothing.
- Tool errors now carry the API's machine-readable reason code, for example
  `American Cloud API error (409) [provisioning_in_progress]: ...`. Branch on
  that code rather than on the message, which can be reworded at any time. It
  tells apart causes that share a status: a 409 that means "still being set up,
  retry" from one that means "being deleted, stop".
- A delete refused because the disk still has snapshots now names them in the
  error, with each snapshot's name and id, so you can remove them with
  `delete_snapshot` and retry without a second lookup.

### Fixed

- `create_wordpress` and `get_cost_estimate_wordpress` take `domain` as a
  string, for example `"example.com"`. It was modelled as an object, which no
  caller could satisfy, so a custom domain could not be sent.
- `create_block_storage_volume` states the real minimum size. `sizeGb` accepted
  1 while the platform refuses anything under 5, so the smallest volumes failed
  with a 400 instead of being caught before the call.

### Changed

- SDK pin bumped to `@americancloud/sdk` 1.4.0 (API 1.4.0).
- `change_wordpress_package` points at the new estimate tool.
- `create_wordpress` states that the call returns as soon as the request is
  accepted, and that you poll `get_wordpress` until the site reports `active`
  or `failed`.
- `delete_vm` and `delete_block_storage_volume` state that the delete is
  refused while the disk still has snapshots.
- `trigger_database_backup` states that a backup needs the cluster's
  infrastructure running, and that you retry once it is.
- `delete_database_backup_repo` states that a repository still in use is
  refused, and points at `set_active_database_backup_repo`.

## [0.4.0] - 2026-07-27

### Added

- `create_port_forwarding_rule` gains an optional `tierId` — targets a specific
  VPC tier when the public IP is reserved in a VPC and the VM has interfaces in
  more than one tier of that VPC. Otherwise the tier is inferred from the VM;
  ignored for IPs in an isolated network.

### Changed

- `delete_vm` and `create_vm` descriptions now note that a network auto-created
  for a VM is removed with it once its last VM is deleted (and its public IPs
  released); networks you supply explicitly are left untouched.
- SDK pin bumped to `@americancloud/sdk` 1.3.3 (API 1.3.3).

## [0.3.0] - 2026-06-17

### Added

- `update_database_backup_config` — enable or disable encryption of a managed
  database cluster's backups with a passphrase (12–256 printable ASCII
  characters; AES-256-CFB). Pairs with the existing `get_database_backup_config`.

### Changed

- SDK pin bumped to `@americancloud/sdk` 1.3.2 (API 1.3.2).

## [0.2.1] - 2026-06-05

### Changed

- SDK pin bumped to `@americancloud/sdk` 1.3.1 (API 1.3.1): isolated-network
  and snapshot deletes now surface typed transient errors — `409` while
  attached resources are still releasing, `504` while deletion is in
  progress. Both are retryable.
- `delete_isolated_network` and `delete_snapshot` descriptions now tell the
  agent to retry those transient failures until the delete succeeds or the
  resource is gone.

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
