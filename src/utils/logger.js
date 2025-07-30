const winston = require('winston');
const config = require('../config');

// 自定义格式化器
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}${stackStr}`;
  })
);

// 创建日志实例
const logger = winston.createLogger({
  level: config.server.logLevel,
  format: customFormat,
  defaultMeta: { service: 'solana-monitor' },
  transports: [
    // 文件传输
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ]
});

// 在开发环境中添加控制台输出
if (!config.isProduction()) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// 日志助手方法
logger.transaction = (txSignature, message, meta = {}) => {
  logger.info(message, { 
    type: 'transaction', 
    signature: txSignature,
    ...meta 
  });
};

logger.webhook = (message, meta = {}) => {
  logger.info(message, { 
    type: 'webhook',
    ...meta 
  });
};

logger.notification = (platform, message, meta = {}) => {
  logger.info(message, { 
    type: 'notification',
    platform,
    ...meta 
  });
};

logger.performance = (operation, duration, meta = {}) => {
  logger.info(`${operation} completed in ${duration}ms`, {
    type: 'performance',
    operation,
    duration,
    ...meta
  });
};

module.exports = logger;