const client = require('prom-client');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Prometheus 监控指标管理器
 * 收集和暴露应用程序指标
 */
class MetricsManager {
  constructor() {
    this.register = new client.Registry();
    this.metrics = {};
    this.initialize();
  }

  /**
   * 初始化指标
   */
  initialize() {
    // 添加默认指标（进程相关）
    client.collectDefaultMetrics({
      register: this.register,
      prefix: 'solana_monitor_'
    });

    // 自定义指标
    this.createCustomMetrics();

    logger.info('Metrics manager initialized');
  }

  /**
   * 创建自定义指标
   */
  createCustomMetrics() {
    // HTTP 请求指标
    this.metrics.httpRequests = new client.Counter({
      name: 'solana_monitor_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.metrics.httpRequestDuration = new client.Histogram({
      name: 'solana_monitor_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register]
    });

    // 交易处理指标
    this.metrics.transactionsProcessed = new client.Counter({
      name: 'solana_monitor_transactions_processed_total',
      help: 'Total number of transactions processed',
      labelNames: ['type', 'status'],
      registers: [this.register]
    });

    this.metrics.transactionProcessingDuration = new client.Histogram({
      name: 'solana_monitor_transaction_processing_duration_seconds',
      help: 'Duration of transaction processing in seconds',
      labelNames: ['type', 'parser'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    // 通知指标
    this.metrics.notificationsSent = new client.Counter({
      name: 'solana_monitor_notifications_sent_total',
      help: 'Total number of notifications sent',
      labelNames: ['platform', 'status'],
      registers: [this.register]
    });

    this.metrics.notificationDuration = new client.Histogram({
      name: 'solana_monitor_notification_duration_seconds',
      help: 'Duration of notification sending in seconds',
      labelNames: ['platform'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register]
    });

    // RPC 调用指标
    this.metrics.rpcCalls = new client.Counter({
      name: 'solana_monitor_rpc_calls_total',
      help: 'Total number of RPC calls',
      labelNames: ['method', 'status'],
      registers: [this.register]
    });

    this.metrics.rpcCallDuration = new client.Histogram({
      name: 'solana_monitor_rpc_call_duration_seconds',
      help: 'Duration of RPC calls in seconds',
      labelNames: ['method'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register]
    });

    // 缓存指标
    this.metrics.cacheHits = new client.Counter({
      name: 'solana_monitor_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['type'],
      registers: [this.register]
    });

    this.metrics.cacheMisses = new client.Counter({
      name: 'solana_monitor_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['type'],
      registers: [this.register]
    });

    // 数据库指标
    this.metrics.dbQueries = new client.Counter({
      name: 'solana_monitor_db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'status'],
      registers: [this.register]
    });

    this.metrics.dbQueryDuration = new client.Histogram({
      name: 'solana_monitor_db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.register]
    });

    // 系统健康指标
    this.metrics.healthStatus = new client.Gauge({
      name: 'solana_monitor_health_status',
      help: 'Health status of services (1 = healthy, 0 = unhealthy)',
      labelNames: ['service'],
      registers: [this.register]
    });

    // 活跃连接数
    this.metrics.activeConnections = new client.Gauge({
      name: 'solana_monitor_active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [this.register]
    });

    // 处理队列大小
    this.metrics.queueSize = new client.Gauge({
      name: 'solana_monitor_queue_size',
      help: 'Size of processing queues',
      labelNames: ['queue_type'],
      registers: [this.register]
    });
  }

  /**
   * 记录 HTTP 请求
   */
  recordHttpRequest(method, route, statusCode, duration) {
    const labels = { method, route, status_code: statusCode };
    this.metrics.httpRequests.inc(labels);
    this.metrics.httpRequestDuration.observe(labels, duration / 1000);
  }

  /**
   * 记录交易处理
   */
  recordTransactionProcessing(type, status, duration, parser = null) {
    this.metrics.transactionsProcessed.inc({ type, status });
    if (parser) {
      this.metrics.transactionProcessingDuration.observe({ type, parser }, duration / 1000);
    }
  }

  /**
   * 记录通知发送
   */
  recordNotification(platform, status, duration) {
    this.metrics.notificationsSent.inc({ platform, status });
    this.metrics.notificationDuration.observe({ platform }, duration / 1000);
  }

  /**
   * 记录 RPC 调用
   */
  recordRpcCall(method, status, duration) {
    this.metrics.rpcCalls.inc({ method, status });
    this.metrics.rpcCallDuration.observe({ method }, duration / 1000);
  }

  /**
   * 记录缓存命中/未命中
   */
  recordCacheHit(type) {
    this.metrics.cacheHits.inc({ type });
  }

  recordCacheMiss(type) {
    this.metrics.cacheMisses.inc({ type });
  }

  /**
   * 记录数据库查询
   */
  recordDbQuery(operation, status, duration) {
    this.metrics.dbQueries.inc({ operation, status });
    this.metrics.dbQueryDuration.observe({ operation }, duration / 1000);
  }

  /**
   * 更新健康状态
   */
  updateHealthStatus(service, isHealthy) {
    this.metrics.healthStatus.set({ service }, isHealthy ? 1 : 0);
  }

  /**
   * 更新活跃连接数
   */
  updateActiveConnections(type, count) {
    this.metrics.activeConnections.set({ type }, count);
  }

  /**
   * 更新队列大小
   */
  updateQueueSize(queueType, size) {
    this.metrics.queueSize.set({ queue_type: queueType }, size);
  }

  /**
   * 获取指标数据
   */
  async getMetrics() {
    return this.register.metrics();
  }

  /**
   * 获取 JSON 格式的指标
   */
  async getMetricsAsJson() {
    const metrics = await this.register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * 重置所有指标
   */
  reset() {
    this.register.clear();
    this.initialize();
    logger.info('Metrics reset');
  }

  /**
   * 获取指标摘要
   */
  async getSummary() {
    const metrics = await this.getMetricsAsJson();
    const summary = {
      totalMetrics: metrics.length,
      categories: {
        http: metrics.filter(m => m.name.includes('http')).length,
        transactions: metrics.filter(m => m.name.includes('transaction')).length,
        notifications: metrics.filter(m => m.name.includes('notification')).length,
        rpc: metrics.filter(m => m.name.includes('rpc')).length,
        cache: metrics.filter(m => m.name.includes('cache')).length,
        database: metrics.filter(m => m.name.includes('db')).length,
        health: metrics.filter(m => m.name.includes('health')).length
      }
    };

    return summary;
  }

  /**
   * 创建中间件
   */
  createMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const route = req.route?.path || req.path || 'unknown';
        this.recordHttpRequest(req.method, route, res.statusCode, duration);
      });

      next();
    };
  }
}

// 导出单例实例
const metricsManager = new MetricsManager();

module.exports = metricsManager;