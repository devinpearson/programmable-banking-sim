FROM ubuntu as base
RUN apt-get update
RUN apt-get install npm -y
# RUN apt add python3
# Add package file
COPY package.json ./
COPY package-lock.json ./
COPY investec.db ./
COPY prisma ./prisma/ 
# Install deps
RUN npm install

# Copy source
COPY src ./src
COPY tsconfig.json ./tsconfig.json
RUN npm run tailwind
# Expose port 3000
EXPOSE 3000
CMD ["npm", "run", "dev"]