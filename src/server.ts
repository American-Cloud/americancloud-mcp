import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  AmericancloudApiError,
  AmericancloudApiTimeoutError,
  type AmericancloudApiClient,
} from "@americancloud/sdk";
import { createRequire } from "node:module";
import { ALL_TOOLS } from "./manifest.js";
import type { Group, ToolDef } from "./tooldef.js";
import type { LocalCredential } from "./client.js";
import { log } from "./logger.js";
import { TOOL_PERMISSIONS } from "./hosted/permissions.js";

const pkg = createRequire(import.meta.url)("../package.json") as {
  version: string;
  dependencies: Record<string, string>;
};
export const VERSION: string = pkg.version;
/**
 * The commit that the hosted image was built from. The image build sets it.
 * The package version stays the same between publishes, so this is what
 * tells two deployments apart.
 */
export const BUILD_SHA: string = process.env["MCP_BUILD_SHA"]?.trim() || "unknown";
const SDK_VERSION: string = pkg.dependencies["@americancloud/sdk"] ?? "unknown";

/**
 * Where a tool handler gets its SDK client.
 *
 * - "fixed": one client for the life of the process (stdio). The client holds
 *   the API key of the user.
 * - "request": the HTTP handler makes a new client for each request and puts it
 *   in `AuthInfo.extra.client`. The handler reads it from the request context.
 *   A prepared server thus holds no credential, and one tool table serves
 *   every user.
 */
export type ClientSource =
  | { kind: "fixed"; client: AmericancloudApiClient }
  | { kind: "request" };

/** The options for the local server (stdio). */
export interface StdioServerOptions {
  mode: "stdio";
  clientSource: ClientSource;
  /** The kind of credential that the server sends. get_server_info shows it. */
  credential: LocalCredential;
  /** Enabled service groups, or "all". */
  services: Set<Group> | "all";
  /** Register only read-only tools (pairs well with a read-only token). */
  readOnly: boolean;
}

/**
 * The options for the hosted server (HTTP, OAuth). It registers every tool:
 * the API checks the permissions of the connected app on each call.
 */
export interface HostedServerOptions {
  mode: "hosted";
  clientSource: ClientSource;
}

export type ServerOptions = StdioServerOptions | HostedServerOptions;

/**
 * The request context that the hosted HTTP handler puts in
 * `AuthInfo.extra`. The handler writes `tool` and `outcome` into `report`, so
 * that the request log line can show them.
 */
export interface HostedRequestContext {
  client: AmericancloudApiClient;
  azp: string;
  sub: string;
  requestId: string;
  app: { clientId: string; displayName: string };
  /** The effective permissions, sorted. get_server_info shows them. */
  permissions: readonly string[];
  report: { tool?: string; outcome?: string };
  /**
   * Remove the cached grant of this token A. A tool handler calls it when the
   * API refuses token B, so the next request gets a new grant, and `get_server_info`
   * agrees with the connected-app row.
   */
  evictGrant(): void;
}

const DESTRUCTIVE_PREFIX = "⚠️ DESTRUCTIVE — ";

/**
 * The text that the local server and the hosted server share: discovery, cost
 * preview, async polling, and the VM login. The default SSH user is stated
 * here because a model guesses root when no text says otherwise. A root login
 * with a password fails, because the VM password belongs to cloud. The text
 * does not forbid root, because a key login as root works and a user can
 * choose it.
 */
const INSTRUCTIONS_INTRO =
  "American Cloud infrastructure management — one tool per API operation across compute, storage, networking, Kubernetes, databases, WordPress, and DNS.";

const INSTRUCTIONS_DISCOVERY = `- Discover before creating: list_* tools (e.g. list_regions, list_images, list_vm_packages) return the labels and IDs that create_* tools require.
- Preview cost before provisioning: each get_cost_estimate_* takes the same arguments as its create_* tool and charges nothing.
- Resources often provision asynchronously — poll the matching get_* tool until the status settles.`;

