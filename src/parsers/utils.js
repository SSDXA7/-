const logger = require('../utils/logger');

// 钱包地址备注表 - 从环境变量或配置文件加载
const WALLET_REMARKS = {
  'suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK': '畜生',
  '5B52w1ZW9tuwUduueP5J7HXz5AcGfruGoX6YoAudvyxG': '外国佬',
  '3h65MmPZksoKKyEpEjnWU2Yk2iYT5oZDNitGy5cTaxoE': '畜生二号',
  'B4brsgvqxWJimyNABzFGDqepUhgu8mDBb7KeCP83CPLB': '自己',
  'WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh': '外国佬二号',
  '3Z19SwGej4xwKh9eiHyx3eVWHjBDEgGHeqrKtmhNcxsv': '其他用户',
};

// 已知代币信息缓存
const TOKEN_CACHE = new Map();

// 主流代币信息
const WELL_KNOWN_TOKENS = {
  'So11111111111111111111111111111111111111112': {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    mint: 'So11111111111111111111111111111111111111112'
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  }
};

/**
 * 获取代币信息
 * @param {string} mint - 代币合约地址
 * @returns {Promise<Object>} 代币信息
 */
async function getTokenInfo(mint) {
  // 检查缓存
  if (TOKEN_CACHE.has(mint)) {
    return TOKEN_CACHE.get(mint);
  }

  // 检查已知代币
  if (WELL_KNOWN_TOKENS[mint]) {
    const tokenInfo = WELL_KNOWN_TOKENS[mint];
    TOKEN_CACHE.set(mint, tokenInfo);
    return tokenInfo;
  }

  // 尝试从链上获取代币信息
  try {
    const tokenInfo = await fetchTokenInfoFromChain(mint);
    if (tokenInfo) {
      TOKEN_CACHE.set(mint, tokenInfo);
      return tokenInfo;
    }
  } catch (error) {
    logger.warn(`Failed to fetch token info for ${mint}:`, error.message);
  }

  // 返回默认信息
  const defaultInfo = {
    symbol: mint.slice(0, 4) + '...',
    name: 'Unknown Token',
    decimals: 9,
    mint
  };

  TOKEN_CACHE.set(mint, defaultInfo);
  return defaultInfo;
}

/**
 * 从链上获取代币信息
 * @param {string} mint - 代币合约地址
 * @returns {Promise<Object|null>} 代币信息或 null
 */
async function fetchTokenInfoFromChain(mint) {
  try {
    // 这里可以调用 Solana RPC 或第三方 API 获取代币信息
    // 例如：Jupiter API、Solana Token List 等
    
    // 简化实现：使用 Jupiter Token List API
    const response = await fetch(`https://token.jup.ag/strict`);
    const tokenList = await response.json();
    
    const token = tokenList.find(t => t.address === mint);
    if (token) {
      return {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        mint: token.address,
        logoURI: token.logoURI
      };
    }

    return null;
  } catch (error) {
    logger.debug(`Token info fetch failed for ${mint}:`, error.message);
    return null;
  }
}

/**
 * 获取代币元数据 URL
 * @param {string} mint - 代币合约地址
 * @returns {Promise<string|null>} 元数据 URL 或 null
 */
async function getTokenMetadataUrl(mint) {
  try {
    // 这里可以实现从 Metaplex 获取元数据的逻辑
    // 暂时返回 null
    return null;
  } catch (error) {
    logger.debug(`Metadata fetch failed for ${mint}:`, error.message);
    return null;
  }
}

/**
 * 格式化地址显示
 * @param {string} address - 钱包地址
 * @returns {string} 格式化后的显示名称
 */
function formatAddress(address) {
  return WALLET_REMARKS[address] || `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * 检查地址是否在监听列表中
 * @param {string} address - 钱包地址
 * @returns {boolean} 是否在监听列表中
 */
function isMonitoredAddress(address) {
  return Object.keys(WALLET_REMARKS).includes(address);
}

/**
 * 格式化数量显示
 * @param {number} amount - 数量
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的数量
 */
function formatAmount(amount, decimals = 2) {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(decimals) + 'M';
  } else if (amount >= 1000) {
    return (amount / 1000).toFixed(decimals) + 'K';
  }
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

/**
 * 获取交易类型的中文名称
 * @param {string} type - 交易类型
 * @returns {string} 中文名称
 */
function getTransactionTypeName(type) {
  const typeMap = {
    'TRANSFER': '💸 转账',
    'SWAP': '🔄 代币交换',
    'NFT_SALE': '🖼️ NFT交易',
    'NFT_MINT': '🎨 NFT铸造',
    'TOKEN_MINT': '🪙 代币铸造',
    'ADD_LIQUIDITY': '💧 添加流动性',
    'REMOVE_LIQUIDITY': '💧 移除流动性',
    'STAKE': '🔒 质押',
    'UNSTAKE': '🔓 解除质押'
  };
  
  return typeMap[type] || type;
}

/**
 * 清理代币缓存
 */
function clearTokenCache() {
  TOKEN_CACHE.clear();
  logger.info('Token cache cleared');
}

/**
 * 获取缓存统计
 * @returns {Object} 缓存统计信息
 */
function getCacheStats() {
  return {
    tokenCacheSize: TOKEN_CACHE.size,
    knownTokensCount: Object.keys(WELL_KNOWN_TOKENS).length,
    monitoredAddressesCount: Object.keys(WALLET_REMARKS).length
  };
}

module.exports = {
  WALLET_REMARKS,
  WELL_KNOWN_TOKENS,
  getTokenInfo,
  getTokenMetadataUrl,
  formatAddress,
  isMonitoredAddress,
  formatAmount,
  getTransactionTypeName,
  clearTokenCache,
  getCacheStats
};