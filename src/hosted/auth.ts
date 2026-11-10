import { createHash } from "node:crypto";
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

/** The claims of token A that the server uses. */
export interface AccessClaims {
  /** The user. */
  sub: string;
  /** The app that the user connected (the OAuth client of token A). */
  azp: string;
  /** The expiry, in seconds since the epoch. */
  exp: number;
}

/** The token is missing, not valid, or not for this server. */
export class InvalidTokenError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidTokenError";
  }
}

/** The server could not get the key set of the issuer. The token is not at fault. */
export class KeySetUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "KeySetUnavailableError";
  }
}

/**
 * The key set of the issuer. jose keeps the keys in memory and fetches them
 * again when a token names an unknown key.
 */
export function issuerKeySet(issuerUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(`${trimSlash(issuerUrl)}/protocol/openid-connect/certs`), {
    timeoutDuration: 10_000,
  });
}

export interface TokenVerifier {
  verify(token: string): Promise<AccessClaims>;
}

/**
 * Make the verifier for token A. It checks the signature against the issuer
 * keys, the issuer, the audience (this resource), the expiry, the presence of
 * `sub` and `azp`, and the life of the token (`exp - iat`). The error message
 * never holds the token.
 *
 * The life cap: the realm issues tokens with a short life. A client that
 * registered itself can set a longer life for its own tokens. Such a token
 * stays valid after the user disconnects the app, so the server refuses a
 * token whose life is more than `maxTokenLifeS`.
 */
export function createTokenVerifier(opts: {
  issuerUrl: string;
  resourceUrl: string;
  keys: JWTVerifyGetKey;
  /** The longest life of token A that the server accepts, in seconds. */
  maxTokenLifeS: number;
}): TokenVerifier {
  return {
    async verify(token: string): Promise<AccessClaims> {
      let payload: Record<string, unknown>;
      try {
        ({ payload } = await jwtVerify(token, opts.keys, {
          issuer: opts.issuerUrl,
          audience: opts.resourceUrl,
          algorithms: ["RS256"],
          requiredClaims: ["exp", "iat", "sub", "azp"],
        }));
      } catch (err) {
        // A failure to get the keys is a server-side failure: answer 502, not
        // 401, so that the client does not start a new sign-in for nothing.
        // jose throws the generic class only from the remote key set, for a
        // key set response that is not 200 or not JSON.
        if (
          err instanceof errors.JWKSTimeout ||
          err instanceof errors.JWKSInvalid ||
          !(err instanceof errors.JOSEError) ||
          err.code === "ERR_JOSE_GENERIC"
        ) {
          throw new KeySetUnavailableError(err instanceof Error ? err.name : "error");
        }
        throw new InvalidTokenError(err.code);
      }
      const { sub, azp, exp, iat } = payload;
      if (typeof sub !== "string" || sub === "") throw new InvalidTokenError("sub missing");
      if (typeof azp !== "string" || azp === "") throw new InvalidTokenError("azp missing");
      if (typeof exp !== "number") throw new InvalidTokenError("exp missing");
      if (typeof iat !== "number") throw new InvalidTokenError("iat missing");
      if (exp - iat > opts.maxTokenLifeS) throw new InvalidTokenError("token_life");
      return { sub, azp, exp };
    },
  };
}

/**
 * Read the bearer token from the Authorization header. Returns undefined when
 * the header is missing or has a different scheme.
 */
export function readBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer[ ]+([A-Za-z0-9\-._~+/]+=*)\s*$/i.exec(header);
  return match?.[1];
}

/** The cache key and the log-safe identity of a token: sha256, hex. */
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
