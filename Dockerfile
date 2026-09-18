FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application files
COPY . .

# Create volume mount point for persistent session and API keys
VOLUME ["/app/data"]

# Set default port (7860 for Hugging Face Spaces, or override via env)
ENV PORT=7860

# Expose port
EXPOSE 7860

# Start server
CMD ["npm", "start"]
