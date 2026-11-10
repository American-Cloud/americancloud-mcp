/**
 * Tests of the hosted (OAuth) server. All offline: a stub HTTP server plays
 * the issuer (key set and token exchange) and the API (whoami and two tool
 * routes). The hosted server runs in this process on an ephemeral port.
 */
import { randomUUID } from "node:crypto";
import { after, before, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ALL_TOOLS } from "../src/manifest.js";
import { createHostedApp, type HostedApp } from "../src/hosted/app.js";
import { createGrantSource } from "../src/hosted/exchange.js";
import { loadConfig } from "../src/hosted/config.js";
import type { JsonLogger } from "../src/hosted/log.js";
import { HOSTED_API_TIMEOUT_S, makeDelegatedClient } from "../src/hosted/client.js";
import { SlidingWindowLimiter } from "../src/hosted/ratelimit.js";
import { ExpiringCache } from "../src/hosted/cache.js";

const RESOURCE = "https://mcp.example.test/mcp";
const AUDIENCE = "api-audience-test";
const CLIENT_SECRET = "stub-dummy-secret";
const PERMISSIONS = ["cmp:virtualmachines:read", "cmp:dns:manage"];
const REVOKED_APP = "revoked-app";
const REVOKED_MESSAGE =
  "This app was disconnected in Connected apps. To use it again, connect it again in a few minutes.";

/** whoami refusals, keyed by the app (azp) of token A. */
const WHOAMI_REFUSALS: Record<
  string,
  { status: number; body: Record<string, unknown>; headers?: Record<string, string> }
> = {
  [REVOKED_APP]: {
    status: 403,
    body: { statusCode: 403, error: "Forbidden", code: "connected_app_revoked", message: REVOKED_MESSAGE },
  },
  "suspended-app": {
    status: 403,
    body: {
      statusCode: 403,
      code: "account_suspended",
      message: "Your account is suspended. Please settle your outstanding balance to restore service.",
    },
  },
  "disabled-app": {
    status: 403,
    body: { statusCode: 403, message: "Internal detail: account row 42 is disabled." },
  },
  "no-account-app": {
    status: 401,
    body: { statusCode: 401, code: "no_account", message: "Account not found for authenticated user" },
  },
  "misconfigured-app": {
    status: 401,
    body: { statusCode: 401, message: "Unauthorized" },
  },
  "busy-app": {
    status: 429,
    body: { statusCode: 429, message: "ThrottlerException: Too Many Requests" },
    headers: { "Retry-After": "17" },
  },
  "broken-app": { status: 500, body: { statusCode: 500, message: "Internal server error" } },
};

/** VM IDs for which the stub API refuses token B. */
const VM_REVOKED = "11111111-1111-1111-1111-111111111111";
const VM_UNAUTHORIZED = "22222222-2222-2222-2222-222222222222";
const VM_FORBIDDEN = "33333333-3333-3333-3333-333333333333";
/** A VM of another account: a 403 with its own message, not a role refusal. */
const VM_OTHER_ACCOUNT = "44444444-4444-4444-4444-444444444444";
const OTHER_ACCOUNT_MESSAGE = "You do not have access to this virtual machine.";

/** What the stub saw. */
const seen = {
  exchanges: [] as URLSearchParams[],
  whoami: [] as IncomingMessage["headers"][],
  api: [] as { path: string; headers: IncomingMessage["headers"] }[],
};

let stub: Server;
let stubBase = "";
let issuer = "";
let privateKey: CryptoKey;
let publicJwk: JWK;
let hosted: HostedApp;
let base = "";
const logLines: string[] = [];
const issuedB: string[] = [];

