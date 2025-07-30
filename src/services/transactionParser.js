const logger = require('../utils/logger');
const SwapTransactionParser = require('./SwapTransactionParser');
// 其他解析器可以在这里导入

/**
 * 交易解析器管理器
 * 统一管理所有交易解析器，提供解析服务
 */
class TransactionParserManager {
  constructor() {
    this.parsers = [];
    this.initialize();
  }

  /**
   * 初始化所有解析器
   */
  initialize() {
    // 注册解析器（按优先级顺序）
    this.registerParser(new SwapTransactionParser());
    // TODO: 添加其他解析器
    // this.registerParser(new TransferTransactionParser());
    // this.registerParser(new MintTransactionParser());
    // this.registerParser(new LiquidityTransactionParser());

    logger.info(`Transaction parser manager initialized with ${this.parsers.length} parsers`);
  }

  /**
   * 注册解析器
   * @param {BaseTransactionParser} parser - 解析器实例
   */
  registerParser(parser) {
    if (!parser.canParse || !parser.parse) {
      throw new Error('Parser must implement canParse and parse methods');
    }

    this.parsers.push(parser);
    logger.debug(`Registered parser: ${parser.name}`);
  }

  /**
   * 解析交易
   * @param {Object} transaction - 交易对象
   * @returns {Promise<Object|null>} 解析结果或 null
   */
  async parseTransaction(transaction) {
    if (!transaction) {
      logger.warn('Invalid transaction provided to parser');
      return null;
    }

    const signature = transaction.transaction?.signatures?.[0] || 'unknown';
    const startTime = Date.now();

    try {
      // 依次尝试每个解析器
      for (const parser of this.parsers) {
        try {
          if (parser.canParse(transaction)) {
            logger.debug(`Attempting to parse transaction ${signature} with ${parser.name}`);
            
            const result = await parser.parse(transaction);
            if (result) {
              const parseTime = Date.now() - startTime;
              logger.performance(`Transaction parsing (${parser.name})`, parseTime, {
                signature,
                parser: parser.name,
                success: true
              });

              return {
                ...result,
                parser: parser.name,
                signature,
                parseTime
              };
            }
          }
        } catch (error) {
          logger.error(`Parser ${parser.name} failed for transaction ${signature}:`, error);
          // 继续尝试下一个解析器
        }
      }

      // 没有解析器能够处理此交易
      const parseTime = Date.now() - startTime;
      logger.debug(`No parser matched transaction ${signature}`, {
        parseTime,
        parsersAttempted: this.parsers.length
      });

      return null;

    } catch (error) {
      logger.error(`Unexpected error parsing transaction ${signature}:`, error);
      return null;
    }
  }

  /**
   * 批量解析交易
   * @param {Array} transactions - 交易数组
   * @returns {Promise<Array>} 解析结果数组
   */
  async parseTransactions(transactions) {
    if (!Array.isArray(transactions)) {
      logger.warn('Invalid transactions array provided');
      return [];
    }

    const startTime = Date.now();
    const results = [];

    for (const transaction of transactions) {
      const result = await this.parseTransaction(transaction);
      if (result) {
        results.push(result);
      }
    }

    const totalTime = Date.now() - startTime;
    logger.performance('Batch transaction parsing', totalTime, {
      totalTransactions: transactions.length,
      successfulParses: results.length,
      successRate: `${((results.length / transactions.length) * 100).toFixed(1)}%`
    });

    return results;
  }

  /**
   * 获取支持的交易类型
   * @returns {Array} 支持的交易类型列表
   */
  getSupportedTypes() {
    return this.parsers.map(parser => ({
      name: parser.name,
      parser: parser.constructor.name
    }));
  }

  /**
   * 获取解析器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      totalParsers: this.parsers.length,
      supportedTypes: this.getSupportedTypes(),
      registrationOrder: this.parsers.map(p => p.name)
    };
  }

  /**
   * 重新加载解析器
   */
  reload() {
    logger.info('Reloading transaction parsers...');
    this.parsers = [];
    this.initialize();
  }
}

// 导出单例实例
const transactionParserManager = new TransactionParserManager();

module.exports = transactionParserManager;