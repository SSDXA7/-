// addressManager.js
// 本地地址管理系统 - 自动同步到 Helius Webhook
const fs = require('fs');
const path = require('path');
const express = require('express');

// ========== 配置区 ==========
const HELIUS_API_KEY = 'ce41efcd-9698-48f2-818e-7d3049bb7190'; // 你的 Helius API Key
const WEBHOOK_ID = process.env.WEBHOOK_ID || 'ce8c0972-f150-48f5-959a-b6c918dcb625'; // 已设置的 Webhook ID
const WEBHOOK_URL = 'https://17c2fa59f7d4.ngrok-free.app/webhook'; // 你的 webhook URL
const ADDRESSES_FILE = './addresses.json';

// ========== 本地地址数据库 ==========
class AddressManager {
  constructor() {
    this.addresses = this.loadAddresses();
  }

  // 加载本地地址数据
  loadAddresses() {
    try {
      if (fs.existsSync(ADDRESSES_FILE)) {
        const data = fs.readFileSync(ADDRESSES_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('加载地址文件失败:', error);
    }
    return [];
  }

  // 保存地址到本地文件
  saveAddresses() {
    try {
      fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(this.addresses, null, 2));
      console.log(`已保存 ${this.addresses.length} 个地址到本地文件`);
    } catch (error) {
      console.error('保存地址文件失败:', error);
    }
  }

  // 添加地址
  addAddress(address, remark = '') {
    const existingIndex = this.addresses.findIndex(item => item.address === address);
    if (existingIndex !== -1) {
      console.log(`地址 ${address} 已存在，更新备注`);
      this.addresses[existingIndex].remark = remark;
      this.addresses[existingIndex].updatedAt = new Date().toISOString();
    } else {
      this.addresses.push({
        address,
        remark,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`已添加地址: ${address} (${remark})`);
    }
    this.saveAddresses();
    return this.syncToHelius();
  }

  // 批量添加地址
  addAddresses(addressList) {
    for (const item of addressList) {
      const address = typeof item === 'string' ? item : item.address;
      const remark = typeof item === 'object' ? item.remark || '' : '';
      this.addAddress(address, remark);
    }
    return this.syncToHelius();
  }

  // 删除地址
  removeAddress(address) {
    const initialLength = this.addresses.length;
    this.addresses = this.addresses.filter(item => item.address !== address);
    if (this.addresses.length < initialLength) {
      console.log(`已删除地址: ${address}`);
      this.saveAddresses();
      return this.syncToHelius();
    } else {
      console.log(`地址 ${address} 不存在`);
      return Promise.resolve();
    }
  }

  // 获取所有地址
  getAllAddresses() {
    return this.addresses;
  }

  // 创建新的 Helius Webhook
  async createWebhook() {
    try {
      const response = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookURL: WEBHOOK_URL,
          transactionTypes: ['Any'],
          accountAddresses: this.addresses.map(item => item.address),
          webhookType: 'enhanced'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎉 Webhook 创建成功!');
        console.log(`Webhook ID: ${data.webhookID}`);
        console.log('请将此 Webhook ID 设置为环境变量 WEBHOOK_ID');
        return data;
      } else {
        const error = await response.text();
        console.error('创建 Webhook 失败:', error);
        return null;
      }
    } catch (error) {
      console.error('创建 Webhook 网络错误:', error);
      return null;
    }
  }

  // 同步地址到 Helius Webhook
  async syncToHelius() {
    if (!WEBHOOK_ID) {
      console.log('⚠️  未设置 WEBHOOK_ID，尝试创建新的 Webhook...');
      return this.createWebhook();
    }

    try {
      const response = await fetch(`https://api.helius.xyz/v0/webhooks/${WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookURL: WEBHOOK_URL,
          transactionTypes: ['Any'],
          accountAddresses: this.addresses.map(item => item.address),
          webhookType: 'enhanced'
        })
      });

      if (response.ok) {
        console.log('✅ 地址已同步到 Helius Webhook');
        console.log(`同步了 ${this.addresses.length} 个地址`);
        return true;
      } else {
        const error = await response.text();
        console.error('同步到 Helius 失败:', error);
        return false;
      }
    } catch (error) {
      console.error('同步到 Helius 网络错误:', error);
      return false;
    }
  }

  // 从 Helius 获取当前 Webhook 信息
  async getWebhookInfo() {
    if (!WEBHOOK_ID) {
      console.log('❌ 未设置 WEBHOOK_ID');
      return null;
    }

    try {
      const response = await fetch(`https://api.helius.xyz/v0/webhooks/${WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📋 当前 Webhook 信息:');
        console.log(`- URL: ${data.webhookURL}`);
        console.log(`- 监听地址数量: ${data.accountAddresses.length}`);
        console.log(`- 交易类型: ${data.transactionTypes.join(', ')}`);
        return data;
      } else {
        console.error('获取 Webhook 信息失败');
        return null;
      }
    } catch (error) {
      console.error('获取 Webhook 信息网络错误:', error);
      return null;
    }
  }
}

// ========== Web 管理界面 ==========
const manager = new AddressManager();
const app = express();
app.use(express.json());
app.use(express.static('public'));

// 静态页面
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>地址管理系统</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            input, textarea, button { margin: 5px; padding: 8px; }
            button { background: #007cba; color: white; border: none; cursor: pointer; }
            button:hover { background: #005a87; }
            .address-list { margin-top: 20px; }
            .address-item { padding: 10px; border: 1px solid #ddd; margin: 5px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏦 地址管理系统</h1>
            
            <h2>添加单个地址</h2>
            <input type="text" id="address" placeholder="Solana 钱包地址" style="width: 400px;">
            <input type="text" id="remark" placeholder="备注 (可选)" style="width: 200px;">
            <button onclick="addAddress()">添加地址</button>
            
            <h2>批量添加地址</h2>
            <textarea id="batchAddresses" placeholder="每行一个地址，格式：地址,备注" rows="5" style="width: 600px;"></textarea>
            <br><button onclick="addBatchAddresses()">批量添加</button>
            
            <h2>管理操作</h2>
            <button onclick="syncToHelius()">同步到 Helius</button>
            <button onclick="getWebhookInfo()">查看 Webhook 信息</button>
            <button onclick="loadAddresses()">刷新地址列表</button>
            
            <div id="result" style="margin: 20px 0; padding: 10px; background: #f0f0f0;"></div>
            
            <h2>当前监听地址</h2>
            <div id="addressList" class="address-list"></div>
        </div>

        <script>
            function showResult(message, isError = false) {
                const result = document.getElementById('result');
                result.textContent = message;
                result.style.background = isError ? '#ffe6e6' : '#e6ffe6';
            }

            async function addAddress() {
                const address = document.getElementById('address').value.trim();
                const remark = document.getElementById('remark').value.trim();
                
                if (!address) {
                    showResult('请输入地址', true);
                    return;
                }
                
                try {
                    const response = await fetch('/api/addresses', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address, remark })
                    });
                    const result = await response.json();
                    showResult(result.message);
                    document.getElementById('address').value = '';
                    document.getElementById('remark').value = '';
                    loadAddresses();
                } catch (error) {
                    showResult('添加失败: ' + error.message, true);
                }
            }

