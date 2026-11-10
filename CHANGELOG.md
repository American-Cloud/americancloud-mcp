# Changelog

All notable changes to the American Cloud MCP server are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See [`VERSIONING.md`](./VERSIONING.md) for how MCP versions relate to the SDK and API.

## [Unreleased]

### Added

- A hosted entry point: MCP over Streamable HTTP with OAuth sign-in, for
  Claude, Claude Code and other clients that support remote servers. The
  npm package stays the local stdio server.
- The local server accepts an API token in `AMERICANCLOUD_API_TOKEN` and
  sends it as `Authorization: Bearer`. The legacy pair
  (`AMERICANCLOUD_API_CLIENT_ID` and `AMERICANCLOUD_API_CLIENT_SECRET`) still
  works. Set one or the other, not both.
- `get_server_info` reports the kind of credential in use.

### Changed

- Hosted server: the log holds the issuer's description on every token
  exchange failure, for example the reason the sign-in service refuses a token.
- The server instructions have a section "Inside a VM". No tool runs a
  command inside a VM. The text names the three paths: SSH from a client that
  has a shell, a cloud-init script in `create_vm`'s `userdata`, and a browser
  console from `create_vm_console`. An assistant without a shell can thus say
  so at once.
- The instructions and the `create_vm` description say to set up an SSH key
  before `create_vm`. A client with a shell registers the host's own public
  key with `create_ssh_key`, and asks before it runs `ssh-keygen`. A client
  without a shell asks the user for a public key, and generates a pair only
  on request, because the private key then stays in the chat. The text also
  says to open port 22 with `networkAccess`, and that the public IP comes
  from `list_public_ips_by_isolated_network`, not from `get_vm`. The `get_vm`
  description says the same.
- Hosted server: the permission error says that a user whose own role lacks
  the permission needs an account admin first. Connected apps cannot grant
  more than the role of the user.
- Hosted server: a permission refusal reads the grant again only when the
  cached permissions hold the refused permission. A cache that agrees with
  the refusal stays, so a model that retries a write tool does not force one
  token exchange for each try.
- Hosted server: `get_server_info` says that its permissions can be up to 5
  minutes old, and that the API decides at call time.
- Hosted server: the log cuts the JSON-RPC method to 64 characters and writes
  "unknown" for a tool name that is not in the tool table.
- Hosted server: `MCP_ISSUER_URL` must use https, except on a loopback host.
- The stdio `get_server_info` reads `AMERICANCLOUD_API_URL` as the client
  does: a blank value means the default.
- `npm test` builds first, so the smoke test runs the current source.
- The npm package ships the stdio server only: `dist/index.js` and its map.
  The hosted entry `dist/http.js` is built from source into the hosted image
  and is not in the package.
- The server sends each API request one time. The SDK no longer sends a
  request again after a 408, 429 or 5xx answer. A repeated create request
  could make a second billable resource. After a failed create, check with
  the matching `list_*` or `get_*` tool before you try again.
- `destructiveHint` is `true` on every write tool that changes or removes
  something that exists, for example `update_*`, `replace_network_acl_list`,
  `stop_database`, `power_vm`, `detach_block_storage_volume` and
  `scale_vm`. Only the tools that add something new (most `create_*` tools,
  `reserve_public_ip`, `attach_block_storage_volume`,
  `assign_vms_to_load_balancer`, `trigger_database_backup`) keep `false`.
  `create_dns_record` is `true`, because it replaces the record set of a
  single-value type. The `⚠️ DESTRUCTIVE` description prefix is unchanged: it
  still marks only the tools that cause irreversible loss.
- Hosted server: `get_database_backup_repo` needs the manage permission for
  databases, because with `include_credentials` its answer holds the S3 keys
  of the backup repository. A Read-only connection gets a permission error
  from this tool.
