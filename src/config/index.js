const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

/**
 * 统一配置管理系统
 * 提供类型安全的配置获取和验证
 */
class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  // Solana 配置
  get solana() {
    return {
      rpcUrl: this.getEnvVar('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
      network: this.getEnvVar('SOLANA_NETWORK', 'mainnet-beta'),
      pollInterval: this.getEnvVarAsNumber('POLL_INTERVAL', 1500),
      concurrency: this.getEnvVarAsNumber('CONCURRENCY', 3),
      rateLimit: this.getEnvVarAsNumber('RATE_LIMIT', 120),
      watchAddresses: this.getWatchAddresses()
    };
  }

  // Telegram 配置
  get telegram() {
    return {
      token: this.getEnvVar('TELEGRAM_TOKEN'),
      chatId: this.getEnvVar('TELEGRAM_CHAT_ID'),
      enabled: this.getEnvVarAsBoolean('ENABLE_TELEGRAM', true)
    };
  }

  // 飞书配置
  get feishu() {
    return {
      webhookUrl: this.getEnvVar('FEISHU_WEBHOOK_URL'),
      enabled: this.getEnvVarAsBoolean('ENABLE_FEISHU', false),
      messageConfig: {
        msgType: 'text',
        atAll: false
      }
    };
  }

  // 服务器配置
  get server() {
    return {
      port: this.getEnvVarAsNumber('PORT', 3000),
      nodeEnv: this.getEnvVar('NODE_ENV', 'development'),
      logLevel: this.getEnvVar('LOG_LEVEL', 'info')
    };
  }

  // 数据库配置
  get database() {
    return {
      url: this.getEnvVar('DATABASE_URL'),
      redisUrl: this.getEnvVar('REDIS_URL', 'redis://localhost:6379')
    };
  }

  // 监控配置
  get monitoring() {
    return {
      enabled: this.getEnvVarAsBoolean('ENABLE_METRICS', false),
      port: this.getEnvVarAsNumber('METRICS_PORT', 9090)
    };
  }

  // 工具方法
  getEnvVar(key, defaultValue = null) {
    const value = process.env[key];
    if (value === undefined && defaultValue === null) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value || defaultValue;
  }

  getEnvVarAsNumber(key, defaultValue = null) {
    const value = this.getEnvVar(key, defaultValue?.toString());
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a valid number`);
    }
    return parsed;
  }

  getEnvVarAsBoolean(key, defaultValue = false) {
    const value = this.getEnvVar(key, defaultValue.toString());
    return value.toLowerCase() === 'true';
  }

  getWatchAddresses() {
    const addresses = this.getEnvVar('WATCH_ADDRESSES', '');
    return addresses.split(',').filter(addr => addr.trim().length > 0);
  }

  validateRequiredEnvVars() {
    const required = [];
    
    // 根据启用的功能检查必需变量
    if (!process.env.TELEGRAM_TOKEN && this.getEnvVarAsBoolean('ENABLE_TELEGRAM', true)) {
      required.push('TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID');
    }
    
    if (!process.env.FEISHU_WEBHOOK_URL && this.getEnvVarAsBoolean('ENABLE_FEISHU', false)) {
      required.push('FEISHU_WEBHOOK_URL');
    }

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  // 运行时配置验证
  isProduction() {
    return this.server.nodeEnv === 'production';
  }

  isDevelopment() {
    return this.server.nodeEnv === 'development';
  }
}

// 导出单例实例
const config = new Config();

module.exports = config;