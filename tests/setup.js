// Jest 测试环境设置
const { beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // 减少测试期间的日志输出
process.env.TELEGRAM_TOKEN = 'test-token';
process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
process.env.ENABLE_FEISHU = 'false';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // 使用数据库1进行测试

// 全局测试钩子
beforeAll(async () => {
  // 在所有测试开始前执行
  console.log('Starting test suite...');
});

afterAll(async () => {
  // 在所有测试结束后执行
  console.log('Test suite completed');
  
  // 清理资源
  const services = [
    require('../src/services/database'),
    require('../src/services/cacheManager'),
    require('../src/services/solanaConnection'),
    require('../src/services/notificationService')
  ];

  for (const service of services) {
    if (service && typeof service.close === 'function') {
      try {
        await service.close();
      } catch (error) {
        console.warn('Error closing service during cleanup:', error.message);
      }
    }
  }
});

beforeEach(() => {
  // 在每个测试前执行
  jest.clearAllMocks();
});

afterEach(() => {
  // 在每个测试后执行
  jest.restoreAllMocks();
});

// 全局测试工具
global.testUtils = {
  // 创建模拟的交易数据
  createMockTransaction: (overrides = {}) => ({
    signature: 'test-signature-' + Math.random().toString(36).substr(2, 9),
    blockTime: Math.floor(Date.now() / 1000),
    slot: 123456789,
    transaction: {
      signatures: ['test-signature'],
      message: {
        instructions: [
          {
            programId: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
            accounts: ['account1', 'account2']
          }
        ]
      }
    },
    meta: {
      postTokenBalances: [
        {
          mint: 'So11111111111111111111111111111111111111112',
          owner: 'test-owner',
          uiTokenAmount: { amount: '1000000000', decimals: 9 }
        }
      ],
      preTokenBalances: [
        {
          mint: 'So11111111111111111111111111111111111111112',
          owner: 'test-owner',
          uiTokenAmount: { amount: '2000000000', decimals: 9 }
        }
      ]
    },
    ...overrides
  }),

  // 等待异步操作完成
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // 创建模拟的 HTTP 响应
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    return res;
  },

  // 创建模拟的 HTTP 请求
  createMockRequest: (overrides = {}) => ({
    method: 'GET',
    path: '/test',
    body: {},
    query: {},
    params: {},
    headers: {},
    ...overrides
  }),

  // 生成随机的钱包地址
  generateRandomAddress: () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};

// 禁用控制台输出（除非明确需要调试）
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}