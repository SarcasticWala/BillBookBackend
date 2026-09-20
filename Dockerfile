# --- deps (full, incl. dev, for the build stage) ---
# Plain `npm install`, not `npm ci`: an optional transitive dep of the mongodb
# driver (gcp-metadata, pulled in for unused GCP IAM auth) resolves
# inconsistently across npm runs, which npm ci treats as a hard mismatch.
# `npm install` tolerates it — same as Render's build (npm install && build).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# --- build TypeScript -> dist ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm run build

# --- production-only deps ---
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# --- runtime ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/server.js"]
