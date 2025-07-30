const { describe, test, expect, jest, beforeEach, afterEach } = require('@jest/globals');

describe('Transaction Parser Manager', () => {
  let transactionParser;
  let mockSwapParser;

  beforeEach(() => {
    // 清除模块缓存
    jest.clearAllMocks();
    delete require.cache[require.resolve('../../src/services/transactionParser')];
    
    // 创建模拟解析器
    mockSwapParser = {
      name: 'TEST_SWAP',
      canParse: jest.fn(),
      parse: jest.fn()
    };

    // 模拟 SwapTransactionParser
    jest.doMock('../../src/parsers/SwapTransactionParser', () => {
      return jest.fn().mockImplementation(() => mockSwapParser);
    });

    transactionParser = require('../../src/services/transactionParser');
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Parser Registration', () => {
    test('should initialize with registered parsers', () => {
      const stats = transactionParser.getStats();
      expect(stats.totalParsers).toBeGreaterThan(0);
      expect(stats.supportedTypes).toContainEqual({
        name: 'TEST_SWAP',
        parser: expect.any(String)
      });
    });

    test('should get supported transaction types', () => {
      const types = transactionParser.getSupportedTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Parsing', () => {
    test('should parse transaction with matching parser', async () => {
      const mockTransaction = global.testUtils.createMockTransaction();
      const expectedResult = {
        type: 'SWAP',
        message: 'Test swap message',
        metadata: { test: true }
      };

      mockSwapParser.canParse.mockReturnValue(true);
      mockSwapParser.parse.mockResolvedValue(expectedResult);

      const result = await transactionParser.parseTransaction(mockTransaction);

      expect(mockSwapParser.canParse).toHaveBeenCalledWith(mockTransaction);
      expect(mockSwapParser.parse).toHaveBeenCalledWith(mockTransaction);
      expect(result).toMatchObject({
        ...expectedResult,
        parser: 'TEST_SWAP',
        signature: mockTransaction.transaction.signatures[0]
      });
    });

    test('should return null when no parser matches', async () => {
      const mockTransaction = global.testUtils.createMockTransaction();

      mockSwapParser.canParse.mockReturnValue(false);

      const result = await transactionParser.parseTransaction(mockTransaction);

      expect(result).toBeNull();
    });

    test('should handle parser errors gracefully', async () => {
      const mockTransaction = global.testUtils.createMockTransaction();

      mockSwapParser.canParse.mockReturnValue(true);
      mockSwapParser.parse.mockRejectedValue(new Error('Parser error'));

      const result = await transactionParser.parseTransaction(mockTransaction);

      expect(result).toBeNull();
    });

    test('should handle invalid transaction input', async () => {
      const result = await transactionParser.parseTransaction(null);
      expect(result).toBeNull();

      const result2 = await transactionParser.parseTransaction(undefined);
      expect(result2).toBeNull();
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple transactions', async () => {
      const transactions = [
        global.testUtils.createMockTransaction({ signature: 'tx1' }),
        global.testUtils.createMockTransaction({ signature: 'tx2' }),
        global.testUtils.createMockTransaction({ signature: 'tx3' })
      ];

      mockSwapParser.canParse.mockReturnValue(true);
      mockSwapParser.parse.mockResolvedValue({
        type: 'SWAP',
        message: 'Test message'
      });

      const results = await transactionParser.parseTransactions(transactions);

      expect(results).toHaveLength(3);
      expect(mockSwapParser.canParse).toHaveBeenCalledTimes(3);
      expect(mockSwapParser.parse).toHaveBeenCalledTimes(3);
    });

    test('should handle empty transactions array', async () => {
      const results = await transactionParser.parseTransactions([]);
      expect(results).toEqual([]);
    });

    test('should handle invalid input gracefully', async () => {
      const results = await transactionParser.parseTransactions(null);
      expect(results).toEqual([]);

      const results2 = await transactionParser.parseTransactions('invalid');
      expect(results2).toEqual([]);
    });
  });
});