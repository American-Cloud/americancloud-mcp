/**
 * Smoke test: spawns the BUILT server (dist/index.js) over stdio with the MCP
 * client and verifies the protocol handshake, tool listing, and filters.
 *
 * - Without real credentials (CI default): handshake + listing + filter
 *   assertions run against dummy keys (the server only touches the API when a
 *   tool is called).
 * - With AMERICANCLOUD_API_CLIENT_ID/SECRET set (and optionally
 *   AMERICANCLOUD_API_URL pointing at staging): also exercises read-only
 *   tool calls against the live API.
 *
 * Run: npm run build && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ALL_TOOLS } from "../src/manifest.js";
import { GROUPS } from "../src/tooldef.js";

const HAVE_CREDS = Boolean(
  process.env.AMERICANCLOUD_API_CLIENT_ID && process.env.AMERICANCLOUD_API_CLIENT_SECRET,
);

function spawnServer(extraArgs: string[] = []): { client: Client; connect: () => Promise<void> } {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js", ...extraArgs],
    env: {
      ...(process.env as Record<string, string>),
      AMERICANCLOUD_API_CLIENT_ID: process.env.AMERICANCLOUD_API_CLIENT_ID ?? "smoke-dummy-id",
      AMERICANCLOUD_API_CLIENT_SECRET:
        process.env.AMERICANCLOUD_API_CLIENT_SECRET ?? "smoke-dummy-secret",
    },
  });
  const client = new Client({ name: "smoke", version: "0.0.0" });
  return { client, connect: () => client.connect(transport) };
}

test("handshake + default tool list", async () => {
  const { client, connect } = spawnServer();
  await connect();
  const { tools } = await client.listTools();
  assert.ok(Array.isArray(tools), "listTools returns a tool array");
  assert.ok(
    tools.some((t) => t.name === "get_server_info"),
    "built-in get_server_info is always registered",
  );
  // Every registered tool carries explicit annotations; every SDK-backed tool
  // is openWorld (the built-in info tool answers locally).
  for (const t of tools) {
    assert.ok(t.annotations, `${t.name} has annotations`);
    const expectOpenWorld = t.name !== "get_server_info";
    assert.equal(t.annotations?.openWorldHint, expectOpenWorld, `${t.name} openWorldHint`);
  }
  await client.close();
});

test("read-only by default (no --allow-writes) registers only read tools", async () => {
  const { client, connect } = spawnServer(); // no flags — default posture
  await connect();
  const { tools } = await client.listTools();
  for (const t of tools) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} must be read-only by default`);
  }
  await client.close();
});

test("--allow-writes enables mutating tools", async () => {
  const { client, connect } = spawnServer(["--allow-writes"]);
  await connect();
  const { tools } = await client.listTools();
  assert.ok(
    tools.some((t) => t.annotations?.readOnlyHint === false),
    "write tools appear only with --allow-writes",
  );
  await client.close();
});

test("--services <group> --allow-writes filters to exactly that group", async () => {
  // For every group, the served tools must equal that group's tools (by the
  // manifest's `group` field, the source of truth) plus the built-in. Not a
  // name regex — this stays correct as groups and names evolve. --allow-writes
  // so the full group (incl. write tools) is registered. Groups are
  // independent, so spawn their servers concurrently.
  await Promise.all(
    GROUPS.map(async (group) => {
      const { client, connect } = spawnServer(["--services", group, "--allow-writes"]);
      await connect();
      const { tools } = await client.listTools();
      const expected = new Set([
        "get_server_info",
        ...ALL_TOOLS.filter((t) => t.group === group).map((t) => t.name),
      ]);
      const actual = new Set(tools.map((t) => t.name));
      assert.deepEqual(actual, expected, `served tools match the ${group} group exactly`);
      await client.close();
    }),
  );
});

test("--services all --allow-writes registers every tool", async () => {
  const { client, connect } = spawnServer(["--services", "all", "--allow-writes"]);
  await connect();
  const { tools } = await client.listTools();
  assert.equal(tools.length, ALL_TOOLS.length + 1, "all tools + the built-in are registered");
  await client.close();
});

test("live read-only calls against the API", { skip: !HAVE_CREDS }, async () => {
  const { client, connect } = spawnServer(); // default read-only
  await connect();

  const regions = await client.callTool({ name: "list_regions", arguments: {} });
  assert.notEqual(regions.isError, true, "list_regions succeeds");

  const vms = await client.callTool({ name: "list_vms", arguments: { pageSize: 5 } });
  assert.notEqual(vms.isError, true, "list_vms succeeds");

  const images = await client.callTool({ name: "list_images", arguments: {} });
  assert.notEqual(images.isError, true, "list_images succeeds");

  await client.close();
});
