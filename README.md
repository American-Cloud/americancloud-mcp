# American Cloud MCP Server

Manage [American Cloud](https://americancloud.com) infrastructure from Claude,
Cursor, and any other [MCP](https://modelcontextprotocol.io) client.

Runs **locally on your machine** over stdio — your API token never leaves your
environment, and no hosted middleman sits between your AI assistant and your
cloud. Prefer a sign-in with no install? Use the hosted server at
`https://mcp.americancloud.com/mcp`: see the
[guides](https://americancloud.com/docs/mcp/overview).

![Claude Code auditing American Cloud infrastructure over the MCP server with a read-only key](https://raw.githubusercontent.com/American-Cloud/americancloud-mcp/master/.demo/mcp-audit.gif)

## Quick start

Add to your MCP client configuration (Claude Desktop, Claude Code, Cursor, …):

```json
{
  "mcpServers": {
    "americancloud": {
      "command": "npx",
      "args": ["-y", "@americancloud/mcp"],
      "env": {
        "AMERICANCLOUD_API_TOKEN": "amcld_…"
      }
    }
  }
}
```

Create and manage API tokens at
**[console.americancloud.com/api-tokens](https://console.americancloud.com/api-tokens)**.
A legacy API key (client ID and secret) still works: set
`AMERICANCLOUD_API_CLIENT_ID` and `AMERICANCLOUD_API_CLIENT_SECRET` instead of the token.

**The server is read-only by default** — see [Safety](#safety) before enabling
resource management.

## Service groups

By default the core infrastructure groups are enabled: **compute, storage,
networking, kubernetes**. Scope or extend with `--services`:

```sh
npx @americancloud/mcp --services all
npx @americancloud/mcp --services compute,dns
```

| Group | Tools | Covers |
|---|---|---|
| `compute` *(default)* | 25 | VMs, packages, images, regions, SSH keys |
| `storage` *(default)* | 27 | block storage, snapshots, object storage and its access keys |
| `networking` *(default)* | 57 | isolated/VPC networks, VPC tiers, public IPs, firewall, port forwarding, load balancers, egress, ACLs |
| `kubernetes` *(default)* | 11 | managed Kubernetes clusters |
| `databases` | 36 | managed MySQL/PostgreSQL/Redis, backups, infrastructure, offerings |
| `wordpress` | 16 | managed WordPress |
| `dns` | 7 | hosted DNS zones and records |

Scoping with `--services` keeps the tool list small for context-sensitive
clients.

## Safety

This server lets an AI assistant manage **real infrastructure with real
billing**. It's designed to be safe by default:

- **Read-only by default.** Out of the box, only read tools (list/get/cost
  estimates) are registered — an assistant can explore and inspect but cannot
  create, modify, or delete anything. To enable management tools, add
  `"--allow-writes"` to `args`.
- **Secrets need `--allow-writes` too.** Five read tools return a secret:
  `get_kubernetes_cluster_config` (the kubeconfig), `get_object_storage_keys`
  and `list_object_storage_access_keys` (S3 keys), `get_database_connection`
  (the password, with `includePassword`) and `get_database_backup_repo` (S3
  keys, with `include_credentials`). They don't change anything, but the
  API requires the manage permission for them, so the read-only default
  doesn't register them. They appear with `--allow-writes`.
- **Use the narrowest token.** For inspection, create a token with the
  **Read-only** preset — then resource mutation and secret reads are
  impossible regardless of any flag, because the token itself can't perform
  them. Only use a token with **Full access** together with `--allow-writes`
  when you actually want the assistant to make changes or read a secret.
- **Changes are flagged.** Every write tool that changes or removes something
  that already exists (update, replace, stop, detach, resize, delete, and so
  on) is marked destructive, so MCP clients that support confirmations will
  prompt before running it. Only tools that add something new are not.
  Tools that cause irreversible loss (delete, release, reinstall, revert,
  cancel) also start their description with ⚠️ DESTRUCTIVE.
- **No automatic retries.** The server sends each API request once. If a
  create call fails with a server error, check with the matching list or get
  tool before you try again, so you do not create the resource twice.

```jsonc
// management-enabled (Full access token + opt-in flag):
"args": ["-y", "@americancloud/mcp", "--allow-writes"]
```

With writes enabled, the assistant can provision and deploy — and it still shows
you the cost and waits for approval before creating anything:

![Claude Code provisioning a server and deploying to it over the MCP server with --allow-writes — cost shown first, writes run through you](https://raw.githubusercontent.com/American-Cloud/americancloud-mcp/master/.demo/mcp-provision.gif)

## Inside a VM

The tools manage your account: they create, change, power, resize and delete
resources. No tool runs a command inside a VM, and the server stores no key
or password for your machines. In-VM work takes one of these paths:

- **A client with a shell** (Claude Code, Codex, Cursor) gets the public IP
  from `get_vm` and runs `ssh cloud@<public-ip>` itself, with your own key.
  Before the first VM it registers the host's own public key with
  `create_ssh_key` and passes it to `create_vm`, so it logs in with the key
  it already has.
- **A new VM** can configure itself on first boot with a cloud-init script in
  `create_vm`'s `userdata` argument.
- **A running VM** without SSH gets a browser console from
  `create_vm_console`, for you to use.

A chat client without a shell (Claude.ai, ChatGPT, Grok) can do the second
and third, not the first. The server tells the assistant this in its
instructions, so it says so instead of guessing.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `AMERICANCLOUD_API_TOKEN` | one credential | API token (`Authorization: Bearer amcld_…`). Create one at [console.americancloud.com/api-tokens](https://console.americancloud.com/api-tokens). |
| `AMERICANCLOUD_API_CLIENT_ID` | legacy | Legacy API key: client ID (`X-API-Client-ID`). Use with the secret, instead of the token. |
| `AMERICANCLOUD_API_CLIENT_SECRET` | legacy | Legacy API key: client secret (`X-API-Client-Secret`) |
| `AMERICANCLOUD_API_URL` | no | API base URL override |

## Guides

Full documentation on the American Cloud docs site:

- [MCP server overview](https://americancloud.com/docs/mcp/overview) — setup, safety, and service groups
- Client setup: [Claude Code](https://americancloud.com/docs/mcp/claude-code) · [Claude.ai and Claude Desktop](https://americancloud.com/docs/mcp/claude-desktop) · [ChatGPT](https://americancloud.com/docs/mcp/chatgpt) · [Grok](https://americancloud.com/docs/mcp/grok) · [Cursor](https://americancloud.com/docs/mcp/cursor) · [Codex](https://americancloud.com/docs/mcp/codex) · [other clients](https://americancloud.com/docs/mcp/other-clients)
- [Things to try](https://americancloud.com/docs/mcp/use-cases) — prompt ideas across compute, storage, networking, and DNS
- [Deploy with AI](https://americancloud.com/docs/deploy-with-ai/overview) — migration playbooks and deployment recipes built on this server

## Versioning

See [`VERSIONING.md`](./VERSIONING.md) — the server versions independently;
the exact-pinned `@americancloud/sdk` dependency states the API surface it
targets.

## Contributing

This server is generated and maintained in lockstep with the American Cloud
SDK and API — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to report
issues or propose changes.

## License

Apache-2.0 — see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).
