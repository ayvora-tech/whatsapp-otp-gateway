#!/data/data/com.termux/files/usr/bin/bash

# ============================================================
# Fulla OTP & SMS Gateway: 1-Click Termux Android Installer
# Runs 24/7 directly on your Android phone for $0
# ============================================================

set -e

echo ""
echo "=========================================================="
echo "🚀 Setting up Fulla OTP & SMS Gateway on Android Phone..."
echo "=========================================================="
echo ""

# 1. Acquire Wake Lock so Android CPU never sleeps when screen is off
echo "⚡ Enabling Termux Wake Lock..."
termux-wake-lock || true

# 2. Update Termux repositories & install required packages
echo "📦 Installing Node.js LTS, Git, and Termux:API..."
pkg update -y
pkg install -y nodejs-lts git termux-api curl jq

# 3. Check for Termux:API SMS permissions
echo "📱 Checking SMS permissions..."
if command -v termux-sms-send >/dev/null 2>&1; then
    echo "✅ termux-sms-send is available!"
else
    echo "⚠️ Make sure you have installed the Termux:API app from F-Droid to enable native SMS sending."
fi

# 4. Install Node.js dependencies
echo "📥 Installing project dependencies..."
npm install

# 5. Install Cloudflare Tunnel (cloudflared) for free public HTTPS domain
if [ ! -f "$PREFIX/bin/cloudflared" ]; then
    echo "🌐 Installing Cloudflare Tunnel (cloudflared for Android ARM64)..."
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
        curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o "$PREFIX/bin/cloudflared"
        chmod +x "$PREFIX/bin/cloudflared"
        echo "✅ Cloudflared installed successfully!"
    else
        echo "ℹ️ Architecture: $ARCH (Cloudflared will use local network or npm tunnel)"
    fi
fi

echo ""
echo "=========================================================="
echo "🎉 Setup Complete! To start your gateway 24/7, run:"
echo ""
echo "    npm start"
echo ""
echo "Or to start with a FREE public HTTPS Cloudflare Tunnel:"
echo ""
echo "    bash start-tunnel.sh"
echo "=========================================================="
echo ""
