const { describe, test, expect, jest, beforeEach, afterEach } = require('@jest/globals');

describe('Cache Manager', () => {
  let CacheManager;
  let cacheManager;
  let mockRedis;

  beforeEach(() => {
    // 创建模拟的 Redis 客户端
    mockRedis = {
      connect: jest.fn(),
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      sadd: jest.fn(),
      sismember: jest.fn(),
      scard: jest.fn(),
      srem: jest.fn(),
      srandmember: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      ping: jest.fn(),
      info: jest.fn(),
      quit: jest.fn(),
      on: jest.fn()
    };

    // 模拟 ioredis
    jest.doMock('ioredis', () => jest.fn(() => mockRedis));

    // 模拟配置
    jest.doMock('../../src/config', () => ({
      database: {
        redisUrl: 'redis://localhost:6379'
      }
    }));

    // 重新加载模块
    delete require.cache[require.resolve('../../src/services/cacheManager')];
    CacheManager = require('../../src/services/cacheManager');
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize Redis connection', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    test('should handle Redis connection events', () => {
      // 模拟连接事件
      const connectHandler = mockRedis.on.mock.calls.find(call => call[0] === 'connect')[1];
      const errorHandler = mockRedis.on.mock.calls.find(call => call[0] === 'error')[1];
      
      expect(() => connectHandler()).not.toThrow();
      expect(() => errorHandler(new Error('Redis error'))).not.toThrow();
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(() => {
      // 模拟 Redis 连接状态
      CacheManager.isConnected = true;
    });

    test('should set cache value with TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await CacheManager.set('test-key', { data: 'test' }, 3600);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify({ data: 'test' })
      );
    });

    test('should get cache value', async () => {
      const testData = { data: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await CacheManager.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    test('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await CacheManager.get('non-existent-key');

      expect(result).toBeNull();
    });

    test('should delete cache key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await CacheManager.del('test-key');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    test('should check if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await CacheManager.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('test-key');
    });
  });

  describe('Set Operations', () => {
    beforeEach(() => {
      CacheManager.isConnected = true;
    });

    test('should add members to set', async () => {
      mockRedis.sadd.mockResolvedValue(1);

      const result = await CacheManager.sadd('test-set', 'member1', 'member2');

      expect(result).toBe(true);
      expect(mockRedis.sadd).toHaveBeenCalledWith('test-set', 'member1', 'member2');
    });

    test('should check set membership', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      const result = await CacheManager.sismember('test-set', 'member1');

      expect(result).toBe(true);
      expect(mockRedis.sismember).toHaveBeenCalledWith('test-set', 'member1');
    });

    test('should get set size', async () => {
      mockRedis.scard.mockResolvedValue(5);

      const result = await CacheManager.scard('test-set');

      expect(result).toBe(5);
      expect(mockRedis.scard).toHaveBeenCalledWith('test-set');
    });

    test('should cleanup large sets', async () => {
      mockRedis.scard.mockResolvedValue(15000);
      mockRedis.srandmember.mockResolvedValue(['member1', 'member2', 'member3']);
      mockRedis.srem.mockResolvedValue(3);

      await CacheManager.cleanupSet('test-set', 10000);

      expect(mockRedis.srandmember).toHaveBeenCalled();
      expect(mockRedis.srem).toHaveBeenCalledWith('test-set', 'member1', 'member2', 'member3');
    });
  });

  describe('Hash Operations', () => {
    beforeEach(() => {
      CacheManager.isConnected = true;
    });

    test('should set hash field', async () => {
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await CacheManager.hset('test-hash', 'field1', { data: 'test' });

      expect(result).toBe(true);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'test-hash',
        'field1',
        JSON.stringify({ data: 'test' })
      );
      expect(mockRedis.expire).toHaveBeenCalledWith('test-hash', 3600);
    });

    test('should get hash field', async () => {
      const testData = { data: 'test' };
      mockRedis.hget.mockResolvedValue(JSON.stringify(testData));

      const result = await CacheManager.hget('test-hash', 'field1');

      expect(result).toEqual(testData);
      expect(mockRedis.hget).toHaveBeenCalledWith('test-hash', 'field1');
    });
  });

  describe('Counter Operations', () => {
    beforeEach(() => {
      CacheManager.isConnected = true;
    });

    test('should increment counter', async () => {
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.expire.mockResolvedValue(1);

      const result = await CacheManager.incr('test-counter');

      expect(result).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith('test-counter');
      expect(mockRedis.expire).toHaveBeenCalledWith('test-counter', 3600);
    });

    test('should not set expiry for existing counter', async () => {
      mockRedis.incr.mockResolvedValue(2); // Not first increment

      const result = await CacheManager.incr('test-counter');

      expect(result).toBe(2);
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('Token-specific Operations', () => {
    beforeEach(() => {
      CacheManager.isConnected = true;
    });

    test('should cache token info', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      const tokenInfo = { symbol: 'SOL', decimals: 9 };

      const result = await CacheManager.cacheTokenInfo('token-mint', tokenInfo);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'token:token-mint',
        86400,
        JSON.stringify(tokenInfo)
      );
    });

    test('should get cached token info', async () => {
      const tokenInfo = { symbol: 'SOL', decimals: 9 };
      mockRedis.get.mockResolvedValue(JSON.stringify(tokenInfo));

      const result = await CacheManager.getCachedTokenInfo('token-mint');

      expect(result).toEqual(tokenInfo);
      expect(mockRedis.get).toHaveBeenCalledWith('token:token-mint');
    });

    test('should mark transaction as processed', async () => {
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await CacheManager.markTransactionProcessed('tx-signature');

      expect(mockRedis.sadd).toHaveBeenCalledWith('processed_transactions', 'tx-signature');
      expect(mockRedis.expire).toHaveBeenCalledWith('processed_transactions', 86400);
    });

    test('should check if transaction is processed', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      const result = await CacheManager.isTransactionProcessed('tx-signature');

      expect(result).toBe(true);
      expect(mockRedis.sismember).toHaveBeenCalledWith('processed_transactions', 'tx-signature');
    });
  });

  describe('Error Handling', () => {
    test('should handle operations when Redis is not connected', async () => {
      CacheManager.isConnected = false;

      const setResult = await CacheManager.set('key', 'value');
      const getResult = await CacheManager.get('key');
      const delResult = await CacheManager.del('key');

      expect(setResult).toBe(false);
      expect(getResult).toBeNull();
      expect(delResult).toBe(false);
    });

    test('should handle Redis operation errors', async () => {
      CacheManager.isConnected = true;
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await CacheManager.get('test-key');

      expect(result).toBeNull();
    });

    test('should handle JSON parsing errors', async () => {
      CacheManager.isConnected = true;
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await CacheManager.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('Health Check', () => {
    test('should return healthy status when connected', async () => {
      CacheManager.isConnected = true;
      mockRedis.ping.mockResolvedValue('PONG');

      const health = await CacheManager.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThan(0);
      expect(health.connected).toBe(true);
    });

    test('should return unhealthy status when not connected', async () => {
      CacheManager.isConnected = false;

      const health = await CacheManager.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Redis not connected');
    });

    test('should handle ping errors', async () => {
      CacheManager.isConnected = true;
      mockRedis.ping.mockRejectedValue(new Error('Ping failed'));

      const health = await CacheManager.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Ping failed');
    });
  });

  describe('Statistics', () => {
    test('should get Redis statistics', async () => {
      CacheManager.isConnected = true;
      mockRedis.info.mockResolvedValueOnce('used_memory:1000000\nused_memory_human:1M');
      mockRedis.info.mockResolvedValueOnce('db0:keys=100,expires=50');

      const stats = await CacheManager.getStats();

      expect(stats.connected).toBe(true);
      expect(stats.memory).toHaveProperty('used_memory');
      expect(stats.keyspace).toHaveProperty('db0');
    });

    test('should handle statistics errors', async () => {
      CacheManager.isConnected = true;
      mockRedis.info.mockRejectedValue(new Error('Info failed'));

      const stats = await CacheManager.getStats();

      expect(stats.connected).toBe(false);
      expect(stats.error).toBe('Info failed');
    });
  });
});