const SILENT_LOGGER: JsonLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function stubHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? "/", "http://stub").pathname;
  if (path === "/realms/test/protocol/openid-connect/certs") {
    return sendJson(res, 200, { keys: [publicJwk] });
  }
  if (path === "/realms/test/protocol/openid-connect/token" && req.method === "POST") {
    const form = new URLSearchParams(await readBody(req));
    seen.exchanges.push(form);
    const sid = unverifiedClaims(form.get("subject_token") ?? "")["sid"];
    // Keycloak's answer when the session behind token A is gone (a revoke, a
    // sign-out everywhere, a disabled user). The test marks such a token with
    // the claim `sid: "dead"`.
    if (sid === "dead") {
      return sendJson(res, 400, { error: "invalid_request", error_description: "Invalid token" });
    }
    if (sid === "odd-request") {
      return sendJson(res, 400, { error: "invalid_request", error_description: "Missing parameter: subject_token_type" });
    }
    const tokenB = `stub-token-b-${seen.exchanges.length}`;
    issuedB.push(tokenB);
    return sendJson(res, 200, { access_token: tokenB, expires_in: 300, token_type: "Bearer" });
  }
  if (path === "/api/v1/whoami") {
    seen.whoami.push(req.headers);
    const azp = String(req.headers["x-delegated-client"] ?? "");
    const refusal = WHOAMI_REFUSALS[azp];
    if (refusal) return sendJson(res, refusal.status, refusal.body, refusal.headers);
    return sendJson(res, 200, {
      kind: "delegated",
      account: { id: "acc-1", name: "Test account" },
      // Out of order and with a duplicate: the server must sort and dedupe.
      // "full-app" also holds the VM manage permission, so a bare 403 on a
      // VM write disagrees with its cache.
      permissions:
        azp === "full-app"
          ? [...PERMISSIONS, "cmp:virtualmachines:manage"]
          : [...PERMISSIONS].reverse().concat(PERMISSIONS[0]!),
      app: { clientId: azp, displayName: "Test App" },
      user: { id: "user-1", email: "", firstName: "", lastName: "" },
    });
  }
  if (path.startsWith("/api/v1/compute/")) {
    seen.api.push({ path, headers: req.headers });
    if (path === "/api/v1/compute/regions") {
      return sendJson(res, 200, { data: [{ label: "test-region-1" }] });
    }
    if (path === `/api/v1/compute/vms/${VM_REVOKED}`) {
      return sendJson(res, 403, {
        statusCode: 403,
        code: "connected_app_revoked",
        message: REVOKED_MESSAGE,
      });
    }
    if (path === `/api/v1/compute/vms/${VM_UNAUTHORIZED}`) {
      return sendJson(res, 401, { statusCode: 401, message: "Unauthorized" });
    }
    // The role check of the API: the bare NestJS 403, no code.
    if (path === `/api/v1/compute/vms/${VM_FORBIDDEN}/power`) {
      return sendJson(res, 403, { statusCode: 403, message: "Forbidden" });
    }
    if (path === `/api/v1/compute/vms/${VM_OTHER_ACCOUNT}`) {
      return sendJson(res, 403, { statusCode: 403, message: OTHER_ACCOUNT_MESSAGE });
    }
    if (path.startsWith("/api/v1/compute/vms/")) {
      return sendJson(res, 404, { statusCode: 404, message: "Virtual machine not found." });
    }
  }
  sendJson(res, 404, { statusCode: 404, message: "stub: no route" });
}

async function signTokenA(
  claims: Record<string, unknown> = {},
  opts: { audience?: string | string[]; key?: CryptoKey; expiresIn?: string; noIat?: boolean } = {},
): Promise<string> {
  // A new jti for each token: two tokens signed in the same second must not
  // share a cache entry.
  const jwt = new SignJWT({ azp: "test-app", scope: "mcp", jti: randomUUID(), ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(opts.audience ?? [RESOURCE, "mcp-server"])
    .setExpirationTime(opts.expiresIn ?? "5m");
  if (!opts.noIat) jwt.setIssuedAt();
  if (claims["sub"] === undefined) jwt.setSubject("user-1");
  return jwt.sign(opts.key ?? privateKey);
}

/** The payload claims of a JWT, without a signature check. For the stub only. */
function unverifiedClaims(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mcpPost(
  token: string | undefined,
  body: unknown,
  query = "",
  to = base,
): Promise<Response> {
  return fetch(`${to}/mcp${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** The env of a hosted app that uses the stub as issuer and API. */
function hostedEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    MCP_ISSUER_URL: issuer,
    MCP_RESOURCE_URL: RESOURCE,
    MCP_CLIENT_SECRET: CLIENT_SECRET,
    MCP_TOKEN_AUDIENCE: AUDIENCE,
    MCP_PUBLIC_API_URL: stubBase,
    ...overrides,
  };
}

/** Start a hosted app on an ephemeral port. */
async function startApp(
  env: NodeJS.ProcessEnv,
  deps: Parameters<typeof createHostedApp>[1],
): Promise<{ app: HostedApp; base: string }> {
  const app = createHostedApp(loadConfig(env), deps);
  await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
  return { app, base: `http://127.0.0.1:${(app.server.address() as AddressInfo).port}` };
}

/** An MCP client connected to the shared hosted app with token A. */
async function connectClient(tokenA: string): Promise<Client> {
  const client = new Client({ name: "hosted-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${tokenA}` } },
  });
  await client.connect(transport);
  return client;
}

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "hosted-test", version: "0.0.0" },
  },
};

before(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" };

  stub = createServer((req, res) => void stubHandler(req, res));
  await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
  stubBase = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
  issuer = `${stubBase}/realms/test`;

  const record: JsonLogger["info"] = (event, fields) =>
    void logLines.push(JSON.stringify({ event, ...fields }));
  ({ app: hosted, base } = await startApp(hostedEnv({ MCP_PORT: "0" }), {
    logger: { debug: () => {}, info: record, warn: record, error: record },
  }));
});

