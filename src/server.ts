import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AmericancloudApiError, type AmericancloudApiClient } from "@americancloud/sdk";
import { createRequire } from "node:module";
import { ALL_TOOLS } from "./manifest.js";
import type { Group, ToolDef } from "./tooldef.js";
import { log } from "./logger.js";

const pkg = createRequire(import.meta.url)("../package.json") as {
  version: string;
  dependencies: Record<string, string>;
};
export const VERSION: string = pkg.version;
const SDK_VERSION: string = pkg.dependencies["@americancloud/sdk"] ?? "unknown";

export interface ServerOptions {
  client: AmericancloudApiClient;
  /** Enabled service groups, or "all". */
  services: Set<Group> | "all";
  /** Register only read-only tools (pairs well with a read-only API key). */
  readOnly: boolean;
}

const DESTRUCTIVE_PREFIX = "⚠️ DESTRUCTIVE — ";

/**
 * Server-level guidance returned in the MCP `initialize` result, so a client or
 * model orients without trial and error: the read-only posture, the
 * discover → cost-estimate → create flow, and the convention that list_* outputs
 * feed create_* inputs. Kept user-facing — it ships in the published package.
 */
const SERVER_INSTRUCTIONS = `American Cloud infrastructure management — one tool per API operation across compute, storage, networking, Kubernetes, databases, WordPress, and DNS.

Getting started:
- Call get_server_info to see the version, enabled service groups, and whether the server is read-only.
- Discover before creating: list_* tools (e.g. list_regions, list_images, list_vm_packages) return the labels and IDs that create_* tools require.
- Preview cost before provisioning: each get_cost_estimate_* takes the same arguments as its create_* tool and charges nothing.
- Resources often provision asynchronously — poll the matching get_* tool until the status settles.

Safety: read-only by default. Create/modify/delete tools appear only when the server is started with --allow-writes; if they're missing and the user wants to make changes, they must restart with that flag. Tools whose description starts with ⚠️ DESTRUCTIVE cause irreversible loss — confirm with the user before calling them.`;

export function buildServer({ client, services, readOnly }: ServerOptions): McpServer {
  const server = new McpServer(
    { name: "americancloud", version: VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  const enabled = ALL_TOOLS.filter((t) => {
    if (services !== "all" && !services.has(t.group)) return false;
    if (readOnly && !t.readOnly) return false;
    return true;
  });

  // Built-in, always registered (also guarantees the SDK installs its
  // tools/list handler — it only does so on the first registerTool call, so a
  // zero-tool server would answer "Method not found" to tools/list).
  registerServerInfo(server, { services, readOnly, toolCount: enabled.length });

  for (const tool of enabled) {
    registerOne(server, client, tool);
  }

  log(
    `registered ${enabled.length + 1} tools ` +
      `(services=${services === "all" ? "all" : [...services].join(",")}, readOnly=${readOnly})`,
  );
  return server;
}

function registerServerInfo(
  server: McpServer,
  opts: { services: Set<Group> | "all"; readOnly: boolean; toolCount: number },
): void {
  server.registerTool(
    "get_server_info",
    {
      title: "Get server info",
      description:
        "Describe this American Cloud MCP server: version, pinned SDK version, API endpoint, enabled service groups, and whether it is running in read-only mode. Useful to confirm configuration before managing resources.",
      inputSchema: {},
      annotations: {
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
        apiBaseUrl: process.env["AMERICANCLOUD_API_URL"] ?? "https://api.americancloud.com",
        enabledGroups: opts.services === "all" ? "all" : [...opts.services],
        readOnly: opts.readOnly,
        registeredTools: opts.toolCount + 1,
      };
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    },
  );
}

function registerOne(server: McpServer, client: AmericancloudApiClient, tool: ToolDef): void {
  const description = tool.destructive ? DESTRUCTIVE_PREFIX + tool.description : tool.description;

  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description,
      inputSchema: tool.inputSchema,
      annotations: {
        readOnlyHint: tool.readOnly,
        destructiveHint: tool.destructive ?? false,
        idempotentHint: tool.idempotent ?? false,
        // Every tool calls the live American Cloud API — an external system.
        openWorldHint: true,
      },
    },
    async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const data = await (
          tool.run as (c: AmericancloudApiClient, a: unknown) => Promise<unknown>
        )(client, args);
        const text =
          data === undefined
            ? `${tool.name} succeeded (no content returned).`
            : JSON.stringify(data, null, 2);
        return { content: [{ type: "text", text }] };
      } catch (err) {
        return toErrorResult(tool.name, err);
      }
    },
  );
}

/**
 * Map any error to an MCP tool error result. A tool failure must NEVER crash
 * the server — the agent gets a readable error and can adjust.
 */
function toErrorResult(toolName: string, err: unknown): CallToolResult {
  if (err instanceof AmericancloudApiError) {
    const body = err.body as { statusCode?: number; message?: string | string[] } | undefined;
    const status = err.statusCode ?? body?.statusCode;
    const msg = Array.isArray(body?.message)
      ? body.message.join("; ")
      : (body?.message ?? err.message);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `American Cloud API error${status ? ` (${status})` : ""}: ${msg}`,
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
