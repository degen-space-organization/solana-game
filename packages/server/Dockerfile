FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY . .

WORKDIR /app/packages/server

RUN npm install

# RUN npm build || true

# run npm build command from my package.json
RUN npm run build || true

# CMD ["yarn", "dev"]

# run the npm dev command from my package.json to start the server when the container starts
CMD ["npm", "run", "dev"]