- Hosted server: a tool call stops after 50 seconds and returns a tool error.
- The local server registers the five tools that return a secret only with
  `--allow-writes`: `get_kubernetes_cluster_config`,
  `get_object_storage_keys`, `list_object_storage_access_keys`,
  `get_database_connection` and `get_database_backup_repo`. The API needs the
  manage permission for these tools. The tools stay read-only
  (`readOnlyHint: true`). The read-only default now has 5 fewer tools.

### Fixed

- Hosted server: when the session behind the user's token is gone (the app
  was disconnected in Connected apps, a sign-out everywhere, a disabled
  user), the server answers 401 with the sign-in challenge. Before, it
  answered "The service is not available now" for the rest of the token
  life, and each retry ran one more exchange.
- Hosted server: the default `MCP_MAX_TOKEN_LIFE_S` is 300, equal to the
  life of a sign-in access token and to the block after a disconnect.
- Hosted server: only the "no account yet" answer of the API maps to "sign
  in to the dashboard once". Any other 401 from the API is a configuration
  fault; the user gets the service error and the detail goes to the log.
- The smoke test accepts `AMERICANCLOUD_API_TOKEN` for its live pass. Before,
  it set a dummy key pair as well, and the server refused to start with two
  credentials.
- Hosted server: a refused account check now gets a clear answer, not "The
  service is not available now". A suspended account gets 403 with the API
  message. Another refused account gets 403 with a fixed message. A user
  with no account yet gets 403 with "Sign in to the dashboard once". A rate
  limit gets 429 with `Retry-After`.
- Hosted server: when the API refuses the connection on a tool call (401, or
  403 `connected_app_revoked`), the next request checks the connection again.
- Hosted server: every connection lists every tool. Before, the list held
  only the tools that the app's permissions allowed, and a client that had
  connected as Read-only kept that short list after the user chose Full
  access, because no client asks for `tools/list` again. Now the API checks
  the permissions on each call, and a refused call returns an error that
  names the missing permission and Connected apps. A permission change
  applies to the next call, with no reconnect. `get_server_info` reports
  the permissions from the last check, up to 5 minutes old.

### Security

- Hosted server: a sign-in token with a life longer than 5 minutes
  (`MCP_MAX_TOKEN_LIFE_S`, default 300) or with no `iat` is refused with 401.
- Hosted server: the configuration refuses an issuer URL with a final slash,
  a resource URL with a path other than `/mcp`, and the example client
  secret.

## [0.8.0] - 2026-10-29

### Added

- `create_kubernetes_cluster` and `get_cost_estimate_kubernetes` take
  `controlPackage` and `workerPackage`: a package for the control-plane nodes
  and another for the workers. `package` is now optional.
- `get_kubernetes_cluster` and `list_kubernetes_clusters` return
  `nodePool.control` and `nodePool.worker`. The cluster's `package` and
  `nodePool.cpuCores` / `memoryMb` describe the workers only, and are
  deprecated.

### Changed

- Built against `@americancloud/sdk` 1.7.2 (API platform 1.7.2).
- `workerNodes`, `minWorkers` and `maxWorkers` must be at least 1.
- An expired card on file makes billable create and change requests fail with
  `payment_method_expired`.
- The API checks the backup `cronExpression` (for example `0 3 * * *` or
  `@daily`) and `retentionPeriod` (for example `30d` or `1y6mo`).
- `zod` 3.25.76 → 4.6.7 and `@modelcontextprotocol/sdk` 1.29.0 → 1.32.1. Tool
  inputs validate as before; validation messages use new words.

### Security

- `zod` 4.6.7 fixes GHSA-mrhx-c7xc-m3w5 (memory use on a very large array
  input).
- The MCP SDK bump and a lock file refresh fix advisories in the SDK's HTTP
  transport and its dependencies. This server runs over stdio only, so they
  were not reachable.

## [0.7.0] - 2026-10-10

### Changed

