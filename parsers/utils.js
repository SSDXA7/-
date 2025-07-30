// utils.js
// 常量与工具函数

// Swap相关programId（可补充主流DEX，如Raydium/Jupiter/Orca等）
const SWAP_PROGRAM_IDS = [
  '9xQeWvG816bUx9EPa2BLk6b6F5j5wX4HnQZ9XbWta7rC', // Serum
  'RVKd61ztZW9GdKzS1nC6tKzFh8L6YJ6jLw6L4dHjUo5', // Jupiter
  '5quB4YkK5QnQw2tq9YwQK8R7g8Vn6v5o6A3XyQ9wQK8R', // Orca
  'EhhTKb8k7fJjQh8J1j5wX4HnQZ9XbWta7rC9xQeWvG81', // Raydium
  // ...可补充
];

// 添加池子相关programId（如Raydium、Orca等）
const ADD_POOL_PROGRAM_IDS = [
  'RVKd61ztZW9GdKzS1nC6tKzFh8L6YJ6jLw6L4dHjUo5', // Jupiter
  '5quB4YkK5QnQw2tq9YwQK8R7g8Vn6v5o6A3XyQ9wQK8R', // Orca
  'EhhTKb8k7fJjQh8J1j5wX4HnQZ9XbWta7rC9xQeWvG81', // Raydium
  // ...可补充
];

// 钱包地址备注表
const WALLET_REMARKS = {
  'suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK': '畜生',
  '5B52w1ZW9tuwUduueP5J7HXz5AcGfruGoX6YoAudvyxG': '外国佬',
  '3h65MmPZksoKKyEpEjnWU2Yk2iYT5oZDNitGy5cTaxoE': '畜生二号',
  'B4brsgvqxWJimyNABzFGDqepUhgu8mDBb7KeCP83CPLB': '自己',
  'WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh': '外国佬二号',
  '3Z19SwGej4xwKh9eiHyx3eVWHjBDEgGHeqrKtmhNcxsv': '其他用户',
};

// 假定本地维护部分主流Token信息（实际可接入链上或API）
const TOKEN_LIST = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9, mint: 'So11111111111111111111111111111111111111112' },
  // ...可补充
};

function getTokenInfo(mint) {
  // 实际可接链上/缓存API
  return TOKEN_LIST[mint] || { symbol: mint.slice(0,4)+'...', decimals: 9, mint };
}

module.exports = {
  SWAP_PROGRAM_IDS,
  ADD_POOL_PROGRAM_IDS,
  TOKEN_LIST,
  WALLET_REMARKS,
  getTokenInfo,
};
