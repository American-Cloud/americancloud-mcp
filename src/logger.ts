/**
 * stderr-only logger.
 *
 * HARD RULE: stdout belongs exclusively to the JSON-RPC protocol stream.
 * Anything written to stdout corrupts MCP framing and kills the connection.
 * Never use console.log anywhere in this codebase.
 */
export function log(msg: string): void {
  process.stderr.write(`[americancloud-mcp] ${msg}\n`);
}
