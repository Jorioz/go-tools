# Development
FROM node:20-alpine AS development

WORKDIR /src

RUN apk add --no-cache python3 py3-pip py3-virtualenv

COPY package*.json ./
RUN npm install

CMD ["npm", "run", "dev"]


# Build stage
FROM node:20-alpine AS builder

WORKDIR /src

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# Production
FROM node:20-alpine AS production

WORKDIR /src

RUN apk add --no-cache python3 py3-pip py3-virtualenv

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /src/dist ./dist

CMD ["npm", "start"]