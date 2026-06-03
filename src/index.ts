import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GROUPS, DEFAULT_GROUPS, type Group } from "./tooldef.js";
import { makeClient } from "./client.js";
import { buildServer, VERSION } from "./server.js";
import { log } from "./logger.js";

const HELP = `americancloud-mcp v${VERSION}
MCP (Model Context Protocol) server for American Cloud — runs locally over stdio.

Usage: npx @americancloud/mcp [options]

Options:
  --services <csv|all>  Service groups to enable. Default: ${DEFAULT_GROUPS.join(",")}
                        Available: ${GROUPS.join(", ")} (or "all")
  --allow-writes        Enable tools that create/modify/delete resources.
                        OMITTED BY DEFAULT — the server is read-only unless you
                        pass this. Pair with a read-write API key.
  --version             Print version and exit
  --help                Show this help

Environment:
  AMERICANCLOUD_API_CLIENT_ID      API client ID (required)
  AMERICANCLOUD_API_CLIENT_SECRET  API client secret (required)
  AMERICANCLOUD_API_URL            Optional API base URL override

Create API keys at https://console.americancloud.com/api-keys
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      services: { type: "string" },
      "allow-writes": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
      version: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    process.stderr.write(HELP);
    return;
  }
  if (values.version) {
    process.stderr.write(`${VERSION}\n`);
    return;
  }

  let services: Set<Group> | "all";
  if (!values.services) {
    services = new Set(DEFAULT_GROUPS);
  } else if (values.services.trim() === "all") {
    services = "all";
  } else {
    const requested = values.services
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = requested.filter((s) => !(GROUPS as readonly string[]).includes(s));
    if (invalid.length > 0) {
      log(`unknown service(s): ${invalid.join(", ")}. Valid: ${GROUPS.join(", ")}, all`);
      process.exit(2);
    }
    services = new Set(requested as Group[]);
  }

  const client = makeClient();
  // Read-only by default — the server controls billable infrastructure and is
  // driven by an LLM, so mutations require an explicit opt-in.
  const server = buildServer({ client, services, readOnly: !values["allow-writes"] });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`americancloud-mcp v${VERSION} ready on stdio`);
}

main().catch((err) => {
  log(`fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});