after(async () => {
  await hosted.close();
  await new Promise<void>((r) => {
    stub.close(() => r());
    stub.closeAllConnections();
  });
});

describe("HTTP surface", () => {
  test("401 with the exact challenge when there is no token", async () => {
    const res = await mcpPost(undefined, INITIALIZE);
    assert.equal(res.status, 401);
    assert.equal(
      res.headers.get("www-authenticate"),
      'Bearer resource_metadata="https://mcp.example.test/.well-known/oauth-protected-resource/mcp", scope="mcp"',
    );
    const body = (await res.json()) as { error: string; message: string };
    assert.equal(body.error, "unauthorized");
    assert.equal(typeof body.message, "string");
  });

  test("401 for a token with a wrong audience, a wrong key, an expiry in the past, or no azp", async () => {
    const other = await generateKeyPair("RS256");
    const bad = [
      await signTokenA({}, { audience: "https://other.example.test/mcp" }),
      await signTokenA({}, { key: other.privateKey }),
      await signTokenA({}, { expiresIn: "-1m" }),
      await signTokenA({ azp: undefined }),
      "not-a-jwt",
    ];
    for (const token of bad) {
      const res = await mcpPost(token, INITIALIZE);
      assert.equal(res.status, 401);
      assert.ok(res.headers.get("www-authenticate")?.startsWith("Bearer resource_metadata="));
    }
  });

  test("401 with reason token_life for a token with a 24-hour life, or with no iat", async () => {
    for (const token of [
      await signTokenA({}, { expiresIn: "24h" }),
      await signTokenA({}, { noIat: true }),
    ]) {
      const before = logLines.length;
      const res = await mcpPost(token, INITIALIZE);
      assert.equal(res.status, 401);
      assert.ok(res.headers.get("www-authenticate")?.startsWith("Bearer resource_metadata="));
      await res.body?.cancel();
      const line = logLines.slice(before).find((l) => l.includes('"event":"request"'));
      assert.ok(line, "the request has a log line");
      assert.equal((JSON.parse(line) as { outcome: string }).outcome, "invalid_token");
    }
    const long = logLines.find((l) => l.includes('"reason":"token_life"'));
    assert.ok(long, "the 24-hour token is refused with reason token_life");
  });

  test("401 with the challenge when the issuer says the session behind token A is gone", async () => {
    // A revoke in Connected apps, a sign-out everywhere or a disabled user:
    // Keycloak refuses the exchange with 400 invalid_request "Invalid token".
    // The client must sign in again, so the answer is 401, not 502.
    const before = logLines.length;
    const res = await mcpPost(await signTokenA({ sid: "dead" }), INITIALIZE);
    assert.equal(res.status, 401);
    assert.ok(res.headers.get("www-authenticate")?.startsWith("Bearer resource_metadata="));
    await res.body?.cancel();
    const line = logLines.slice(before).find((l) => l.includes('"event":"request"'));
    assert.ok(line, "the request has a log line");
    const entry = JSON.parse(line) as { outcome: string; reason: string };
    assert.equal(entry.outcome, "invalid_token");
    assert.match(entry.reason, /^exchange: invalid_request Invalid token$/);
    assert.ok(!logLines.slice(before).some((l) => l.includes("grant.failed")), "not logged as a fault");
  });

  test("502 when the issuer refuses our own exchange request, with the issuer's description in the log", async () => {
    const before = logLines.length;
    const res = await mcpPost(await signTokenA({ sid: "odd-request" }), INITIALIZE);
    assert.equal(res.status, 502);
    assert.equal(res.headers.get("www-authenticate"), null, "no sign-in challenge");
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "upstream_error");
    const fault = logLines.slice(before).find((l) => l.includes('"event":"grant.failed"'));
    assert.ok(fault, "a fault is logged");
    assert.match(fault, /Missing parameter: subject_token_type/);
  });

  test("a token with a 5-minute life is accepted", async () => {
    const res = await mcpPost(await signTokenA({}, { expiresIn: "5m" }), INITIALIZE);
    assert.equal(res.status, 200);
    await res.body?.cancel();
  });

  test("400 for a token in the query string", async () => {
    const res = await mcpPost(undefined, INITIALIZE, "?access_token=abc");
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "invalid_request");
  });

  test("GET and DELETE on /mcp without a token answer 401 with the challenge", async () => {
    // A client that opens the stream with a GET first must get the challenge,
    // not a 405 (Grok stopped at the 405 on 2026-11-05).
    for (const method of ["GET", "DELETE"]) {
      const res = await fetch(`${base}/mcp`, { method });
      assert.equal(res.status, 401, method);
      assert.match(res.headers.get("www-authenticate") ?? "", /resource_metadata=/);
      await res.body?.cancel();
    }
  });

  test("GET and DELETE on /mcp with a token answer 405", async () => {
    const tokenA = await signTokenA();
    for (const method of ["GET", "DELETE"]) {
      const res = await fetch(`${base}/mcp`, {
        method,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.status, 405, method);
      assert.equal(res.headers.get("allow"), "POST");
      await res.body?.cancel();
    }
  });

  test("both protected-resource metadata documents", async () => {
    for (const path of [
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/oauth-protected-resource",
    ]) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, path);
      assert.equal(res.headers.get("cache-control"), "public, max-age=300");
      assert.deepEqual(await res.json(), {
        resource: RESOURCE,
        authorization_servers: [issuer],
        scopes_supported: ["mcp"],
        bearer_methods_supported: ["header"],
        resource_documentation: "https://americancloud.com/docs/mcp/overview",
      });
    }
  });

  test("/health answers ok", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  test("/ redirects a browser to the documentation", async () => {
    const res = await fetch(`${base}/`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://americancloud.com/docs/mcp/overview");
    const post = await fetch(`${base}/`, { method: "POST", redirect: "manual" });
    assert.equal(post.status, 405);
  });

  test("an unknown path answers 404 JSON", async () => {
    const res = await fetch(`${base}/nothing-here`);
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as { error: string }).error, "not_found");
  });
});

