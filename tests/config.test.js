const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

describe('Configuration Management', () => {
  let originalEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };
    
    // 清除 require 缓存
    delete require.cache[require.resolve('../../src/config')];
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('Environment Variable Loading', () => {
    test('should load default values when environment variables are not set', () => {
      // 删除相关环境变量
      delete process.env.SOLANA_RPC_URL;
      delete process.env.PORT;
      delete process.env.POLL_INTERVAL;

      const config = require('../../src/config');

      expect(config.solana.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
      expect(config.server.port).toBe(3000);
      expect(config.solana.pollInterval).toBe(1500);
    });

    test('should use environment variables when provided', () => {
      process.env.SOLANA_RPC_URL = 'https://custom-rpc.example.com';
      process.env.PORT = '8080';
      process.env.POLL_INTERVAL = '2000';

      const config = require('../../src/config');

      expect(config.solana.rpcUrl).toBe('https://custom-rpc.example.com');
      expect(config.server.port).toBe(8080);
      expect(config.solana.pollInterval).toBe(2000);
    });

    test('should parse boolean environment variables correctly', () => {
      process.env.ENABLE_FEISHU = 'true';
      process.env.ENABLE_TELEGRAM = 'false';

      const config = require('../../src/config');

      expect(config.feishu.enabled).toBe(true);
      expect(config.telegram.enabled).toBe(false);
    });

    test('should parse watch addresses from comma-separated string', () => {
      process.env.WATCH_ADDRESSES = 'addr1,addr2,addr3';

      const config = require('../../src/config');

      expect(config.solana.watchAddresses).toEqual(['addr1', 'addr2', 'addr3']);
    });

    test('should handle empty watch addresses', () => {
      process.env.WATCH_ADDRESSES = '';

      const config = require('../../src/config');

      expect(config.solana.watchAddresses).toEqual([]);
    });
  });

  describe('Configuration Validation', () => {
    test('should throw error for invalid number values', () => {
      process.env.PORT = 'invalid-number';

      expect(() => {
        require('../../src/config');
      }).toThrow('Environment variable PORT must be a valid number');
    });

    test('should validate required environment variables', () => {
      // 启用 Telegram 但不提供 token
      process.env.ENABLE_TELEGRAM = 'true';
      delete process.env.TELEGRAM_TOKEN;

      expect(() => {
        require('../../src/config');
      }).toThrow('Missing required environment variables');
    });
  });

  describe('Environment Detection', () => {
    test('should detect production environment', () => {
      process.env.NODE_ENV = 'production';

      const config = require('../../src/config');

      expect(config.isProduction()).toBe(true);
      expect(config.isDevelopment()).toBe(false);
    });

    test('should detect development environment', () => {
      process.env.NODE_ENV = 'development';

      const config = require('../../src/config');

      expect(config.isProduction()).toBe(false);
      expect(config.isDevelopment()).toBe(true);
    });
  });

  describe('Configuration Sections', () => {
    test('should provide solana configuration', () => {
      const config = require('../../src/config');

      expect(config.solana).toHaveProperty('rpcUrl');
      expect(config.solana).toHaveProperty('network');
      expect(config.solana).toHaveProperty('pollInterval');
      expect(config.solana).toHaveProperty('concurrency');
      expect(config.solana).toHaveProperty('rateLimit');
      expect(config.solana).toHaveProperty('watchAddresses');
    });

    test('should provide telegram configuration', () => {
      const config = require('../../src/config');

      expect(config.telegram).toHaveProperty('token');
      expect(config.telegram).toHaveProperty('chatId');
      expect(config.telegram).toHaveProperty('enabled');
    });

    test('should provide feishu configuration', () => {
      const config = require('../../src/config');

      expect(config.feishu).toHaveProperty('webhookUrl');
      expect(config.feishu).toHaveProperty('enabled');
      expect(config.feishu).toHaveProperty('messageConfig');
    });

    test('should provide server configuration', () => {
      const config = require('../../src/config');

      expect(config.server).toHaveProperty('port');
      expect(config.server).toHaveProperty('nodeEnv');
      expect(config.server).toHaveProperty('logLevel');
    });

    test('should provide database configuration', () => {
      const config = require('../../src/config');

      expect(config.database).toHaveProperty('url');
      expect(config.database).toHaveProperty('redisUrl');
    });

    test('should provide monitoring configuration', () => {
      const config = require('../../src/config');

      expect(config.monitoring).toHaveProperty('enabled');
      expect(config.monitoring).toHaveProperty('port');
    });
  });
});