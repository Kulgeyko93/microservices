# Microservices Development Guide

Comprehensive guide for working with microservices architecture in this project.

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Creating a New Microservice](#creating-a-new-microservice)
3. [Inter-Service Communication](#inter-service-communication)
4. [Development Commands](#development-commands)
5. [Configuration](#configuration)
6. [Deployment](#deployment)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Testing](#testing)
9. [Best Practices](#best-practices)

## Project Architecture

### Microservices Structure

```
apps/
├── api-gateway/          # API Gateway - entry point for clients
│   ├── src/
│   │   ├── main.ts
│   │   ├── api-gateway.module.ts
│   │   ├── api-gateway.controller.ts
│   │   └── api-gateway.service.ts
│   └── tsconfig.app.json
├── auth-service/         # Authentication service
│   ├── src/
│   │   ├── main.ts
│   │   ├── auth-service.module.ts
│   │   ├── auth-service.controller.ts
│   │   └── auth-service.service.ts
│   └── tsconfig.app.json
└── user-service/         # User management service
    ├── src/
    │   ├── main.ts
    │   ├── user-service.module.ts
    │   ├── user-service.controller.ts
    │   └── user-service.service.ts
    └── tsconfig.app.json
```

### Architecture Principles

1. **API Gateway Pattern** - single entry point for all client requests
2. **Event-Driven Architecture** - communication through RabbitMQ
3. **Database per Service** - each service has its own database
4. **Centralized Configuration** - shared configuration through environment variables

## Creating a New Microservice

### Step 1: Create Structure

```bash
# Create new service folder
mkdir -p apps/product-service/src

# Create main files
touch apps/product-service/src/main.ts
touch apps/product-service/src/product-service.module.ts
touch apps/product-service/src/product-service.controller.ts
touch apps/product-service/src/product-service.service.ts
touch apps/product-service/tsconfig.app.json
```

### Step 2: TypeScript Configuration

Create `apps/product-service/tsconfig.app.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/product-service"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### Step 3: Main Service File

`apps/product-service/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ProductServiceModule } from './product-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ProductServiceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'product_queue',
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  await app.listen();
  console.log('Product Service is running');
}
bootstrap();
```

### Step 4: Service Module

`apps/product-service/src/product-service.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductServiceController } from './product-service.controller';
import { ProductService } from './product-service.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/products',
    ),
  ],
  controllers: [ProductServiceController],
  providers: [ProductService],
})
export class ProductServiceModule {}
```

### Step 5: Service Controller

`apps/product-service/src/product-service.controller.ts`:

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductService } from './product-service.service';

@Controller()
export class ProductServiceController {
  constructor(private readonly productService: ProductService) {}

  @MessagePattern({ cmd: 'get-product' })
  async getProduct(@Payload() data: { id: string }) {
    return this.productService.getProduct(data.id);
  }

  @MessagePattern({ cmd: 'create-product' })
  async createProduct(@Payload() data: any) {
    return this.productService.createProduct(data);
  }

  @MessagePattern({ cmd: 'update-product' })
  async updateProduct(@Payload() data: { id: string; productData: any }) {
    return this.productService.updateProduct(data.id, data.productData);
  }

  @MessagePattern({ cmd: 'delete-product' })
  async deleteProduct(@Payload() data: { id: string }) {
    return this.productService.deleteProduct(data.id);
  }

  @MessagePattern({ cmd: 'list-products' })
  async listProducts(@Payload() data: { page?: number; limit?: number }) {
    return this.productService.listProducts(data.page, data.limit);
  }
}
```

### Step 6: Service Implementation

