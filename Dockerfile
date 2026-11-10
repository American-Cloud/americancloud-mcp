# The hosted MCP server (Streamable HTTP, OAuth). The stdio server ships on
# npm and does not use this image.
#
# Build stage: install from the committed lock file, then bundle.
FROM node:24.22.2-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: no install script of a dependency runs in the build.
RUN npm ci --ignore-scripts
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build

# Runtime stage: production dependencies and the bundle only.
FROM node:24.22.2-alpine3.24 AS runtime
# The commit the image is built from. The CI build sets it.
ARG MCP_BUILD_SHA=unknown
ENV NODE_ENV=production MCP_BUILD_SHA=$MCP_BUILD_SHA
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.MCP_PORT || 3004) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/http.js"]
