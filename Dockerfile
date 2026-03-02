FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./
COPY src ./src
COPY tsconfig.json ./

RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile && \
    pnpm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]
