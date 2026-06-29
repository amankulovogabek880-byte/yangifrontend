# Omon CRM — Frontend Deployment

## Talablar
- Node.js >= 18.x
- npm >= 8

## O'rnatish

```bash
npm install --legacy-peer-deps

cp .env.example .env.local
# .env.local da NEXT_PUBLIC_API_URL ni to'ldiring
```

## Ishga tushirish

```bash
# Development
npm run dev        # http://localhost:3001

# Production
npm run build
npm run start      # http://localhost:3001
```

## PM2 bilan

```bash
npm run build
pm2 start npm --name "omon-frontend" -- start
pm2 save
```

## Nginx (frontend uchun)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.uz;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```
