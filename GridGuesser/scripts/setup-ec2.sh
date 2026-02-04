#!/bin/bash

# GridGuesser EC2 Setup Script
# Run this after connecting to your EC2 instance via SSH

set -e  # Exit on any error

echo "🚀 GridGuesser EC2 Setup Starting..."
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Update system
echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Step 2: Install Node.js
echo -e "${YELLOW}Step 2: Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
echo -e "${GREEN}✓ NPM installed: $(npm --version)${NC}"

# Step 3: Install PM2
echo -e "${YELLOW}Step 3: Installing PM2...${NC}"
sudo npm install -g pm2

echo -e "${GREEN}✓ PM2 installed: $(pm2 --version)${NC}"

# Step 4: Install Nginx
echo -e "${YELLOW}Step 4: Installing Nginx...${NC}"
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

echo -e "${GREEN}✓ Nginx installed and started${NC}"

# Step 5: Setup firewall
echo -e "${YELLOW}Step 5: Configuring firewall...${NC}"
sudo apt install -y ufw
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo -e "${GREEN}✓ Firewall configured${NC}"

# Step 6: Clone repository
echo -e "${YELLOW}Step 6: Ready to clone your repository${NC}"
echo ""
echo "Next steps:"
echo "1. Clone your repository: git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git"
echo "2. Navigate to GridGuesser folder: cd YOUR_REPO/GridGuesser"
echo "3. Create .env.local file with your environment variables"
echo "4. Run: npm install"
echo "5. Run: npm run build"
echo "6. Start with PM2: pm2 start npm --name gridguesser-backend -- run server:prod"
echo "7. Start frontend: pm2 start npm --name gridguesser-frontend -- start"
echo "8. Configure Nginx (see AWS_EC2_DEPLOYMENT.md)"
echo ""
echo -e "${GREEN}✓ Server setup complete!${NC}"
echo ""
echo "📖 For detailed instructions, see AWS_EC2_DEPLOYMENT.md"

