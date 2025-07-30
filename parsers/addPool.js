// addPool.js
// 添加池子交易解析器
const { ADD_POOL_PROGRAM_IDS, getTokenInfo } = require('./utils');

/**
 * 判断并解析是否为添加池子
 * @param {object} tx
 * @returns {string|null}
 */
function parseAddPoolTx(tx) {
  if (!tx || !tx.meta || !tx.transaction) return null;
  const instructions = tx.transaction.message.instructions || [];
  // 检查是否为添加池子相关 programId
  const poolInstr = instructions.find(i => ADD_POOL_PROGRAM_IDS.includes(i.programId));
  if (!poolInstr) return null;
  // 解析池子相关信息（如涉及的token、池子地址等）
  // 这里只做基础示例，实际可根据平台协议细化
  const poolAddress = poolInstr.accounts ? poolInstr.accounts[0] : '未知';
  return `添加池子\n池子地址: ${poolAddress}\n平台: ${poolInstr.programId}\nTx: https://solscan.io/tx/${tx.transaction.signatures[0]}`;
}

module.exports = { parseAddPoolTx };
