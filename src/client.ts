import { AmericancloudApiClient } from "@americancloud/sdk";
import { log } from "./logger.js";

/**
 * Build the SDK client from the environment.
 *
 * Required:
 *   AMERICANCLOUD_API_CLIENT_ID      -> X-API-Client-ID
 *   AMERICANCLOUD_API_CLIENT_SECRET  -> X-API-Client-Secret
 * Optional:
 *   AMERICANCLOUD_API_URL            -> base URL override (e.g. staging)
 *
 * The SDK's own logging is routed to stderr — stdout is the MCP channel.
 */
export function makeClient(): AmericancloudApiClient {
  const apiKey = requireEnv("AMERICANCLOUD_API_CLIENT_ID");
  const apiClientSecret = requireEnv("AMERICANCLOUD_API_CLIENT_SECRET");
  const baseUrl = process.env["AMERICANCLOUD_API_URL"];
  if (baseUrl) log(`using API base URL override: ${baseUrl}`);

  return new AmericancloudApiClient({
    apiKey,
    apiClientSecret,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Create an API key at https://console.americancloud.com/api-keys`,
    );
  }
  return v;
}