`apps/product-service/src/product-service.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  private products = [
    { id: '1', name: 'Laptop', price: 999.99, category: 'Electronics' },
    { id: '2', name: 'Book', price: 19.99, category: 'Education' },
  ];

  async getProduct(id: string) {
    this.logger.log(`Getting product with id: ${id}`);
    
    const product = this.products.find(p => p.id === id);
    
    if (!product) {
      return {
        success: false,
        error: 'Product not found',
      };
    }

    return {
      success: true,
      data: product,
    };
  }

  async createProduct(productData: any) {
    this.logger.log(`Creating product: ${JSON.stringify(productData)}`);
    
    const newProduct = {
      id: Date.now().toString(),
      ...productData,
      createdAt: new Date(),
    };
    
    this.products.push(newProduct);
    
    return {
      success: true,
      data: newProduct,
      message: 'Product created successfully',
    };
  }

  async updateProduct(id: string, productData: any) {
    this.logger.log(`Updating product ${id}: ${JSON.stringify(productData)}`);
    
    const productIndex = this.products.findIndex(p => p.id === id);
    
    if (productIndex === -1) {
      return {
        success: false,
        error: 'Product not found',
      };
    }

    this.products[productIndex] = { 
      ...this.products[productIndex], 
      ...productData,
      updatedAt: new Date(),
    };
    
    return {
      success: true,
      data: this.products[productIndex],
      message: 'Product updated successfully',
    };
  }

  async deleteProduct(id: string) {
    this.logger.log(`Deleting product with id: ${id}`);
    
    const productIndex = this.products.findIndex(p => p.id === id);
    
    if (productIndex === -1) {
      return {
        success: false,
        error: 'Product not found',
      };
    }

    const deletedProduct = this.products.splice(productIndex, 1)[0];
    
    return {
      success: true,
      data: deletedProduct,
      message: 'Product deleted successfully',
    };
  }

  async listProducts(page = 1, limit = 10) {
    this.logger.log(`Listing products - page: ${page}, limit: ${limit}`);
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = this.products.slice(startIndex, endIndex);
    
    return {
      success: true,
      data: {
        items: paginatedProducts,
        total: this.products.length,
        page,
        limit,
        totalPages: Math.ceil(this.products.length / limit),
      },
    };
  }
}
```

### Step 7: Update Configuration

1. Add new service to `nest-cli.json`:

```json
{
  "projects": {
    "api-gateway": {
      "type": "application",
      "root": "apps/api-gateway",
      "entryFile": "main",
      "sourceRoot": "apps/api-gateway/src",
      "compilerOptions": {
        "tsConfigPath": "apps/api-gateway/tsconfig.app.json"
      }
    },
    "product-service": {
      "type": "application",
      "root": "apps/product-service",
      "entryFile": "main",
      "sourceRoot": "apps/product-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/product-service/tsconfig.app.json"
      }
    }
  }
}
```

2. Add scripts to `package.json`:

```json
{
  "scripts": {
    "build:product": "nest build product-service",
    "start:product": "nest start product-service",
    "start:product:dev": "nest start product-service --watch",
    "start:all:dev": "concurrently \"npm run start:gateway:dev\" \"npm run start:auth:dev\" \"npm run start:user:dev\" \"npm run start:product:dev\""
  }
}
```

3. Update API Gateway to connect to the new service:

```typescript
// In api-gateway.module.ts
ClientsModule.register([
  {
    name: 'PRODUCT_SERVICE',
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'product_queue',
      queueOptions: {
        durable: true,
      },
    },
  },
])

// In api-gateway.controller.ts
@Controller('products')
export class ProductController {
  constructor(
    @Inject('PRODUCT_SERVICE') private readonly productClient: ClientProxy,
  ) {}

  @Get()
  async listProducts(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.productClient.send({ cmd: 'list-products' }, { page, limit });
  }

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    return this.productClient.send({ cmd: 'get-product' }, { id });
  }

  @Post()
  async createProduct(@Body() productData: any) {
    return this.productClient.send({ cmd: 'create-product' }, productData);
  }

  @Put(':id')
  async updateProduct(@Param('id') id: string, @Body() productData: any) {
    return this.productClient.send({ cmd: 'update-product' }, { id, productData });
  }

  @Delete(':id')
  async deleteProduct(@Param('id') id: string) {
    return this.productClient.send({ cmd: 'delete-product' }, { id });
  }
}
```

## Inter-Service Communication

### Communication Types

1. **Synchronous (Request-Response)**:
   ```typescript
   // In API Gateway
   @Get('products/:id')
   async getProduct(@Param('id') id: string) {
     return this.productClient.send({ cmd: 'get-product' }, { id });
   }
   ```

2. **Asynchronous (Event-based)**:
   ```typescript
   // Sending event
   this.productClient.emit('product.created', productData);
   
   // Handling event
   @EventPattern('product.created')
   handleProductCreated(@Payload() data: any) {
     // Handle the event
     this.logger.log(`Product created: ${data.id}`);
   }
   ```

