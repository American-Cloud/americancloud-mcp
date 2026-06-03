# Security Policy

## Reporting a vulnerability

Please report security issues privately to **security@americancloud.com**
rather than opening a public issue or pull request. We'll acknowledge receipt
and keep you updated on the fix.

## How this server handles credentials

- Your API key (`AMERICANCLOUD_API_CLIENT_ID` / `AMERICANCLOUD_API_CLIENT_SECRET`)
  is read **only** from the environment at startup and passed to the American
  Cloud API over HTTPS. It is never written to disk, never logged (all
  diagnostics go to stderr; request arguments and headers are not logged), and
  never leaves your machine except in API requests.
- The server runs **locally** over stdio — there is no American Cloud-hosted
  component in the path between your AI client and your account.

## Safe operation

- The server is **read-only by default**; resource-mutating tools require the
  explicit `--allow-writes` flag.
- For inspection-only use, provision a **read-only API key** — mutations are
  then impossible regardless of any flag.
- Destructive tools are annotated so MCP clients can prompt for confirmation.

See [README.md](./README.md#safety) for details.
