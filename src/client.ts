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
    client: new AmericancloudApiClient({
      ...(baseUrl ? { baseUrl } : {}),
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
      apiKey,
      apiClientSecret,
      // See MAX_RETRIES: the SDK must not send a write two times.
      maxRetries: MAX_RETRIES,
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
 * local token path and the hosted server both use this function.
 *
 * - `auth: false` replaces the API key provider with a no-op provider, so the
 *   SDK sends no `X-API-Client-ID`.
 * - The SDK adds `X-API-Client-Secret` only when `apiClientSecret` has a
 *   value. This function gives no value.
 *
 * The SDK options type marks `apiKey` and `apiClientSecret` as required, also
 * when `auth` is false. The type assertion below removes only those two
 * fields. `headers` holds more headers, for example `X-Delegated-Client`.
 * `timeoutInSeconds` replaces the SDK default of 60 s.
 */
export function makeBearerClient(opts: {
  baseUrl?: string;
  token: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  timeoutInSeconds?: number;
}): AmericancloudApiClient {
  const options: Omit<AmericancloudApiClient.Options, "apiKey" | "apiClientSecret"> = {
    ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
    auth: false,
    headers: { ...opts.headers, Authorization: `Bearer ${opts.token}` },
    // See MAX_RETRIES: the SDK must not send a write two times.
    maxRetries: MAX_RETRIES,
    ...(opts.timeoutInSeconds !== undefined ? { timeoutInSeconds: opts.timeoutInSeconds } : {}),
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  };
  return new AmericancloudApiClient(options as AmericancloudApiClient.Options);
}

/** The trimmed value of the variable, or undefined when it is unset or blank. */
function read(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}
