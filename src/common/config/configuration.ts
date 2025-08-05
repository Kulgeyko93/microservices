export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/microservices',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    queuePrefix: process.env.RABBITMQ_QUEUE_PREFIX || 'microservices',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'secret-key',
    expiresIn: process.env.JWT_EXPIRATION || '3600s',
  },
  microservices: {
    apiGatewayPort: parseInt(process.env.API_GATEWAY_PORT, 10) || 3000,
    authServicePort: parseInt(process.env.AUTH_SERVICE_PORT, 10) || 3001,
    userServicePort: parseInt(process.env.USER_SERVICE_PORT, 10) || 3002,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});