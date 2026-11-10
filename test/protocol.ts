/**
 * Protocol pin. The server is built for one revision of the MCP protocol. A
 * bump of the MCP SDK that moves the latest revision fails here, so that a
 * person reads the change log of the new revision before the bump ships.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

test("the MCP SDK speaks protocol revision 2025-11-25", () => {
  assert.equal(LATEST_PROTOCOL_VERSION, "2025-11-25");
});
