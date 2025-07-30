const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

// ========== 配置区 ==========
const TELEGRAM_TOKEN = '8229398613:AAExmMzZRQr0sB8GHznkELFY1XWtiLRyxQc';
const TELEGRAM_CHAT_ID = '-1002788539967';

// 飞书配置
const feishuConfig = require('./feishu-config');
const FEISHU_WEBHOOK_URL = feishuConfig.FEISHU_WEBHOOK_URL;
const ENABLE_FEISHU = feishuConfig.ENABLE_FEISHU;

const PORT = process.env.PORT || 3000;

const { parseSwapTx } = require('./parsers/swap');
const { parseTransferTx } = require('./parsers/transfer');
const { parseMintTx } = require('./parsers/mint');
const { parseAddPoolTx } = require('./parsers/addPool');

const handledTxs = new Set();
const bot = new TelegramBot(TELEGRAM_TOKEN);

// ========== 工具函数 ==========
// 飞书推送函数
async function sendToFeishu(message) {
  if (!ENABLE_FEISHU) {
    console.log('飞书推送已禁用');
    return;
  }
  
  if (FEISHU_WEBHOOK_URL === 'https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_WEBHOOK_KEY') {
    console.log('请先配置飞书webhook地址');
    return;
  }
  
  try {
    const response = await fetch(FEISHU_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msg_type: feishuConfig.MESSAGE_CONFIG.msg_type,
        content: {
          text: message
        }
      })
    });
    
    if (response.ok) {
      console.log('推送到飞书成功');
    } else {
      console.error('推送飞书失败:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('推送飞书错误:', error.message);
  }
}

// 统一推送函数 - 同时发送到Telegram和飞书
function formatAndSend(msg) {
  if (msg) {
    // 推送到Telegram
    bot.sendMessage(TELEGRAM_CHAT_ID, msg)
      .then(() => console.log('推送到TG成功'))
      .catch(e => console.error('推送TG失败:', e));
    
    // 推送到飞书（如果启用）
    if (ENABLE_FEISHU) {
      sendToFeishu(msg);
    }
  }
}