const INSTRUCTIONS_VM = `Connecting to a VM:
- The default SSH login user on Linux images is cloud: ssh -i <private-key-file> cloud@<public-ip>. Connect as cloud unless the user names a different user, for example root.
- Set up an SSH key before create_vm, and pass its name in create_vm's keypairs argument. Key login needs no VM password. Use a key from list_ssh_keys, or register a public key with create_ssh_key.
- If you have a shell, register the host's own public key (for example ~/.ssh/id_ed25519.pub) with create_ssh_key, so the host logs in with the key it already has. Ask the user before you run ssh-keygen. If you have no shell, ask the user for a public key and register it. Let create_ssh_key generate a pair only when the user asks for one, and say that the private key then stays in this chat.
- Open port 22 when you create the VM: set create_vm's networkAccess.inboundPorts to [{port: 22, protocol: "TCP"}], with sourceCidr set to the user's address when you know it. On an existing network, check that its public IP has a port forwarding rule and a firewall rule for port 22; create_port_forwarding_rule and create_firewall_rule add them.
- The ipAddress of get_vm is the private address on the VM's network. The public IP comes from list_public_ips_by_isolated_network or list_public_ips_by_vpc for the network of the VM.
- Kubernetes cluster nodes also use the cloud user, with the key from create_kubernetes_cluster's keypair argument. Node SSH is on the cluster's public IP at port 2222 for the first node, 2223 for the next, and so on: ssh -p 2222 cloud@<public-ip>.
- A VM password (from create_vm or reset_vm_password) belongs to the cloud user.
- If SSH is unavailable, open a browser console with create_vm_console.

Inside a VM:
- No tool runs a command inside a VM. The tools manage the account: they create, change, power, resize and delete resources. They do not run software on them.
- If you have a shell, use it: find the public IP as above, then ssh cloud@<public-ip> and run the command yourself.
- If you have no shell, say so, and offer the alternatives: a cloud-init script in create_vm's userdata argument configures a new VM on first boot, and create_vm_console gives the user a browser console for a running VM.`;

const INSTRUCTIONS_DESTRUCTIVE =
  "Tools whose description starts with ⚠️ DESTRUCTIVE cause irreversible loss — confirm with the user before calling them.";

/**
 * Server-level guidance returned in the MCP `initialize` result, so a client or
 * model orients without trial and error: the read-only posture, the
 * discover → cost-estimate → create flow, and the convention that list_* outputs
 * feed create_* inputs. Kept user-facing — it ships in the published package.
 */
const SERVER_INSTRUCTIONS = `${INSTRUCTIONS_INTRO}

Getting started:
- Call get_server_info to see the version, enabled service groups, and whether the server is read-only.
${INSTRUCTIONS_DISCOVERY}

${INSTRUCTIONS_VM}

Safety: read-only by default. Create/modify/delete tools, and the tools that return a secret (access keys, database passwords, kubeconfig), appear only when the server is started with --allow-writes; if they're missing and the user wants to make changes or read a secret, they must restart with that flag. ${INSTRUCTIONS_DESTRUCTIVE}`;

/**
 * The guidance for the hosted server. It does not refer to a start flag: the
 * permissions that the user set for the app decide which calls succeed.
 */
const HOSTED_INSTRUCTIONS = `${INSTRUCTIONS_INTRO}

Getting started:
- Call get_server_info to see the version, the connected app, and the permissions that this connection has. The permissions can be up to 5 minutes old; the API decides at call time.
${INSTRUCTIONS_DISCOVERY}

${INSTRUCTIONS_VM}

Permissions: every tool is listed. A call that the user's permissions for this app do not allow returns an error that names the missing permission. The user can change the permissions for this app in Connected apps in the American Cloud dashboard; the change applies to the next call, with no reconnect. ${INSTRUCTIONS_DESTRUCTIVE}`;

/**
 * The `_meta` that the hosted server adds to each tool. It tells a client that
 * the tool needs an OAuth token with the `mcp` scope.
 */
