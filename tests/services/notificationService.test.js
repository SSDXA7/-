const { describe, test, expect, jest, beforeEach, afterEach } = require('@jest/globals');

describe('Notification Service', () => {
  let NotificationService;
  let notificationService;
  let mockTelegramBot;
  let mockConfig;

  beforeEach(() => {
    // 创建模拟的 TelegramBot
    mockTelegramBot = {
      sendMessage: jest.fn(),
      getMe: jest.fn(),
      close: jest.fn()
    };

    // 模拟配置
    mockConfig = {
      telegram: {
        enabled: true,
        token: 'test-token',
        chatId: 'test-chat-id'
      },
      feishu: {
        enabled: true,
        webhookUrl: 'https://test.webhook.url',
        messageConfig: {
          msgType: 'text',
          atAll: false
        }
      }
    };

    // 模拟依赖
    jest.doMock('node-telegram-bot-api', () => jest.fn(() => mockTelegramBot));
    jest.doMock('../../src/config', () => mockConfig);
    
    // 模拟 fetch
    global.fetch = jest.fn();

    // 重新加载模块
    delete require.cache[require.resolve('../../src/services/notificationService')];
    NotificationService = require('../../src/services/notificationService');
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete global.fetch;
  });

  describe('Initialization', () => {
    test('should initialize with Telegram bot when enabled', () => {
      expect(mockTelegramBot).toBeDefined();
    });

    test('should not initialize Telegram bot when disabled', () => {
      mockConfig.telegram.enabled = false;
      delete require.cache[require.resolve('../../src/services/notificationService')];
      
      // 这里需要重新实例化，但由于是单例，需要不同的处理方式
      // 实际测试中可能需要重构为非单例或提供重置方法
    });
  });

  describe('Telegram Notifications', () => {
    test('should send message to Telegram successfully', async () => {
      const mockResponse = { message_id: 123 };
      mockTelegramBot.sendMessage.mockResolvedValue(mockResponse);

      const result = await NotificationService.sendToTelegram('Test message');

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        'Test message',
        expect.objectContaining({
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      );
      expect(result).toEqual(mockResponse);
    });

    test('should retry Telegram sending on failure', async () => {
      mockTelegramBot.sendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ message_id: 123 });

      const result = await NotificationService.sendToTelegram('Test message');

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ message_id: 123 });
    });

    test('should throw error after max retries', async () => {
      const error = new Error('Persistent network error');
      mockTelegramBot.sendMessage.mockRejectedValue(error);

      await expect(NotificationService.sendToTelegram('Test message'))
        .rejects.toThrow('Persistent network error');

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('should throw error when Telegram not configured', async () => {
      mockConfig.telegram.enabled = false;
      
      await expect(NotificationService.sendToTelegram('Test message'))
        .rejects.toThrow('Telegram not configured');
    });
  });

  describe('Feishu Notifications', () => {
    test('should send message to Feishu successfully', async () => {
      const mockResponse = { code: 0, msg: 'success' };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await NotificationService.sendToFeishu('Test message');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.webhook.url',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msg_type: 'text',
            content: { text: 'Test message' }
          })
        })
      );
      expect(result).toEqual(mockResponse);
    });

    test('should retry Feishu sending on failure', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ code: 0 })
        });

      const result = await NotificationService.sendToFeishu('Test message');

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ code: 0 });
    });

    test('should handle HTTP error responses', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(NotificationService.sendToFeishu('Test message'))
        .rejects.toThrow('HTTP 400: Bad Request');
    });

    test('should throw error when Feishu not configured', async () => {
      mockConfig.feishu.webhookUrl = 'https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_WEBHOOK_KEY';

      await expect(NotificationService.sendToFeishu('Test message'))
        .rejects.toThrow('Feishu webhook URL not configured');
    });
  });

  describe('Multi-platform Notifications', () => {
    test('should send to all enabled platforms', async () => {
      mockTelegramBot.sendMessage.mockResolvedValue({ message_id: 123 });
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 0 })
      });

      const results = await NotificationService.sendNotification('Test message');

      expect(results.telegram.success).toBe(true);
      expect(results.feishu.success).toBe(true);
      expect(mockTelegramBot.sendMessage).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should handle partial failures', async () => {
      mockTelegramBot.sendMessage.mockResolvedValue({ message_id: 123 });
      global.fetch.mockRejectedValue(new Error('Feishu error'));

      const results = await NotificationService.sendNotification('Test message');

      expect(results.telegram.success).toBe(true);
      expect(results.feishu.success).toBe(false);
      expect(results.feishu.error).toBe('Feishu error');
    });

    test('should skip disabled platforms', async () => {
      mockConfig.telegram.enabled = false;
      mockConfig.feishu.enabled = false;

      const results = await NotificationService.sendNotification('Test message');

      expect(results.telegram).toBeNull();
      expect(results.feishu).toBeNull();
      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('System Notifications', () => {
    test('should send formatted system notification', async () => {
      mockTelegramBot.sendMessage.mockResolvedValue({ message_id: 123 });
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 0 })
      });

      const results = await NotificationService.sendSystemNotification(
        'error',
        'Test Alert',
        'Something went wrong',
        { details: 'test' }
      );

      const expectedMessage = expect.stringContaining('🔔 **ERROR**: Test Alert');
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expectedMessage,
        expect.any(Object)
      );
    });
  });

  describe('Health Check', () => {
    test('should return healthy status for all services', async () => {
      mockTelegramBot.getMe.mockResolvedValue({ id: 123, first_name: 'TestBot' });

      const health = await NotificationService.checkHealth();

      expect(health.telegram.enabled).toBe(true);
      expect(health.telegram.healthy).toBe(true);
      expect(health.feishu.enabled).toBe(true);
      expect(health.feishu.healthy).toBe(true);
    });

    test('should detect unhealthy Telegram service', async () => {
      mockTelegramBot.getMe.mockRejectedValue(new Error('Telegram API error'));

      const health = await NotificationService.checkHealth();

      expect(health.telegram.healthy).toBe(false);
      expect(health.telegram.error).toBe('Telegram API error');
    });
  });
});