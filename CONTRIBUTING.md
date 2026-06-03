# Contributing

Thanks for your interest in the American Cloud MCP server.

## This server is generated from our API

The tool surface is maintained in lockstep with the
[American Cloud SDK](https://www.npmjs.com/package/@americancloud/sdk) and the
American Cloud API. Tool definitions and the pinned SDK version are produced by
our internal generation process, so **pull requests that add or change tools
can't be merged directly** — the change has to happen upstream in the API/SDK.

What helps most:

- **Found a missing or wrong tool, a confusing description, or a bad argument
  schema?** [Open an issue](../../issues) describing what you expected. Most of
  these trace back to the API or its OpenAPI spec, and fixing them there flows
  into the next release of the server and all SDKs.
- **Docs, README, and packaging fixes** are welcome as PRs.

## Versioning & compatibility

The server pins one exact `@americancloud/sdk` version, which states the API
surface it targets — see [`VERSIONING.md`](./VERSIONING.md).

## Reporting security issues

Email security@americancloud.com rather than opening a public issue.
