const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Redis 缓存管理器
 * 提供缓存服务和会话管理
 */
class CacheManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.initialize();
  }

  /**
   * 初始化 Redis 连接
   */
  async initialize() {
    try {
      if (!config.database.redisUrl) {
        logger.warn('Redis URL not configured, running without cache');
        return;
      }

      this.redis = new Redis(config.database.redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000
      });

      // 事件监听
      this.redis.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        logger.info('Redis ready');
      });

      this.redis.on('error', (error) => {
        logger.error('Redis error:', error);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      // 尝试连接
      await this.redis.connect();

    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * 设置缓存
   */
  async set(key, value, ttl = 3600) {
    if (!this.isConnected) {
      logger.debug('Redis not connected, skipping cache set');
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.setex(key, ttl, serializedValue);
      return true;
    } catch (error) {
      logger.error('Failed to set cache:', error, { key });
      return false;
    }
  }

  /**
   * 获取缓存
   */
  async get(key) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      logger.error('Failed to get cache:', error, { key });
      return null;
    }
  }

  /**
   * 删除缓存
   */
  async del(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Failed to delete cache:', error, { key });
      return false;
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Failed to check cache existence:', error, { key });
      return false;
    }
  }

  /**
   * 设置集合缓存（用于去重）
   */
  async sadd(key, ...members) {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.sadd(key, ...members);
      return true;
    } catch (error) {
      logger.error('Failed to add to set:', error, { key });
      return false;
    }
  }

  /**
   * 检查集合成员
   */
  async sismember(key, member) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.sismember(key, member);
      return result === 1;
    } catch (error) {
      logger.error('Failed to check set member:', error, { key, member });
      return false;
    }
  }

  /**
   * 获取集合大小
   */
  async scard(key) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      return await this.redis.scard(key);
    } catch (error) {
      logger.error('Failed to get set size:', error, { key });
      return 0;
    }
  }

  /**
   * 清理过期的集合成员
   */
  async cleanupSet(key, maxSize = 10000) {
    if (!this.isConnected) {
      return;
    }

    try {
      const size = await this.scard(key);
      if (size > maxSize) {
        // 随机移除一些成员
        const removeCount = Math.floor(size * 0.3);
        const members = await this.redis.srandmember(key, removeCount);
        if (members.length > 0) {
          await this.redis.srem(key, ...members);
          logger.info(`Cleaned up ${members.length} members from set ${key}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup set:', error, { key });
    }
  }

  /**
   * 增量计数器
   */
  async incr(key, ttl = 3600) {
    if (!this.isConnected) {
      return 1;
    }

    try {
      const result = await this.redis.incr(key);
      if (result === 1 && ttl > 0) {
        await this.redis.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error('Failed to increment counter:', error, { key });
      return 1;
    }
  }

  /**
   * 获取哈希字段
   */
  async hget(key, field) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.redis.hget(key, field);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      logger.error('Failed to get hash field:', error, { key, field });
      return null;
    }
  }

  /**
   * 设置哈希字段
   */
  async hset(key, field, value, ttl = 3600) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.hset(key, field, serializedValue);
      if (ttl > 0) {
        await this.redis.expire(key, ttl);
      }
      return true;
    } catch (error) {
      logger.error('Failed to set hash field:', error, { key, field });
      return false;
    }
  }

  /**
   * 缓存代币信息
   */
  async cacheTokenInfo(mint, tokenInfo, ttl = 86400) { // 24小时
    const key = `token:${mint}`;
    return this.set(key, tokenInfo, ttl);
  }

  /**
   * 获取缓存的代币信息
   */
  async getCachedTokenInfo(mint) {
    const key = `token:${mint}`;
    return this.get(key);
  }

  /**
   * 缓存交易处理状态
   */
  async markTransactionProcessed(signature, ttl = 86400) { // 24小时
    const key = 'processed_transactions';
    await this.sadd(key, signature);
    if (ttl > 0) {
      await this.redis.expire(key, ttl);
    }
  }

  /**
   * 检查交易是否已处理
   */
  async isTransactionProcessed(signature) {
    const key = 'processed_transactions';
    return this.sismember(key, signature);
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    if (!this.isConnected) {
      return { connected: false };
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      const stats = {
        connected: true,
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace)
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get Redis stats:', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * 解析 Redis INFO 输出
   */
  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(value) ? value : Number(value);
      }
    }
    
    return result;
  }

  /**
   * 健康检查
   */
  async checkHealth() {
    try {
      if (!this.isConnected) {
        return { healthy: false, error: 'Redis not connected' };
      }

      const startTime = Date.now();
      await this.redis.ping();
      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
        connected: this.isConnected
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * 关闭连接
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

// 导出单例实例
const cacheManager = new CacheManager();

module.exports = cacheManager;