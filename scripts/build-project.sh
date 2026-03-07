#!/bin/bash
set -e

echo "=== Building NPM-WG ==="

# 1. Build frontend
echo "[1/2] Building frontend..."
cd frontend
# Install dependencies (requires yarn or npm/pnpm)
if command -v yarn &> /dev/null; then
    yarn install
    yarn locale-compile
    yarn build
elif command -v npm &> /dev/null; then
    npm install
    npm run locale-compile
    npm run build
else
    echo "Error: Neither yarn nor npm found. Please install Node.js."
    exit 1
fi
cd ..

# 2. Build Docker image
echo "[2/2] Building Docker image..."
# Make sure to include the trailing dot!
docker build -t npm-wg -f docker/Dockerfile .

echo "=== Build Complete ==="
echo "You can now run the container with:"
echo "docker run -d --name npm-wg --cap-add=NET_ADMIN --cap-add=SYS_MODULE -p 80:80 -p 81:81 -p 443:443 -p 51820:51820/udp -v npm-wg-data:/data npm-wg:latest"