3. **Saga Pattern for Distributed Transactions**:
   ```typescript
   @Injectable()
   export class OrderSaga {
     @EventPattern('order.created')
     async handleOrderCreated(@Payload() orderData: any) {
       try {
         // Step 1: Reserve inventory
         await this.inventoryClient.send({ cmd: 'reserve-items' }, orderData.items);
         
         // Step 2: Process payment
         await this.paymentClient.send({ cmd: 'process-payment' }, orderData.payment);
         
         // Step 3: Confirm order
         await this.orderClient.emit('order.confirmed', orderData);
       } catch (error) {
         // Compensating actions
         await this.orderClient.emit('order.failed', { orderId: orderData.id, error });
       }
     }
   }
   ```

### Communication Patterns

1. **Command Pattern** - for state-changing operations
2. **Query Pattern** - for data retrieval
3. **Event Pattern** - for notifications and side effects

## Development Commands

### Development

```bash
# Build all services
npm run build

# Build specific service
npm run build:gateway
npm run build:auth
npm run build:user
npm run build:product

# Start in development mode
npm run start:gateway:dev
npm run start:auth:dev
npm run start:user:dev
npm run start:product:dev

# Start all services concurrently
npm run start:all:dev
```

### Code Generation

```bash
# Create new module
nest g module products apps/product-service/src

# Create new controller
nest g controller products apps/product-service/src

# Create new service
nest g service products apps/product-service/src

# Create new application
nest g app new-service

# Create new library
nest g lib shared

# Create DTOs
nest g class dto/create-product.dto apps/product-service/src --no-spec

# Create interfaces
nest g interface interfaces/product.interface apps/product-service/src --no-spec
```

### Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- product.service.spec.ts

# Debug tests
npm run test:debug
```

### Linting and Formatting

```bash
# Check code quality
npm run lint

# Fix linting issues
npm run lint -- --fix

# Format code
npm run format

# Check formatting
npm run format -- --check
```

## Configuration

### Environment Variables

Create environment files for different environments:

- `.env.development`
- `.env.production`
- `.env.test`
- `.env.local`

Example `.env.development`:

```env
# Application
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/microservices
MONGODB_AUTH_URI=mongodb://localhost:27017/auth
MONGODB_USER_URI=mongodb://localhost:27017/users
MONGODB_PRODUCT_URI=mongodb://localhost:27017/products

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=password

# JWT
JWT_SECRET=development-secret-key-change-in-production
JWT_EXPIRATION=3600
JWT_REFRESH_SECRET=refresh-secret-key
JWT_REFRESH_EXPIRATION=86400

# Services Ports
API_GATEWAY_PORT=3000
AUTH_SERVICE_PORT=3001
USER_SERVICE_PORT=3002
PRODUCT_SERVICE_PORT=3003

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DEST=./uploads

# External APIs
EXTERNAL_API_URL=https://api.example.com
EXTERNAL_API_KEY=your-api-key-here
```

### Service-Specific Configuration

Each service should use its own database:

```typescript
// auth-service
MongooseModule.forRoot(
  process.env.MONGODB_AUTH_URI || 'mongodb://localhost:27017/auth',
)

// user-service
MongooseModule.forRoot(
  process.env.MONGODB_USER_URI || 'mongodb://localhost:27017/users',
)

// product-service
MongooseModule.forRoot(
  process.env.MONGODB_PRODUCT_URI || 'mongodb://localhost:27017/products',
)
```

### Configuration Validation

```typescript
import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  MONGODB_URI: Joi.string().required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  RABBITMQ_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('3600'),
});

// In module
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: configValidationSchema,
  validationOptions: {
    allowUnknown: true,
    abortEarly: true,
  },
})
```

## Deployment

### Docker

1. **Service-specific Dockerfile**:

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY apps/product-service ./apps/product-service
COPY libs ./libs

# Build the application
RUN npm run build:product

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/product-service ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/main"]
```

2. **Docker Compose for entire system**:

