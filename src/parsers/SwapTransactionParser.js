const BaseTransactionParser = require('./BaseTransactionParser');
const { WALLET_REMARKS, getTokenInfo } = require('./utils');

/**
 * SWAP 交易解析器
 * 识别和解析代币交换交易
 */
class SwapTransactionParser extends BaseTransactionParser {
  constructor() {
    super('SWAP');
    
    // 支持的 DEX 程序 ID
    this.dexPrograms = {
      'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'Raydium CPMM',
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
      'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj': 'Raydium LaunchLab',
      '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca',
      'SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8': 'Serum',
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter V6',
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool'
    };
  }

  /**
   * 检查是否为 SWAP 交易
   */
  canParse(transaction) {
    if (!transaction?.meta || !transaction?.transaction) {
      return false;
    }

    // 检查是否有代币转移
    const tokenTransfers = transaction.meta.postTokenBalances || [];
    if (tokenTransfers.length < 2) {
      return false;
    }

    // 检查是否涉及已知的 DEX 程序
    const instructions = transaction.transaction.message.instructions || [];
    const hasDexInstruction = instructions.some(instruction => 
      Object.keys(this.dexPrograms).includes(instruction.programId)
    );

    return hasDexInstruction;
  }

  /**
   * 解析 SWAP 交易
   */
  async parse(transaction) {
    try {
      const signature = transaction.transaction.signatures[0];
      const timestamp = this.getTimestamp(transaction);
      
      // 分析代币余额变化
      const balanceChanges = this.analyzeBalanceChanges(transaction);
      if (!balanceChanges.input || !balanceChanges.output) {
        this.logResult(signature, false, { reason: 'No valid balance changes found' });
        return null;
      }

      // 识别用户和交易方向
      const userInfo = this.identifyUser(balanceChanges);
      if (!userInfo.user) {
        this.logResult(signature, false, { reason: 'No monitored user found' });
        return null;
      }

      // 获取 DEX 信息
      const dexInfo = this.identifyDex(transaction);
      
      // 获取代币信息
      const inputToken = await getTokenInfo(balanceChanges.input.mint);
      const outputToken = await getTokenInfo(balanceChanges.output.mint);

      // 格式化交易信息
      const result = await this.formatSwapMessage({
        signature,
        timestamp,
        user: userInfo.user,
        action: userInfo.action,
        input: {
          token: inputToken,
          amount: Math.abs(balanceChanges.input.amount) / Math.pow(10, inputToken.decimals)
        },
        output: {
          token: outputToken,
          amount: balanceChanges.output.amount / Math.pow(10, outputToken.decimals)
        },
        dex: dexInfo,
        links: this.generateLinks(signature, outputToken.mint)
      });

      this.logResult(signature, true, {
        user: userInfo.user,
        inputToken: inputToken.symbol,
        outputToken: outputToken.symbol,
        dex: dexInfo.name
      });

      return result;

    } catch (error) {
      logger.error(`Error parsing swap transaction:`, error, {
        signature: transaction.transaction?.signatures?.[0]
      });
      return null;
    }
  }

  /**
   * 分析代币余额变化
   */
  analyzeBalanceChanges(transaction) {
    const postBalances = transaction.meta.postTokenBalances || [];
    const preBalances = transaction.meta.preTokenBalances || [];

    const changes = postBalances.map((post, index) => {
      const pre = preBalances[index];
      if (!pre || post.mint !== pre.mint) return null;

      const postAmount = Number(post.uiTokenAmount.amount);
      const preAmount = Number(pre.uiTokenAmount.amount);
      const change = postAmount - preAmount;

      if (change === 0) return null;

      return {
        mint: post.mint,
        owner: post.owner,
        amount: change,
        decimals: post.uiTokenAmount.decimals
      };
    }).filter(Boolean);

    const input = changes.find(change => change.amount < 0); // 减少的代币
    const output = changes.find(change => change.amount > 0); // 增加的代币

    return { input, output, all: changes };
  }

  /**
   * 识别用户和交易方向
   */
  identifyUser(balanceChanges) {
    // 检查输入代币的所有者
    const inputOwner = balanceChanges.input.owner;
    const outputOwner = balanceChanges.output.owner;

    let user = WALLET_REMARKS[inputOwner] || WALLET_REMARKS[outputOwner];
    let action = 'swap';

    if (user) {
      // 根据 SOL 的流向判断是买入还是卖出
      const solMint = 'So11111111111111111111111111111111111111112';
      
      if (balanceChanges.input.mint === solMint) {
        action = '购买';
      } else if (balanceChanges.output.mint === solMint) {
        action = '卖出';
      }
    }

    return { user, action };
  }

  /**
   * 识别 DEX
   */
  identifyDex(transaction) {
    const instructions = transaction.transaction.message.instructions || [];
    
    for (const instruction of instructions) {
      if (this.dexPrograms[instruction.programId]) {
        return {
          name: this.dexPrograms[instruction.programId],
          programId: instruction.programId
        };
      }
    }

    return { name: '未知 DEX', programId: null };
  }

  /**
   * 格式化 SWAP 消息
   */
  async formatSwapMessage(data) {
    const {
      signature,
      timestamp,
      user,
      action,
      input,
      output,
      dex,
      links
    } = data;

    // 获取代币元数据（如果可用）
    let metadataInfo = '';
    try {
      if (output.token.metadataUrl) {
        metadataInfo = `\n📄 元数据: ${output.token.metadataUrl}`;
      }
    } catch (error) {
      // 忽略元数据获取错误
    }

    const message = `🔄 **代币交换**

👤 用户: ${user}
💱 操作: ${action}
📊 交易: ${this.formatNumber(input.amount)} ${input.token.symbol} → ${this.formatNumber(output.amount)} ${output.token.symbol}
🏊 DEX: ${dex.name}
📋 合约: \`${output.token.mint}\`
🕒 时间: ${timestamp.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

🔗 [Solscan](${links.solscan}) | [GMGN](${links.gmgn}) | [Axiom](${links.axiom})${metadataInfo}`;

    return {
      type: 'SWAP',
      message,
      metadata: {
        signature,
        user,
        inputToken: input.token.symbol,
        outputToken: output.token.symbol,
        inputAmount: input.amount,
        outputAmount: output.amount,
        dex: dex.name
      }
    };
  }
}

module.exports = SwapTransactionParser;