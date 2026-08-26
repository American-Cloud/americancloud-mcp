/**
 * Error-formatting tests. toErrorResult runs inside every tool's catch block,
 * so it must never throw, whatever shape the API sends. It also carries two
 * fields the agent acts on: the machine-readable `code`, and the snapshots
 * that block a delete.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { AmericancloudApiError } from "@americancloud/sdk";
import { toErrorResult } from "../src/server.js";

const text = (err: unknown) => {
  const r = toErrorResult("some_tool", err);
  assert.equal(r.isError, true);
  return (r.content as { type: string; text: string }[]).map((c) => c.text).join(" ");
};

const apiError = (statusCode: number, body: unknown) =>
  new AmericancloudApiError({ message: "request failed", statusCode, body });

test("includes the machine-readable code", () => {
  const out = text(apiError(409, { statusCode: 409, message: "Still provisioning.", code: "provisioning_in_progress" }));
  assert.match(out, /\(409\) \[provisioning_in_progress\]: Still provisioning\./);
});

test("omits the code when the API does not send one", () => {
  const out = text(apiError(404, { statusCode: 404, message: "Not found." }));
  assert.equal(out.includes("["), false);
  assert.match(out, /\(404\): Not found\./);
});

test("names the snapshots that block a delete", () => {
  const out = text(
    apiError(409, {
      statusCode: 409,
      message: "The disk has snapshots.",
      code: "volume_has_snapshots",
      snapshots: [
        { id: "id-1", name: "nightly" },
        { id: "id-2", name: "before-upgrade" },
      ],
    }),
  );
  assert.match(out, /Blocking snapshots: nightly \(id-1\), before-upgrade \(id-2\)\./);
});

test("falls back to the id when a snapshot has no usable name", () => {
  const out = text(
    apiError(409, {
      statusCode: 409,
      message: "The disk has snapshots.",
      snapshots: [{ id: "id-1", name: "   " }, { id: "id-2" }],
    }),
  );
  assert.match(out, /Blocking snapshots: id-1, id-2\./);
});

test("joins a message the API sends as an array", () => {
  const out = text(apiError(400, { statusCode: 400, message: ["name is required", "region is required"] }));
  assert.match(out, /name is required; region is required/);
});

test("does not throw on shapes the API should never send", () => {
  const shapes: unknown[] = [
    { statusCode: 409, message: "x", snapshots: "not-an-array" },
    { statusCode: 409, message: "x", snapshots: [null, undefined] },
    { statusCode: 409, message: "x", snapshots: [{ id: 7, name: {} }] },
    { statusCode: 409, message: "x", code: 42 },
    {},
    undefined,
  ];
  for (const body of shapes) {
    const out = text(apiError(409, body));
    assert.equal(typeof out, "string");
    assert.equal(out.includes("Blocking snapshots"), false);
  }
});

test("a non-API error still returns a readable result", () => {
  assert.match(text(new Error("socket hang up")), /some_tool failed: socket hang up/);
});
