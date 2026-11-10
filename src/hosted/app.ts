import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { performance } from "node:perf_hooks";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { JWTVerifyGetKey } from "jose";
import { ALL_TOOLS } from "../manifest.js";
import type { HostedRequestContext } from "../server.js";
import {
  createTokenVerifier,
  InvalidTokenError,
  issuerKeySet,
  KeySetUnavailableError,
  readBearer,
  tokenHash,
} from "./auth.js";
import { ExpiringCache } from "./cache.js";
import { makeDelegatedClient } from "./client.js";
import type { HostedConfig } from "./config.js";
import { createGrantSource, GrantError, UNAVAILABLE, type Grant } from "./exchange.js";
import { createJsonLogger, type JsonLogger, type LogFields } from "./log.js";
import { SlidingWindowLimiter } from "./ratelimit.js";
import { hostedTable, serverFor } from "./tooltable.js";

/** The maximum number of cached grants (one for each token A). */
export const MAX_CACHED_GRANTS = 10_000;
/** The maximum size of a request body. */
const MAX_BODY_BYTES = 1024 * 1024;
const SWEEP_INTERVAL_MS = 60_000;

const MCP_PATH = "/mcp";
const METADATA_PATHS = new Set([
  "/.well-known/oauth-protected-resource/mcp",
  "/.well-known/oauth-protected-resource",
]);

/** Replaceable parts, for tests. */
export interface HostedDeps {
  /** The issuer key set. Default: the remote key set of MCP_ISSUER_URL. */
  keys?: JWTVerifyGetKey;
  /** The fetch for the token exchange, whoami, and the SDK client. */
  fetch?: typeof fetch;
  logger?: JsonLogger;
}

export interface HostedApp {
  server: Server;
  /** Stop the timers and close the HTTP server. */
  close(): Promise<void>;
}