describe("OAuth session", () => {
  test("initialize, tools/list, and tool calls with one exchange", async () => {
    const tokenA = await signTokenA();
    const exchangesBefore = seen.exchanges.length;
    const client = await connectClient(tokenA);
    assert.equal(seen.exchanges.length, exchangesBefore + 1, "initialize made one exchange");

    const instructions = client.getInstructions() ?? "";
    assert.ok(!instructions.includes("--allow-writes"), "hosted instructions do not refer to the flag");
    assert.match(instructions, /Connected apps/);
    assert.match(instructions, /cloud@<public-ip>/);
    assert.match(instructions, /No tool runs a command inside a VM/);
    assert.match(instructions, /list_public_ips_by_isolated_network/);
    assert.match(instructions, /the private key then stays in this chat/);

    // The exchange request.
    const form = seen.exchanges[seen.exchanges.length - 1]!;
    assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:token-exchange");
    assert.equal(form.get("client_id"), "mcp-server");
    assert.equal(form.get("client_secret"), CLIENT_SECRET);
    assert.equal(form.get("subject_token"), tokenA);
    assert.equal(form.get("subject_token_type"), "urn:ietf:params:oauth:token-type:access_token");
    assert.equal(form.get("requested_token_type"), "urn:ietf:params:oauth:token-type:access_token");
    assert.equal(form.get("audience"), AUDIENCE);
    assert.equal(form.has("scope"), false, "the exchange sends no scope");

    // The whoami request.
    const who = seen.whoami[seen.whoami.length - 1]!;
    assert.equal(who["authorization"], `Bearer ${issuedB[issuedB.length - 1]}`);
    assert.equal(who["x-delegated-client"], "test-app");

    const { tools } = await client.listTools();
    assert.equal(seen.exchanges.length, exchangesBefore + 1, "tools/list used the cache");

    // Every tool, whatever the permissions: the API checks each call, so a
    // change in Connected apps applies to the next call with no reconnect.
    const expected = ["get_server_info", ...ALL_TOOLS.map((t) => t.name)];
    assert.deepEqual(tools.map((t) => t.name), expected, "every tool, in the order of ALL_TOOLS");
    assert.ok(tools.some((t) => t.name === "create_vm"), "a write tool is listed without the permission");
    for (const t of tools) {
      assert.deepEqual(
        t._meta?.["securitySchemes"],
        [{ type: "oauth2", scopes: ["mcp"] }],
        `${t.name} has the OAuth security scheme`,
      );
    }

    const info = await client.callTool({ name: "get_server_info", arguments: {} });
    const infoBody = JSON.parse((info.content as { text: string }[])[0]!.text) as Record<string, unknown>;
    assert.equal(infoBody["mode"], "hosted");
    assert.deepEqual(infoBody["app"], { clientId: "test-app", displayName: "Test App" });
    assert.deepEqual(infoBody["permissions"], [...PERMISSIONS].sort());
    assert.equal(infoBody["registeredTools"], expected.length);

    // A tool call reaches the API with token B and the app header only.
    const apiBefore = seen.api.length;
    const regions = await client.callTool({ name: "list_regions", arguments: {} });
    assert.notEqual(regions.isError, true);
    const call = seen.api[apiBefore]!;
    assert.equal(call.path, "/api/v1/compute/regions");
    assert.equal(call.headers["authorization"], `Bearer ${issuedB[issuedB.length - 1]}`);
    assert.equal(call.headers["x-delegated-client"], "test-app");
    assert.equal(call.headers["x-api-client-id"], undefined);
    assert.equal(call.headers["x-api-client-secret"], undefined);

    // An API error comes back as a tool error with the API message.
    const vm = await client.callTool({
      name: "get_vm",
      arguments: { id: "00000000-0000-0000-0000-000000000000" },
    });
    assert.equal(vm.isError, true);
    assert.match((vm.content as { text: string }[])[0]!.text, /\(404\): Virtual machine not found\./);

    assert.equal(seen.exchanges.length, exchangesBefore + 1, "the whole session used one exchange");

    // The API refuses a write that the permissions do not allow. The error
    // names the permission and Connected apps. The cache already lacks the
    // permission, so it agrees with the refusal and stays.
    const power = await client.callTool({
      name: "power_vm",
      arguments: { id: VM_FORBIDDEN, action: "start" },
    });
    assert.equal(power.isError, true);
    const powerText = (power.content as { text: string }[])[0]!.text;
    assert.match(powerText, /Test App does not have the cmp:virtualmachines:manage permission/);
    assert.match(powerText, /Connected apps/);
    assert.ok(!powerText.includes("Forbidden"), "the bare API text stays out");
    await client.callTool({ name: "list_regions", arguments: {} });
    assert.equal(seen.exchanges.length, exchangesBefore + 1, "the cache agrees with the refusal and stays");
    await client.close();

    // The log has one line for each request, with the tool name, and no token.
    const toolLine = logLines.find((l) => l.includes('"tool":"list_regions"'));
    assert.ok(toolLine, "the tools/call line names the tool");
    const parsed = JSON.parse(toolLine) as Record<string, unknown>;
    assert.equal(parsed["sub"], "user-1");
    assert.equal(parsed["azp"], "test-app");
    assert.equal(parsed["app"], "test-app");
    assert.equal(parsed["outcome"], "ok");
    assert.equal(parsed["status"], 200);
    assert.equal(typeof parsed["durationMs"], "number");
    assert.equal(typeof parsed["requestId"], "string");
    const vmLine = logLines.find((l) => l.includes('"tool":"get_vm"'));
    assert.equal((JSON.parse(vmLine!) as { outcome: string }).outcome, "tool_error");
    for (const line of logLines) {
      assert.ok(!line.includes(tokenA), "no log line holds token A");
      for (const b of issuedB) assert.ok(!line.includes(b), "no log line holds token B");
    }
  });

  test("a JSON-RPC batch body is refused with 400", async () => {
    const tokenA = await signTokenA();
    const res = await mcpPost(tokenA, [INITIALIZE, INITIALIZE]);
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, "invalid_request");
  });

  test("a revoked app gets 403 that names Connected apps", async () => {
    const tokenA = await signTokenA({ azp: REVOKED_APP });
    const res = await mcpPost(tokenA, INITIALIZE);
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string; message: string };
    assert.equal(body.error, "connected_app_revoked");
    assert.match(body.message, /Connected apps/);
  });

  test("each whoami refusal gets its own status and message, and unknown API text stays out", async () => {
    const cases: {
      azp: string;
      status: number;
      error: string;
      message: RegExp;
      retryAfter?: string;
    }[] = [
      { azp: "suspended-app", status: 403, error: "account_suspended", message: /settle your outstanding balance/ },
      { azp: "disabled-app", status: 403, error: "account_unavailable", message: /^Your account cannot use this app now\./ },
      { azp: "no-account-app", status: 403, error: "account_not_ready", message: /^Your account is not ready\. Sign in to the dashboard once/ },
      { azp: "misconfigured-app", status: 502, error: "upstream_error", message: /^The service is not available now\./ },
      { azp: "busy-app", status: 429, error: "rate_limited", message: /^Too many requests\./, retryAfter: "17" },
      { azp: "broken-app", status: 502, error: "upstream_error", message: /^The service is not available now\./ },
    ];
    for (const c of cases) {
      const res = await mcpPost(await signTokenA({ azp: c.azp }), INITIALIZE);
      assert.equal(res.status, c.status, c.azp);
      assert.equal(res.headers.get("www-authenticate"), null, `${c.azp}: no sign-in challenge`);
      assert.equal(res.headers.get("retry-after"), c.retryAfter ?? null, `${c.azp}: Retry-After`);
      const body = (await res.json()) as { error: string; message: string };
      assert.equal(body.error, c.error, c.azp);
      assert.match(body.message, c.message, c.azp);
      assert.ok(!body.message.includes("Internal detail"), `${c.azp}: no unknown API text`);
      assert.ok(!body.message.includes("Throttler"), `${c.azp}: no unknown API text`);
      assert.ok(!body.message.includes("Account not found"), `${c.azp}: no unknown API text`);
    }
  });


  test("a permission refusal that disagrees with the cache evicts the grant", async () => {
    const client = await connectClient(await signTokenA({ azp: "full-app" }));
    const afterConnect = seen.exchanges.length;
    await client.listTools();
    assert.equal(seen.exchanges.length, afterConnect, "the grant is cached");

    const power = await client.callTool({
      name: "power_vm",
      arguments: { id: VM_FORBIDDEN, action: "start" },
    });
    assert.equal(power.isError, true);
    assert.match((power.content as { text: string }[])[0]!.text, /cmp:virtualmachines:manage/);
    assert.equal(seen.exchanges.length, afterConnect, "the refused call itself makes no exchange");

    await client.listTools();
    assert.equal(seen.exchanges.length, afterConnect + 1, "the next request reads the grant again");
    await client.close();
  });

  test("a 403 with its own message is not a permission refusal", async () => {
    const client = await connectClient(await signTokenA());
    const afterConnect = seen.exchanges.length;
    await client.listTools();

    const vm = await client.callTool({ name: "get_vm", arguments: { id: VM_OTHER_ACCOUNT } });
    assert.equal(vm.isError, true);
    const text = (vm.content as { text: string }[])[0]!.text;
    assert.ok(text.includes(OTHER_ACCOUNT_MESSAGE), "the API message comes through");
    assert.ok(!text.includes("Connected apps"), "no permission text");

    await client.listTools();
    assert.equal(seen.exchanges.length, afterConnect, "the grant stays cached");
    await client.close();
  });

  for (const [what, vmId] of [
    ["a 403 connected_app_revoked", VM_REVOKED],
    ["a 401", VM_UNAUTHORIZED],
  ] as const) {
    test(`${what} on a tool call removes the cached grant`, async () => {
      const client = await connectClient(await signTokenA());
      const afterConnect = seen.exchanges.length;
      await client.listTools();
      assert.equal(seen.exchanges.length, afterConnect, "the grant is cached");

      const vm = await client.callTool({ name: "get_vm", arguments: { id: vmId } });
      assert.equal(vm.isError, true);
      assert.equal(seen.exchanges.length, afterConnect, "the refused call itself makes no exchange");

      await client.listTools();
      assert.equal(seen.exchanges.length, afterConnect + 1, "the next request gets a new grant");
      await client.close();
    });
  }
});