```yaml
version: '3.8'

services:
  # Infrastructure
  mongodb:
    image: mongo:6.0
    container_name: microservices-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongodb_data:/data/db
    networks:
      - microservices-network

  redis:
    image: redis:7-alpine
    container_name: microservices-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - microservices-network

  rabbitmq:
    image: rabbitmq:3-management
    container_name: microservices-rabbitmq
    restart: unless-stopped
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - microservices-network

  # Services
  api-gateway:
    build:
      context: .
      dockerfile: apps/api-gateway/Dockerfile
    container_name: api-gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://admin:password@mongodb:27017/gateway?authSource=admin
      - REDIS_HOST=redis
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    depends_on:
      - mongodb
      - redis
      - rabbitmq
    networks:
      - microservices-network

  auth-service:
    build:
      context: .
      dockerfile: apps/auth-service/Dockerfile
    container_name: auth-service
    environment:
      - NODE_ENV=production
      - MONGODB_AUTH_URI=mongodb://admin:password@mongodb:27017/auth?authSource=admin
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    depends_on:
      - mongodb
      - rabbitmq
    networks:
      - microservices-network

  user-service:
    build:
      context: .
      dockerfile: apps/user-service/Dockerfile
    container_name: user-service
    environment:
      - NODE_ENV=production
      - MONGODB_USER_URI=mongodb://admin:password@mongodb:27017/users?authSource=admin
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    depends_on:
      - mongodb
      - rabbitmq
    networks:
      - microservices-network

  product-service:
    build:
      context: .
      dockerfile: apps/product-service/Dockerfile
    container_name: product-service
    environment:
      - NODE_ENV=production
      - MONGODB_PRODUCT_URI=mongodb://admin:password@mongodb:27017/products?authSource=admin
      - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
    depends_on:
      - mongodb
      - rabbitmq
    networks:
      - microservices-network

volumes:
  mongodb_data:
  redis_data:
  rabbitmq_data:

networks:
  microservices-network:
    driver: bridge
```

### Kubernetes

Example Kubernetes manifests:

1. **Deployment**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  labels:
    app: product-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: product-service
  template:
    metadata:
      labels:
        app: product-service
    spec:
      containers:
      - name: product-service
        image: product-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_PRODUCT_URI
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: uri
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: rabbitmq-secret
              key: url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: product-service
spec:
  selector:
    app: product-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

2. **ConfigMap**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
```

3. **Secret**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  JWT_SECRET: "your-jwt-secret"
  MONGODB_URI: "mongodb://username:password@mongodb:27017/database"
  RABBITMQ_URL: "amqp://username:password@rabbitmq:5672"
```

## Monitoring and Logging

### Structured Logging

```typescript
import { Logger } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  async createProduct(productData: any, context?: { userId?: string; traceId?: string }) {
    const logContext = {
      method: 'createProduct',
      userId: context?.userId,
      traceId: context?.traceId,
      productData: { name: productData.name, category: productData.category },
    };

    this.logger.log('Creating product', logContext);
    
    try {
      const product = await this.performCreate(productData);
      
      this.logger.log('Product created successfully', {
        ...logContext,
        productId: product.id,
        duration: Date.now() - startTime,
      });
      
      return { success: true, data: product };
    } catch (error) {
      this.logger.error('Failed to create product', {
        ...logContext,
        error: error.message,
        stack: error.stack,
      });
      
      throw error;
    }
  }
}
```

### Health Checks

```typescript
import { Controller, Get } from '@nestjs/common';
import { 
  HealthCheck, 
  HealthCheckService, 
  MongooseHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator 
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
      () => this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

### Metrics with OpenTelemetry

```typescript
// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// metrics.service.ts
import { Injectable } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('product-service');
  private readonly requestCounter = this.meter.createCounter('http_requests_total');
  private readonly requestDuration = this.meter.createHistogram('http_request_duration_ms');

  recordRequest(method: string, route: string, statusCode: number, duration: number) {
    this.requestCounter.add(1, {
      method,
      route,
      status_code: statusCode.toString(),
    });

    this.requestDuration.record(duration, {
      method,
      route,
    });
  }
}
```

### Custom Metrics

```typescript
import { Injectable } from '@nestjs/common';
import { Gauge, Counter, Histogram, register } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  private readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  });

  private readonly activeConnections = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
  });

  constructor() {
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.activeConnections);
  }

  incrementHttpRequests(method: string, route: string, statusCode: number) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
  }

  observeHttpDuration(method: string, route: string, duration: number) {
    this.httpRequestDuration.observe({ method, route }, duration / 1000);
  }

  setActiveConnections(count: number) {
    this.activeConnections.set(count);
  }

  getMetrics() {
    return register.metrics();
  }
}
```

## Testing

### Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product-service.service';
import { Logger } from '@nestjs/common';

describe('ProductService', () => {
  let service: ProductService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    logger = module.get<Logger>(Logger);
  });

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      const productData = { 
        name: 'Test Product', 
        price: 100, 
        category: 'Electronics' 
      };
      
      const result = await service.createProduct(productData);
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Product');
      expect(result.data.id).toBeDefined();
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating product'),
        expect.any(Object)
      );
    });

    it('should handle validation errors', async () => {
      const invalidProductData = { price: -100 };
      
      await expect(service.createProduct(invalidProductData))
        .rejects
        .toThrow('Invalid product data');
    });
  });

  describe('getProduct', () => {
    it('should return a product when found', async () => {
      const productId = '1';
      const result = await service.getProduct(productId);
      
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(productId);
    });

    it('should return error when product not found', async () => {
      const nonExistentId = 'non-existent';
      const result = await service.getProduct(nonExistentId);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Product not found');
    });
  });
});
```

