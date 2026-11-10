/**
 * The permission map of the hosted server. Each tool must have an entry, and
 * the entry must agree with the kind of the tool: a read-only tool needs a
 * ":read" permission and a tool that changes something needs ":manage".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_TOOLS } from "../src/manifest.js";
import { TOOL_PERMISSIONS } from "../src/hosted/permissions.js";

/**
 * Read-only tools for which the API asks for the ":manage" permission,
 * because the answer holds a credential. The hosted server follows the API.
 * The `secret` flag of the tool definition makes this list.
 */
const READS_THAT_NEED_MANAGE = new Set(ALL_TOOLS.filter((t) => t.secret).map((t) => t.sdkRef));

test("every tool has a permission entry, and no entry is stale", () => {
  const refs = new Set(ALL_TOOLS.map((t) => t.sdkRef));
  for (const ref of refs) assert.ok(TOOL_PERMISSIONS[ref], `${ref} has a permission`);
  for (const ref of Object.keys(TOOL_PERMISSIONS)) assert.ok(refs.has(ref), `${ref} is a tool`);
});

test("each permission has the form cmp:<service>:<read|manage>", () => {
  for (const [ref, perm] of Object.entries(TOOL_PERMISSIONS)) {
    assert.match(perm, /^cmp:[a-z]+:(read|manage)$/, ref);
  }
});

test("read-only tools need :read, other tools need :manage", () => {
  for (const t of ALL_TOOLS) {
    const perm = TOOL_PERMISSIONS[t.sdkRef]!;
    if (READS_THAT_NEED_MANAGE.has(t.sdkRef)) {
      assert.ok(t.readOnly, `${t.sdkRef} is in the exception list, so it must be read-only`);
      assert.ok(perm.endsWith(":manage"), `${t.sdkRef} needs :manage`);
    } else if (t.readOnly) {
      assert.ok(perm.endsWith(":read"), `${t.name} is read-only, so it needs :read (has ${perm})`);
    } else {
      assert.ok(perm.endsWith(":manage"), `${t.name} changes something, so it needs :manage (has ${perm})`);
    }
  }
});
