import Redis from 'ioredis';

if (!process.env.REDIS_URL) {
  throw new Error('Please define the REDIS_URL environment variable');
}

const redis = new Redis(process.env.REDIS_URL, {
  reconnectOnError: (err) => {
    console.error('Redis reconnect on error:', err);
    return true;
  },
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export default redis;