### Integration Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ProductServiceModule } from './product-service.module';
import { ProductService } from './product-service.service';

describe('ProductService Integration', () => {
  let app: INestApplication;
  let service: ProductService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProductServiceModule],
    })
    .overrideProvider('RABBITMQ_CLIENT')
    .useValue({
      send: jest.fn(),
      emit: jest.fn(),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    service = moduleFixture.get<ProductService>(ProductService);
    
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should handle product creation with database interaction', async () => {
    const productData = {
      name: 'Integration Test Product',
      price: 299.99,
      category: 'Test Category',
    };

    const result = await service.createProduct(productData);

    expect(result.success).toBe(true);
    expect(result.data.name).toBe(productData.name);
    
    // Verify product was actually created
    const retrievedProduct = await service.getProduct(result.data.id);
    expect(retrievedProduct.success).toBe(true);
    expect(retrievedProduct.data.name).toBe(productData.name);
  });

  it('should handle concurrent product operations', async () => {
    const products = Array.from({ length: 10 }, (_, i) => ({
      name: `Product ${i}`,
      price: 100 + i,
      category: 'Test',
    }));

    // Create products concurrently
    const createPromises = products.map(product => 
      service.createProduct(product)
    );
    
    const results = await Promise.all(createPromises);
    
    // All should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Verify all products exist
    const listResult = await service.listProducts(1, 20);
    expect(listResult.data.items.length).toBeGreaterThanOrEqual(10);
  });
});
```

### End-to-End Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ApiGatewayModule } from '../src/api-gateway.module';
import { ClientProxy } from '@nestjs/microservices';

describe('API Gateway E2E', () => {
  let app: INestApplication;
  let productClient: ClientProxy;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiGatewayModule],
    })
    .overrideProvider('PRODUCT_SERVICE')
    .useValue({
      send: jest.fn().mockImplementation((pattern, data) => {
        if (pattern.cmd === 'create-product') {
          return Promise.resolve({
            success: true,
            data: { id: '1', ...data },
          });
        }
        if (pattern.cmd === 'get-product') {
          return Promise.resolve({
            success: true,
            data: { id: data.id, name: 'Test Product', price: 100 },
          });
        }
      }),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    productClient = moduleFixture.get('PRODUCT_SERVICE');
    
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/products (POST)', () => {
    it('should create a new product', () => {
      const productData = {
        name: 'E2E Test Product',
        price: 199.99,
        category: 'Electronics',
      };

      return request(app.getHttpServer())
        .post('/products')
        .send(productData)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.name).toBe(productData.name);
          expect(productClient.send).toHaveBeenCalledWith(
            { cmd: 'create-product' },
            productData
          );
        });
    });

    it('should validate product data', () => {
      const invalidProductData = {
        name: '', // Invalid: empty name
        price: -100, // Invalid: negative price
      };

      return request(app.getHttpServer())
        .post('/products')
        .send(invalidProductData)
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('validation');
        });
    });
  });

  describe('/products/:id (GET)', () => {
    it('should get a product by id', () => {
      const productId = '1';

      return request(app.getHttpServer())
        .get(`/products/${productId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(productId);
          expect(productClient.send).toHaveBeenCalledWith(
            { cmd: 'get-product' },
            { id: productId }
          );
        });
    });
  });

  describe('/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });
  });
});
```

### Performance Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product-service.service';

describe('ProductService Performance', () => {
  let service: ProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductService],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should handle high load of product creation', async () => {
    const startTime = Date.now();
    const concurrency = 100;
    const promises = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        service.createProduct({
          name: `Product ${i}`,
          price: Math.random() * 1000,
          category: 'Performance Test',
        })
      );
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // All operations should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Should complete within reasonable time (adjust as needed)
    expect(duration).toBeLessThan(5000); // 5 seconds

    console.log(`Created ${concurrency} products in ${duration}ms`);
    console.log(`Average: ${duration / concurrency}ms per product`);
  });

  it('should maintain performance under memory pressure', async () => {
    // Create a large number of products to test memory usage
    const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
      name: `Large Dataset Product ${i}`,
      price: Math.random() * 1000,
      category: 'Memory Test',
      description: 'A'.repeat(1000), // Large description to increase memory usage
    }));

    const startMemory = process.memoryUsage();
    
    for (const productData of largeDataSet) {
      await service.createProduct(productData);
    }

    const endMemory = process.memoryUsage();
    const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

    // Memory increase should be reasonable (adjust threshold as needed)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB

    console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
  });
});
```