const HOSTED_TOOL_META = { securitySchemes: [{ type: "oauth2", scopes: ["mcp"] }] };

export function buildServer(opts: ServerOptions): McpServer {
  if (opts.mode === "hosted") return buildHostedServer(opts);

  const { clientSource, credential, services, readOnly } = opts;
  const server = new McpServer(
    { name: "americancloud", version: VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  const enabled = ALL_TOOLS.filter((t) => {
    if (services !== "all" && !services.has(t.group)) return false;
    // A tool that returns a secret needs the API manage permission. The
    // read-only default thus does not register it, as for a write tool.
    if (readOnly && (!t.readOnly || t.secret)) return false;
    return true;
  });

  // Built-in, always registered (also guarantees the SDK installs its
  // tools/list handler — it only does so on the first registerTool call, so a
  // zero-tool server would answer "Method not found" to tools/list).
  registerServerInfo(server, { credential, services, readOnly, toolCount: enabled.length });

  for (const tool of enabled) {
    registerOne(server, clientSource, tool);
  }

  log(
    `registered ${enabled.length + 1} tools ` +
      `(services=${services === "all" ? "all" : [...services].join(",")}, readOnly=${readOnly})`,
  );
  return server;
}

/**
 * Build the hosted server. Registration keeps the order of `ALL_TOOLS`, so
 * `tools/list` is deterministic. This function writes no log line: the hosted
 * server builds a server for each request.
 */
function buildHostedServer(opts: HostedServerOptions): McpServer {
  const server = new McpServer(
    { name: "americancloud", version: VERSION },
    { instructions: HOSTED_INSTRUCTIONS },
  );
  registerHostedServerInfo(server, { toolCount: ALL_TOOLS.length });
  for (const tool of ALL_TOOLS) {
    registerOne(server, opts.clientSource, tool, HOSTED_TOOL_META);
  }
  return server;
}

function registerServerInfo(
  server: McpServer,
  opts: {
    credential: LocalCredential;
    services: Set<Group> | "all";
    readOnly: boolean;
    toolCount: number;
  },
): void {
  server.registerTool(
    "get_server_info",
    {
      title: "Get server info",
      description:
        "Describe this American Cloud MCP server: version, pinned SDK version, API endpoint, the kind of credential in use, enabled service groups, and whether it is running in read-only mode. Useful to confirm configuration before managing resources.",
      inputSchema: {},
      annotations: {
        title: "Get server info",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false, // answers locally; no API call
      },
    },
    async (): Promise<CallToolResult> => {
      const info = {
        server: "@americancloud/mcp",
        version: VERSION,
        sdkVersion: SDK_VERSION,
        // The same reading as makeClient: a blank value means the default.
        apiBaseUrl: process.env["AMERICANCLOUD_API_URL"]?.trim() || "https://api.americancloud.com",
        credential: opts.credential,
        enabledGroups: opts.services === "all" ? "all" : [...opts.services],
        readOnly: opts.readOnly,
        registeredTools: opts.toolCount + 1,
      };
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    },
  );
}

function registerHostedServerInfo(server: McpServer, opts: { toolCount: number }): void {
  server.registerTool(
    "get_server_info",
    {
      title: "Get server info",
      description:
        "Describe this American Cloud MCP server: version, pinned SDK version, the connected app, and the permissions that this connection has. The permissions are from the last check, up to 5 minutes old. The API decides at call time, so a call can succeed after a permission change before this answer shows it.",
      inputSchema: {},
      annotations: {
        title: "Get server info",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false, // answers locally; no API call
      },
      _meta: HOSTED_TOOL_META,
    },
    async (_args, extra): Promise<CallToolResult> => {
      const ctx = requestContext(extra);
      if (ctx) ctx.report.tool = "get_server_info";
      const info = {
        server: "@americancloud/mcp",
        mode: "hosted",
        version: VERSION,
        build: BUILD_SHA,
        sdkVersion: SDK_VERSION,
        app: ctx?.app ?? null,
        permissions: ctx?.permissions ?? [],
        registeredTools: opts.toolCount + 1,
      };
      if (ctx) ctx.report.outcome = "ok";
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    },
  );
}

/** The hosted request context from the handler extra, or undefined (stdio). */
function requestContext(extra: { authInfo?: AuthInfo }): HostedRequestContext | undefined {
  const ctx = extra.authInfo?.extra as Partial<HostedRequestContext> | undefined;
  return ctx && ctx.report && ctx.client ? (ctx as HostedRequestContext) : undefined;
}

/**
 * Get the SDK client for one call. A "request" source with no client in the
 * context is a wiring defect. The handler then returns a tool error.
 */
function resolveClient(
  source: ClientSource,
  extra: { authInfo?: AuthInfo },
): AmericancloudApiClient {
  if (source.kind === "fixed") return source.client;
  const ctx = requestContext(extra);
  if (!ctx) throw new Error("no API client in the request context");
  return ctx.client;
}

function registerOne(
  server: McpServer,
  source: ClientSource,
  tool: ToolDef,
  meta?: Record<string, unknown>,
): void {
  const description = tool.destructive ? DESTRUCTIVE_PREFIX + tool.description : tool.description;

  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description,
      inputSchema: tool.inputSchema,
      annotations: {
        // The same text as the top-level title. Some clients and directories
        // read the title from the annotations only.
        title: tool.title,
        readOnlyHint: tool.readOnly,
        // MCP defines destructiveHint false as "only additive updates". A
        // write that changes or removes a thing that exists is true, also
        // when the change is reversible. `destructive` (the description
        // prefix) means irreversible loss, which is a narrower thing.
        destructiveHint: !tool.readOnly && !tool.additive,
        idempotentHint: tool.idempotent ?? false,
        // Every tool calls the live American Cloud API — an external system.
        openWorldHint: true,
      },
      ...(meta ? { _meta: meta } : {}),
    },
    async (args: Record<string, unknown>, extra): Promise<CallToolResult> => {
      const report = source.kind === "request" ? requestContext(extra)?.report : undefined;
      if (report) report.tool = tool.name;
      try {
        const client = resolveClient(source, extra);
        const data = await (
          tool.run as (c: AmericancloudApiClient, a: unknown) => Promise<unknown>
        )(client, args);
        const text =
          data === undefined
            ? `${tool.name} succeeded (no content returned).`
            : JSON.stringify(data, null, 2);
        if (report) report.outcome = "ok";
        return { content: [{ type: "text", text }] };
      } catch (err) {
        if (report) report.outcome = "tool_error";
        if (source.kind === "request") {
          const ctx = requestContext(extra);
          if (grantRefused(err)) ctx?.evictGrant();
          if (ctx && permissionRefused(err)) {
            // Evict only when the cache disagrees with the refusal: the row
            // changed after the grant was read. A cache that already agrees
            // gains nothing from a new grant, and a model that retries write
            // tools in a loop must not force one exchange for each try.
            if (cacheHolds(ctx.permissions, TOOL_PERMISSIONS[tool.sdkRef])) ctx.evictGrant();
            return permissionResult(tool, ctx.app.displayName);
          }
        }
        return toErrorResult(tool.name, err);
      }
    },
  );
}