describe("grant source", () => {
  test("the cache entry expiry counts from the time before the exchange", async () => {
    let t = 1_000_000;
    const slowFetch: typeof fetch = async (input) => {
      // Each upstream call takes 8 seconds.
      t += 8_000;
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith("/protocol/openid-connect/token")) {
        return new Response(JSON.stringify({ access_token: "b", expires_in: 300 }), { status: 200 });
      }
      return new Response(JSON.stringify({ permissions: ["cmp:dns:read"] }), { status: 200 });
    };
    const source = createGrantSource({
      issuerUrl: "https://auth.example.test/realms/main",
      clientId: "mcp-server",
      clientSecret: "x-dummy",
      tokenAudience: AUDIENCE,
      publicApiUrl: "https://api.example.test",
      fetch: slowFetch,
      now: () => t,
    });
    const grant = await source.fetch("token-a", "test-app", "user-1");
    assert.equal(t, 1_016_000, "the two calls took 16 seconds");
    assert.equal(grant.expiresAt, 1_000_000 + 300_000 - 10_000);
  });
});

describe("issuer key set unavailable", () => {
  test("answers 502, not 401, when the certs route answers 503 (real remote key set)", async () => {
    // The issuer restarts and its edge answers 503 for the certs URL. jose
    // throws its generic error for a non-200 key set response. The server
    // must treat that as a key-set fault, not as a bad token.
    const downIssuer = createServer((_req, res) => {
      res.writeHead(503, { "Content-Type": "text/html" });
      res.end("<html>503</html>");
    });
    await new Promise<void>((r) => downIssuer.listen(0, "127.0.0.1", r));
    const downPort = (downIssuer.address() as AddressInfo).port;
    const { app, base: appBase } = await startApp(
      hostedEnv({ MCP_ISSUER_URL: `http://127.0.0.1:${downPort}/realms/test` }),
      { logger: SILENT_LOGGER },
    );
    try {
      const res = await mcpPost(await signTokenA(), INITIALIZE, "", appBase);
      assert.equal(res.status, 502);
      assert.equal(((await res.json()) as { error: string }).error, "upstream_unavailable");
    } finally {
      await app.close();
      downIssuer.close();
    }
  });

  test("answers 502, not 401, when the key set cannot be fetched", async () => {
    const { app, base: appBase } = await startApp(hostedEnv(), {
      keys: async () => {
        throw new TypeError("fetch failed");
      },
      logger: SILENT_LOGGER,
    });
    try {
      const res = await mcpPost(await signTokenA(), INITIALIZE, "", appBase);
      assert.equal(res.status, 502);
      assert.equal(((await res.json()) as { error: string }).error, "upstream_unavailable");
    } finally {
      await app.close();
    }
  });
});

