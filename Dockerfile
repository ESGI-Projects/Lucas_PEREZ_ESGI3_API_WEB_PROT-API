FROM node:24-bookworm-slim AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
COPY scripts ./scripts
COPY db ./db
COPY tests ./tests
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=development /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
