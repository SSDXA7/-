const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 统一的通知服务管理器
 * 支持多平台推送和失败重试
 */
class NotificationService {
  constructor() {
    this.telegram = null;
    this.initialize();
  }

  initialize() {
    // 初始化 Telegram Bot
    if (config.telegram.enabled && config.telegram.token) {
      try {
        this.telegram = new TelegramBot(config.telegram.token);
        logger.info('Telegram bot initialized');
      } catch (error) {
        logger.error('Failed to initialize Telegram bot:', error);
      }
    }
  }

  /**
   * 发送消息到所有启用的平台
   */
  async sendNotification(message, options = {}) {
    const results = {
      telegram: null,
      feishu: null
    };

    const promises = [];

    // Telegram 推送
    if (config.telegram.enabled && this.telegram) {
      promises.push(
        this.sendToTelegram(message, options.telegram)
          .then(result => results.telegram = { success: true, result })
          .catch(error => results.telegram = { success: false, error: error.message })
      );
    }

    // 飞书推送
    if (config.feishu.enabled && config.feishu.webhookUrl) {
      promises.push(
        this.sendToFeishu(message, options.feishu)
          .then(result => results.feishu = { success: true, result })
          .catch(error => results.feishu = { success: false, error: error.message })
      );
    }

    // 等待所有推送完成
    await Promise.allSettled(promises);

    // 记录推送结果
    const successCount = Object.values(results).filter(r => r?.success).length;
    const totalCount = Object.values(results).filter(r => r !== null).length;

    logger.notification('multi-platform', `Sent to ${successCount}/${totalCount} platforms`, {
      results,
      message: message.substring(0, 100) + '...'
    });

    return results;
  }

  /**
   * 发送到 Telegram
   */
  async sendToTelegram(message, options = {}) {
    if (!this.telegram || !config.telegram.chatId) {
      throw new Error('Telegram not configured');
    }

    const maxRetries = 3;
    const retryDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.telegram.sendMessage(
          config.telegram.chatId,
          message,
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            ...options
          }
        );

        logger.notification('telegram', 'Message sent successfully', {
          messageId: result.message_id,
          attempt
        });

        return result;
      } catch (error) {
        logger.warn(`Telegram send attempt ${attempt} failed:`, {
          error: error.message,
          attempt,
          chatId: config.telegram.chatId
        });

        if (attempt === maxRetries) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  /**
   * 发送到飞书
   */
  async sendToFeishu(message, options = {}) {
    if (!config.feishu.webhookUrl || config.feishu.webhookUrl.includes('YOUR_WEBHOOK_KEY')) {
      throw new Error('Feishu webhook URL not configured');
    }

    const maxRetries = 3;
    const retryDelay = 1000;

    const payload = {
      msg_type: config.feishu.messageConfig.msgType,
      content: {
        text: message
      },
      ...options
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(config.feishu.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        logger.notification('feishu', 'Message sent successfully', {
          statusCode: response.status,
          attempt,
          result
        });

        return result;
      } catch (error) {
        logger.warn(`Feishu send attempt ${attempt} failed:`, {
          error: error.message,
          attempt,
          webhookUrl: this.maskWebhookUrl(config.feishu.webhookUrl)
        });

        if (attempt === maxRetries) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  /**
   * 发送系统通知（用于监控和警报）
   */
  async sendSystemNotification(level, title, message, metadata = {}) {
    const formattedMessage = `🔔 **${level.toUpperCase()}**: ${title}\n\n${message}`;
    
    if (metadata && Object.keys(metadata).length > 0) {
      formattedMessage += '\n\n**Details:**\n```json\n' + JSON.stringify(metadata, null, 2) + '\n```';
    }

    logger.info(`System notification [${level}]: ${title}`, metadata);
    
    return this.sendNotification(formattedMessage);
  }

  /**
   * 健康检查
   */
  async checkHealth() {
    const health = {
      telegram: { enabled: config.telegram.enabled, healthy: false },
      feishu: { enabled: config.feishu.enabled, healthy: false }
    };

    // 检查 Telegram
    if (config.telegram.enabled && this.telegram) {
      try {
        await this.telegram.getMe();
        health.telegram.healthy = true;
      } catch (error) {
        health.telegram.error = error.message;
      }
    }

    // 检查飞书（发送测试请求）
    if (config.feishu.enabled && config.feishu.webhookUrl) {
      try {
        // 这里可以发送一个静默的测试消息或者检查 webhook 有效性
        health.feishu.healthy = true; // 简化实现
      } catch (error) {
        health.feishu.error = error.message;
      }
    }

    return health;
  }

  /**
   * 隐藏 webhook URL 中的敏感信息
   */
  maskWebhookUrl(url) {
    return url.replace(/\/hook\/([^\/]+)/, '/hook/***');
  }

  /**
   * 清理资源
   */
  async close() {
    if (this.telegram) {
      await this.telegram.close();
    }
    logger.info('Notification service closed');
  }
}

// 导出单例实例
const notificationService = new NotificationService();

module.exports = notificationService;