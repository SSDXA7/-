const logger = require('../utils/logger');
const config = require('../config');
const metricsManager = require('./metricsManager');

/**
 * 健康检查管理器
 * 定期检查各个服务的健康状态
 */
class HealthCheckManager {
  constructor() {
    this.services = new Map();
    this.checkInterval = null;
    this.isRunning = false;
    this.lastCheckTime = null;
    this.initialize();
  }

  /**
   * 初始化健康检查
   */
  initialize() {
    // 注册需要检查的服务
    this.registerService('solana', async () => {
      const solanaConnection = require('./solanaConnection');
      return solanaConnection.checkHealth();
    });

    this.registerService('notifications', async () => {
      const notificationService = require('./notificationService');
      return notificationService.checkHealth();
    });

    this.registerService('database', async () => {
      const database = require('./database');
      return database.checkHealth();
    });

    this.registerService('cache', async () => {
      const cacheManager = require('./cacheManager');
      return cacheManager.checkHealth();
    });

    logger.info('Health check manager initialized');
  }

  /**
   * 注册服务健康检查
   */
  registerService(name, checkFunction) {
    this.services.set(name, {
      name,
      check: checkFunction,
      lastResult: null,
      lastCheckTime: null,
      consecutive_failures: 0
    });

    logger.debug(`Registered health check for service: ${name}`);
  }

  /**
   * 移除服务健康检查
   */
  unregisterService(name) {
    this.services.delete(name);
    logger.debug(`Unregistered health check for service: ${name}`);
  }

  /**
   * 检查单个服务
   */
  async checkService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    const startTime = Date.now();
    let result;

    try {
      result = await service.check();
      const duration = Date.now() - startTime;
      
      // 确保结果包含必要字段
      result = {
        healthy: true,
        ...result,
        checkDuration: duration,
        timestamp: new Date().toISOString()
      };

      // 重置连续失败计数
      service.consecutive_failures = 0;

      logger.debug(`Health check passed for ${serviceName}`, {
        duration,
        result: result.healthy
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      service.consecutive_failures++;

      result = {
        healthy: false,
        error: error.message,
        checkDuration: duration,
        timestamp: new Date().toISOString(),
        consecutive_failures: service.consecutive_failures
      };

      logger.warn(`Health check failed for ${serviceName}:`, error.message, {
        duration,
        consecutive_failures: service.consecutive_failures
      });
    }

    // 更新服务状态
    service.lastResult = result;
    service.lastCheckTime = new Date();

    // 更新 Prometheus 指标
    if (config.monitoring.enabled) {
      metricsManager.updateHealthStatus(serviceName, result.healthy);
    }

    return result;
  }

  /**
   * 检查所有服务
   */
  async checkAllServices() {
    const results = {};
    const startTime = Date.now();

    // 并行检查所有服务
    const checkPromises = Array.from(this.services.keys()).map(async (serviceName) => {
      try {
        const result = await this.checkService(serviceName);
        results[serviceName] = result;
      } catch (error) {
        results[serviceName] = {
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    });

    await Promise.allSettled(checkPromises);

    const totalDuration = Date.now() - startTime;
    this.lastCheckTime = new Date();

    // 计算整体健康状态
    const healthyCount = Object.values(results).filter(r => r.healthy).length;
    const totalCount = Object.keys(results).length;
    const overallHealthy = healthyCount === totalCount;

    const summary = {
      healthy: overallHealthy,
      timestamp: this.lastCheckTime.toISOString(),
      totalDuration,
      services: results,
      summary: {
        total: totalCount,
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount,
        healthPercentage: totalCount > 0 ? (healthyCount / totalCount * 100).toFixed(1) : 0
      }
    };

    logger.info('Health check completed', {
      overallHealthy,
      healthyServices: healthyCount,
      totalServices: totalCount,
      duration: totalDuration
    });

    return summary;
  }

  /**
   * 获取服务状态摘要
   */
  getServicesSummary() {
    const summary = {
      registeredServices: this.services.size,
      services: {},
      lastGlobalCheck: this.lastCheckTime?.toISOString() || null
    };

    for (const [name, service] of this.services) {
      summary.services[name] = {
        name: service.name,
        lastCheck: service.lastCheckTime?.toISOString() || null,
        healthy: service.lastResult?.healthy || null,
        consecutive_failures: service.consecutive_failures,
        hasResult: service.lastResult !== null
      };
    }

    return summary;
  }

  /**
   * 启动定期健康检查
   */
  startPeriodicChecks(intervalMs = 30000) { // 默认30秒
    if (this.isRunning) {
      logger.warn('Health checks already running');
      return;
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAllServices();
      } catch (error) {
        logger.error('Periodic health check failed:', error);
      }
    }, intervalMs);

    this.isRunning = true;
    logger.info(`Started periodic health checks (interval: ${intervalMs}ms)`);

    // 立即执行一次检查
    this.checkAllServices().catch(error => {
      logger.error('Initial health check failed:', error);
    });
  }

  /**
   * 停止定期健康检查
   */
  stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    logger.info('Stopped periodic health checks');
  }

  /**
   * 获取不健康的服务列表
   */
  getUnhealthyServices() {
    const unhealthy = [];

    for (const [name, service] of this.services) {
      if (service.lastResult && !service.lastResult.healthy) {
        unhealthy.push({
          name,
          error: service.lastResult.error,
          consecutive_failures: service.consecutive_failures,
          lastCheck: service.lastCheckTime?.toISOString()
        });
      }
    }

    return unhealthy;
  }

  /**
   * 检查是否需要发送警报
   */
  async checkAlerts() {
    const unhealthyServices = this.getUnhealthyServices();
    
    if (unhealthyServices.length > 0) {
      const criticalServices = unhealthyServices.filter(s => s.consecutive_failures >= 3);
      
      if (criticalServices.length > 0) {
        logger.error('Critical services detected', { criticalServices });
        
        // 发送系统通知
        try {
          const notificationService = require('./notificationService');
          await notificationService.sendSystemNotification(
            'error',
            '系统健康警报',
            `检测到 ${criticalServices.length} 个关键服务异常:\n${criticalServices.map(s => `- ${s.name}: ${s.error}`).join('\n')}`,
            { criticalServices }
          );
        } catch (error) {
          logger.error('Failed to send health alert:', error);
        }
      }
    }
  }

  /**
   * 创建 Express 中间件
   */
  createMiddleware(detailed = false) {
    return async (req, res, next) => {
      try {
        if (detailed) {
          const health = await this.checkAllServices();
          const statusCode = health.healthy ? 200 : 503;
          res.status(statusCode).json(health);
        } else {
          const summary = this.getServicesSummary();
          const hasUnhealthy = Object.values(summary.services).some(s => s.healthy === false);
          const statusCode = hasUnhealthy ? 503 : 200;
          
          res.status(statusCode).json({
            status: hasUnhealthy ? 'unhealthy' : 'healthy',
            timestamp: new Date().toISOString(),
            ...summary
          });
        }
      } catch (error) {
        logger.error('Health check middleware error:', error);
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopPeriodicChecks();
    this.services.clear();
    logger.info('Health check manager cleaned up');
  }
}

// 导出单例实例
const healthCheckManager = new HealthCheckManager();

module.exports = healthCheckManager;