# EC2 Deployment Guide - Wholesale Marketplace Backend

## Why EC2 over Render?

| Feature | Render (Free/Starter) | EC2 |
|---|---|---|
| Cold starts | Yes (sleeps after 15 min) | No - always running |
| CPU/RAM control | Limited | Full control |
| PM2 cluster mode | No | Yes - uses all CPU cores |
| Response time | 500ms-2s (cold) | 50-200ms |
| Cost | $7/mo starter | ~$3.5-8.5/mo (t3.micro/small) |

---

## Step 1: Launch EC2 Instance

### Recommended Instance Types
| Traffic Level | Instance | vCPU | RAM | Monthly Cost |
|---|---|---|---|---|
| Low (dev/testing) | t3.micro | 2 | 1 GB | ~$8.5/mo |
| Medium | t3.small | 2 | 2 GB | ~$17/mo |
| Production | t3.medium | 2 | 4 GB | ~$34/mo |

> **Tip**: `t3.micro` is **free tier eligible** for 12 months.

### Launch Steps
1. Go to **AWS Console → EC2 → Launch Instance**
2. **Name**: `wholesale-marketplace-api`
3. **AMI**: Ubuntu Server 24.04 LTS (Free tier eligible)
4. **Instance type**: `t3.micro` (or `t3.small` for better performance)
5. **Key pair**: Create new or select existing `.pem` key
6. **Security Group** — allow these inbound rules:

| Type | Port | Source |
|---|---|---|
| SSH | 22 | Your IP (or 0.0.0.0/0) |
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |

7. **Storage**: 20 GB gp3 (default is fine)
8. Click **Launch Instance**

---

## Step 2: Connect to EC2

```bash
# Make key file read-only (first time only)
chmod 400 your-key.pem

# Connect via SSH
ssh -i your-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

---

## Step 3: Run Setup Script

```bash
# Clone your repository
cd /home/ubuntu
git clone <YOUR_REPO_URL> app
cd app/WholesaleMarketplace-backend

# Run the setup script
sudo chmod +x deploy/setup-ec2.sh
sudo ./deploy/setup-ec2.sh
```

This installs Node.js 20, PM2, Nginx, and configures the firewall.

---

## Step 4: Configure Environment

```bash
cd /home/ubuntu/app/WholesaleMarketplace-backend

# Install production dependencies
npm install --production

# Create environment file
nano .env
```

Add your environment variables:
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
JWT_SECRET=<your-strong-secret-key>
CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
```

> **Important**: Use a strong random JWT_SECRET. Generate one with:
> `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## Step 5: Configure Nginx

```bash
# Copy nginx config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/wholesale-api

# Enable the site
sudo ln -sf /etc/nginx/sites-available/wholesale-api /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Step 6: Start the Application with PM2

```bash
cd /home/ubuntu/app/WholesaleMarketplace-backend

# Start in cluster mode (uses all CPU cores)
pm2 start ecosystem.config.js

# Check status
pm2 status

# Check logs
pm2 logs

# Make PM2 restart on server reboot
pm2 startup
# Run the command that PM2 outputs, then:
pm2 save
```

---

## Step 7: Verify Deployment

```bash
# From your local machine, test the health endpoint
curl http://<YOUR_EC2_PUBLIC_IP>/api/health
```

Expected response:
```json
{"status":"OK","message":"Wholesale Marketplace API is running"}
```

---

## Step 8: Update Your Mobile App Config

In your `WholesaleMarketplace/src/constants/Config.js`, update the API URL:

```js
const API_URL = 'http://<YOUR_EC2_PUBLIC_IP>/api';
```

---

## Optional: Add HTTPS with Let's Encrypt (Free SSL)

If you have a domain name pointed to your EC2 IP:

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is configured automatically. Test with:
sudo certbot renew --dry-run
```

---

## Optional: Assign Elastic IP (Recommended)

By default, EC2 public IPs change on restart. To get a static IP:

1. Go to **EC2 → Elastic IPs → Allocate Elastic IP**
2. Select the new IP → **Actions → Associate Elastic IP**
3. Choose your instance
4. Update your app config with this new static IP

> Elastic IPs are **free** while associated with a running instance.

---

## Deploying Updates

After pushing new code to your repo:

```bash
ssh -i your-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
cd /home/ubuntu/app/WholesaleMarketplace-backend

# Run the deploy script
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

This pulls the latest code and does a **zero-downtime reload**.

---

## Monitoring & Troubleshooting

```bash
# Application status
pm2 status

# Live logs
pm2 logs

# Detailed monitoring dashboard
pm2 monit

# Restart if needed
pm2 restart wholesale-marketplace-api

# Check nginx status
sudo systemctl status nginx

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check if port 5000 is in use
sudo lsof -i :5000
```

---

## Performance Tips for EC2

1. **MongoDB Atlas**: Ensure your MongoDB cluster is in the **same AWS region** as your EC2 instance to minimize latency.
2. **PM2 Cluster Mode**: Already configured in `ecosystem.config.js` — uses all CPU cores automatically.
3. **Nginx**: Acts as a reverse proxy with gzip compression, reducing payload sizes.
4. **Elastic IP**: Assign one so your IP doesn't change on restart.
5. **Monitor**: Use `pm2 monit` to track CPU/memory usage and scale up if needed.