## Best Practices

### 1. Code Organization

```typescript
// Use feature-based modules
apps/product-service/src/
├── modules/
│   ├── products/
│   │   ├── dto/
│   │   │   ├── create-product.dto.ts
│   │   │   ├── update-product.dto.ts
│   │   │   └── product-response.dto.ts
│   │   ├── entities/
│   │   │   └── product.entity.ts
│   │   ├── interfaces/
│   │   │   └── product.interface.ts
│   │   ├── repositories/
│   │   │   └── product.repository.ts
│   │   ├── products.controller.ts
│   │   ├── products.service.ts
│   │   └── products.module.ts
│   ├── categories/
│   └── inventory/
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── config/
└── main.ts
```

### 2. Error Handling

```typescript
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  async createProduct(productData: CreateProductDto): Promise<ProductResponse> {
    try {
      this.validateProductData(productData);
      
      const product = await this.productRepository.create(productData);
      
      this.logger.log(`Product created: ${product.id}`);
      
      return {
        success: true,
        data: product,
        message: 'Product created successfully',
      };
      
    } catch (error) {
      this.logger.error(`Product creation failed: ${error.message}`, error.stack);
      
      if (error instanceof ServiceError) {
        throw error;
      }
      
      if (error.code === 11000) { // MongoDB duplicate key error
        throw new ServiceError(
          'Product with this name already exists',
          'DUPLICATE_PRODUCT',
          HttpStatus.CONFLICT
        );
      }
      
      throw new ServiceError(
        'Failed to create product',
        'CREATION_FAILED',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { originalError: error.message }
      );
    }
  }

  private validateProductData(productData: CreateProductDto): void {
    if (!productData.name || productData.name.trim().length === 0) {
      throw new ServiceError(
        'Product name is required',
        'INVALID_NAME',
        HttpStatus.BAD_REQUEST
      );
    }

    if (productData.price <= 0) {
      throw new ServiceError(
        'Product price must be greater than 0',
        'INVALID_PRICE',
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
```

### 3. Data Validation

```typescript
import { IsString, IsNumber, IsNotEmpty, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ProductCategory {
  ELECTRONICS = 'electronics',
  CLOTHING = 'clothing',
  BOOKS = 'books',
  HOME = 'home',
}

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Laptop' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ description: 'Product description', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({ description: 'Product price', example: 999.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  price: number;

  @ApiProperty({ description: 'Product category', enum: ProductCategory })
  @IsEnum(ProductCategory)
  category: ProductCategory;

  @ApiProperty({ description: 'Stock quantity', example: 100 })
  @IsNumber()
  @Min(0)
  @Max(999999)
  stock: number;

  @ApiProperty({ description: 'Product tags', required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }) => value?.map((tag: string) => tag.trim().toLowerCase()))
  tags?: string[];
}

export class UpdateProductDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({ required: false })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  @IsOptional()
  price?: number;

  @ApiProperty({ required: false })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(999999)
  @IsOptional()
  stock?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }) => value?.map((tag: string) => tag.trim().toLowerCase()))
  tags?: string[];
}

export class ProductQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
```

