/**
 * The local server sends exactly one credential. These tests build the SDK
 * client from a given environment with a stub fetch, and check the
 * credential headers that reach the API and the retry count.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { makeClient } from "../src/client.js";

/** A fetch that records the headers of the first call and answers an empty list. */
function captureFetch(): { fetch: typeof fetch; headers: () => Map<string, string> } {
  let captured: Map<string, string> | undefined;
  const stub: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    captured = new Map();
    headers.forEach((value, key) => captured!.set(key, value));
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return {
    fetch: stub,
    headers: () => {
      assert.ok(captured, "the client called fetch");
      return captured;
    },
  };
}

const BASE = { AMERICANCLOUD_API_URL: "https://api.example.test" };

describe("local credential", () => {
  test("an API token goes in Authorization and nothing else", async () => {
    const stub = captureFetch();
    const { client, credential } = makeClient(
      { ...BASE, AMERICANCLOUD_API_TOKEN: "amcld_test_token" },
      stub.fetch,
    );
    assert.equal(credential, "api-token");
    await client.regions.listRegions();
    // Check the credential headers only. The SDK can add other headers in a
    // later version, and that is not a defect.
    const headers = stub.headers();
    assert.equal(headers.get("authorization"), "Bearer amcld_test_token");
    assert.equal(headers.has("x-api-client-id"), false);
    assert.equal(headers.has("x-api-client-secret"), false);
  });

  test("a legacy API key goes in the two X-API-Client headers and nothing else", async () => {
    const stub = captureFetch();
    const { client, credential } = makeClient(
      {
        ...BASE,
        AMERICANCLOUD_API_CLIENT_ID: "legacy-id",
        AMERICANCLOUD_API_CLIENT_SECRET: "legacy-secret",
      },
      stub.fetch,
    );
    assert.equal(credential, "legacy-api-key");
    await client.regions.listRegions();
    const headers = stub.headers();
    assert.equal(headers.get("x-api-client-id"), "legacy-id");
    assert.equal(headers.get("x-api-client-secret"), "legacy-secret");
    assert.equal(headers.has("authorization"), false);
  });

  for (const [name, env] of [
    ["an API token", { AMERICANCLOUD_API_TOKEN: "amcld_test_token" }],
    [
      "a legacy API key",
      { AMERICANCLOUD_API_CLIENT_ID: "legacy-id", AMERICANCLOUD_API_CLIENT_SECRET: "legacy-secret" },
    ],
  ] as const) {
    test(`${name}: the client does not send a request again after a 503`, async () => {
      // The SDK default sends a request again after a 5xx. A second POST can
      // make a second billable resource, so the server turns that off.
      let calls = 0;
      const fail: typeof fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ statusCode: 503, message: "busy" }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Retry-After": "0" },
        });
      };
      const { client } = makeClient({ ...BASE, ...env }, fail);
      await assert.rejects(() => client.regions.listRegions());
      assert.equal(calls, 1, "one request, no retry");
    });
  }

  test("a blank token counts as unset", () => {
    const { credential } = makeClient({
      ...BASE,
      AMERICANCLOUD_API_TOKEN: "  ",
      AMERICANCLOUD_API_CLIENT_ID: "legacy-id",
      AMERICANCLOUD_API_CLIENT_SECRET: "legacy-secret",
    });
    assert.equal(credential, "legacy-api-key");
  });

  test("a token and a pair together refuse to start", () => {
    assert.throws(
      () =>
        makeClient({
          ...BASE,
          AMERICANCLOUD_API_TOKEN: "amcld_test_token",
          AMERICANCLOUD_API_CLIENT_ID: "legacy-id",
          AMERICANCLOUD_API_CLIENT_SECRET: "legacy-secret",
        }),
      /not both/,
    );
  });

  test("no credential names the token page", () => {
    assert.throws(() => makeClient({ ...BASE }), /console\.americancloud\.com\/api-tokens/);
  });

  test("half a pair is no credential", () => {
    assert.throws(
      () => makeClient({ ...BASE, AMERICANCLOUD_API_CLIENT_ID: "legacy-id" }),
      /Missing credential/,
    );
  });
});