/** Make the hosted HTTP server. The caller calls `listen`. */
export function createHostedApp(config: HostedConfig, deps: HostedDeps = {}): HostedApp {
  const logger = deps.logger ?? createJsonLogger(config.logLevel);
  const verifier = createTokenVerifier({
    issuerUrl: config.issuerUrl,
    resourceUrl: config.resourceUrl,
    keys: deps.keys ?? issuerKeySet(config.issuerUrl),
    maxTokenLifeS: config.maxTokenLifeS,
  });
  const grants = createGrantSource({
    issuerUrl: config.issuerUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    tokenAudience: config.tokenAudience,
    publicApiUrl: config.publicApiUrl,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  });
  const cache = new ExpiringCache<Grant>(MAX_CACHED_GRANTS);
  const inflight = new Map<string, Promise<Grant>>();
  const limiter = new SlidingWindowLimiter();

  const resource = new URL(config.resourceUrl);
  const challenge =
    `Bearer resource_metadata="${resource.origin}/.well-known/oauth-protected-resource/mcp", ` +
    `scope="mcp"`;
  const metadata = JSON.stringify({
    resource: config.resourceUrl,
    authorization_servers: [config.issuerUrl],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
    resource_documentation: config.resourceDocumentation,
  });

  /** Get the grant from the cache, or from the issuer and the API. */
  async function grantFor(token: string, hash: string, azp: string, sub: string) {
    const cached = cache.get(hash);
    if (cached) return { grant: cached, cache: "hit" as const };
    // Two parallel requests with the same token (a client often sends
    // initialize and tools/list together) share one exchange.
    let pending = inflight.get(hash);
    if (!pending) {
      pending = grants.fetch(token, azp, sub).finally(() => inflight.delete(hash));
      inflight.set(hash, pending);
    }
    const grant = await pending;
    cache.set(hash, grant);
    return { grant, cache: "miss" as const };
  }

  /** A POST to the MCP endpoint, with the bearer token that `handle` read. */
  async function handleMcp(
    req: IncomingMessage & { auth?: AuthInfo },
    res: ServerResponse,
    token: string,
    entry: LogFields,
    state: RequestState,
    requestId: string,
  ): Promise<void> {
    let claims;
    try {
      claims = await verifier.verify(token);
    } catch (err) {
      if (err instanceof KeySetUnavailableError) {
        entry.outcome = "upstream_error";
        logger.error("keys.unavailable", { requestId, reason: err.message });
        return sendError(res, 502, "upstream_unavailable", UNAVAILABLE);
      }
      return invalidToken(res, entry, err instanceof InvalidTokenError ? err.message : "invalid");
    }
    entry.sub = claims.sub;
    entry.azp = claims.azp;

    const limit = limiter.check(claims.sub);
    if (!limit.allowed) {
      entry.outcome = "rate_limited";
      return sendError(
        res,
        429,
        "rate_limited",
        `Too many requests. Try again in ${limit.retryAfterSeconds} seconds.`,
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    const hash = tokenHash(token);
    let grant: Grant;
    try {
      const found = await grantFor(token, hash, claims.azp, claims.sub);
      grant = found.grant;
      entry.cache = found.cache;
    } catch (err) {
      // The issuer refused token A: the client must sign in again.
      if (err instanceof InvalidTokenError) return invalidToken(res, entry, err.message);
      if (err instanceof GrantError) {
        entry.outcome = err.code;
        entry.reason = err.reason;
        if (err.status >= 500) logger.error("grant.failed", { requestId, reason: err.reason });
        return sendError(res, err.status, err.code, err.message, err.headers);
      }
      throw err;
    }
    entry.app = grant.app.clientId;

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      if (err instanceof BodyTooLargeError) {
        entry.outcome = "body_too_large";
        return sendError(res, 413, "body_too_large", "The request body is too large.");
      }
      entry.outcome = "invalid_json";
      return sendError(res, 400, "invalid_request", "The request body is not valid JSON.");
    }
    // Protocol 2025-11-25 has no JSON-RPC batch. A batch would also count as
    // one request for the per-user limit and give one log line for many calls.
    if (Array.isArray(body)) {
      entry.outcome = "batch_refused";
      return sendError(res, 400, "invalid_request", "Send one JSON-RPC message per request.");
    }
    describeRpc(body, entry);

    const table = await hostedTable();
    if (typeof entry.tool === "string") {
      const def = ALL_TOOLS.find((t) => t.name === entry.tool);
      if (def) entry.write = !def.readOnly;
    }

    const context: HostedRequestContext = {
      client: makeDelegatedClient({
        baseUrl: config.publicApiUrl,
        tokenB: grant.tokenB,
        azp: claims.azp,
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      }),
      azp: claims.azp,
      sub: claims.sub,
      requestId,
      app: grant.app,
      permissions: grant.permissions,
      report: {},
      evictGrant: () => cache.evict(hash),
    };
    state.report = context.report;
    // `token` is the hash of token A, never the token itself.
    req.auth = {
      token: hash,
      clientId: claims.azp,
      scopes: ["mcp"],
      expiresAt: claims.exp,
      resource,
      extra: context as unknown as Record<string, unknown>,
    };

    const server = serverFor(table);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  function unauthorized(res: ServerResponse): void {
    sendError(res, 401, "unauthorized", "Sign in again to get a valid access token.", {
      "WWW-Authenticate": challenge,
    });
  }

  function invalidToken(res: ServerResponse, entry: LogFields, reason: string): void {
    entry.outcome = "invalid_token";
    entry.reason = reason;
    unauthorized(res);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = randomUUID();
    const started = performance.now();
    const url = parseRequestUrl(req.url);
    const entry: LogFields = { requestId, method: req.method, path: url.pathname };
    const state: RequestState = {};
    let logged = false;
    const writeLog = () => {
      if (logged) return;
      logged = true;
      // The tool handler writes its outcome into the report. A tools/call
      // with no report outcome did not reach the handler: the SDK refused it,
      // for example for an unknown tool or bad arguments.
      if (state.report?.outcome) entry.outcome = state.report.outcome;
      // The client or the proxy closed the socket before the answer was
      // complete. The handler runs on, so the outcome is not known here.
      else if (!res.writableFinished) entry.outcome = "client_closed";
      else if (entry.rpcMethod === "tools/call" && res.statusCode < 400) entry.outcome = "call_rejected";
      entry.status = res.statusCode;
      entry.durationMs = Math.round(performance.now() - started);
      entry.outcome ??= res.statusCode < 400 ? "ok" : "rejected";
      // The health check runs every few seconds. Keep it out of the info log.
      if (url.pathname === "/health" && res.statusCode === 200) logger.debug("request", entry);
      else logger.info("request", entry);
    };
    res.on("finish", writeLog);
    res.on("close", writeLog);

    try {
      if (url.pathname === "/health") {
        if (refuseUnlessRead(req, res)) return;
        return sendJson(res, 200, { status: "ok" });
      }
      // A person who opens the host in a browser goes to the documentation.
      // MCP clients never request "/".
      if (url.pathname === "/") {
        if (refuseUnlessRead(req, res)) return;
        res.writeHead(302, { Location: config.resourceDocumentation, "Cache-Control": "no-store" });
        res.end();
        return;
      }
      if (METADATA_PATHS.has(url.pathname)) {
        if (refuseUnlessRead(req, res)) return;
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        });
        res.end(req.method === "HEAD" ? undefined : metadata);
        return;
      }
      if (url.pathname === MCP_PATH) {
        // A token in the URL ends up in logs and in the browser history.
        if (url.searchParams.has("access_token")) {
          entry.outcome = "token_in_query";
          return sendError(
            res,
            400,
            "invalid_request",
            "Send the access token in the Authorization header, not in the URL.",
          );
        }
        // Every request to the MCP endpoint needs a token, also a GET: a client
        // that opens the stream first must get the 401 with the challenge, not
        // a 405 that it reads as a dead server (Grok, 2026-11-05).
        const token = readBearer(req.headers.authorization);
        if (!token) {
          entry.outcome = "no_token";
          return unauthorized(res);
        }
        if (req.method !== "POST") return methodNotAllowed(res, "POST");
        return await handleMcp(req, res, token, entry, state, requestId);
      }
      return sendError(res, 404, "not_found", "Not found.");
    } catch (err) {
      entry.outcome = "error";
      logger.error("request.failed", {
        requestId,
        error: err instanceof Error ? err.name : "error",
        message: err instanceof Error ? err.message : undefined,
      });
      if (!res.headersSent) {
        sendError(res, 500, "internal_error", "The server could not complete the request.");
      } else {
        res.end();
      }
    }
  }

  const server = createServer((req, res) => {
    void handle(req, res);
  });
  // Keep idle connections open longer than a typical proxy does, so that the
  // proxy closes first and no request meets a closed socket.
  server.keepAliveTimeout = 65_000;

  const sweep = setInterval(() => cache.sweep(), SWEEP_INTERVAL_MS);
  sweep.unref();

  return {
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        clearInterval(sweep);
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections();
      }),
  };
}