### 4. Caching Strategies

```typescript
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class ProductService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private productRepository: ProductRepository,
  ) {}

  async getProduct(id: string): Promise<ProductResponse> {
    // Try cache first
    const cacheKey = `product:${id}`;
    let product = await this.cacheManager.get<Product>(cacheKey);

    if (!product) {
      // Cache miss - fetch from database
      product = await this.productRepository.findById(id);
      
      if (product) {
        // Cache for 1 hour
        await this.cacheManager.set(cacheKey, product, 3600);
      }
    }

    if (!product) {
      throw new ServiceError('Product not found', 'PRODUCT_NOT_FOUND', 404);
    }

    return { success: true, data: product };
  }

  async updateProduct(id: string, updateData: UpdateProductDto): Promise<ProductResponse> {
    const product = await this.productRepository.update(id, updateData);
    
    if (product) {
      // Invalidate cache
      await this.cacheManager.del(`product:${id}`);
      
      // Update cache with new data
      await this.cacheManager.set(`product:${id}`, product, 3600);
      
      // Invalidate related cache entries
      await this.invalidateRelatedCache(product.category);
    }

    return { success: true, data: product };
  }

  async searchProducts(query: ProductQueryDto): Promise<PaginatedProductResponse> {
    const cacheKey = `products:search:${JSON.stringify(query)}`;
    let result = await this.cacheManager.get<PaginatedProductResponse>(cacheKey);

    if (!result) {
      result = await this.productRepository.search(query);
      
      // Cache search results for 5 minutes
      await this.cacheManager.set(cacheKey, result, 300);
    }

    return result;
  }

  private async invalidateRelatedCache(category: ProductCategory): Promise<void> {
    const pattern = `products:search:*${category}*`;
    // Implementation depends on cache store (Redis supports pattern-based deletion)
    await this.cacheManager.store.reset(); // Simplified - in real app use pattern matching
  }
}
```

### 5. Database Migrations and Seeding

```typescript
// migrations/001-create-products-table.ts
import { Migration } from '@mikro-orm/migrations';

export class CreateProductsTable20231101000001 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE products (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        tags JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        
        INDEX idx_products_category (category),
        INDEX idx_products_price (price),
        INDEX idx_products_stock (stock),
        INDEX idx_products_created_at (created_at),
        UNIQUE KEY uk_products_name (name)
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE products;');
  }
}

// seeders/product.seeder.ts
import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../repositories/product.repository';

@Injectable()
export class ProductSeeder {
  constructor(private productRepository: ProductRepository) {}

  async seed(): Promise<void> {
    const sampleProducts = [
      {
        name: 'MacBook Pro 16"',
        description: 'Apple MacBook Pro with M2 chip',
        price: 2499.99,
        category: ProductCategory.ELECTRONICS,
        stock: 10,
        tags: ['laptop', 'apple', 'professional'],
      },
      {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones',
        price: 299.99,
        category: ProductCategory.ELECTRONICS,
        stock: 25,
        tags: ['audio', 'wireless', 'music'],
      },
      // ... more products
    ];

    for (const productData of sampleProducts) {
      const exists = await this.productRepository.findByName(productData.name);
      if (!exists) {
        await this.productRepository.create(productData);
      }
    }
  }
}
```

### 6. Security Best Practices

```typescript
// JWT Guard
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token not provided');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

// Rate Limiting
import { Injectable, NestMiddleware } from '@nestjs/common';
import * as rateLimit from 'express-rate-limit';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const limiter = rateLimit.rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });

    limiter(req, res, next);
  }
}

// Input Sanitization
import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (typeof value === 'string') {
      return sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      });
    }

    if (typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value);
    }

    return value;
  }

  private sanitizeObject(obj: any): any {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeHtml(value, {
          allowedTags: [],
          allowedAttributes: {},
        });
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
```

## Conclusion

This microservices architecture provides:

- **Scalability** - services can be scaled independently
- **Reliability** - failure of one service doesn't affect others
- **Flexibility** - different technologies can be used for different services
- **Maintainability** - clear separation of concerns and responsibilities
- **Testability** - services can be tested in isolation
- **Deployment Independence** - each service can be deployed separately

When developing new microservices, follow this guide to ensure architectural consistency and best practices implementation.