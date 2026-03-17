#!/bin/bash
# =============================================================
# Deployment Script - Run on EC2 to pull latest code and restart
# Usage: chmod +x deploy.sh && ./deploy.sh
# =============================================================

set -e

APP_DIR="/home/ubuntu/app/WholesaleMarketplace-backend"

echo "========================================="
echo "  Deploying Wholesale Marketplace API"
echo "========================================="

cd "$APP_DIR"

# Pull latest code
echo "[1/4] Pulling latest code..."
git pull origin main

# Install/update dependencies
echo "[2/4] Installing dependencies..."
npm install --production

# Restart PM2 processes (zero-downtime reload in cluster mode)
echo "[3/4] Reloading application..."
pm2 reload ecosystem.config.js

# Show status
echo "[4/4] Checking status..."
pm2 status

echo ""
echo "Deployment complete!"
echo "Check logs: pm2 logs wholesale-marketplace-api"
echo ""
