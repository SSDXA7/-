# API 文档

Solana Transaction Monitor 提供了完整的 REST API 接口，用于接收 Webhook、监控系统状态和管理配置。

## 📋 基础信息

- **Base URL**: `http://localhost:3000` (默认)
- **Content-Type**: `application/json`
- **认证**: 无 (可通过 Nginx 等反向代理添加)

## 🔗 核心接口

### 1. Webhook 接口

#### POST /webhook
接收 Solana 交易推送数据

**描述**: 主要的 Webhook 端点，接收来自 Helius 或其他 Solana 数据提供商的交易推送。

**请求头**:
```
Content-Type: application/json
```

**请求体格式 1 - Enhanced Webhook**:
```json
{
  "signature": "5j7s8K...",
  "blockTime": 1703924400,
  "slot": 240123456,
  "type": "SWAP",
  "description": "User swapped 1.5 SOL for 1500 USDC",
  "tokenTransfers": [
    {
      "mint": "So11111111111111111111111111111111111111112",
      "fromUserAccount": "ABC123...",
      "toUserAccount": "DEF456...",
      "tokenAmount": 1500000000
    }
  ],
  "instructions": [...],
  "accounts": [...],
  "timestamp": 1703924400
}
```

**请求体格式 2 - 原始交易数据**:
```json
{
  "signature": "5j7s8K...",
  "transaction": {
    "signatures": ["5j7s8K..."],
    "message": {
      "instructions": [...]
    }
  },
  "meta": {
    "postTokenBalances": [...],
    "preTokenBalances": [...]
  },
  "blockTime": 1703924400,
  "slot": 240123456
}
```

**请求体格式 3 - 批量交易**:
```json
[
  {
    "signature": "tx1...",
    "transaction": {...}
  },
  {
    "signature": "tx2...",
    "transaction": {...}
  }
]
```

**响应**:
```json
{
  "status": "received",
  "requestId": "req_1703924400123_abc123",
  "timestamp": "2023-12-30T10:00:00.000Z"
}
```

**错误响应**:
```json
{
  "error": "Invalid request format",
  "requestId": "req_1703924400123_abc123",
  "timestamp": "2023-12-30T10:00:00.000Z"
}
```

**状态码**:
- `200` - 成功接收
- `400` - 请求格式错误
- `500` - 内部服务器错误

---

## 🏥 健康检查接口

### 1. GET /health
基础健康检查

**描述**: 返回系统基本健康状态，用于负载均衡器和监控系统的快速检查。

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2023-12-30T10:00:00.000Z",
  "registeredServices": 4,
  "services": {
    "solana": {
      "name": "solana",
      "lastCheck": "2023-12-30T09:59:30.000Z",
      "healthy": true,
      "consecutive_failures": 0,
      "hasResult": true
    },
    "notifications": {
      "name": "notifications",
      "lastCheck": "2023-12-30T09:59:30.000Z", 
      "healthy": true,
      "consecutive_failures": 0,
      "hasResult": true
    }
  },
  "lastGlobalCheck": "2023-12-30T09:59:30.000Z"
}
```

**状态码**:
- `200` - 系统健康
- `503` - 系统不健康

### 2. GET /health/detailed
详细健康检查

**描述**: 返回详细的系统健康信息，包括各服务的具体状态和性能指标。

**响应**:
```json
{
  "healthy": true,
  "timestamp": "2023-12-30T10:00:00.000Z",
  "totalDuration": 45,
  "services": {
    "solana": {
      "healthy": true,
      "checkDuration": 12,
      "timestamp": "2023-12-30T10:00:00.000Z",
      "slot": 240123456,
      "latency": 150,
      "url": "https://rpc.helius.xyz/***"
    },
    "notifications": {
      "healthy": true,
      "checkDuration": 8,
      "timestamp": "2023-12-30T10:00:00.000Z",
      "telegram": { "enabled": true, "healthy": true },
      "feishu": { "enabled": true, "healthy": true }
    },
    "database": {
      "healthy": true,
      "checkDuration": 15,
      "timestamp": "2023-12-30T10:00:00.000Z",
      "pool": {
        "totalCount": 20,
        "idleCount": 18,
        "waitingCount": 0
      },
      "latency": 5
    },
    "cache": {
      "healthy": true,
      "checkDuration": 10,
      "timestamp": "2023-12-30T10:00:00.000Z",
      "latency": 2,
      "connected": true
    }
  },
  "summary": {
    "total": 4,
    "healthy": 4,
    "unhealthy": 0,
    "healthPercentage": "100.0"
  }
}
```

### 3. GET /health/:service
单个服务健康检查

**描述**: 检查特定服务的健康状态。

**路径参数**:
- `service` - 服务名称 (`solana`, `notifications`, `database`, `cache`)

**示例**: `GET /health/solana`

**响应**:
```json
{
  "healthy": true,
  "checkDuration": 12,
  "timestamp": "2023-12-30T10:00:00.000Z",
  "slot": 240123456,
  "latency": 150,
  "url": "https://rpc.helius.xyz/***"
}
```

**错误响应**:
```json
{
  "error": "Service unknown not registered"
}
```

**状态码**:
- `200` - 服务健康
- `404` - 服务不存在
- `503` - 服务不健康

### 4. GET /health/unhealthy
获取不健康服务列表

**描述**: 返回当前所有不健康的服务及其错误信息。

**响应**:
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "count": 1,
  "services": [
    {
      "name": "database",
      "error": "Connection timeout",
      "consecutive_failures": 3,
      "lastCheck": "2023-12-30T09:58:30.000Z"
    }
  ]
}
```

