import { AmericancloudApiClient } from "@americancloud/sdk";
import { log } from "./logger.js";

/** The kind of credential that the local server sends. get_server_info shows it. */
export type LocalCredential = "api-token" | "legacy-api-key";

/**
 * Build the SDK client from the environment. The server sends one credential:
 *
 *   AMERICANCLOUD_API_TOKEN          -> Authorization: Bearer (an API token, amcld_…)
 *   AMERICANCLOUD_API_CLIENT_ID +
 *   AMERICANCLOUD_API_CLIENT_SECRET  -> X-API-Client-ID + X-API-Client-Secret (a legacy API key)
 *
 * Optional:
 *   AMERICANCLOUD_API_URL            -> base URL override (e.g. staging)
 *
 * The API refuses a request that carries more than one credential, so the
 * server refuses to start when the token and the pair are both set. The
 * token path uses makeBearerClient, the same builder as the hosted server.
 * test/client.ts checks the credential headers of each path.
 *
 * The SDK's own logging is routed to stderr — stdout is the MCP channel.
 */
export function makeClient(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): { client: AmericancloudApiClient; credential: LocalCredential } {
  const token = read(env, "AMERICANCLOUD_API_TOKEN");
  const apiKey = read(env, "AMERICANCLOUD_API_CLIENT_ID");
  const apiClientSecret = read(env, "AMERICANCLOUD_API_CLIENT_SECRET");
  const baseUrl = read(env, "AMERICANCLOUD_API_URL");
  if (baseUrl) log(`using API base URL override: ${baseUrl}`);

  if (token && (apiKey || apiClientSecret)) {
    throw new Error(
      "Set AMERICANCLOUD_API_TOKEN or the AMERICANCLOUD_API_CLIENT_ID and " +
        "AMERICANCLOUD_API_CLIENT_SECRET pair, not both. The API accepts one credential.",
    );
  }

  if (token) {
    return {
      client: makeBearerClient({
        ...(baseUrl ? { baseUrl } : {}),
        token,
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
      }),
      credential: "api-token",
    };
  }

  if (!apiKey || !apiClientSecret) {
    throw new Error(
      "Missing credential. Set AMERICANCLOUD_API_TOKEN to an API token from " +
        "https://console.americancloud.com/api-tokens (or, for a legacy API key, set " +
        "AMERICANCLOUD_API_CLIENT_ID and AMERICANCLOUD_API_CLIENT_SECRET).",
    );
  }
  return {
    client: makeHeaderClient({
      ...(baseUrl ? { baseUrl } : {}),
      headers: { "X-API-Client-ID": apiKey, "X-API-Client-Secret": apiClientSecret },
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    }),
    credential: "legacy-api-key",
  };
}

/**
 * The number of times that the SDK sends a request again. The SDK default is
 * 2, for every HTTP method, after a 408, 429 or 5xx answer, and it waits for
 * `Retry-After` up to 60 s. The API can do the work of a POST and then answer
 * 5xx. A second POST can then make a second billable resource, for example a
 * second VM. Thus the server sends each request one time only. The model sees
 * the error and decides what to do.
 */
export const MAX_RETRIES = 0;

/**
 * Make an SDK client that sends a bearer token as its only credential. The
 * local token path and the hosted server both use this function. `headers`
 * holds more headers, for example `X-Delegated-Client`.
 */
export function makeBearerClient(opts: {
  baseUrl?: string;
  token: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  timeoutInSeconds?: number;
}): AmericancloudApiClient {
  const { token, headers, ...rest } = opts;
  return makeHeaderClient({ ...rest, headers: { ...headers, Authorization: `Bearer ${token}` } });
}

/**
 * Make an SDK client that sends exactly the given headers as its credential.
 *
 * `auth: false` replaces the SDK token provider with a no-op provider, so the
 * SDK reads no `AMERICANCLOUD_API_TOKEN` and adds no `Authorization` header of
 * its own. The server sets the credential header itself: a bearer token, or
 * the legacy `X-API-Client-ID` and `X-API-Client-Secret` pair.
 * `timeoutInSeconds` replaces the SDK default of 60 s.
 */
function makeHeaderClient(opts: {
  baseUrl?: string;
  headers: Record<string, string>;
  fetch?: typeof fetch;
  timeoutInSeconds?: number;
}): AmericancloudApiClient {
  return new AmericancloudApiClient({
    ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
    auth: false,
    headers: opts.headers,
    // See MAX_RETRIES: the SDK must not send a write two times.
    maxRetries: MAX_RETRIES,
    ...(opts.timeoutInSeconds !== undefined ? { timeoutInSeconds: opts.timeoutInSeconds } : {}),
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
}

/** The trimmed value of the variable, or undefined when it is unset or blank. */
function read(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}
