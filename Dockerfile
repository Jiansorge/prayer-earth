# Single container runs the whole Prayer Earth app: built static files + the
# live sync socket, on the same port. Works on Railway, Fly.io, or any host
# that runs OCI images.
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV PORT=8787
# Optional: GOOGLE_TTS_KEY=<your key> enables authentic neural prayer voices
EXPOSE 8787

CMD ["node", "server/index.js"]
