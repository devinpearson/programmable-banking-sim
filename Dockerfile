FROM nikolaik/python-nodejs:latest AS base

# The web app calls the API from the browser, so it needs the API's public
# URL at build time. Override for a hosted deploy, e.g.
#   docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Install deps (API and web app)
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY web/package.json web/package-lock.json ./web/
RUN npm install && npm --prefix web install

# Copy source and build the web app
COPY src ./src
COPY tsconfig.json ./tsconfig.json
COPY web ./web
RUN npm --prefix web run build

# API on 3000, dashboard and OAuth pages on 3001
EXPOSE 3000 3001
CMD ["npm", "run", "serve"]
