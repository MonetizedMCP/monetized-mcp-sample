# Use official Node.js 22 image
FROM node:22

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Copy the rest of your application code
COPY . .

# Install dependencies
RUN npm install

RUN npm run build

# Build your app (uncomment if you have a build step)
# RUN npm run build

# Expose the port your app runs on (change if needed)
EXPOSE 80

# Start the application
CMD ["npm", "start"]