FROM nikolaik/python-nodejs:latest as base
# Add package file
COPY package.json ./
COPY package-lock.json ./
COPY prisma ./prisma/ 
# Install deps
RUN npm install

# Copy source
COPY src ./src
COPY public ./public
COPY tsconfig.json ./tsconfig.json

# Expose port 3000
EXPOSE 3000
CMD ["npm", "run", "dev"]