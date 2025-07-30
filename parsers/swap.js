// swap.js
// Swap 交易解析器
const { SWAP_PROGRAM_IDS, getTokenInfo } = require('./utils');

/**
 * 判断并解析是否为 Swap 交易
 * @param {object} tx - 解析后的交易对象
 * @returns {string|null} - 返回格式化推送内容或 null
 */
function parseSwapTx(tx) {
  if (!tx || !tx.meta || !tx.transaction) return null;
  const instructions = tx.transaction.message.instructions || [];
  const swapInstr = instructions.find(i => SWAP_PROGRAM_IDS.includes(i.programId));
  if (!swapInstr) return null;

  const postTokenBalances = tx.meta.postTokenBalances || [];
  const preTokenBalances = tx.meta.preTokenBalances || [];
  let swapOut = null, swapIn = null;
  if (postTokenBalances.length > 1 && preTokenBalances.length > 1) {
    const changes = postTokenBalances.map((post, idx) => {
      const pre = preTokenBalances[idx];
      if (!pre) return null;
      return {
        mint: post.mint,
        owner: post.owner,
        amount: Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount)
      };
    }).filter(Boolean);
    swapOut = changes.find(c => c.amount < 0);
    swapIn = changes.find(c => c.amount > 0);
  }
  if (!swapOut || !swapIn) return null;
  const outToken = getTokenInfo(swapOut.mint);
  const inToken = getTokenInfo(swapIn.mint);
  // 元数据url（假设在tx.meta.tokenMetadataUrls或自定义扩展字段）
  const metaUrl = tx.meta?.tokenMetadataUrls?.[inToken.mint] || '';
  // 池子信息，假设取swapInstr.accounts[0]为池子地址
  const pool = swapInstr.accounts ? swapInstr.accounts[0] : '未知';
  // 时间戳（优先取tx.blockTime，否则当前时间）
  const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : new Date().toISOString();
  // 合约跳转链接
  const gmgnUrl = `https://gmgn.ai/token/${inToken.mint}`;
  const axUrl = `https://axplorer.io/token/${inToken.mint}`;
  return `【Swap】\n买入: ${swapIn.amount / Math.pow(10, inToken.decimals)} ${inToken.symbol}\n用: ${Math.abs(swapOut.amount) / Math.pow(10, outToken.decimals)} ${outToken.symbol}\n合约: ${inToken.mint}\n池子: ${pool}\n元数据: ${metaUrl}\n时间: ${timestamp}\n[gmgn](${gmgnUrl})\n[ax](${axUrl})`;
}

module.exports = { parseSwapTx };