describe("delegated SDK client", () => {
  test("sends Authorization and X-Delegated-Client, and no X-API-Client-* header", async () => {
    let captured: Headers | undefined;
    let capturedUrl = "";
    const stubFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input instanceof Request ? input.url : input);
      captured = new Headers(init?.headers);
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = makeDelegatedClient({
      baseUrl: "https://api.example.test",
      tokenB: "token-b-value",
      azp: "test-app",
      fetch: stubFetch,
    });
    await client.regions.listRegions();
    assert.ok(captured, "the client called fetch");
    assert.match(capturedUrl, /^https:\/\/api\.example\.test\/api\/v1\/compute\/regions/);
    // Check the credential headers only. The SDK can add other headers in a
    // later version, and that is not a defect.
    assert.equal(captured.get("authorization"), "Bearer token-b-value");
    assert.equal(captured.get("x-delegated-client"), "test-app");
    assert.equal(captured.has("x-api-client-id"), false);
    assert.equal(captured.has("x-api-client-secret"), false);
  });

  test("does not send a request again after a 503", async () => {
    let calls = 0;
    const client = makeDelegatedClient({
      baseUrl: "https://api.example.test",
      tokenB: "token-b-value",
      azp: "test-app",
      fetch: async () => {
        calls += 1;
        return new Response(JSON.stringify({ statusCode: 503, message: "busy" }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Retry-After": "0" },
        });
      },
    });
    await assert.rejects(() => client.vms.createVms({} as never));
    assert.equal(calls, 1, "one request, no retry");
  });

  test("stops a call after the hosted time limit, which is under the 60 s proxy limit", async () => {
    assert.ok(HOSTED_API_TIMEOUT_S < 60);
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let signal: AbortSignal | undefined;
      let started!: () => void;
      const called = new Promise<void>((r) => (started = r));
      const client = makeDelegatedClient({
        baseUrl: "https://api.example.test",
        tokenB: "token-b-value",
        azp: "test-app",
        fetch: (_input, init) => {
          signal = init?.signal ?? undefined;
          started();
          return new Promise<Response>((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(signal?.reason ?? new Error("aborted")));
          });
        },
      });
      const call = client.regions.listRegions().then(
        () => "ok",
        () => "error",
      );
      await called;
      assert.ok(signal, "the SDK gives fetch a signal");
      mock.timers.tick(HOSTED_API_TIMEOUT_S * 1000 - 1);
      assert.equal(signal.aborted, false, "not stopped before the limit");
      mock.timers.tick(1);
      assert.equal(signal.aborted, true, "stopped at the limit");
      assert.equal(await call, "error");
    } finally {
      mock.timers.reset();
    }
  });
});

