# syntax=docker/dockerfile:1
# Сборка из корня репозитория: docker build -f backend/Dockerfile .

FROM node:22-bookworm-slim AS deps

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 python3-pip make g++ \
    libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json* ./
COPY backend/prisma ./prisma/

RUN npm ci
RUN npx prisma generate

FROM deps AS build

COPY backend/ .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 python3-pip \
    libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY chess-recognition/requirements.txt /tmp/cv-requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu \
  && python3 -m pip install --no-cache-dir --break-system-packages -r /tmp/cv-requirements.txt \
  && rm /tmp/cv-requirements.txt

ENV NODE_ENV=production
ENV CHESS_RECOGNITION_DIR=/chess-recognition
ENV PYTHON_BIN=python3

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/prisma ./prisma
COPY backend/docker/backend-entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && mkdir -p uploads/users-avatars uploads/organizations-avatars chessboard_mappings

EXPOSE 5000
EXPOSE 40000-40100/udp

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
