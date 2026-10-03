FROM node:20-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code and master seed with all data and media
COPY server/ ./server/
COPY master_seed/ ./master_seed/

# Set production environment
ENV NODE_ENV=production
ENV PORT=9559

EXPOSE 9559

# Start application
CMD ["node", "server/index.js"]
