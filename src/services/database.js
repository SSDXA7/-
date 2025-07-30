const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 数据库连接管理器
 * 提供数据库连接池和基础查询功能
 */
class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.initialize();
  }

  /**
   * 初始化数据库连接
   */
  async initialize() {
    try {
      if (!config.database.url) {
        logger.warn('Database URL not configured, running without database');
        return;
      }

      this.pool = new Pool({
        connectionString: config.database.url,
        max: 20, // 最大连接数
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // 测试连接
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connection established');

    } catch (error) {
      logger.error('Failed to initialize database:', error);
      this.isConnected = false;
    }
  }

  /**
   * 执行查询
   */
  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const startTime = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - startTime;
      
      logger.debug('Database query executed', {
        duration,
        rowCount: result.rowCount,
        command: result.command
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database query failed:', error, {
        duration,
        query: text.substring(0, 100) + '...',
        paramsCount: params.length
      });
      throw error;
    }
  }

  /**
   * 执行事务
   */
  async transaction(callback) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 检查数据库健康状态
   */
  async checkHealth() {
    try {
      if (!this.isConnected) {
        return { healthy: false, error: 'Database not connected' };
      }

      const startTime = Date.now();
      const result = await this.query('SELECT 1 as health_check');
      const latency = Date.now() - startTime;

      return {
        healthy: true,
        pool: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        },
        latency
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }
}

// 导出单例实例
const databaseManager = new DatabaseManager();

module.exports = databaseManager;