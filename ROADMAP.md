# Microservices Architecture with NestJS - Roadmap

## 0. TL;DR

You are learning backend development with NestJS in a microservices architecture.

### System Architecture

```
Domain services: api-gateway, auth, posts, notification, subscription, payment, admin

                 ┌────────────┐  gRPC   ┌─────────────┐
                 │   Auth     │─────────▶│   Posts     │
                 │(users,jwt) │◀─────────│             │
                 └────────────┘ Kafka evt└─────────────┘
                       ▲                        ▲
                       │                        │
                       │Kafka user.*            │Kafka post.*
                       │                        │
                       └────────────┐           ▼
                                   │      ┌───────────────┐
                        RabbitMQ   │      │ Notification  │─▶ SMTP / FCM
                    send-email.cmd ▷      │               │
                        push.cmd ▷        └───────────────┘
                                   │            ▲
                                   │            │Kafka pay.*
                                   │            │Rabbit
                 ┌────────────┐ gRPC ┌────────────┴───┐
                 │Subscription│──────│    Payment     │─▶ Stripe stub
                 └────────────┘      └────────────────┘
                     Kafka sub.*              ▲
                                             │Kafka/HTTP
                                      ┌──────────────┐
                                      │    Admin     │
                                      └──────────────┘

All services: Winston → Loki → Grafana
              Traces → Jaeger
```

### Key Ideas
- Clear separation of bounded contexts
- Three communication methods for practice
- Log audit extracted into a separate service

## 2. Services and Their Modules

| Service | Main Modules | DB | Transport |
|---------|--------------|-----|-----------|
| api-gateway | auth-proxy, posts-proxy, payments-proxy, rate-limit | — | HTTP in, gRPC/Kafka out |
| auth | users, roles, jwt, refresh-tokens | PostgreSQL | gRPC, Kafka ("user.*") |
| posts | posts, comments, feed | PostgreSQL + Redis cache | gRPC, Kafka ("post.*") |
| notification | mail, push, templates | Redis (delayed) | RabbitMQ consumer, Kafka ("user.", "post.") |
| subscription | plans, webhooks | PostgreSQL | gRPC to payment, Kafka ("sub.*") |
| payment | invoices, stripe-stub | PostgreSQL | gRPC ("getUser", "charge"), Kafka ("pay.*") |
| admin | audit, metrics aggregation, feature-flags | MongoDB | gRPC to all services |
| logger (infra) | log-collector, trace-ingest | Loki | HTTP/GRPC ingest |

Each service follows Nest's layered architecture:
```
domain → application → infrastructure → interface (controller/consumer)
```

## 3. Sprint Plan (2 weeks each)

### Sprint 0: Bootstrap
**Goals:** Infrastructure, CI/CD skeleton

**Critical Tasks:**
- Create GitHub org, repo per service
- Docker compose with: Kafka, Zookeeper, RabbitMQ, PostgreSQL, Loki, Promtail, Grafana, Jaeger
- Common linters, pre-commit, Husky
- Helm charts scaffolding

### Sprint 1: Auth + Gateway
**Goals:** Authorization, tokens, gRPC

**Critical Tasks:**
- Auth service (Nest microservice)
- gRPC contract (proto) and code-gen
- API-Gateway (HTTP) + JWT guard
- Kafka "user.created"
- Unit + e2e tests (supertest)
- Seed 10k users

### Sprint 2: Posts
**Goals:** Posts CRUD, connection with Auth

**Critical Tasks:**
- Posts service: entities, repos
- gRPC request user-profile from Auth (demo sync)
- Kafka "post.created/updated"
- Redis cache layer
- Gatling smoke test (CRUD 100 rps)

### Sprint 3: Notification
**Goals:** RabbitMQ & event-driven

**Critical Tasks:**
- Notification service
- Consumers: Rabbit (send-email, send-push)
- Kafka consumer "user.created", "post.created" → queues tasks in Rabbit
- Winston → Loki
- Contract tests (Pact) between Posts and Notification

### Sprint 4: Subscription + Payment
**Goals:** Payment flow, Saga

**Critical Tasks:**
- Subscription service (orchestrator)
- Payment service (Stripe stub)
- gRPC request-response
- Kafka Saga events: subscription.requested → payment.success → subscription.activated
- Dead-letter queue (Rabbit)

### Sprint 5: Admin + Observability
**Goals:** Roles, log panel, load testing

**Critical Tasks:**
- Admin service with RBAC (gRPC to others)
- Metrics collection Prometheus, Grafana dashboards
- Log export function (Loki query)
- k6 scenarios: 1k rps, scaling to 10k
- Performance report

### Sprint 6: Hardening + Deploy
**Goals:** k8s, auto-scale, chaos

**Critical Tasks:**
- Kubernetes deployment (Helm)
- HPA by CPU and Kafka lag
- Istio (or open-source ingress)
- Chaos-mesh experiment: kill Posts, verify Saga
- Final demo, documentation

*(If time is limited — combine 5 and 6)*

## 4. Communications — Practice Tasks

### gRPC
- Auth ↔ Gateway (login, validateToken)
- Posts ↔ Auth (getUserProfile)
- Subscription ↔ Payment

### Kafka (event stream)
- user.created, post.created, payment.succeeded, subscription.activated
- Demonstrate consumer groups, partitioning, offset-lag metrics

### RabbitMQ (task queue)
- send-email, send-push (fan-out)
- dead-letter → retry → discard

## 5. Logging, Tracing, Metrics

- **Winston** everywhere + transport http → Logger service
- **Logger** = Grafana Loki + Promtail sidecar (practice with json logs)
- **Tracing:** Nest opentelemetry module → Jaeger
- **Metrics:** @willsoto/nestjs-prometheus. Dashboard RPS, latency, error %, Kafka lag

## 6. Load Testing

**Tool:** k6 (or Gatling)

### Scenario Template:
```javascript
VU: 50 → 500
Ramp: 10m
— POST /auth/sign-in (25%)
— GET /posts/feed (40%)
— POST /posts (10%)
— POST /subscription (15%)
— POST /posts/:id/like (10%)
SLA: 95% < 200 ms, error < 0.5%
```

### Process:
1. Generate seeds (10k users, 100k posts) — TypeORM seed script
2. Run k6 in k8s job
3. Collect Grafana metrics; identify bottlenecks (DB CPU, Kafka lag)
4. Tuning: indexes, connection-pool, HPA
5. Repeat until target metrics achieved

## 7. Testing/Seed Strategy

- Each service has `scripts/seed.ts` (Nest CLI + Faker)
- e2e tests run in CI (`docker-compose -f docker-compose.test.yml`)
- Pact files versioned in separate `contracts` repo

## 8. Final Deployment

### Minimal: 
`docker-compose.prod.yml`

### Production-like:
- k8s (AKS/EKS/k3d)
- Helm charts per service (values.yaml — replica count)
- Ingress (NGINX) + cert-manager (Let's Encrypt)
- Secrets: sealed-secrets or HashiCorp Vault dev-mode

### GitHub Actions workflow:
```
Build → Unit tests → Docker build & push → Helm upgrade --install
```

## 9. Demo Readiness Checklist

- [ ] All services start with single command `make dev`
- [ ] `k6 run smoke.js` passes SLA
- [ ] Grafana shows dashboards
- [ ] Loki stores logs ≥ 3 days, can filter by post_id
- [ ] Chaos experiment: kill payment-pod; Saga completes with "subscription.failed"
- [ ] README contains diagram + Postman/Thunder Client collection

**Good luck with your training!**