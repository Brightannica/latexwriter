FROM node:20-alpine

WORKDIR /app

COPY signaling-server/package*.json ./
RUN npm ci --only=production

COPY signaling-server/server.js ./

EXPOSE 3000

CMD ["node", "server.js"]