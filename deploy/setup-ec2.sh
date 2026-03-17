#!/bin/bash
# =============================================================
# EC2 Setup Script for Wholesale Marketplace Backend
# Run this on a fresh Ubuntu 22.04/24.04 EC2 instance
# Usage: chmod +x setup-ec2.sh && sudo ./setup-ec2.sh
# =============================================================

set -e

echo "========================================="
echo "  Wholesale Marketplace - EC2 Setup"
echo "========================================="

# Update system
echo "[1/7] Updating system packages..."
apt-get update -y && apt-get upgrade -y

# Install Node.js 20 LTS
echo "[2/7] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Install PM2 globally
echo "[3/7] Installing PM2 process manager..."
npm install -g pm2

# Install Nginx
echo "[4/7] Installing Nginx..."
apt-get install -y nginx

# Install Git
echo "[5/7] Installing Git..."
apt-get install -y git

# Create app directory and logs directory
echo "[6/7] Setting up directories..."
mkdir -p /home/ubuntu/app
mkdir -p /home/ubuntu/logs
chown -R ubuntu:ubuntu /home/ubuntu/app /home/ubuntu/logs

# Configure firewall
echo "[7/7] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Switch to ubuntu user: su - ubuntu"
echo "  2. Clone your repo:  cd ~/app && git clone <your-repo-url> ."
echo "  3. Install deps:     cd WholesaleMarketplace-backend && npm install --production"
echo "  4. Create .env file: nano .env"
echo "  5. Copy nginx config: sudo cp deploy/nginx.conf /etc/nginx/sites-available/wholesale-api"
echo "  6. Enable nginx site: sudo ln -sf /etc/nginx/sites-available/wholesale-api /etc/nginx/sites-enabled/"
echo "  7. Remove default:    sudo rm -f /etc/nginx/sites-enabled/default"
echo "  8. Test & reload:     sudo nginx -t && sudo systemctl reload nginx"
echo "  9. Start with PM2:    pm2 start ecosystem.config.js"
echo " 10. Save PM2 startup:  pm2 startup && pm2 save"
echo ""
