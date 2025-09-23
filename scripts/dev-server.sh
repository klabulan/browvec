#!/bin/bash

# LocalRetrieve Development Server Script
# Starts a development server with required COOP/COEP headers for SharedArrayBuffer support

set -e

# Configuration
PORT=${PORT:-5173}
HOST=${HOST:-localhost}
HTTPS=${HTTPS:-true}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting LocalRetrieve Development Server${NC}"
echo -e "${BLUE}===========================================${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ to continue.${NC}"
    exit 1
fi

# Check if we're in a project directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ No package.json found. Please run this from your project root.${NC}"
    exit 1
fi

# Check if Vite is available
if ! command -v vite &> /dev/null && ! npx vite --version &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vite not found. Installing Vite...${NC}"
    npm install -D vite
fi

# Function to check if port is available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Find available port
ORIGINAL_PORT=$PORT
while ! check_port $PORT; do
    echo -e "${YELLOW}⚠️  Port $PORT is already in use${NC}"
    PORT=$((PORT + 1))
done

if [ $PORT != $ORIGINAL_PORT ]; then
    echo -e "${YELLOW}📍 Using port $PORT instead of $ORIGINAL_PORT${NC}"
fi

# Create temporary vite config if none exists
TEMP_CONFIG=false
if [ ! -f "vite.config.ts" ] && [ ! -f "vite.config.js" ]; then
    echo -e "${YELLOW}📝 Creating temporary Vite configuration...${NC}"
    TEMP_CONFIG=true
    cat > vite.config.temp.js << EOF
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: $PORT,
    https: $HTTPS,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es'
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['sqlite3.wasm']
  }
});
EOF
fi

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    if [ "$TEMP_CONFIG" = true ]; then
        rm -f vite.config.temp.js
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Environment check
echo -e "${BLUE}🔍 Environment Check:${NC}"

# Check for HTTPS capability
if [ "$HTTPS" = true ]; then
    echo -e "${GREEN}✓${NC} HTTPS enabled (required for SharedArrayBuffer)"
else
    echo -e "${YELLOW}⚠️${NC} HTTPS disabled - SharedArrayBuffer may not work"
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ $MAJOR_VERSION -ge 18 ]; then
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION (✓ >= 18)"
else
    echo -e "${RED}❌${NC} Node.js $NODE_VERSION (requires >= 18)"
    exit 1
fi

echo ""

# Start the development server
echo -e "${GREEN}🌟 Starting development server...${NC}"
echo -e "${BLUE}📍 Local:${NC}   https://$HOST:$PORT/"
echo -e "${BLUE}📍 Network:${NC} https://$(hostname -I | awk '{print $1}'):$PORT/"
echo ""
echo -e "${YELLOW}📋 Important Notes:${NC}"
echo -e "   • COOP/COEP headers are enabled for SharedArrayBuffer support"
echo -e "   • WASM files are configured for proper loading"
echo -e "   • Workers are configured for ES modules"
echo -e "   • Use Ctrl+C to stop the server"
echo ""

# Start Vite with appropriate config
if [ "$TEMP_CONFIG" = true ]; then
    exec npx vite --config vite.config.temp.js
else
    exec npx vite --port $PORT --host --https
fi