describe("building blocks", () => {
  test("the limiter refuses request 121 in a minute and sets Retry-After", () => {
    let t = 1_000_000;
    const limiter = new SlidingWindowLimiter(120, () => t);
    for (let i = 0; i < 120; i++) assert.equal(limiter.check("user").allowed, true);
    const refused = limiter.check("user");
    assert.equal(refused.allowed, false);
    if (!refused.allowed) assert.equal(refused.retryAfterSeconds, 60);
    assert.equal(limiter.check("other-user").allowed, true, "the limit is per user");
    t += 60_001;
    assert.equal(limiter.check("user").allowed, true, "the window slides");
  });

  test("the cache drops expired entries and keeps its size limit", () => {
    let t = 0;
    const cache = new ExpiringCache<{ expiresAt: number }>(2, () => t);
    cache.set("a", { expiresAt: 100 });
    cache.set("b", { expiresAt: 200 });
    cache.set("c", { expiresAt: 300 });
    assert.equal(cache.size, 2);
    assert.equal(cache.get("a"), undefined, "the oldest entry went first");
    t = 250;
    assert.equal(cache.get("b"), undefined, "an expired entry is gone");
    assert.ok(cache.get("c"));
    cache.set("d", { expiresAt: 10 });
    assert.equal(cache.get("d"), undefined, "an entry that is already expired is not stored");
  });

  test("the configuration fails fast and names each missing value", () => {
    assert.throws(
      () => loadConfig({}),
      /MCP_ISSUER_URL is required.*MCP_RESOURCE_URL is required.*MCP_CLIENT_SECRET is required.*MCP_TOKEN_AUDIENCE is required.*MCP_PUBLIC_API_URL is required/,
    );
    const config = loadConfig({
      MCP_ISSUER_URL: "https://auth.example.test/realms/main",
      MCP_RESOURCE_URL: RESOURCE,
      MCP_CLIENT_SECRET: "x-dummy",
      MCP_TOKEN_AUDIENCE: AUDIENCE,
      MCP_PUBLIC_API_URL: "http://api.example.test/",
    });
    assert.equal(config.clientId, "mcp-server");
    assert.equal(config.port, 3004);
    assert.equal(config.logLevel, "info");
    assert.equal(config.publicApiUrl, "http://api.example.test");
    assert.equal(config.resourceDocumentation, "https://americancloud.com/docs/mcp/overview");
    assert.equal(config.maxTokenLifeS, 300);
  });

  test("the configuration refuses values that break the sign-in", () => {
    const good = {
      MCP_ISSUER_URL: "https://auth.example.test/realms/main",
      MCP_RESOURCE_URL: RESOURCE,
      MCP_CLIENT_SECRET: "x-dummy",
      MCP_TOKEN_AUDIENCE: AUDIENCE,
      MCP_PUBLIC_API_URL: "http://api.example.test",
    };
    assert.throws(
      () => loadConfig({ ...good, MCP_ISSUER_URL: "https://auth.example.test/realms/main/" }),
      /MCP_ISSUER_URL must not end with a slash/,
    );
    assert.throws(
      () => loadConfig({ ...good, MCP_RESOURCE_URL: "https://mcp.example.test/other" }),
      /MCP_RESOURCE_URL must have the path \/mcp/,
    );
    assert.throws(
      () => loadConfig({ ...good, MCP_CLIENT_SECRET: "change-me" }),
      /MCP_CLIENT_SECRET is the example value/,
    );
    assert.throws(
      () => loadConfig({ ...good, MCP_MAX_TOKEN_LIFE_S: "0" }),
      /MCP_MAX_TOKEN_LIFE_S must be a positive integer/,
    );
    assert.equal(loadConfig({ ...good, MCP_MAX_TOKEN_LIFE_S: "300" }).maxTokenLifeS, 300);
  });
});
