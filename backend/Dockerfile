# Development
FROM node:20-alpine AS development

WORKDIR /src

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

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /src/dist ./dist

CMD ["npm", "start"]