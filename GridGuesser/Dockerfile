# =============================================================================
#  GridGuesser — Backend Dockerfile  (Express + Socket.IO server)
#
#  HOW TO READ THIS FILE:
#  A Dockerfile is a recipe. Each instruction builds one "layer" of the image.
#  Docker caches layers, so unchanged layers are reused on subsequent builds.
#  That is why we copy package.json BEFORE the source code — if only code
#  changes, the expensive "npm ci" layer is cached and skipped.
# =============================================================================

# ---- FROM: Choose the base image -------------------------------------------
# Think of this as choosing an operating system.
# "node:20-alpine" = Linux Alpine (~50 MB) with Node.js 20 pre-installed.
# Alpine is much smaller than the default Debian-based image (~350 MB).
FROM node:20-alpine

# ---- WORKDIR: Set the working directory inside the container ----------------
# Every command after this runs from /app. Like running "cd /app".
WORKDIR /app

# ---- COPY + RUN: Install dependencies first (for layer caching) ------------
# We copy ONLY the dependency manifests first. If they haven't changed since
# the last build, Docker reuses the cached "npm ci" layer and skips the
# install entirely. This makes rebuilds after code-only changes very fast.
COPY package.json package-lock.json ./

# "npm ci" is like "npm install" but stricter: it uses the exact versions
# from package-lock.json and is designed for reproducible builds.
# "--omit=dev" skips devDependencies (testing libs, eslint, etc.) since the
# production backend doesn't need them.
RUN npm ci --omit=dev

# ---- COPY: Bring in the rest of the source code ----------------------------
# Everything not excluded by .dockerignore gets copied into /app.
COPY . .

# ---- EXPOSE: Document the port the server listens on -----------------------
# This does NOT publish the port to your machine — it's just metadata.
# The actual port mapping happens in docker-compose.yml ("3001:3001").
EXPOSE 3001

# ---- CMD: The command that runs when the container starts -------------------
# This starts the Express + Socket.IO server using tsx (TypeScript executor).
# Unlike RUN (which runs during build), CMD runs at container start time.
CMD ["npx", "tsx", "server/index.ts"]
