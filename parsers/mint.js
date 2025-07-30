// mint.js
// 创建代币交易解析器
const { getTokenInfo } = require('./utils');

/**
 * 判断并解析是否为创建代币
 * @param {object} tx
 * @returns {string|null}
 */
function parseMintTx(tx) {
  if (!tx || !tx.meta || !tx.transaction) return null;
  const instructions = tx.transaction.message.instructions || [];
  const mintInstr = instructions.find(i => i.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' && i.parsed && i.parsed.type === 'mintTo');
  if (!mintInstr) return null;
  const mint = mintInstr.parsed.info.mint;
  const to = mintInstr.parsed.info.account;
  const amount = mintInstr.parsed.info.amount;
  const token = getTokenInfo(mint);
  // 元数据url（假设在tx.meta.tokenMetadataUrls或自定义扩展字段）
  const metaUrl = tx.meta?.tokenMetadataUrls?.[mint] || '';
  // 池子信息，假设取mintInstr.accounts[0]为池子地址
  const pool = mintInstr.accounts ? mintInstr.accounts[0] : '未知';
  const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : new Date().toISOString();
  // mint视为"买入"新币，"用"字段可留空或写"mint"
  // 合约跳转链接
  const gmgnUrl = `https://gmgn.ai/token/${mint}`;
  const axUrl = `https://axplorer.io/token/${mint}`;
  return `【Mint】\n买入: ${amount / Math.pow(10, token.decimals)} ${token.symbol}\n用: mint\n合约: ${mint}\n池子: ${pool}\n元数据: ${metaUrl}\n时间: ${timestamp}\n[gmgn](${gmgnUrl})\n[ax](${axUrl})`;
}

module.exports = { parseMintTx };