            async function addBatchAddresses() {
                const text = document.getElementById('batchAddresses').value.trim();
                if (!text) {
                    showResult('请输入地址列表', true);
                    return;
                }
                
                const addresses = text.split('\\n').map(line => {
                    const [address, remark = ''] = line.split(',').map(s => s.trim());
                    return { address, remark };
                }).filter(item => item.address);
                
                try {
                    const response = await fetch('/api/addresses/batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ addresses })
                    });
                    const result = await response.json();
                    showResult(result.message);
                    document.getElementById('batchAddresses').value = '';
                    loadAddresses();
                } catch (error) {
                    showResult('批量添加失败: ' + error.message, true);
                }
            }

            async function removeAddress(address) {
                if (!confirm('确定要删除这个地址吗？')) return;
                
                try {
                    const response = await fetch(\`/api/addresses/\${encodeURIComponent(address)}\`, {
                        method: 'DELETE'
                    });
                    const result = await response.json();
                    showResult(result.message);
                    loadAddresses();
                } catch (error) {
                    showResult('删除失败: ' + error.message, true);
                }
            }

            async function syncToHelius() {
                try {
                    const response = await fetch('/api/sync');
                    const result = await response.json();
                    showResult(result.message);
                } catch (error) {
                    showResult('同步失败: ' + error.message, true);
                }
            }

            async function getWebhookInfo() {
                try {
                    const response = await fetch('/api/webhook-info');
                    const result = await response.json();
                    showResult(JSON.stringify(result, null, 2));
                } catch (error) {
                    showResult('获取信息失败: ' + error.message, true);
                }
            }

            async function loadAddresses() {
                try {
                    const response = await fetch('/api/addresses');
                    const addresses = await response.json();
                    
                    const listDiv = document.getElementById('addressList');
                    listDiv.innerHTML = addresses.map(item => \`
                        <div class="address-item">
                            <strong>\${item.address}</strong> 
                            \${item.remark ? \`(\${item.remark})\` : ''}
                            <button onclick="removeAddress('\${item.address}')" style="float: right; background: #dc3545;">删除</button>
                            <br><small>添加时间: \${new Date(item.createdAt).toLocaleString()}</small>
                        </div>
                    \`).join('');
                } catch (error) {
                    showResult('加载地址列表失败: ' + error.message, true);
                }
            }

            // 页面加载时获取地址列表
            loadAddresses();
        </script>
    </body>
    </html>
  `);
});

