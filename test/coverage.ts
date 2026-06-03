/**
 * Coverage gate.
 *
 * For every SDK namespace the manifest claims (COVERED_NAMESPACES), every
 * public client method must be EITHER a ToolDef (via its sdkRef) OR an entry
 * in NOT_EXPOSED with a reason. This turns SDK growth into a failing test
 * instead of a silent coverage gap, and is the drift detector when the
 * @americancloud/sdk pin is bumped.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AmericancloudApiClient } from "@americancloud/sdk";
import { ALL_TOOLS, NOT_EXPOSED, COVERED_NAMESPACES } from "../src/manifest.js";

// Infrastructure members of every generated namespace client — not API calls.
const IGNORED_MEMBERS = new Set(["constructor", "withRawResponse"]);

function publicMethodsOf(obj: object): string[] {
  const proto = Object.getPrototypeOf(obj) as object;
  return Object.getOwnPropertyNames(proto).filter((name) => {
    if (IGNORED_MEMBERS.has(name) || name.startsWith("_")) return false;
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (desc?.get) return false; // accessor, not an API method
    return typeof (obj as Record<string, unknown>)[name] === "function";
  });
}

test("every covered SDK method is a tool or NOT_EXPOSED", () => {
  const client = new AmericancloudApiClient({
    apiKey: "coverage-dummy",
    apiClientSecret: "coverage-dummy",
  });

  const toolRefs = new Set(ALL_TOOLS.map((t) => t.sdkRef));
  const notExposedRefs = new Set(Object.keys(NOT_EXPOSED));
  const problems: string[] = [];

  for (const ns of COVERED_NAMESPACES) {
    const nsClient = (client as unknown as Record<string, object>)[ns];
    assert.ok(nsClient, `SDK client has namespace "${ns}"`);
    for (const method of publicMethodsOf(nsClient)) {
      const ref = `${ns}.${method}`;
      if (!toolRefs.has(ref) && !notExposedRefs.has(ref)) {
        problems.push(`uncovered SDK method: ${ref} (add a ToolDef or a NOT_EXPOSED entry)`);
      }
    }
  }

  // Reverse direction: every sdkRef / NOT_EXPOSED key must resolve to a real
  // method — catches renames/removals on SDK bumps and typos in defs.
  for (const ref of [...toolRefs, ...notExposedRefs]) {
    const [ns, method] = ref.split(".");
    const nsClient = (client as unknown as Record<string, Record<string, unknown>>)[ns!];
    if (!nsClient || typeof nsClient[method!] !== "function") {
      problems.push(`dangling reference: ${ref} does not exist on the SDK client`);
    }
  }

  assert.deepEqual(problems, [], `coverage problems:\n${problems.join("\n")}`);
});

test("tool names are unique and well-formed", () => {
  const seen = new Set<string>();
  for (const t of ALL_TOOLS) {
    assert.match(t.name, /^[a-z][a-z0-9_]*$/, `${t.name} is snake_case`);
    assert.ok(!seen.has(t.name), `duplicate tool name: ${t.name}`);
    seen.add(t.name);
    assert.ok(t.description.length >= 30, `${t.name} description is substantial`);
    assert.ok(
      !t.description.includes("DESTRUCTIVE"),
      `${t.name}: destructive prefix is added automatically — remove it from the description`,
    );
  }
});
