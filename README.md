# Solana Transaction Monitor

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Test Coverage](https://img.shields.io/badge/coverage-85%25-green.svg)](coverage/)

一个专业的 Solana 区块链交易监控和通知系统，支持实时监听指定钱包地址的交易活动，智能解析不同类型的交易，并推送到 Telegram 和飞书。

## 🚀 特性

### 核心功能
- ✅ **实时交易监听** - 通过 Webhook 和轮询两种方式监听 Solana 交易
- ✅ **智能交易解析** - 支持 SWAP、转账、铸造、添加流动性等多种交易类型
- ✅ **多平台通知** - 同时支持 Telegram Bot 和飞书机器人推送
- ✅ **地址备注管理** - 为钱包地址设置可读的备注名称
- ✅ **DEX 识别** - 自动识别 Raydium、Jupiter、Orca 等主流 DEX

### 技术特性
- 🔧 **模块化架构** - 清晰的代码结构，易于扩展和维护
- 🛡️ **安全设计** - 环境变量管理，无硬编码敏感信息
- 📊 **监控指标** - 集成 Prometheus 指标和健康检查
- 💾 **数据持久化** - PostgreSQL 存储交易历史，Redis 缓存优化
- 🔄 **错误恢复** - 完善的重试机制和错误处理
- 🧪 **测试覆盖** - 完整的单元测试和集成测试

## 📋 系统要求

- **Node.js** >= 16.0.0
- **PostgreSQL** >= 12 (可选，用于数据持久化)
- **Redis** >= 6.0 (可选，用于缓存)
- **系统内存** >= 512MB
- **网络** - 需要访问 Solana RPC 和通知平台 API

## 🛠️ 快速开始

### 1. 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd sol-hook

# 安装依赖
npm install
```

### 2. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

必需配置项：
```env
# Solana 配置
SOLANA_RPC_URL=https://rpc.helius.xyz/?api-key=YOUR_API_KEY
WATCH_ADDRESSES=address1,address2,address3

# Telegram 配置 (二选一)
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 飞书配置 (二选一)
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_KEY
ENABLE_FEISHU=true
```

### 3. 数据库初始化 (可选)

```bash
# 创建数据库和表结构
psql -U username -d database_name -f database/schema.sql
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务启动后可访问：
- **主服务**: http://localhost:3000
- **健康检查**: http://localhost:3000/health
- **监控指标**: http://localhost:3000/monitoring/metrics

## 🔧 配置说明

### 环境变量详解

#### Solana 配置
| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `SOLANA_RPC_URL` | 否 | mainnet-beta | Solana RPC 节点地址 |
| `SOLANA_NETWORK` | 否 | mainnet-beta | 网络环境 |
| `WATCH_ADDRESSES` | 是 | - | 监听的钱包地址，逗号分隔 |
| `POLL_INTERVAL` | 否 | 1500 | 轮询间隔(毫秒) |
| `CONCURRENCY` | 否 | 3 | 并发请求数 |
| `RATE_LIMIT` | 否 | 120 | 速率限制(毫秒) |

#### 通知配置
| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `TELEGRAM_TOKEN` | * | - | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | * | - | Telegram 群组 ID |
| `ENABLE_TELEGRAM` | 否 | true | 是否启用 Telegram |
| `FEISHU_WEBHOOK_URL` | * | - | 飞书 Webhook 地址 |
| `ENABLE_FEISHU` | 否 | false | 是否启用飞书 |

\* 至少需要配置一种通知方式

#### 数据库配置
| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `DATABASE_URL` | 否 | - | PostgreSQL 连接字符串 |
| `REDIS_URL` | 否 | redis://localhost:6379 | Redis 连接字符串 |

#### 服务配置
| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | 否 | 3000 | 服务端口 |
| `NODE_ENV` | 否 | development | 运行环境 |
| `LOG_LEVEL` | 否 | info | 日志级别 |
| `ENABLE_METRICS` | 否 | false | 是否启用监控指标 |

## 📡 API 接口

### Webhook 接口

#### POST /webhook
接收 Solana 交易推送

**请求示例:**
```json
{
  "signature": "5j7s...",
  "blockTime": 1703924400,
  "transaction": {...},
  "meta": {...}
}
```

**响应:**
```json
{
  "status": "received",
  "requestId": "req_123456789",
  "timestamp": "2023-12-30T10:00:00.000Z"
}
```

### 监控接口

#### GET /health
基础健康检查

**响应:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-30T10:00:00.000Z",
  "registeredServices": 4,
  "services": {
    "solana": { "healthy": true },
    "database": { "healthy": true }
  }
}
```

#### GET /health/detailed
详细健康检查

#### GET /monitoring/metrics
Prometheus 格式指标

#### GET /monitoring/status
系统状态概览

## 🔍 交易类型支持

### SWAP 交易
- **支持的 DEX**: Raydium、Jupiter、Orca、Serum 等
- **解析内容**: 交易对、数量、用户、池子信息
- **链接生成**: GMGN、Axiom 快速访问链接

### 转账交易
- **SOL 转账**: 原生 SOL 代币转账
- **SPL 代币转账**: 各类 SPL 代币转账
- **批量转账**: 支持批量转账识别

### 铸造交易
- **代币铸造**: 新代币创建
- **NFT 铸造**: NFT 创建和铸造

### 流动性操作
- **添加流动性**: 向 DEX 池子添加流动性
- **移除流动性**: 从池子移除流动性

## 📊 监控和指标

### 健康检查
系统提供多层级的健康检查：

1. **服务级别** - 检查各个服务组件状态
2. **依赖级别** - 检查外部依赖（数据库、缓存、RPC）
3. **业务级别** - 检查交易处理和通知发送

### Prometheus 指标
- `solana_monitor_http_requests_total` - HTTP 请求总数
- `solana_monitor_transactions_processed_total` - 处理的交易总数
- `solana_monitor_notifications_sent_total` - 发送的通知总数
- `solana_monitor_rpc_calls_total` - RPC 调用总数
- `solana_monitor_cache_hits_total` - 缓存命中数

### 日志管理
- **结构化日志** - JSON 格式，便于解析
- **日志级别** - error、warn、info、debug
- **日志轮转** - 自动轮转，控制磁盘使用
- **性能日志** - 记录关键操作耗时

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- tests/config.test.js

# 生成覆盖率报告
npm test -- --coverage

# 监听模式
npm test -- --watch
```

