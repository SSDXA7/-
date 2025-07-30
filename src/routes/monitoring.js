const express = require('express');
const metricsManager = require('../services/metricsManager');
const healthCheckManager = require('../services/healthCheckManager');
const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

/**
 * Prometheus 指标端点
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsManager.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * JSON 格式的指标端点
 */
router.get('/metrics/json', async (req, res) => {
  try {
    const metrics = await metricsManager.getMetricsAsJson();
    res.json({
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error) {
    logger.error('Failed to get JSON metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * 指标摘要端点
 */
router.get('/metrics/summary', async (req, res) => {
  try {
    const summary = await metricsManager.getSummary();
    res.json({
      timestamp: new Date().toISOString(),
      summary
    });
  } catch (error) {
    logger.error('Failed to get metrics summary:', error);
    res.status(500).json({ error: 'Failed to get metrics summary' });
  }
});

/**
 * 基本健康检查端点
 */
router.get('/health', healthCheckManager.createMiddleware(false));

/**
 * 详细健康检查端点
 */
router.get('/health/detailed', healthCheckManager.createMiddleware(true));

/**
 * 单个服务健康检查端点
 */
router.get('/health/:service', async (req, res) => {
  try {
    const serviceName = req.params.service;
    const result = await healthCheckManager.checkService(serviceName);
    const statusCode = result.healthy ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error) {
    if (error.message.includes('not registered')) {
      res.status(404).json({ error: error.message });
    } else {
      logger.error('Service health check failed:', error);
      res.status(500).json({ error: 'Health check failed' });
    }
  }
});

/**
 * 获取不健康的服务列表
 */
router.get('/health/unhealthy', (req, res) => {
  try {
    const unhealthyServices = healthCheckManager.getUnhealthyServices();
    res.json({
      timestamp: new Date().toISOString(),
      count: unhealthyServices.length,
      services: unhealthyServices
    });
  } catch (error) {
    logger.error('Failed to get unhealthy services:', error);
    res.status(500).json({ error: 'Failed to get unhealthy services' });
  }
});

/**
 * 系统状态概览
 */
router.get('/status', async (req, res) => {
  try {
    const healthSummary = healthCheckManager.getServicesSummary();
    const metricsSummary = await metricsManager.getSummary();
    
    // 获取系统信息
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    };

    // 获取配置摘要
    const configSummary = {
      environment: config.server.nodeEnv,
      port: config.server.port,
      logLevel: config.server.logLevel,
      monitoringEnabled: config.monitoring.enabled,
      watchAddresses: config.solana.watchAddresses.length,
      telegramEnabled: config.telegram.enabled,
      feishuEnabled: config.feishu.enabled
    };

    res.json({
      timestamp: new Date().toISOString(),
      status: 'running',
      health: healthSummary,
      metrics: metricsSummary,
      system: systemInfo,
      configuration: configSummary
    });

  } catch (error) {
    logger.error('Failed to get system status:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

/**
 * 手动触发健康检查
 */
router.post('/health/check', async (req, res) => {
  try {
    const serviceName = req.body.service;
    
    if (serviceName) {
      // 检查特定服务
      const result = await healthCheckManager.checkService(serviceName);
      res.json({
        timestamp: new Date().toISOString(),
        service: serviceName,
        result
      });
    } else {
      // 检查所有服务
      const results = await healthCheckManager.checkAllServices();
      res.json(results);
    }
  } catch (error) {
    logger.error('Manual health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * 重置指标
 */
router.post('/metrics/reset', (req, res) => {
  try {
    if (!config.isDevelopment()) {
      return res.status(403).json({ error: 'Metrics reset only available in development' });
    }

    metricsManager.reset();
    res.json({
      timestamp: new Date().toISOString(),
      message: 'Metrics reset successfully'
    });
  } catch (error) {
    logger.error('Failed to reset metrics:', error);
    res.status(500).json({ error: 'Failed to reset metrics' });
  }
});

/**
 * 获取日志级别
 */
router.get('/logging/level', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    level: logger.level
  });
});

/**
 * 设置日志级别
 */
router.put('/logging/level', (req, res) => {
  try {
    const { level } = req.body;
    const validLevels = ['error', 'warn', 'info', 'debug'];
    
    if (!level || !validLevels.includes(level)) {
      return res.status(400).json({ 
        error: 'Invalid log level',
        validLevels 
      });
    }

    logger.level = level;
    
    res.json({
      timestamp: new Date().toISOString(),
      message: `Log level set to ${level}`,
      level
    });
  } catch (error) {
    logger.error('Failed to set log level:', error);
    res.status(500).json({ error: 'Failed to set log level' });
  }
});

/**
 * 获取最近的错误日志
 */
router.get('/logging/errors', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // 这里需要实现从日志文件读取错误的逻辑
    // 简化实现，返回空数组
    res.json({
      timestamp: new Date().toISOString(),
      errors: [],
      message: 'Error log retrieval not implemented'
    });
  } catch (error) {
    logger.error('Failed to get error logs:', error);
    res.status(500).json({ error: 'Failed to get error logs' });
  }
});

module.exports = router;