### 5. POST /health/check
手动触发健康检查

**描述**: 手动触发健康检查，可以检查所有服务或特定服务。

**请求体** (可选):
```json
{
  "service": "solana"
}
```

**响应** (检查所有服务):
```json
{
  "healthy": true,
  "timestamp": "2023-12-30T10:00:00.000Z",
  "services": {...}
}
```

**响应** (检查特定服务):
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "service": "solana",
  "result": {
    "healthy": true,
    "latency": 150
  }
}
```

---

## 📊 监控接口

### 1. GET /monitoring/metrics
Prometheus 格式指标

**描述**: 返回 Prometheus 格式的监控指标，用于监控系统集成。

**响应头**:
```
Content-Type: text/plain
```

**响应**:
```
# HELP solana_monitor_http_requests_total Total number of HTTP requests
# TYPE solana_monitor_http_requests_total counter
solana_monitor_http_requests_total{method="POST",route="/webhook",status_code="200"} 1523

# HELP solana_monitor_transactions_processed_total Total number of transactions processed
# TYPE solana_monitor_transactions_processed_total counter
solana_monitor_transactions_processed_total{type="SWAP",status="success"} 342

# HELP solana_monitor_rpc_call_duration_seconds Duration of RPC calls in seconds
# TYPE solana_monitor_rpc_call_duration_seconds histogram
solana_monitor_rpc_call_duration_seconds_bucket{method="getParsedTransaction",le="0.1"} 123
solana_monitor_rpc_call_duration_seconds_bucket{method="getParsedTransaction",le="0.5"} 456
```

### 2. GET /monitoring/metrics/json
JSON 格式指标

**描述**: 返回 JSON 格式的监控指标，便于程序化处理。

**响应**:
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "metrics": [
    {
      "name": "solana_monitor_http_requests_total",
      "help": "Total number of HTTP requests",
      "type": "counter",
      "values": [
        {
          "value": 1523,
          "labels": {
            "method": "POST",
            "route": "/webhook",
            "status_code": "200"
          }
        }
      ]
    }
  ]
}
```

### 3. GET /monitoring/metrics/summary
指标摘要

**描述**: 返回指标分类统计信息。

**响应**:
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "summary": {
    "totalMetrics": 25,
    "categories": {
      "http": 4,
      "transactions": 6,
      "notifications": 4,
      "rpc": 5,
      "cache": 3,
      "database": 2,
      "health": 1
    }
  }
}
```

### 4. GET /monitoring/status
系统状态概览

**描述**: 返回系统的综合状态信息，包括健康状态、指标摘要、系统信息和配置。

**响应**:
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "status": "running",
  "health": {
    "registeredServices": 4,
    "services": {...},
    "lastGlobalCheck": "2023-12-30T09:59:30.000Z"
  },
  "metrics": {
    "totalMetrics": 25,
    "categories": {...}
  },
  "system": {
    "uptime": 86400,
    "memory": {
      "rss": 134217728,
      "heapTotal": 67108864,
      "heapUsed": 45088768,
      "external": 2097152
    },
    "cpu": {
      "user": 12345678,
      "system": 2345678
    },
    "platform": "linux",
    "nodeVersion": "v18.17.0",
    "pid": 12345
  },
  "configuration": {
    "environment": "production",
    "port": 3000,
    "logLevel": "info",
    "monitoringEnabled": true,
    "watchAddresses": 5,
    "telegramEnabled": true,
    "feishuEnabled": false
  }
}
```

### 5. POST /monitoring/metrics/reset
重置指标 (仅开发环境)

**描述**: 重置所有监控指标，仅在开发环境可用。

**响应**:
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "message": "Metrics reset successfully"
}
```

**错误响应**:
```json
{
  "error": "Metrics reset only available in development"
}
```

**状态码**:
- `200` - 重置成功
- `403` - 生产环境禁止访问

---

## 🔧 管理接口

### 1. GET /monitoring/logging/level
获取日志级别

**描述**: 获取当前的日志级别设置。

**响应**:
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "level": "info"
}
```

### 2. PUT /monitoring/logging/level
设置日志级别

**描述**: 动态修改日志级别，无需重启服务。

**请求体**:
```json
{
  "level": "debug"
}
```

**有效级别**: `error`, `warn`, `info`, `debug`

