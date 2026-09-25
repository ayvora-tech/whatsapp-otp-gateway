#!/data/data/com.termux/files/usr/bin/bash

# ============================================================
# Fulla OTP & SMS Gateway: Phone Launcher with Public HTTPS Tunnel
# ============================================================

# Enable wake lock so CPU never sleeps
termux-wake-lock || true

# Start Node.js gateway in background
echo "🚀 Booting Fulla OTP & SMS Gateway on phone..."
node src/index.js &
NODE_PID=$!

sleep 3

echo ""
echo "=========================================================="
echo "🌐 Starting Free Public Cloudflare Tunnel..."
echo "=========================================================="
echo ""

if command -v cloudflared >/dev/null 2>&1; then
    cloudflared tunnel --url http://localhost:3000
else
    echo "Using npx localtunnel as fallback..."
    npx -y localtunnel --port 3000
fi

# Cleanup on exit
trap "kill $NODE_PID" EXIT
