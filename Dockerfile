# ENGIE360 demo: one image serving the start page (/), the customer portal (/app), the staff app (/staff),
# the API (/api, live events at /api/events), all on port 3000.
#
# Database: Node's built-in SQLite, nothing to install or download. The file lives in DATA_DIR;
# without a volume a restart starts from fresh demo data (fine for a demo).
#
# Build for linux/amd64 (required by Zoho Catalyst AppSail):
#   docker build --platform linux/amd64 -t engie360-demo:latest .

# ---------- build ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/tmp/engie360-data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# The server runs TypeScript directly (tsx) and reuses the mock-up's data and Eva from src/.
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY src ./src
COPY public ./public
EXPOSE 3000
USER node
CMD ["node", "--import", "tsx", "server/index.ts", "--prod"]
