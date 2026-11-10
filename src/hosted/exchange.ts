import { InvalidTokenError, trimSlash } from "./auth.js";

/** What the server knows about one token A after a cache miss. */
export interface Grant {
  /** Token B: the token that the API accepts for this user and app. */
  tokenB: string;
  /** The effective permissions, sorted and without duplicates. */
  permissions: string[];
  app: { clientId: string; displayName: string };
  sub: string;
  azp: string;
  /** When the cache entry stops, in milliseconds since the epoch. */
  expiresAt: number;
}

/**
 * A failure to get a grant. `status` is the HTTP status for the MCP client.
 * `code` and `message` go into the response body. `headers` go into the
 * response, for example `Retry-After`. `reason` is for the log only. No field
 * holds a token.
 */
export class GrantError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reason: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "GrantError";
  }
}

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

/** The time limit for one call to the issuer or to the API. */
export const UPSTREAM_TIMEOUT_MS = 10_000;

/** The cache entry stops this much time before token B expires. */
const EXPIRY_MARGIN_MS = 10_000;

/** The message for any upstream fault. app.ts also sends it. */
export const UNAVAILABLE = "The service is not available now. Try again in a moment.";

/** The fixed messages for a whoami refusal. The API text goes through only for the codes below. */
const ACCOUNT_SUSPENDED =
  "Your account is suspended. Settle your outstanding balance to restore service.";
const ACCOUNT_UNAVAILABLE =
  "Your account cannot use this app now. Open your account to check its status.";
const ACCOUNT_NOT_READY = "Your account is not ready. Sign in to the dashboard once, then try again.";
const TOO_MANY_REQUESTS = "Too many requests. Try again in a moment.";

/**
 * The 403 codes whose API message goes through to the user, because the user
 * can act on it. The value is the message when the API gives none.
 */
const PASS_THROUGH_403 = new Map<string, string>([
  // The API message names Connected apps.
  ["connected_app_revoked", "This app was disconnected in Connected apps."],
  ["account_suspended", ACCOUNT_SUSPENDED],
]);

/** A 502 for an upstream answer that the server cannot use. */
function upstreamError(reason: string): GrantError {
  return new GrantError(502, "upstream_error", UNAVAILABLE, reason);
}

export interface GrantSource {
  /**
   * Get the grant for token A. Throws InvalidTokenError when the issuer
   * refuses token A, and GrantError for every other failure.
   */
  fetch(tokenA: string, azp: string, sub: string): Promise<Grant>;
}

export function createGrantSource(opts: {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  /** The audience of token B: the client that the API accepts tokens for. */
  tokenAudience: string;
  publicApiUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
}): GrantSource {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const tokenUrl = `${trimSlash(opts.issuerUrl)}/protocol/openid-connect/token`;
  const whoamiUrl = `${trimSlash(opts.publicApiUrl)}/api/v1/whoami`;

  /** One call to the issuer or the API, with the time limit. A network failure is a 502. */
  async function call(
    label: "exchange" | "whoami",
    url: string,
    init: RequestInit,
  ): Promise<{ res: Response; json: unknown }> {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch (err) {
      throw new GrantError(502, "upstream_unavailable", UNAVAILABLE, `${label}: ${errName(err)}`);
    }
    return { res, json: await readJson(res) };
  }

  async function exchange(tokenA: string): Promise<{ tokenB: string; expiresIn: number }> {
    // No `scope` parameter: the issuer gives token B the scopes of this
    // server's client, and the roles of the user within them.
    const body = new URLSearchParams({
      grant_type: TOKEN_EXCHANGE_GRANT,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      subject_token: tokenA,
      subject_token_type: ACCESS_TOKEN_TYPE,
      requested_token_type: ACCESS_TOKEN_TYPE,
      audience: opts.tokenAudience,
    });
    const { res, json: raw } = await call("exchange", tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    const json = raw as
      | { access_token?: unknown; expires_in?: unknown; error?: unknown; error_description?: unknown }
      | undefined;
    if (!res.ok) {
      const error = typeof json?.error === "string" ? json.error : "";
      const description = typeof json?.error_description === "string" ? json.error_description : "";
      // The issuer refuses token A itself: it expired, or the user ended the
      // session. The client must get a new token, so app.ts answers 401.
      //
      // Keycloak answers 400 `invalid_request` with the description "Invalid
      // token" when the session behind token A is gone: a revoke in Connected
      // apps, a sign-out everywhere, a session revoke by an admin, or a
      // disabled user. That is the same case. Any other `invalid_request` is
      // a fault in our own request and stays a 502.
      const deadToken =
        error === "invalid_grant" ||
        error === "invalid_token" ||
        (error === "invalid_request" && /invalid token/i.test(description));
      if (res.status === 400 && deadToken) {
        throw new InvalidTokenError(`exchange: ${error}${description ? ` ${description}` : ""}`);
      }
      // Keycloak's description names the fault (a missing parameter, an
      // audience the client cannot request). Keep it in the log, cut short.
      const detail = description ? ` ${description.slice(0, 200)}` : "";
      throw upstreamError(`exchange: status ${res.status}${error ? ` ${error}` : ""}${detail}`);
    }
    if (typeof json?.access_token !== "string" || json.access_token === "") {
      throw upstreamError("exchange: no access_token");
    }
    const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 0;
    return { tokenB: json.access_token, expiresIn };
  }

  async function whoami(
    tokenB: string,
    azp: string,
  ): Promise<{ permissions: string[]; app: { clientId: string; displayName: string } }> {
    const { res, json: raw } = await call("whoami", whoamiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "X-Delegated-Client": azp,
        Accept: "application/json",
      },
    });
    const json = raw as
      | {
          code?: unknown;
          message?: unknown;
          permissions?: unknown;
          app?: { clientId?: unknown; displayName?: unknown };
        }
      | undefined;
    if (!res.ok) throw whoamiError(res, json);
    const permissions = json?.permissions;
    if (!Array.isArray(permissions) || !permissions.every((p) => typeof p === "string")) {
      throw upstreamError("whoami: no permissions list");
    }
    const clientId = typeof json?.app?.clientId === "string" ? json.app.clientId : azp;
    const displayName =
      typeof json?.app?.displayName === "string" && json.app.displayName
        ? json.app.displayName
        : clientId;
    return { permissions: [...new Set(permissions as string[])].sort(), app: { clientId, displayName } };
  }

  return {
    async fetch(tokenA, azp, sub) {
      // The issuer starts the life of token B during the exchange. Take the
      // time before the exchange, so that the cache entry never outlives
      // token B, also when the exchange and whoami are slow.
      const t0 = now();
      const { tokenB, expiresIn } = await exchange(tokenA);
      const { permissions, app } = await whoami(tokenB, azp);
      return {
        tokenB,
        permissions,
        app,
        sub,
        azp,
        expiresAt: t0 + expiresIn * 1000 - EXPIRY_MARGIN_MS,
      };
    },
  };
}

