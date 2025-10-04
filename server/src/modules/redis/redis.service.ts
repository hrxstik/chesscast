import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT!, 10) || 6379;
    const password = process.env.REDIS_PWD || undefined;

    this.client = new Redis({ host, port, password });
    this.client.on('connect', () => {
      console.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      console.error('Redis client error', err);
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    if (ttlSeconds) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const stream = this.client.scanStream({
      match: pattern,
      count: 100,
    });

    stream.on('data', (keys: string[]) => {
      if (keys.length) {
        this.client.del(...keys).catch(console.error);
      }
    });

    return new Promise((resolve, reject) => {
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });
  }
}