**响应**:
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "message": "Log level set to debug",
  "level": "debug"
}
```

**错误响应**:
```json
{
  "error": "Invalid log level",
  "validLevels": ["error", "warn", "info", "debug"]
}
```

### 3. GET /monitoring/logging/errors
获取错误日志

**描述**: 获取最近的错误日志记录。

**查询参数**:
- `limit` - 限制返回数量 (默认: 50)

**示例**: `GET /monitoring/logging/errors?limit=20`

**响应**:
```json
{
  "timestamp": "2023-12-30T10:00:00.000Z",
  "errors": [],
  "message": "Error log retrieval not implemented"
}
```

---

## 🏠 基础接口

### 1. GET /
服务信息

**描述**: 返回服务的基本信息。

**响应**:
```json
{
  "name": "Solana Transaction Monitor",
  "version": "2.0.0",
  "status": "running",
  "timestamp": "2023-12-30T10:00:00.000Z"
}
```

### 2. GET /config (仅开发环境)
配置信息

**描述**: 返回当前配置信息，仅在开发环境可用。

**响应**:
```json
{
  "solana": {
    "network": "mainnet-beta",
    "pollInterval": 1500,
    "concurrency": 3,
    "rateLimit": 120,
    "watchAddressesCount": 5
  },
  "server": {
    "port": 3000,
    "nodeEnv": "development",
    "logLevel": "info"
  },
  "telegram": {
    "enabled": true
  },
  "feishu": {
    "enabled": false
  }
}
```

---

## 🛠️ 错误处理

### 错误响应格式

所有错误响应都遵循统一格式：

```json
{
  "error": "错误描述",
  "timestamp": "2023-12-30T10:00:00.000Z",
  "requestId": "req_1703924400123_abc123", // 可选
  "details": {}, // 可选，详细错误信息
  "code": "ERROR_CODE" // 可选，错误代码
}
```

### 常见状态码

- `200` - 成功
- `400` - 请求错误
- `401` - 未认证
- `403` - 禁止访问
- `404` - 资源不存在
- `429` - 请求过频
- `500` - 内部服务器错误
- `503` - 服务不可用

### 错误示例

```json
{
  "error": "Invalid transaction format",
  "timestamp": "2023-12-30T10:00:00.000Z",
  "requestId": "req_1703924400123_abc123",
  "details": {
    "field": "signature",
    "expected": "string",
    "received": "null"
  },
  "code": "INVALID_FORMAT"
}
```

---

## 📝 使用示例

### JavaScript/Node.js

```javascript
// 发送 Webhook
const response = await fetch('http://localhost:3000/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    signature: 'your-transaction-signature',
    transaction: {...},
    meta: {...}
  })
});

const result = await response.json();
console.log(result);

// 检查健康状态
const healthResponse = await fetch('http://localhost:3000/health');
const health = await healthResponse.json();
console.log('System health:', health.status);
```

### Python

```python
import requests
import json

# 发送 Webhook
webhook_data = {
    "signature": "your-transaction-signature",
    "transaction": {...},
    "meta": {...}
}

response = requests.post(
    'http://localhost:3000/webhook',
    headers={'Content-Type': 'application/json'},
    json=webhook_data
)

print(response.json())

# 检查健康状态
health_response = requests.get('http://localhost:3000/health')
print('System health:', health_response.json()['status'])
```

### cURL

```bash
# 发送 Webhook
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "your-transaction-signature",
    "transaction": {...},
    "meta": {...}
  }'

# 检查健康状态
curl http://localhost:3000/health

# 获取指标
curl http://localhost:3000/monitoring/metrics

# 设置日志级别
curl -X PUT http://localhost:3000/monitoring/logging/level \
  -H "Content-Type: application/json" \
  -d '{"level": "debug"}'
```

---

## 🔐 认证和安全

目前 API 不包含内置认证机制，建议在生产环境中通过以下方式保护 API：

### 1. Nginx 反向代理认证

```nginx
location /monitoring {
    auth_basic "Monitoring";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3000;
}
```

### 2. IP 白名单

```nginx
location /monitoring {
    allow 10.0.0.0/8;
    allow 127.0.0.1;
    deny all;
    proxy_pass http://localhost:3000;
}
```

### 3. API Gateway

建议使用 API Gateway (如 Kong, Ambassador) 提供：
- API 密钥认证
- 速率限制
- 请求日志
- 流量监控

---

## 📊 监控集成

### Prometheus 配置

```yaml
scrape_configs:
  - job_name: 'solana-monitor'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/monitoring/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard

可以使用以下指标创建 Grafana 仪表板：

- `solana_monitor_http_requests_total` - HTTP 请求数
- `solana_monitor_transactions_processed_total` - 处理的交易数
- `solana_monitor_notifications_sent_total` - 发送的通知数
- `solana_monitor_health_status` - 服务健康状态
- `solana_monitor_rpc_call_duration_seconds` - RPC 调用延迟

---

通过以上 API 文档，您可以完整地了解和使用 Solana Transaction Monitor 的所有接口功能。