// API 路由
app.get('/api/addresses', (req, res) => {
  res.json(manager.getAllAddresses());
});

app.post('/api/addresses', async (req, res) => {
  const { address, remark } = req.body;
  try {
    await manager.addAddress(address, remark);
    res.json({ message: `地址 ${address} 添加成功并已同步到 Helius` });
  } catch (error) {
    res.status(500).json({ message: '添加失败: ' + error.message });
  }
});

app.post('/api/addresses/batch', async (req, res) => {
  const { addresses } = req.body;
  try {
    await manager.addAddresses(addresses);
    res.json({ message: `批量添加 ${addresses.length} 个地址成功并已同步到 Helius` });
  } catch (error) {
    res.status(500).json({ message: '批量添加失败: ' + error.message });
  }
});

app.delete('/api/addresses/:address', async (req, res) => {
  const { address } = req.params;
  try {
    await manager.removeAddress(address);
    res.json({ message: `地址 ${address} 删除成功并已同步到 Helius` });
  } catch (error) {
    res.status(500).json({ message: '删除失败: ' + error.message });
  }
});

app.get('/api/sync', async (req, res) => {
  try {
    const result = await manager.syncToHelius();
    res.json({ message: result ? '同步成功' : '同步失败' });
  } catch (error) {
    res.status(500).json({ message: '同步失败: ' + error.message });
  }
});

app.get('/api/webhook-info', async (req, res) => {
  try {
    const info = await manager.getWebhookInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ message: '获取信息失败: ' + error.message });
  }
});

// ========== 命令行接口 ==========
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'add':
      if (args.length >= 1) {
        manager.addAddress(args[0], args[1] || '');
      } else {
        console.log('使用方法: node addressManager.js add <地址> [备注]');
      }
      break;
      
    case 'remove':
      if (args.length >= 1) {
        manager.removeAddress(args[0]);
      } else {
        console.log('使用方法: node addressManager.js remove <地址>');
      }
      break;
      
    case 'list':
      console.log('当前监听地址:');
      manager.getAllAddresses().forEach((item, index) => {
        console.log(`${index + 1}. ${item.address} ${item.remark ? `(${item.remark})` : ''}`);
      });
      break;
      
    case 'sync':
      manager.syncToHelius().then(result => {
        console.log(result ? '同步成功' : '同步失败');
        process.exit(0);
      });
      break;
      
    case 'info':
      manager.getWebhookInfo().then(() => {
        process.exit(0);
      });
      break;
      
    case 'web':
      app.listen(4000, () => {
        console.log('🌐 地址管理系统已启动: http://localhost:4000');
        console.log('💡 你可以通过浏览器管理地址');
      });
      break;
      
    default:
      console.log('📋 地址管理系统使用说明:');
      console.log('');
      console.log('命令行操作:');
      console.log('  node addressManager.js add <地址> [备注]    - 添加地址');
      console.log('  node addressManager.js remove <地址>       - 删除地址');
      console.log('  node addressManager.js list               - 查看所有地址');
      console.log('  node addressManager.js sync               - 同步到 Helius');
      console.log('  node addressManager.js info               - 查看 Webhook 信息');
      console.log('  node addressManager.js web                - 启动 Web 管理界面');
      console.log('');
      console.log('Web 界面:');
      console.log('  访问 http://localhost:4000 进行可视化管理');
  }
}

module.exports = { AddressManager, manager }; 