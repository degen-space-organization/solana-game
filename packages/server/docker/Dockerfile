# Use latest Node.js
FROM node:22-alpine

# Enable Yarn (Berry) support
RUN corepack enable

# Create working directory
WORKDIR /app

# Copy package files and tsconfig
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
# RUN yarn install
RUN npm install

# Copy all source files
COPY . .

# Build the app (optional if you use ts-node or dev script)
# RUN yarn build || true
RUN npm run build || true

# Default command (can be overridden in docker-compose)
# CMD ["yarn", "dev"]
CMD ["npm", "run", "dev"]