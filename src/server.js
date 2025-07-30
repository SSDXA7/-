const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const logger = require('./utils/logger');
const notificationService = require('./services/notificationService');
const transactionParser = require('./services/transactionParser');
const solanaConnection = require('./services/solanaConnection');

class SolanaMonitorServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.processedTransactions = new Set();
    this.initialize();
  }

  /**
   * 初始化服务器
   */
  initialize() {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    // 请求解析
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true }));

    // 请求日志
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info(`${req.method} ${req.path}`, {
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      });

      next();
    });

    // CORS（如果需要）
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      next();
    });
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 主 webhook 端点
    this.app.post('/webhook', this.handleWebhook.bind(this));

    // 健康检查端点
    this.app.get('/health', this.handleHealthCheck.bind(this));

    // 状态信息端点
    this.app.get('/status', this.handleStatus.bind(this));

    // 配置信息端点（仅开发环境）
    if (config.isDevelopment()) {
      this.app.get('/config', this.handleConfig.bind(this));
    }

    // 根路径
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Solana Transaction Monitor',
        version: '2.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });

    // 404 处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  /**
   * 处理 webhook 请求
   */
  async handleWebhook(req, res) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 立即响应，防止超时
      res.status(200).json({ 
        status: 'received', 
        requestId,
        timestamp: new Date().toISOString()
      });

      logger.webhook('Webhook received', { 
        requestId,
        bodySize: JSON.stringify(req.body).length 
      });

      // 异步处理交易
      this.processWebhookData(req.body, requestId).catch(error => {
        logger.error('Webhook processing failed:', error, { requestId });
      });

    } catch (error) {
      logger.error('Webhook handler error:', error, { requestId });
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error', 
          requestId 
        });
      }
    }
  }

  /**
   * 处理 webhook 数据
   */
  async processWebhookData(data, requestId) {
    try {
      // 解析交易数据
      let transactions = [];
      
      if (Array.isArray(data)) {
        transactions = data;
      } else if (data.transaction || data.signature) {
        transactions = [data];
      } else {
        logger.warn('Invalid webhook data format', { requestId, data });
        return;
      }

      // 处理每个交易
      for (const txData of transactions) {
        await this.processTransaction(txData, requestId);
      }

    } catch (error) {
      logger.error('Webhook data processing error:', error, { requestId });
    }
  }

  /**
   * 处理单个交易
   */
  async processTransaction(txData, requestId) {
    let signature = null;
    
    try {
      // 提取交易签名
      signature = txData.signature || 
                  txData.transaction?.signatures?.[0] ||
                  txData.data?.transaction?.signature;

      if (!signature) {
        logger.warn('No transaction signature found', { requestId, txData });
        return;
      }

      // 检查是否已处理
      if (this.processedTransactions.has(signature)) {
        logger.debug('Transaction already processed', { signature, requestId });
        return;
      }

      // 标记为已处理
      this.processedTransactions.add(signature);

      // 清理旧的处理记录（保持内存使用合理）
      if (this.processedTransactions.size > 10000) {
        const entries = Array.from(this.processedTransactions);
        const toKeep = entries.slice(-5000); // 保留最新的 5000 个
        this.processedTransactions = new Set(toKeep);
      }

      logger.transaction(signature, 'Processing transaction', { requestId });

      // 解析交易
      const parseResult = await transactionParser.parseTransaction(txData);
      
      if (parseResult) {
        // 发送通知
        await notificationService.sendNotification(parseResult.message, {
          telegram: { disable_web_page_preview: true },
          feishu: {}
        });

        logger.transaction(signature, 'Transaction processed and notified', {
          type: parseResult.type,
          parser: parseResult.parser,
          requestId
        });
      } else {
        logger.transaction(signature, 'Transaction parsed but no result', { requestId });
      }

    } catch (error) {
      logger.error('Transaction processing error:', error, { 
        signature, 
        requestId 
      });
    }
  }

  /**
   * 健康检查处理器
   */
  async handleHealthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {}
      };

      // 检查 Solana 连接
      const solanaHealth = await solanaConnection.checkHealth();
      health.services.solana = solanaHealth;

      // 检查通知服务
      const notificationHealth = await notificationService.checkHealth();
      health.services.notifications = notificationHealth;

      // 检查处理统计
      health.services.processing = {
        processedTransactions: this.processedTransactions.size,
        supportedParsers: transactionParser.getSupportedTypes().length
      };

      // 确定整体状态
      const allHealthy = Object.values(health.services).every(service => {
        return service.healthy !== false;
      });

      if (!allHealthy) {
        health.status = 'degraded';
        res.status(503);
      }

      res.json(health);

    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 状态信息处理器
   */
  handleStatus(req, res) {
    const status = {
      server: {
        name: 'Solana Transaction Monitor',
        version: '2.0.0',
        environment: config.server.nodeEnv,
        uptime: process.uptime(),
        processId: process.pid
      },
      configuration: {
        watchAddresses: config.solana.watchAddresses.length,
        enabledNotifications: {
          telegram: config.telegram.enabled,
          feishu: config.feishu.enabled
        },
        rateLimit: config.solana.rateLimit,
        concurrency: config.solana.concurrency
      },
      processing: {
        processedTransactions: this.processedTransactions.size,
        supportedParsers: transactionParser.getStats()
      }
    };

    res.json(status);
  }

  /**
   * 配置信息处理器（仅开发环境）
   */
  handleConfig(req, res) {
    if (!config.isDevelopment()) {
      return res.status(404).json({ error: 'Not found' });
    }

    const safeConfig = {
      solana: {
        network: config.solana.network,
        pollInterval: config.solana.pollInterval,
        concurrency: config.solana.concurrency,
        rateLimit: config.solana.rateLimit,
        watchAddressesCount: config.solana.watchAddresses.length
      },
      server: config.server,
      telegram: {
        enabled: config.telegram.enabled
      },
      feishu: {
        enabled: config.feishu.enabled
      }
    };

    res.json(safeConfig);
  }

  /**
   * 设置错误处理
   */
  setupErrorHandling() {
    // 全局错误处理中间件
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled express error:', err, {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection:', reason, { promise });
    });
  }

  /**
   * 设置优雅关闭
   */
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        this.gracefulShutdown(signal);
      });
    });
  }

  /**
   * 优雅关闭
   */
  async gracefulShutdown(signal) {
    logger.info('Starting graceful shutdown...');

    try {
      // 停止接受新连接
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      // 关闭服务连接
      await Promise.all([
        solanaConnection.close(),
        notificationService.close()
      ]);

      logger.info('All services closed successfully');
      process.exit(0);

    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * 启动服务器
   */
  start() {
    const port = config.server.port;
    
    this.server = this.app.listen(port, () => {
      logger.info(`Solana Transaction Monitor started on port ${port}`, {
        environment: config.server.nodeEnv,
        watchAddresses: config.solana.watchAddresses.length,
        telegramEnabled: config.telegram.enabled,
        feishuEnabled: config.feishu.enabled
      });

      // 发送启动通知
      notificationService.sendSystemNotification(
        'info',
        '系统启动',
        `Solana 交易监控系统已启动\n端口: ${port}\n环境: ${config.server.nodeEnv}`,
        {
          watchAddresses: config.solana.watchAddresses.length,
          supportedParsers: transactionParser.getSupportedTypes().length
        }
      ).catch(error => {
        logger.warn('Failed to send startup notification:', error);
      });
    });

    return this.server;
  }
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  const server = new SolanaMonitorServer();
  server.start();
}

module.exports = SolanaMonitorServer;