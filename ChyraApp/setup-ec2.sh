set -e

# Ensure dirs
mkdir -p ~/apps/chyraapp/backend

# Node.js 18 + pm2 (if needed)
if ! command -v node &>/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
  sudo dnf install -y nodejs
fi
sudo npm i -g pm2

# MongoDB should already be installed and running from your last step
sudo systemctl enable mongod || true
sudo systemctl start mongod || true

# Backend setup
cd ~/apps/chyraapp/backend

# Create .env if missing and align names the app expects
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    touch .env
  fi

  # Update or set values
  grep -q '^MONGODB_URI=' .env && sudo sed -i 's/^MONGODB_URI=.*/MONGODB_URI=mongodb:\/\/localhost:27017\/chyraapp/' .env || echo 'MONGODB_URI=mongodb://localhost:27017/chyraapp' | sudo tee -a .env >/dev/null
  grep -q '^CORS_ORIGIN=' .env && sudo sed -i 's/^CORS_ORIGIN=.*/CORS_ORIGIN=https:\/\/chyraapp.com,https:\/\/www.chyraapp.com/' .env || echo 'CORS_ORIGIN=https://chyraapp.com,https://www.chyraapp.com' | sudo tee -a .env >/dev/null

  # JWT names your code reads
  grep -q '^JWT_EXPIRES_IN=' .env && sudo sed -i 's/^JWT_EXPIRES_IN=.*/JWT_EXPIRES_IN=15m/' .env || echo 'JWT_EXPIRES_IN=15m' | sudo tee -a .env >/dev/null
  grep -q '^JWT_REFRESH_EXPIRES_IN=' .env && sudo sed -i 's/^JWT_REFRESH_EXPIRES_IN=.*/JWT_REFRESH_EXPIRES_IN=7d/' .env || echo 'JWT_REFRESH_EXPIRES_IN=7d' | sudo tee -a .env >/dev/null

  # Generate JWT secrets if missing
  if ! grep -q '^JWT_SECRET=' .env; then
    echo "JWT_SECRET=$(openssl rand -hex 32)" | sudo tee -a .env >/dev/null
  fi
  if ! grep -q '^JWT_REFRESH_SECRET=' .env; then
    echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)" | sudo tee -a .env >/dev/null
  fi

  grep -q '^PORT=' .env && sudo sed -i 's/^PORT=.*/PORT=5000/' .env || echo 'PORT=5000' | sudo tee -a .env >/dev/null
fi

# Install backend dependencies
npm install

# Start backend with pm2
pm2 delete chyra-api || true
pm2 start src/server.js --name chyra-api
pm2 save
pm2 startup -u ec2-user --hp /home/ec2-user | sed -n 's/.*sudo //p' | sudo bash

# Nginx reverse proxy (with WebSockets)
sudo tee /etc/nginx/conf.d/api.conf >/dev/null <<'EOF'
server {
  listen 80;
  server_name api.chyraapp.com;

  location /socket.io/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF

sudo nginx -t
sudo systemctl reload nginx

# TLS (safe to re-run)
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.chyraapp.com --non-interactive --agree-tos -m noreply@chyraapp.com || true

echo "Done. Test: https://api.chyraapp.com"