// ========== Webhook 处理 ==========
const app = express();
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  console.log(`[${new Date().toISOString()}] 收到Webhook推送`);
  // 1. 立即返回200，防止推送阻塞
  res.status(200).send('OK');

  // 2. 调试：输出完整的数据结构
  console.log('完整数据结构:', JSON.stringify(req.body, null, 2));
  
  // 3. 尝试多种可能的数据路径
  let tx = null;
  let sig = null;
  
  // 路径1: Enhanced webhook 格式（数组）
  if (Array.isArray(req.body) && req.body.length > 0) {
    tx = req.body[0];
    sig = tx.signature;
    console.log('使用数组格式，签名:', sig);
  }
  // 路径2: 单个对象格式
  else if (req.body.signature) {
    tx = req.body;
    sig = req.body.signature;
    console.log('使用对象格式，签名:', sig);
  }
  // 路径3: 嵌套格式
  else if (req.body.data?.transaction) {
    tx = req.body.data.transaction;
    sig = tx.transaction?.signatures?.[0] || tx.signature;
    console.log('使用嵌套格式，签名:', sig);
  }
  // 路径4: 直接事务格式
  else if (req.body.transaction) {
    tx = req.body.transaction;
    sig = tx.transaction?.signatures?.[0] || tx.signature;
    console.log('使用事务格式，签名:', sig);
  }
  
  if (!sig || handledTxs.has(sig)) {
    if (!sig) console.log('❌ 未获取到交易哈希，请检查数据格式');
    else console.log('重复交易，已忽略:', sig);
    return;
  }
  handledTxs.add(sig);

  // 4. 处理Enhanced Webhook格式，智能识别交易类型
  if (tx.description && tx.type) {
    console.log(`✅ 接收到${tx.type}交易:`, tx.description);
    
    // 获取发送人备注
    const { WALLET_REMARKS } = require('./parsers/utils');
    let description = tx.description;
    
    // 智能识别实际交易类型
    let actualType = tx.type;
    
    // 检查是否为SWAP交易（只要有tokenTransfers就是SWAP）
    if (tx.tokenTransfers && tx.tokenTransfers.length >= 1) {
      // 所有涉及代币的交易都认为是SWAP
      const isSwap = true;
      
      if (isSwap) {
        actualType = 'SWAP';
        // 重新构造描述
        const transfers = tx.tokenTransfers;
        const solTransfer = transfers.find(t => t.mint === 'So11111111111111111111111111111111111111112');
        const tokenTransfer = transfers.find(t => t.mint !== 'So11111111111111111111111111111111111111112');
        
        if (solTransfer && tokenTransfer) {
          // 确定交易方向和用户
          let user, action, inputAmount, outputAmount, inputToken, outputToken;
          
          // 找到我们监听的用户
          const monitoredUser = WALLET_REMARKS[solTransfer.fromUserAccount] || 
                               WALLET_REMARKS[solTransfer.toUserAccount] ||
                               WALLET_REMARKS[tokenTransfer.fromUserAccount] ||
                               WALLET_REMARKS[tokenTransfer.toUserAccount];
          
          if (monitoredUser) {
            user = monitoredUser;
            
            // 判断是买入还是卖出
            if (WALLET_REMARKS[tokenTransfer.toUserAccount]) {
              // 用户接收代币 = 买入
              inputAmount = solTransfer.tokenAmount;
              outputAmount = tokenTransfer.tokenAmount.toLocaleString();
              inputToken = 'SOL';
              outputToken = '代币';
              action = '购买';
            } else if (WALLET_REMARKS[solTransfer.toUserAccount]) {
              // 用户接收SOL = 卖出
              inputAmount = tokenTransfer.tokenAmount.toLocaleString();
              outputAmount = solTransfer.tokenAmount;
              inputToken = '代币';
              outputToken = 'SOL';
              action = '卖出';
            }
            
            // 获取代币符号的函数
            function getTokenSymbol(mint) {
              const knownTokens = {
                'jj4sVHBNAycihr3yLRddJKDLYrPEL8Ki2HDnkAUbonk': 'MLG',
                '5MSZwxeYVBS69ezCaxN4mjXq6TS1rP2YRpXCAciMbonk': 'Chip',
                'HvpKzRDC3bgyEp6ArCAKiSJx4vm7yvo2tJQoJhFLbonk': 'Chip',
                '21VL1jo4MF5uij74PVmpnGmhizbQhbdXtBiTgXFVbonk': 'SSC',
                'DgGVowZqPiepG7JDN7Beb3i42UUMY1xcAZNmvqdNnaLR': 'GROK',
                '3drQLQw1Q8y5sQ2oxuno85UoTJYEFhJWZwFCZvqobonk': 'Unknown'
              };
              return knownTokens[mint] || mint.slice(0, 4) + '...';
            }

            // 获取代币元数据URL的函数
            async function getTokenMetadataUrl(mint) {
              try {
                const response = await fetch('https://api.mainnet-beta.solana.com', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getAccountInfo',
                    params: [
                      mint,
                      {
                        encoding: 'jsonParsed',
                        commitment: 'finalized'
                      }
                    ]
                  })
                });
                
                const data = await response.json();
                if (data.result && data.result.value && data.result.value.data) {
                  const parsed = data.result.value.data.parsed;
                  if (parsed && parsed.info && parsed.info.extensions) {
                    // 查找元数据扩展
                    for (const extension of parsed.info.extensions) {
                      if (extension.extension === 'tokenMetadata' && extension.state && extension.state.uri) {
                        return extension.state.uri;
                      }
                    }
                  }
                }
                return null;
              } catch (error) {
                console.log(`获取代币 ${mint} 元数据失败:`, error.message);
                return null;
              }
            }
            
            // 获取池子名字的函数
            function getPoolName(instructions, accounts) {
              // 检查是否是知名DEX
              const dexPrograms = {
                'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'Raydium CPMM',
                '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
                'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj': 'Raydium LaunchLab',
                '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca',
                'SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8': 'Serum',
                'BXxgGt3akAghZviYHLh8KUh6vhXBht5wf86De6huTp95': 'Jupiter',
                'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter V6'
              };
              
              // 从指令中找到DEX程序
              if (instructions) {
                for (const instruction of instructions) {
                  if (dexPrograms[instruction.programId]) {
                    return dexPrograms[instruction.programId];
                  }
                }
              }
              
              return '未知池子';
            }
            
            // 格式化数字的函数
            function formatNumber(num) {
              if (num >= 1000000) {
                return (num / 1000000).toFixed(2) + 'M';
              } else if (num >= 1000) {
                return (num / 1000).toFixed(2) + 'K';
              }
              return num.toLocaleString();
            }
            
            // 获取代币符号和CA
            const tokenSymbol = getTokenSymbol(tokenTransfer.mint);
            const tokenCA = tokenTransfer.mint;
            const poolName = getPoolName(tx.instructions, tx.accounts);
            outputToken = tokenSymbol;
            
            // 异步获取元数据URL
            const metadataUrl = await getTokenMetadataUrl(tokenCA);
            
            // 生成链接
            const gmgnLink = `https://gmgn.ai/sol/token/${tokenCA}`;
            const axiomLink = `https://www.axiom.trade/trade/${tokenCA}`;
            
            description = `${user} 用 ${inputAmount} ${inputToken} ${action}了 ${formatNumber(typeof outputAmount === 'string' ? parseFloat(outputAmount.replace(/,/g, '')) : outputAmount)} ${outputToken}
🏊 池子: ${poolName}
📋 CA: ${tokenCA}
🔍 GMGN: ${gmgnLink}
💰 快速购买: ${axiomLink}`;
            
            // 如果获取到元数据URL，则添加到描述中
            if (metadataUrl) {
              description += `\n📄 元数据: ${metadataUrl}`;
            }
          } else {
            // 如果没找到监听的用户，保持原描述但标记为SWAP
            description = `检测到代币交换: ${solTransfer.tokenAmount} SOL ↔ ${tokenTransfer.tokenAmount.toLocaleString()} 代币`;
          }
        }
      }
    }
    
    // 如果是普通转账但涉及代币，也要显示完整信息
    if (actualType === 'TRANSFER' && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      // 检查是否有我们监听的地址参与
      const relevantTransfer = tx.tokenTransfers.find(t => 
        WALLET_REMARKS[t.fromUserAccount] || WALLET_REMARKS[t.toUserAccount]
      );
      
      if (relevantTransfer) {
        const fromUser = WALLET_REMARKS[relevantTransfer.fromUserAccount] || relevantTransfer.fromUserAccount.slice(0,8) + '...';
        const toUser = WALLET_REMARKS[relevantTransfer.toUserAccount] || relevantTransfer.toUserAccount.slice(0,8) + '...';
        
        // 获取代币符号的函数
        function getTokenSymbol(mint) {
          const knownTokens = {
            'jj4sVHBNAycihr3yLRddJKDLYrPEL8Ki2HDnkAUbonk': 'MLG',
            '5MSZwxeYVBS69ezCaxN4mjXq6TS1rP2YRpXCAciMbonk': 'Chip',
            'HvpKzRDC3bgyEp6ArCAKiSJx4vm7yvo2tJQoJhFLbonk': 'Chip',
            '21VL1jo4MF5uij74PVmpnGmhizbQhbdXtBiTgXFVbonk': 'SSC',
            'DgGVowZqPiepG7JDN7Beb3i42UUMY1xcAZNmvqdNnaLR': 'GROK',
            '3drQLQw1Q8y5sQ2oxuno85UoTJYEFhJWZwFCZvqobonk': 'Unknown'
          };
          return knownTokens[mint] || mint.slice(0, 4) + '...';
        }
        
        // 获取池子名字的函数
        function getPoolName(instructions, accounts) {
          // 检查是否是知名DEX
          const dexPrograms = {
            'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'Raydium CPMM',
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
            'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj': 'Raydium LaunchLab',
            '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca',
            'SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8': 'Serum',
            'BXxgGt3akAghZviYHLh8KUh6vhXBht5wf86De6huTp95': 'Jupiter',
            'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter V6'
          };
          
          // 从指令中找到DEX程序
          if (instructions) {
            for (const instruction of instructions) {
              if (dexPrograms[instruction.programId]) {
                return dexPrograms[instruction.programId];
              }
            }
          }
          
          return '未知池子';
        }
        
        // 格式化数字的函数
        function formatNumber(num) {
          if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
          } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
          }
          return num.toLocaleString();
        }
        
        const amount = formatNumber(relevantTransfer.tokenAmount);
        const isSOL = relevantTransfer.mint === 'So11111111111111111111111111111111111111112';
        const tokenSymbol = isSOL ? 'SOL' : getTokenSymbol(relevantTransfer.mint);
        const tokenCA = relevantTransfer.mint;
        
        if (isSOL) {
          description = `${fromUser} 转账 ${amount} ${tokenSymbol} 给 ${toUser}`;
        } else {
          // 代币转账也显示完整信息
          const poolName = getPoolName(tx.instructions, tx.accounts);
          const gmgnLink = `https://gmgn.ai/sol/token/${tokenCA}`;
          const axiomLink = `https://www.axiom.trade/trade/${tokenCA}`;
          
          // 异步获取元数据URL
          const metadataUrl = await getTokenMetadataUrl(tokenCA);
          
          description = `${fromUser} 转账 ${amount} ${tokenSymbol} 给 ${toUser}
🏊 池子: ${poolName}
📋 CA: ${tokenCA}
🔍 GMGN: ${gmgnLink}
💰 快速购买: ${axiomLink}`;
          
          // 如果获取到元数据URL，则添加到描述中
          if (metadataUrl) {
            description += `\n📄 元数据: ${metadataUrl}`;
          }
        }
      }
    }
    
    // 替换地址为备注名称（如果还没替换的话）
    Object.keys(WALLET_REMARKS).forEach(address => {
      const remark = WALLET_REMARKS[address];
      if (description.includes(address)) {
        description = description.replace(new RegExp(address, 'g'), remark);
      }
    });
    
    // 获取交易类型的中文名称
    const typeMap = {
      'TRANSFER': '转账',
      'SWAP': '🔄 代币交换',
      'NFT_SALE': 'NFT交易',
      'MINT': '铸造',
      'ADD_POOL': '添加池子'
    };
    const typeName = typeMap[actualType] || actualType;
    
    // 格式化消息
    const message = `【${typeName}】\n${description}\n时间: ${new Date(tx.timestamp * 1000).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n交易: https://solscan.io/tx/${sig}`;
    
    console.log('📱 推送到Telegram:', message);
    return formatAndSend(message);
  }
  
  // 5. 如果没有description，尝试原有的解析器
  let result = null;
  result = parseSwapTx(tx); // Swap类型
  if (result) {
    console.log('解析为Swap类型，推送内容如下：\n', result);
    return formatAndSend(result);
  }
  result = parseTransferTx(tx); // 转账类型
  if (result) {
    console.log('解析为转账类型，推送内容如下：\n', result);
    return formatAndSend(result);
  }
  result = parseMintTx(tx); // 创建代币类型
  if (result) {
    console.log('解析为Mint类型，推送内容如下：\n', result);
    return formatAndSend(result);
  }
  result = parseAddPoolTx(tx); // 添加池子类型
  if (result) {
    console.log('解析为AddPool类型，推送内容如下：\n', result);
    return formatAndSend(result);
  }

  console.log('❌ 未识别的交易类型，已忽略:', sig);
  return;
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
