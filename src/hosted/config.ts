/**
 * The configuration of the hosted server. The server reads the environment one
 * time at start. A missing required value stops the start with a clear error.
 */
export interface HostedConfig {
  /** The OAuth issuer, for example https://auth.example.com/realms/main. */
  issuerUrl: string;
  /** The canonical resource identifier of this server, for example https://mcp.example.com/mcp. */
  resourceUrl: string;
  /** The client of this server at the issuer. The token exchange uses it. */
  clientId: string;
  clientSecret: string;
  /** The audience that the token exchange asks for: the client that the API accepts. */
  tokenAudience: string;
  /** The base URL of the American Cloud API, without /api/v1. */
  publicApiUrl: string;
  logLevel: LogLevel;
  port: number;
  resourceDocumentation: string;
  /** The longest life (`exp - iat`) of token A that the server accepts, in seconds. */
  maxTokenLifeS: number;
}

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const REQUIRED = [
  "MCP_ISSUER_URL",
  "MCP_RESOURCE_URL",
  "MCP_CLIENT_SECRET",
  "MCP_TOKEN_AUDIENCE",
  "MCP_PUBLIC_API_URL",
] as const;

/** Read the configuration. Throws one error that names every bad value. */
export function loadConfig(env: NodeJS.ProcessEnv): HostedConfig {
  const problems: string[] = [];
  for (const name of REQUIRED) {
    if (!env[name]?.trim()) problems.push(`${name} is required`);
  }

  for (const name of ["MCP_ISSUER_URL", "MCP_RESOURCE_URL", "MCP_PUBLIC_API_URL"] as const) {
    const value = env[name]?.trim();
    if (value && !isHttpUrl(value)) problems.push(`${name} must be an http or https URL`);
  }

  // The key set comes from the issuer. Plain http is only for a loopback
  // host, as in the tests.
  const issuerValue = env["MCP_ISSUER_URL"]?.trim();
  if (issuerValue && isHttpUrl(issuerValue) && !isHttpsOrLoopback(issuerValue)) {
    problems.push("MCP_ISSUER_URL must use https, except on a loopback host");
  }

  // The issuer must match the `iss` claim exactly, and the issuer has no
  // final slash. A final slash makes every token fail the check.
  const issuer = env["MCP_ISSUER_URL"]?.trim();
  if (issuer && issuer.endsWith("/")) problems.push("MCP_ISSUER_URL must not end with a slash");

  // The server serves the endpoint, the metadata, and the challenge on /mcp.
  // The resource URL must name that path, or the values do not agree.
  const resource = env["MCP_RESOURCE_URL"]?.trim();
  if (resource && isHttpUrl(resource) && new URL(resource).pathname !== "/mcp") {
    problems.push("MCP_RESOURCE_URL must have the path /mcp");
  }

  // "change-me" is the placeholder in the example file. With it, every token
  // exchange fails.
  if (env["MCP_CLIENT_SECRET"]?.trim() === "change-me") {
    problems.push("MCP_CLIENT_SECRET is the example value; set the real secret");
  }

  // The default equals the realm token life and the five-minute block after a
  // revoke: a token A that outlives the block must not re-activate the row.
  const lifeText = env["MCP_MAX_TOKEN_LIFE_S"]?.trim() || "300";
  const maxTokenLifeS = Number(lifeText);
  if (!Number.isInteger(maxTokenLifeS) || maxTokenLifeS < 1) {
    problems.push("MCP_MAX_TOKEN_LIFE_S must be a positive integer");
  }

  const logLevel = (env["MCP_LOG_LEVEL"]?.trim() || "info") as LogLevel;
  if (!LOG_LEVELS.includes(logLevel)) {
    problems.push(`MCP_LOG_LEVEL must be one of ${LOG_LEVELS.join(", ")}`);
  }

  const portText = env["MCP_PORT"]?.trim() || "3004";
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push("MCP_PORT must be an integer from 0 to 65535");
  }

  if (problems.length > 0) {
    throw new Error(`Invalid configuration: ${problems.join("; ")}`);
  }

  return {
    issuerUrl: env["MCP_ISSUER_URL"]!.trim(),
    resourceUrl: env["MCP_RESOURCE_URL"]!.trim(),
    clientId: env["MCP_CLIENT_ID"]?.trim() || "mcp-server",
    clientSecret: env["MCP_CLIENT_SECRET"]!.trim(),
    tokenAudience: env["MCP_TOKEN_AUDIENCE"]!.trim(),
    publicApiUrl: env["MCP_PUBLIC_API_URL"]!.trim().replace(/\/+$/, ""),
    logLevel,
    port,
    resourceDocumentation:
      env["MCP_RESOURCE_DOCUMENTATION"]?.trim() || "https://americancloud.com/docs/mcp/overview",
    maxTokenLifeS,
  };
}

function isHttpsOrLoopback(value: string): boolean {
  const url = new URL(value);
  if (url.protocol === "https:") return true;
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