/**
 * Map a whoami refusal to the answer for the MCP client. The API text goes
 * through only for a code that this function knows. Any other refusal gets a
 * fixed message, because an unknown API text can hold internal detail.
 *
 * - 403 `connected_app_revoked` and 403 `account_suspended`: 403 with the API
 *   message. The user can act on it.
 * - Any other 403 (for example a disabled account): 403 with a fixed message.
 * - 401 `no_account`: the user has no account yet. 403 with a fixed message.
 *   A 401 would start a new sign-in, and that sign-in cannot help.
 * - Any other 401: the API refused token B, a configuration fault. 502.
 * - 429: 429, with the `Retry-After` of the API when it is valid.
 * - 5xx and all other statuses: 502, try again.
 *
 * A 4xx answer does not tell the client to try again at once, so a client
 * does not run a new exchange in a loop for an account problem.
 */
function whoamiError(
  res: Response,
  json: { code?: unknown; message?: unknown } | undefined,
): GrantError {
  const code = typeof json?.code === "string" ? json.code : "";
  const apiMessage = typeof json?.message === "string" ? json.message.trim() : "";
  const fallback = PASS_THROUGH_403.get(code);
  if (res.status === 403 && fallback !== undefined) {
    return new GrantError(403, code, apiMessage || fallback, `whoami: ${code}`);
  }
  if (res.status === 403) {
    return new GrantError(403, "account_unavailable", ACCOUNT_UNAVAILABLE, "whoami: status 403");
  }
  if (res.status === 401 && code === "no_account") {
    // The user has no account yet.
    return new GrantError(403, "account_not_ready", ACCOUNT_NOT_READY, "whoami: no_account");
  }
  if (res.status === 401) {
    // The API refused token B itself: the azp whitelist, the audience or the
    // issuer do not match. A configuration fault, not a user state. The
    // detail goes to the log; the user gets a service error.
    return upstreamError(`whoami: status 401 refused token B (${code || apiMessage || "no detail"})`);
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after")?.trim() ?? "";
    return new GrantError(
      429,
      "rate_limited",
      TOO_MANY_REQUESTS,
      "whoami: status 429",
      validRetryAfter(retryAfter) ? { "Retry-After": retryAfter } : {},
    );
  }
  return upstreamError(`whoami: status ${res.status}`);
}

/** True for a Retry-After value in seconds or as an HTTP date. */
function validRetryAfter(value: string): boolean {
  if (/^[0-9]{1,9}$/.test(value)) return true;
  // An HTTP date, for example "Wed, 21 Oct 2026 07:28:00 GMT".
  return /^[A-Za-z0-9 ,:]{1,64}$/.test(value) && !Number.isNaN(Date.parse(value));
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** A short, token-free name for a network error, for the log. */
function errName(err: unknown): string {
  if (err instanceof Error) return err.name === "TimeoutError" ? "timeout" : err.name;
  return "error";
}