/**
 * True when the API refused the call because the connected app does not have
 * the permission: the bare 403 of the role check, with no code and the default
 * message. Every other 403 of the API carries its own message or a code.
 */
/**
 * True when the cached permissions hold `required`, or its `:manage` pair for
 * a `:read` requirement. Without a known requirement the answer is true, so
 * the cache is read again.
 */
function cacheHolds(permissions: readonly string[], required: string | undefined): boolean {
  if (!required) return true;
  if (permissions.includes(required)) return true;
  return required.endsWith(":read") && permissions.includes(required.replace(/:read$/, ":manage"));
}

function permissionRefused(err: unknown): boolean {
  if (!(err instanceof AmericancloudApiError) || err.statusCode !== 403) return false;
  const body = err.body as { code?: unknown; message?: unknown } | undefined;
  return body?.code === undefined && body?.message === "Forbidden";
}

/**
 * The tool error for a permission refusal. It names the permission and the
 * place to grant it, so the agent can tell the user what to do. The change
 * applies to the next call: the API reads the row on each request.
 */
function permissionResult(tool: ToolDef, appName: string): CallToolResult {
  const required = TOOL_PERMISSIONS[tool.sdkRef] ?? "a permission this tool needs";
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `${tool.name}: ${appName} does not have the ${required} permission in this American Cloud account. ` +
          "The user can grant it in Connected apps in the American Cloud dashboard, if their own account role has that permission; if not, an account admin must give them the role first. " +
          "The change applies to the next call, with no reconnect.",
      },
    ],
  };
}

