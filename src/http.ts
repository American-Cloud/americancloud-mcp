import { loadConfig } from "./hosted/config.js";
import { createHostedApp } from "./hosted/app.js";
import { createJsonLogger } from "./hosted/log.js";
import { BUILD_SHA, VERSION } from "./server.js";

/**
 * The hosted entry point: MCP over Streamable HTTP, with OAuth. The local
 * entry point (stdio, API key) is src/index.ts.
 *
 * The server reads its configuration one time at start, from MCP_*
 * variables. A missing required value stops the start.
 */
function main(): void {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    createJsonLogger("error").error("config.invalid", {
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  const logger = createJsonLogger(config.logLevel);
  const app = createHostedApp(config, { logger });

  app.server.listen(config.port, () => {
    logger.info("started", { version: VERSION, build: BUILD_SHA, port: config.port });
  });

  // A rollout sends SIGTERM. Stop new connections, let open requests end,
  // then stop. A second signal, or 10 seconds, stops at once.
  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) process.exit(1);
    stopping = true;
    logger.info("stopping", { signal });
    setTimeout(() => process.exit(1), 10_000).unref();
    app.server.close(() => process.exit(0));
    app.server.closeIdleConnections();
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}

main();
