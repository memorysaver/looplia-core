# Minimal runtime image - requires pre-built artifacts
# Usage: bun run build && docker build -t looplia .
FROM oven/bun:1.2-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S looplia && \
    adduser -S looplia -u 1001 -G looplia

# Copy pre-built artifacts with docker-specific package.json
COPY packages/core/dist ./packages/core/dist
COPY packages/core/docker.package.json ./packages/core/package.json
COPY packages/provider/dist ./packages/provider/dist
COPY packages/provider/docker.package.json ./packages/provider/package.json
COPY apps/cli/dist ./apps/cli/dist
COPY apps/cli/docker.package.json ./apps/cli/package.json
COPY plugins ./plugins

# Copy minimal package.json for Docker (no workspace refs)
COPY docker.package.json ./package.json

# Install production runtime dependencies
RUN bun install --production

# Copy entrypoint
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/

# Set ownership and switch user
RUN chown -R looplia:looplia /app
USER looplia
RUN mkdir -p /home/looplia/.looplia

ENV NODE_ENV=production
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["--help"]
