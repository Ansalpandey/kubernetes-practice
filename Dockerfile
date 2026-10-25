FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --verbose

COPY . .

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app /app

EXPOSE 3000

USER node

CMD ["node", "index.js"]
