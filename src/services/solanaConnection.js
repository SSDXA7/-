const { Connection, clusterApiUrl } = require('@solana/web3.js');
const Bottleneck = require('bottleneck');
const config = require('../config');
const logger = require('../utils/logger');
const cacheManager = require('./cacheManager');

/**
 * Solana 连接管理器
 * 提供连接池、速率限制和重试机制
 */
class SolanaConnectionManager {
  constructor() {
    this.connection = null;
    this.limiter = null;
    this.connectionPool = [];
    this.currentConnectionIndex = 0;
    this.initialize();
  }

  initialize() {
    try {
      // 创建主连接
      this.connection = new Connection(
        config.solana.rpcUrl,
        {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000
        }
      );

      // 创建速率限制器
      this.limiter = new Bottleneck({
        minTime: config.solana.rateLimit,
        maxConcurrent: config.solana.concurrency,
        reservoir: 100, // 令牌桶初始容量
        reservoirRefreshAmount: 100,
        reservoirRefreshInterval: 60 * 1000 // 每分钟刷新
      });

      // 设置错误处理
      this.limiter.on('error', (error) => {
        logger.error('Rate limiter error:', error);
      });

      logger.info('Solana connection manager initialized', {
        rpcUrl: this.maskUrl(config.solana.rpcUrl),
        network: config.solana.network
      });

    } catch (error) {
      logger.error('Failed to initialize Solana connection:', error);
      throw error;
    }
  }

  /**
   * 获取限速的连接实例
   */
  getConnection() {
    return this.connection;
  }

  /**
   * 执行限速的 RPC 调用
   */
  async execute(method, ...args) {
    return this.limiter.schedule(async () => {
      try {
        const startTime = Date.now();
        const result = await this.connection[method](...args);
        const duration = Date.now() - startTime;
        
        logger.performance(`RPC ${method}`, duration, {
          args: args.length,
          success: true
        });
        
        return result;
      } catch (error) {
        logger.error(`RPC ${method} failed:`, error, { args });
        throw error;
      }
    });
  }

  /**
   * 获取交易信息（带重试和缓存）
   */
  async getTransaction(signature, options = {}) {
    const maxRetries = 3;
    const retryDelay = 1000;
    const cacheKey = `tx:${signature}`;

    // 先检查缓存
    const cached = await cacheManager.get(cacheKey);
    if (cached && !options.skipCache) {
      logger.debug('Transaction retrieved from cache', { signature });
      return cached;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const transaction = await this.execute('getParsedTransaction', signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
          ...options
        });

        // 缓存成功的结果
        if (transaction && !options.skipCache) {
          await cacheManager.set(cacheKey, transaction, 3600); // 缓存1小时
        }

        return transaction;
      } catch (error) {
        logger.warn(`Transaction fetch attempt ${attempt} failed:`, {
          signature,
          error: error.message,
          attempt
        });

        if (attempt === maxRetries) {
          throw error;
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  /**
   * 获取地址签名列表
   */
  async getSignaturesForAddress(address, options = {}) {
    return this.execute('getSignaturesForAddress', address, {
      limit: 10,
      ...options
    });
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo(publicKey, options = {}) {
    return this.execute('getAccountInfo', publicKey, {
      commitment: 'confirmed',
      ...options
    });
  }

  /**
   * 批量获取账户信息
   */
  async getMultipleAccountsInfo(publicKeys, options = {}) {
    return this.execute('getMultipleAccountsInfo', publicKeys, {
      commitment: 'confirmed',
      ...options
    });
  }

  /**
   * 检查连接健康状态
   */
  async checkHealth() {
    try {
      const startTime = Date.now();
      const slot = await this.execute('getSlot');
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        slot,
        latency,
        url: this.maskUrl(config.solana.rpcUrl)
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        url: this.maskUrl(config.solana.rpcUrl)
      };
    }
  }

  /**
   * 获取当前速率限制状态
   */
  getRateLimitStatus() {
    return {
      currentReservoir: this.limiter.currentReservoir,
      running: this.limiter.running,
      queued: this.limiter.queued
    };
  }

  /**
   * 隐藏 URL 中的敏感信息
   */
  maskUrl(url) {
    return url.replace(/api-key=([^&]+)/, 'api-key=***');
  }

  /**
   * 清理资源
   */
  async close() {
    if (this.limiter) {
      await this.limiter.stop();
    }
    logger.info('Solana connection manager closed');
  }
}

// 导出单例实例
const solanaManager = new SolanaConnectionManager();

module.exports = solanaManager;