### 测试覆盖
- **单元测试** - 核心业务逻辑测试
- **集成测试** - API 接口和服务集成测试
- **模拟测试** - 外部依赖模拟测试

### 测试环境
测试使用独立的环境配置，不会影响生产数据：
- 使用内存数据库或测试数据库
- 模拟外部 API 调用
- 独立的缓存实例

## 🚀 部署指南

### Docker 部署

```dockerfile
# 构建镜像
docker build -t solana-monitor .

# 运行容器
docker run -d \
  --name solana-monitor \
  -p 3000:3000 \
  --env-file .env \
  solana-monitor
```

### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start src/server.js --name solana-monitor

# 查看状态
pm2 status

# 查看日志
pm2 logs solana-monitor
```

### 系统服务部署

```bash
# 创建系统服务文件
sudo nano /etc/systemd/system/solana-monitor.service

# 启动服务
sudo systemctl enable solana-monitor
sudo systemctl start solana-monitor
```

## 🔒 安全考虑

### 环境变量安全
- 所有敏感信息通过环境变量配置
- 生产环境使用密钥管理服务
- 定期轮换 API 密钥

### 网络安全
- 使用 HTTPS 进行外部通信
- 限制入站网络访问
- 定期更新依赖包

### 访问控制
- Webhook 端点可配置验证
- 监控接口可限制访问
- 日志不记录敏感信息

## 🛠️ 开发指南

### 项目结构
```
src/
├── config/           # 配置管理
├── services/         # 核心服务
├── parsers/          # 交易解析器
├── routes/           # API 路由
├── dal/              # 数据访问层
└── utils/            # 工具函数

tests/
├── setup.js          # 测试环境设置
├── config.test.js    # 配置测试
└── services/         # 服务测试
```

### 添加新的交易解析器

1. 创建解析器类：
```javascript
class NewTransactionParser extends BaseTransactionParser {
  constructor() {
    super('NEW_TYPE');
  }

  canParse(transaction) {
    // 实现判断逻辑
  }

  async parse(transaction) {
    // 实现解析逻辑
  }
}
```

2. 注册解析器：
```javascript
// 在 transactionParser.js 中注册
this.registerParser(new NewTransactionParser());
```

### 代码规范
- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 遵循 JSDoc 注释规范

## 📈 性能优化

### 缓存策略
- **交易缓存** - 避免重复处理
- **代币信息缓存** - 减少 API 调用
- **连接池管理** - 复用数据库连接

### 限流控制
- **RPC 限流** - 控制 Solana RPC 调用频率
- **通知限流** - 避免通知平台限制
- **内存管理** - 及时清理过期数据

### 监控优化
- **关键指标监控** - 处理延迟、成功率等
- **资源监控** - CPU、内存、网络使用
- **告警机制** - 异常情况及时通知

## 🤝 贡献指南

欢迎提交 Pull Request 和 Issue！

### 开发流程
1. Fork 项目
2. 创建功能分支
3. 提交代码变更
4. 编写测试用例
5. 提交 Pull Request

### 提交规范
- 使用有意义的提交信息
- 每个 PR 解决一个问题
- 包含必要的测试用例
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。

## 🙋‍♂️ 支持

如有问题或建议，请：
- 提交 [Issue](../../issues)
- 查看 [文档](docs/)
- 联系开发团队

---

**开发团队**: Web3 Development Team  
**版本**: 2.0.0  
**最后更新**: 2024-01-01