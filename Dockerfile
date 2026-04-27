# Repo-root Dockerfile so Railway uses Docker mode regardless of Root Directory setting.
# Builds the api/ workspace; web/ is not built here (deployed separately to Vercel).

FROM node:20-alpine AS build
WORKDIR /app
COPY api/package*.json ./
RUN npm install --no-audit --no-fund
COPY api/tsconfig.json ./
COPY api/scripts ./scripts
COPY api/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY api/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
