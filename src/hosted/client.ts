import type { AmericancloudApiClient } from "@americancloud/sdk";
import { makeBearerClient } from "../client.js";

/**
 * The time limit for one API call from a tool, in seconds. The proxy in front
 * of the hosted server closes a request after 60 s. A limit under that value
 * makes a slow call a tool error that the model can read, not a proxy error
 * page.
 */
export const HOSTED_API_TIMEOUT_S = 50;

/**
 * Make the SDK client for one hosted request. It sends exactly one
 * credential: token B in `Authorization`, and the app in
 * `X-Delegated-Client`. The API refuses a request that carries more than one
 * credential. makeBearerClient sends no `X-API-Client-ID` and no
 * `X-API-Client-Secret` header, and it does not send a request again.
 * test/hosted.ts checks the headers.
 */
export function makeDelegatedClient(opts: {
  baseUrl: string;
  tokenB: string;
  azp: string;
  fetch?: typeof fetch;
}): AmericancloudApiClient {
  return makeBearerClient({
    baseUrl: opts.baseUrl,
    token: opts.tokenB,
    headers: { "X-Delegated-Client": opts.azp },
    timeoutInSeconds: HOSTED_API_TIMEOUT_S,
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
}