const TOOL_NAMES = new Set<string>([...ALL_TOOLS.map((t) => t.name), "get_server_info"]);

/**
 * Put the JSON-RPC method and, for tools/call, the tool name in the log entry.
 * The client controls both strings, so the method is cut to 64 characters and
 * an unknown tool name is logged as "unknown".
 */
function describeRpc(body: unknown, entry: LogFields): void {
  if (!body || typeof body !== "object") return;
  const msg = body as { method?: unknown; params?: { name?: unknown } };
  if (typeof msg.method === "string") entry.rpcMethod = msg.method.slice(0, 64);
  if (msg.method === "tools/call" && typeof msg.params?.name === "string") {
    entry.tool = TOOL_NAMES.has(msg.params.name) ? msg.params.name : "unknown";
  }
}

/** The path and query of the request. A URL that does not parse becomes "/invalid". */
function parseRequestUrl(raw: string | undefined): URL {
  try {
    return new URL(raw ?? "/", "http://localhost");
  } catch {
    return new URL("/invalid", "http://localhost");
  }
}

class BodyTooLargeError extends Error {}

/** The parts of one request that the log line reads at the end. */
interface RequestState {
  report?: HostedRequestContext["report"];
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLargeError();
    chunks.push(buf);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(text),
    ...headers,
  });
  res.end(text);
}

function sendError(
  res: ServerResponse,
  status: number,
  error: string,
  message: string,
  headers: Record<string, string> = {},
): void {
  sendJson(res, status, { error, message }, headers);
}

/** Answer 405 to a method other than GET or HEAD. True when it answered. */
function refuseUnlessRead(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method === "GET" || req.method === "HEAD") return false;
  methodNotAllowed(res, "GET, HEAD");
  return true;
}

function methodNotAllowed(res: ServerResponse, allow: string): void {
  sendError(res, 405, "method_not_allowed", "This method is not allowed on this path.", {
    Allow: allow,
  });
}
