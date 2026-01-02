#!/bin/bash
# Script to start the backend server

cd "$(dirname "$0")/../server" || exit 1

echo "Starting backend server..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
EOF
fi

# Check if dist directory exists (for production build)
if [ ! -d "dist" ]; then
    echo "Building TypeScript..."
    npm run build
fi

# Start the server (use dev mode for development)
echo "Starting server on http://localhost:3001"
echo "Press Ctrl+C to stop"
echo ""
echo "Note: Using 'npm run dev' for development (auto-reload)"
echo ""

# Use dev mode if available, otherwise use start
if npm run | grep -q "dev"; then
    npm run dev
else
    npm start
fi

