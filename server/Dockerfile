FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
RUN apk add --no-cache curl
RUN wget -q -O /usr/bin/supercronic https://github.com/aptible/supercronic/releases/latest/download/supercronic-linux-amd64 \
  && chmod +x /usr/bin/supercronic
COPY package.json package-lock.json ./
RUN npm ci

# Copy server source
COPY server ./server

# Build server
RUN npm run build:server

# Runtime image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
RUN wget -q -O /usr/bin/supercronic https://github.com/aptible/supercronic/releases/latest/download/supercronic-linux-amd64 \
  && chmod +x /usr/bin/supercronic

# Copy node_modules and built server
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/server/src ./server/src
COPY --from=base /app/server/tsconfig.json ./server/tsconfig.json

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
