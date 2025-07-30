const logger = require('../utils/logger');

/**
 * 交易解析器基类
 * 定义统一的解析接口和通用功能
 */
class BaseTransactionParser {
  constructor(name) {
    this.name = name;
  }

  /**
   * 检查交易是否匹配此解析器
   * @param {Object} transaction - 解析后的交易对象
   * @returns {boolean}
   */
  canParse(transaction) {
    throw new Error('canParse method must be implemented');
  }

  /**
   * 解析交易并返回格式化的消息
   * @param {Object} transaction - 解析后的交易对象
   * @returns {Object|null} - 解析结果或 null
   */
  async parse(transaction) {
    throw new Error('parse method must be implemented');
  }

  /**
   * 获取交易时间戳
   */
  getTimestamp(transaction) {
    return transaction.blockTime 
      ? new Date(transaction.blockTime * 1000)
      : new Date();
  }

  /**
   * 格式化数字显示
   */
  formatNumber(num, decimals = 2) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(decimals) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(decimals) + 'K';
    }
    return num.toLocaleString();
  }

  /**
   * 生成交易链接
   */
  generateLinks(signature, tokenMint = null) {
    const links = {
      solscan: `https://solscan.io/tx/${signature}`
    };

    if (tokenMint) {
      links.gmgn = `https://gmgn.ai/sol/token/${tokenMint}`;
      links.axiom = `https://www.axiom.trade/trade/${tokenMint}`;
    }

    return links;
  }

  /**
   * 记录解析结果
   */
  logResult(signature, success, details = {}) {
    if (success) {
      logger.transaction(signature, `Successfully parsed as ${this.name}`, details);
    } else {
      logger.debug(`Transaction ${signature} did not match ${this.name} parser`);
    }
  }
}

module.exports = BaseTransactionParser;