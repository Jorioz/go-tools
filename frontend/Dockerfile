FROM node:24.12.0

WORKDIR /app

COPY app/package.json app/package-lock.json ./
RUN npm install

COPY app/ ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]