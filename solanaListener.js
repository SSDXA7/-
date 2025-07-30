// solanaListener.js
// 主入口：监听Solana链上指定钱包地址的所有交易，解析并分发到四大块

const { Connection, clusterApiUrl } = require('@solana/web3.js');
const Bottleneck = require('bottleneck');
const pLimit = require('p-limit');
const TelegramBot = require('node-telegram-bot-api');

// ========== 配置区 ==========
// 使用用户提供的 RPC 秘钥
const RPC_URL = `https://rpc.helius.xyz/?api-key=ce41efcd-9698-48f2-818e-7d3049bb7190`;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID';
const WATCH_ADDRESSES = process.env.WATCH_ADDRESSES?.split(',') || [];
const POLL_INTERVAL = 1500; // ms，每个地址拉取间隔，适配免费套餐
const CONCURRENCY = 3; // 并发请求数，适配免费套餐

// ========== 初始化 ==========
const connection = new Connection(RPC_URL, 'confirmed');
const bot = new TelegramBot(TELEGRAM_TOKEN);
const limit = pLimit(CONCURRENCY);
const handledTxs = new Set();
const limiter = new Bottleneck({ minTime: 120 }); // 限速器，适配10 req/sec

// ========== 四大块解析模块 ==========
const { parseSwapTx } = require('./parsers/swap');
const { parseTransferTx } = require('./parsers/transfer');
const { parseMintTx } = require('./parsers/mint');
const { parseAddPoolTx } = require('./parsers/addPool');

// ========== 工具函数 ==========
async function fetchWithRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      if (res) return res;
    } catch (e) {
      console.warn(`Retry ${i + 1} failed:`, e.message);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return null;
}

function formatAndSend(msg) {
  if (msg) {
    bot.sendMessage(TELEGRAM_CHAT_ID, msg).catch(console.error);
  }
}

// ========== 主监听逻辑 ==========
/**
 * 只推送命中的块（swap/transfer/mint/addPool），其余类型全部忽略。
 * 逻辑说明：
 * 1. 依次调用四大解析器，顺序为 swap > transfer > mint > addPool。
 * 2. 只要有一个块命中（返回内容），立即推送并终止后续判断。
 * 3. 所有解析器都未命中则不推送。
 * 4. 保证不会混合类型，也不会多次推送同一交易。
 */
async function handleSignature(address, sig) {
  if (handledTxs.has(sig)) return;
  handledTxs.add(sig);
  const tx = await fetchWithRetry(() => limiter.schedule(() => connection.getParsedTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })));
  if (!tx) {
    console.error('获取交易失败:', sig);
    return;
  }
  // 只输出命中的块
  let result = null;
  // 1. swap
  result = parseSwapTx(tx);
  if (result) {
    formatAndSend(result);
    return;
  }
  // 2. transfer
  result = parseTransferTx(tx);
  if (result) {
    formatAndSend(result);
    return;
  }
  // 3. mint
  result = parseMintTx(tx);
  if (result) {
    formatAndSend(result);
    return;
  }
  // 4. addPool
  result = parseAddPoolTx(tx);
  if (result) {
    formatAndSend(result);
    return;
  }
  // 其它类型全部忽略，不推送
  console.log('未识别交易类型:', sig);
}

function startAddressListener(address) {
  let lastSignature = null;
  setInterval(async () => {
    try {
      const signatures = await fetchWithRetry(() => limiter.schedule(() => connection.getSignaturesForAddress(address, { limit: 10 })));
      if (!signatures || signatures.length === 0) return;
      for (const sigObj of signatures) {
        const sig = sigObj.signature;
        if (sig === lastSignature) break;
        await handleSignature(address, sig);
      }
      lastSignature = signatures[0]?.signature || lastSignature;
    } catch (e) {
      console.error('监听地址出错:', address, e.message);
    }
  }, POLL_INTERVAL);
}

function main() {
  if (!WATCH_ADDRESSES.length) {
    console.error('未配置监听地址');
    process.exit(1);
  }
  for (const addr of WATCH_ADDRESSES) {
    startAddressListener(addr);
  }
  console.log('Solana监听启动，地址：', WATCH_ADDRESSES.join(','));
}

main();
