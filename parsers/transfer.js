// transfer.js
// 普通转账交易解析器
const { getTokenInfo } = require('./utils');

/**
 * 判断并解析是否为普通转账
 * @param {object} tx
 * @returns {string|null}
 */
function parseTransferTx(tx) {
  if (!tx || !tx.meta || !tx.transaction) return null;
  const instructions = tx.transaction.message.instructions || [];
  // 备注（假设在tx.remark或tx.transaction.message.memo）
  const remark = tx.remark || tx.transaction.message.memo || '';
  const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : new Date().toISOString();
  // 检查是否为系统SOL转账
  const sysTransfer = instructions.find(i => i.programId === '11111111111111111111111111111111');
  if (sysTransfer && tx.meta.postBalances && tx.meta.preBalances) {
    const delta = tx.meta.postBalances.map((post, i) => post - tx.meta.preBalances[i]);
    const fromIdx = delta.findIndex(d => d < 0);
    const toIdx = delta.findIndex(d => d > 0);
    if (fromIdx !== -1 && toIdx !== -1) {
      const amount = Math.abs(delta[fromIdx]) / 1e9;
      if (amount < 1e-9) return null;
      // 收款人备注处理
      const { WALLET_REMARKS } = require('./utils');
      const toAddr = tx.transaction.message.accountKeys[toIdx].pubkey;
      const toRemark = WALLET_REMARKS[toAddr] || toAddr;
      return `【转账】\n备注: ${remark}\n金额: ${amount} SOL\n收款人: ${toRemark}\n时间: ${timestamp}`;
    }
  }
  // SPL Token转账
  const tokenInstr = instructions.find(i => i.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  if (tokenInstr && tx.meta.postTokenBalances && tx.meta.preTokenBalances) {
    const changes = tx.meta.postTokenBalances.map((post, idx) => {
      const pre = tx.meta.preTokenBalances[idx];
      if (!pre) return null;
      return {
        mint: post.mint,
        owner: post.owner,
        amount: Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount)
      };
    }).filter(Boolean);
    const out = changes.find(c => c.amount < 0);
    const inn = changes.find(c => c.amount > 0);
    if (out && inn) {
      if (Math.abs(out.amount) < 1) return null;
      const token = getTokenInfo(out.mint);
      // 收款人备注处理
      const { WALLET_REMARKS } = require('./utils');
      const toAddr = inn.owner;
      const toRemark = WALLET_REMARKS[toAddr] || toAddr;
      return `【转账】\n备注: ${remark}\n金额: ${Math.abs(out.amount) / Math.pow(10, token.decimals)} ${token.symbol}\n收款人: ${toRemark}\n时间: ${timestamp}`;
    }
  }
  return null;
}

module.exports = { parseTransferTx };