- Built against `@americancloud/sdk` 1.6.0 (API platform 1.6.0).
- `get_kubernetes_cluster_config` needs a read-write API key. The API now
  requires manage access for the kubeconfig, because it grants full access to
  the cluster. The tool stays in the read-only tool set; with a read-only key
  the API answers 403. The README says so.
- The API protects the rules that a managed Kubernetes cluster depends on.
  `delete_firewall_rule`, `delete_port_forwarding_rule`,
  `delete_load_balancer_rule`, `update_load_balancer_rule`,
  `assign_vms_to_load_balancer`, `remove_vms_from_load_balancer`,
  `delete_network_acl_rule` and `replace_network_acl_list` are refused with
  `kubernetes_managed_rule` when the rule is one the cluster made on its
  address; `release_public_ip` with `kubernetes_cluster_address` when the IP is
  the cluster's; `change_source_nat_ip` with `kubernetes_source_nat` on the
  cluster's network. `scale_kubernetes_cluster` and
  `upgrade_kubernetes_cluster` are refused with `kubernetes_api_rule_missing`
  when the cluster's port 6443 rule is already gone. In every case nothing
  changes, and the message names the cluster.
- `get_vm` and `get_kubernetes_cluster` find a resource right after
  `create_vm` or `create_kubernetes_cluster` returns, with the status
  `CREATING` and the requested spec. Before, the read answered not found for a
  few seconds.
- `get_cost_estimate_object_storage` returns `metered`: the price of a GB stored
  for a month (`rate_per_gb_month`, before and after any discount) and the
  storage that the monthly minimum covers (`minimum_gb`).
- `create_object_storage_unit` accepts hyphens and underscores in the name:
  letters, digits, hyphens and underscores, up to 100 characters, starting and
  ending with a letter or digit. The names `anonymous` and `RGW` followed by 17
  digits are reserved. `create_object_storage_bucket` also refuses two dots
  together, a dot next to a hyphen, and a name in the form of an IP address.
  Each refusal names the rule.
- `attach_block_storage_volume` and `detach_block_storage_volume` are refused
  while the VM starts or stops, with a message that names the state.

## [0.6.0] - 2026-10-05

### Added

- `list_object_storage_access_keys`, `create_object_storage_access_key` and
  `delete_object_storage_access_key` — manage the S3 access keys of an object
  storage unit. A unit holds up to 10 keys, every key works at the same time,
  and a unit always keeps at least one key. Each key has a label that you set
  when you create it. `delete_object_storage_access_key` is destructive and needs
  `--allow-writes`, like `create_object_storage_access_key`.

### Changed

- Built against `@americancloud/sdk` 1.5.0 (API platform 1.5.0).
- `get_object_storage_keys` says that it returns the unit's original key (its
  oldest key) and points to `list_object_storage_access_keys` for every key.
- The object storage tools describe `storageUnitId` correctly: it is the
  `storageUnitId` from `list_object_storage_units`, for example `tenant$name`,
  not a UUID.

### Security

- Refreshed the transitive dependencies in the lock file, for example
  `@hono/node-server` 1.19.17.

## [0.5.1] - 2026-09-30

### Changed

- The server instructions now state that the default SSH login user on Linux
  VMs is `cloud`, and show the command form
  (`ssh -i <private-key-file> cloud@<public-ip>`). An agent connects as `cloud`
  unless you name a different user. Before this, an agent tried `root`, was
  refused, and then tried other default user names. `get_vm`,
  `create_ssh_key`, the `create_vm` `keypairs` argument, and the Kubernetes
  cluster `keypair` argument say the same. For a Kubernetes cluster, the
  instructions also give the node SSH port: 2222 for the first node on the
  cluster's public IP, and one port higher for each next node.
- `reset_vm_password` now says that it resets the password of the VM's login
  user, `cloud` on Linux images. It no longer says "root/administrator". The
  instructions also say that a VM password belongs to `cloud`.

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