/**
 * True when the API refused the grant itself: a 401 (token B is not valid
 * now) or a 403 with the code `connected_app_revoked`. The hosted server then
 * removes the cached grant.
 */
function grantRefused(err: unknown): boolean {
  if (!(err instanceof AmericancloudApiError)) return false;
  if (err.statusCode === 401) return true;
  const code = (err.body as { code?: unknown } | undefined)?.code;
  return err.statusCode === 403 && code === "connected_app_revoked";
}

/**
 * The text for a request that got no answer in time. The server can have
 * completed the operation after the client stopped waiting, so a blind retry
 * of a create makes the resource twice. The agent must look first.
 */
const NO_ANSWER_IN_TIME =
  "The request got no answer in time. The operation can still have completed on the server. " +
  "List or get the resource before you try again, so that you do not create it twice.";

export function toErrorResult(toolName: string, err: unknown): CallToolResult {
  if (err instanceof AmericancloudApiTimeoutError) {
    return { isError: true, content: [{ type: "text", text: `${toolName}: ${NO_ANSWER_IN_TIME}` }] };
  }
  if (err instanceof AmericancloudApiError) {
    const body = err.body as
      | {
          statusCode?: number;
          message?: string | string[];
          code?: string;
          snapshots?: { id?: string; name?: string }[];
        }
      | undefined;
    const status = err.statusCode ?? body?.statusCode;
    const msg = Array.isArray(body?.message)
      ? body.message.join("; ")
      : (body?.message ?? err.message);
    // `code` is the machine-readable reason. Give it to the agent, because it
    // separates causes that share a status: a 409 that means "still being set
    // up, retry" from one that means "being deleted, stop". The message text
    // can be reworded at any time, so it is the wrong thing to branch on.
    const code = typeof body?.code === "string" && body.code ? ` [${body.code}]` : "";
    // A delete refused because snapshots exist names them. Passing them through
    // saves the agent a second call to work out what to remove. Every field
    // here arrives over the network, and this function runs inside the tool's
    // catch block, so it must not throw on a shape it did not expect.
    const blocking = (Array.isArray(body?.snapshots) ? body.snapshots : [])
      .map((s) => {
        const name = typeof s?.name === "string" ? s.name.trim() : "";
        const id = typeof s?.id === "string" ? s.id.trim() : "";
        if (name && id) return `${name} (${id})`;
        return id || name;
      })
      .filter((entry) => entry.length > 0);
    const snapshotNote = blocking.length ? ` Blocking snapshots: ${blocking.join(", ")}.` : "";
    // 504: a gateway in front of the API stopped waiting. Same advice as a
    // client-side timeout.
    const suffix = status === 504 ? `${snapshotNote} ${NO_ANSWER_IN_TIME}` : snapshotNote;
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `American Cloud API error${status ? ` (${status})` : ""}${code}: ${msg}${suffix}`,
        },
      ],
    };
  }
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `${toolName} failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    ],
  };
}
