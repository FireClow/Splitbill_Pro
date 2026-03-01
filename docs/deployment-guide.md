# SplitBill Pro - Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   Expo Mobile    │────▶│  Nginx       │────▶│  FastAPI      │
│   (iOS/Android/  │     │  Reverse     │     │  Backend      │
│    Web)          │     │  Proxy       │     │  (Port 8001)  │
└─────────────────┘     └──────────────┘     └──────┬───────┘
                                                      │
                              ┌────────────────────────┤
                              ▼                        ▼
                        ┌──────────┐           ┌──────────────┐
                        │  MongoDB │           │  Redis       │
                        │  (27017) │           │  (6379)      │
                        └──────────┘           └──────────────┘
```

## Quick Start (Development)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend
yarn install
npx expo start
```

## Production Deployment

### Option 1: Docker Compose

```bash
cd devops
cp .env.production.template .env.production
# Edit .env.production with your values

docker-compose up -d
```

### Option 2: AWS/GCP/Azure

1. **Database**: Use MongoDB Atlas (managed)
2. **Backend**: Deploy to AWS ECS / GCP Cloud Run / Azure Container Apps
3. **Redis**: Use ElastiCache / Memorystore / Azure Cache
4. **CDN**: CloudFront / Cloud CDN for static assets

### Option 3: Kubernetes

```yaml
# Example K8s deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: splitbill-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: splitbill-api
  template:
    spec:
      containers:
        - name: api
          image: splitbill-pro:latest
          ports:
            - containerPort: 8001
          envFrom:
            - secretRef:
                name: splitbill-secrets
```

## SSL/HTTPS Setup

```bash
# Using Let's Encrypt with certbot
sudo certbot --nginx -d splitbillpro.app -d www.splitbillpro.app
```

## Database Indexes

The app creates these indexes automatically on startup:
- `users`: user_id (unique), email (unique)
- `user_sessions`: session_token (unique), user_id
- `bills`: bill_id (unique), owner_id, status, compound(owner_id, status), compound(owner_id, created_at)
- `share_links`: token (unique), bill_id
- `exchange_rates`: compound(base_currency, target_currency)
- `subscriptions`: user_id
- `audit_logs`: compound(user_id, timestamp)
- `idempotency_keys`: key (unique), created_at (TTL: 24h)

## Monitoring & Observability

### Structured Logging
All logs are JSON-formatted with correlation IDs:
```json
{"timestamp": "2026-02-27T12:00:00Z", "level": "INFO", "logger": "splitbill", "message": "GET /api/bills → 200 (15ms)", "correlation_id": "abc-123"}
```

### Health Check
```bash
curl https://splitbillpro.app/api/health
# {"status": "ok", "service": "SplitBill Pro API", "version": "2.0.0"}
```

### Error Monitoring (Sentry-Ready)
Add SENTRY_DSN to environment and install `sentry-sdk[fastapi]`.

## Scaling Strategy

| Component | Scaling Method | Target |
|-----------|---------------|--------|
| API | Horizontal (replicas) | 3-10 pods |
| MongoDB | Replica set + sharding | 3-node RS |
| Redis | Cluster mode | 3-node |
| Nginx | Load balancer | AWS ALB |

## Production Checklist

- [ ] HTTPS enforced (HSTS enabled)
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled (60 req/min default)
- [ ] Database backups scheduled (daily)
- [ ] Log aggregation configured
- [ ] Error monitoring active
- [ ] Health checks configured
- [ ] Auto-scaling rules set
- [ ] SSL certificates auto-renewal
- [ ] Secrets managed securely (AWS Secrets Manager / Vault)
