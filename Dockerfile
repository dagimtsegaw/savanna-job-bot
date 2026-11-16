FROM mcr.microsoft.com/playwright:v1.65.1-noble

WORKDIR /app

# Node 26 links against libatomic. Keep the package next to the Playwright base image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libatomic1 \
  && rm -rf /var/lib/apt/lists/*

# The base image already has Firefox at /ms-playwright. Do not download another copy.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["npm", "start"]
