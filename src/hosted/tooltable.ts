import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ListToolsRequestSchema,
  type JSONRPCMessage,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { buildServer } from "../server.js";

/**
 * The one tool table of the hosted server: the `tools/list` answer with the
 * JSON schemas already converted.
 *
 * Every connection lists every tool. The API checks the permissions of the
 * connected app on each call, so a change in Connected apps applies to the
 * next call. A list that followed the permissions would need the client to
 * ask for `tools/list` again, and no client does that on its own.
 */
export interface PreparedTable {
  listResult: ListToolsResult;
}

let prepared: Promise<PreparedTable> | undefined;

/**
 * Get the tool table. The first call prepares it; a failed preparation does
 * not stay, so the next call tries again.
 */
export function hostedTable(): Promise<PreparedTable> {
  if (!prepared) {
    const pending = prepare();
    pending.catch(() => {
      if (prepared === pending) prepared = undefined;
    });
    prepared = pending;
  }
  return prepared;
}

/** The hosted McpServer. `prepare` and `serverFor` must build the same server. */
function buildHostedServer(): McpServer {
  return buildServer({ mode: "hosted", clientSource: { kind: "request" } });
}

/**
 * Build the McpServer for one request. The MCP SDK lets one server instance
 * connect to one transport at a time, and a stateless transport serves one
 * request, so each HTTP request gets a new McpServer. That step only stores
 * the tool definitions (well under a millisecond). The expensive step, the
 * conversion of the tool schemas for `tools/list`, ran one time in `prepare`.
 */
export function serverFor(table: PreparedTable): McpServer {
  const server = buildHostedServer();
  // Answer tools/list from the prepared result. The tool set of this server
  // is the same as the set that made the result.
  server.server.setRequestHandler(ListToolsRequestSchema, () => table.listResult);
  return server;
}

/**
 * Make the table: build the server one time and ask it for tools/list over an
 * in-memory transport. The answer is thus exactly what the SDK produces.
 */
async function prepare(): Promise<PreparedTable> {
  const server = buildHostedServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverSide);
    const answer = new Promise<JSONRPCMessage>((resolve) => {
      clientSide.onmessage = resolve;
    });
    await clientSide.start();
    await clientSide.send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const message = (await answer) as { result?: ListToolsResult; error?: { message?: string } };
    if (!message.result) {
      throw new Error(`tools/list failed: ${message.error?.message ?? "no result"}`);
    }
    return { listResult: message.result };
  } finally {
    await server.close();
  }
}
