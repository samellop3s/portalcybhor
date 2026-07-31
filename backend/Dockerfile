FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN addgroup -S cybhor && adduser -S cybhor -G cybhor
USER cybhor

EXPOSE 4000

CMD ["node", "src/server.js"]
