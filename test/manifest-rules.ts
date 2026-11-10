/**
 * Rules for each tool in the manifest, and for the annotations that the
 * server registers from it. A client uses the annotations to decide when to
 * ask the user before a call. The MCP default for a tool that is not
 * read-only is "destructive", so the server must always state the value.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { AmericancloudApiClient } from "@americancloud/sdk";
import { ALL_TOOLS } from "../src/manifest.js";
import { buildServer, type ServerOptions } from "../src/server.js";

test("every tool has a title and a name of 64 characters or fewer", () => {
  for (const t of ALL_TOOLS) {
    assert.ok(t.title.trim().length > 0, `${t.name} has a title`);
    assert.ok(t.name.length <= 64, `${t.name} is 64 characters or fewer`);
  }
});

test("a read-only tool is never marked destructive", () => {
  for (const t of ALL_TOOLS) {
    if (t.readOnly) assert.notEqual(t.destructive, true, `${t.name}`);
  }
});

/**
 * The tools whose answer holds a secret. The API needs the manage permission
 * for each of them. Change this list only together with the API guards.
 */
const SECRET_TOOLS = [
  "get_kubernetes_cluster_config",
  "get_object_storage_keys",
  "list_object_storage_access_keys",
  "get_database_connection",
  "get_database_backup_repo",
];

test("only the known secret tools have the secret flag, and each is read-only", () => {
  const flagged = ALL_TOOLS.filter((t) => t.secret).map((t) => t.name);
  assert.deepEqual(new Set(flagged), new Set(SECRET_TOOLS));
  for (const t of ALL_TOOLS) {
    if (t.secret) assert.equal(t.readOnly, true, `${t.name} has the secret flag, so it is read-only`);
  }
});

async function listTools(opts: ServerOptions): Promise<Tool[]> {
  const server = buildServer(opts);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const answer = new Promise<{ result: { tools: Tool[] } }>((resolve) => {
    clientSide.onmessage = (m) => resolve(m as unknown as { result: { tools: Tool[] } });
  });
  await clientSide.start();
  await clientSide.send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const { result } = await answer;
  await server.close();
  return result.tools;
}

test("every registered tool states readOnlyHint, and destructiveHint when it writes", async () => {
  const client = new AmericancloudApiClient({ token: "rules-dummy" });
  const builds: ServerOptions[] = [
    {
      mode: "stdio",
      clientSource: { kind: "fixed", client },
      credential: "api-token",
      services: "all",
      readOnly: false,
    },
    { mode: "hosted", clientSource: { kind: "request" } },
  ];
  for (const opts of builds) {
    const tools = await listTools(opts);
    assert.equal(tools.length, ALL_TOOLS.length + 1, `${opts.mode}: all tools and get_server_info`);
    for (const t of tools) {
      assert.ok(t.title, `${opts.mode}: ${t.name} has a title`);
      assert.equal(typeof t.annotations?.readOnlyHint, "boolean", `${opts.mode}: ${t.name} readOnlyHint`);
      if (t.annotations?.readOnlyHint === false) {
        assert.equal(
          typeof t.annotations?.destructiveHint,
          "boolean",
          `${opts.mode}: ${t.name} destructiveHint`,
        );
      }
    }
  }
});

test("stdio: a secret tool registers only with --allow-writes, and keeps readOnlyHint true", async () => {
  const client = new AmericancloudApiClient({ token: "rules-dummy" });
  const base = {
    mode: "stdio",
    clientSource: { kind: "fixed", client },
    credential: "api-token",
    services: "all",
  } as const;
  const readOnlyNames = new Set((await listTools({ ...base, readOnly: true })).map((t) => t.name));
  const writeTools = await listTools({ ...base, readOnly: false });
  const secrets = ALL_TOOLS.filter((t) => t.secret);
  assert.ok(secrets.length > 0, "the manifest has secret tools");
  for (const def of secrets) {
    assert.equal(readOnlyNames.has(def.name), false, `${def.name} is absent in the read-only default`);
    const listed = writeTools.find((t) => t.name === def.name);
    assert.ok(listed, `${def.name} is present with --allow-writes`);
    assert.equal(listed.annotations?.readOnlyHint, true, `${def.name} keeps readOnlyHint true`);
  }
  // The read-only default shows every other read-only tool.
  const expected = new Set([
    "get_server_info",
    ...ALL_TOOLS.filter((t) => t.readOnly && !t.secret).map((t) => t.name),
  ]);
  assert.deepEqual(readOnlyNames, expected, "the read-only default shows the read tools that hold no secret");
});

/**
 * MCP 2025-11-25 defines `destructiveHint: false` as "only additive updates".
 * A write tool that changes or removes a thing that exists must therefore say
 * true. These name prefixes always change or remove a thing.
 */
const CHANGING_PREFIXES = [
  "update_",
  "replace_",
  "modify_",
  "stop_",
  "start_",
  "power_",
  "detach_",
  "remove_",
  "disable_",
  "reset_",
  "scale_",
  "resize_",
  "upgrade_",
  "change_",
  "set_",
  "delete_",
  "cancel_",
  "revert_",
  "reinstall_",
  "restart_",
  "release_",
];

/** An additive tool makes a new thing or a new link. Its name starts with one of these. */
const ADDITIVE_PREFIXES = ["create_", "reserve_", "assign_", "attach_", "trigger_"];

test("destructiveHint is true for each write tool that is not additive, and the names agree", async () => {
  const client = new AmericancloudApiClient({ token: "rules-dummy" });
  const tools = await listTools({
    mode: "stdio",
    clientSource: { kind: "fixed", client },
    credential: "api-token",
    services: "all",
    readOnly: false,
  });
  const byName = new Map(ALL_TOOLS.map((t) => [t.name, t]));
  for (const t of tools) {
    const def = byName.get(t.name);
    if (!def) continue; // get_server_info
    const hint = t.annotations?.destructiveHint;
    if (def.readOnly) {
      assert.equal(hint, false, `${t.name} is read-only, so destructiveHint is false`);
      assert.notEqual(def.additive, true, `${t.name} is read-only, so it is not additive`);
      continue;
    }
    assert.equal(hint, def.additive !== true, `${t.name}: destructiveHint follows the additive flag`);
    if (CHANGING_PREFIXES.some((p) => t.name.startsWith(p))) {
      assert.equal(hint, true, `${t.name} changes or removes a thing, so destructiveHint is true`);
    }
    if (def.additive) {
      assert.ok(
        ADDITIVE_PREFIXES.some((p) => t.name.startsWith(p)),
        `${t.name} is additive, so its name starts with ${ADDITIVE_PREFIXES.join(", ")}`,
      );
      assert.notEqual(def.destructive, true, `${t.name} is additive, so it is not destructive`);
    }
  }
});
