# 部署指南

本指南详细介绍了 Solana Transaction Monitor 的各种部署方式。

## 📋 部署前准备

### 系统要求
- **操作系统**: Linux (推荐 Ubuntu 20.04+) / macOS / Windows
- **Node.js**: >= 16.0.0
- **内存**: >= 512MB RAM
- **磁盘**: >= 1GB 可用空间
- **网络**: 稳定的互联网连接

### 外部依赖 (可选)
- **PostgreSQL** >= 12 (数据持久化)
- **Redis** >= 6.0 (缓存优化)
- **Nginx** (反向代理)

## 🐳 Docker 部署 (推荐)

### 1. 创建 Dockerfile

```dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY src/ ./src/
COPY database/ ./database/

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 创建日志目录
RUN mkdir -p logs && chown nodejs:nodejs logs

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 启动命令
CMD ["node", "src/server.js"]
```

### 2. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/solana_monitor
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    depends_on:
      - db
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - solana-network

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=solana_monitor
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped
    networks:
      - solana-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks:
      - solana-network
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - solana-network

volumes:
  postgres_data:
  redis_data:

networks:
  solana-network:
    driver: bridge
```

### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

## 🔧 PM2 部署

PM2 是 Node.js 应用的进程管理器，适合生产环境部署。

### 1. 安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2

# 验证安装
pm2 --version
```

### 2. 创建 PM2 配置文件

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'solana-monitor',
    script: 'src/server.js',
    instances: 2, // 启动实例数量
    exec_mode: 'cluster', // 集群模式
    watch: false, // 生产环境不监听文件变化
    max_memory_restart: '500M', // 内存限制
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
};
```

### 3. 部署命令

```bash
# 启动应用
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 status

# 查看日志
pm2 logs solana-monitor

# 重启应用
pm2 restart solana-monitor

# 停止应用
pm2 stop solana-monitor

# 删除应用
pm2 delete solana-monitor

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

### 4. 监控和管理

```bash
# 实时监控
pm2 monit

# 查看详细信息
pm2 show solana-monitor

# 重载配置（零停机时间）
pm2 reload solana-monitor

# 查看日志（最后 200 行）
pm2 logs solana-monitor --lines 200
```

## 🖥️ 系统服务部署

将应用部署为系统服务，适合 Linux 系统。

### 1. 创建服务文件

```bash
sudo nano /etc/systemd/system/solana-monitor.service
```

```ini
[Unit]
Description=Solana Transaction Monitor
After=network.target
Wants=postgresql.service redis.service

[Service]
Type=simple
User=nodejs
Group=nodejs
WorkingDirectory=/opt/solana-monitor
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=solana-monitor
Environment=NODE_ENV=production
EnvironmentFile=/opt/solana-monitor/.env

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/solana-monitor/logs

[Install]
WantedBy=multi-user.target
```

### 2. 部署步骤

```bash
# 创建用户
sudo useradd -r -s /bin/false nodejs

# 创建应用目录
sudo mkdir -p /opt/solana-monitor
sudo chown nodejs:nodejs /opt/solana-monitor

# 复制应用文件
sudo cp -r * /opt/solana-monitor/
sudo chown -R nodejs:nodejs /opt/solana-monitor

# 安装依赖
cd /opt/solana-monitor
sudo -u nodejs npm ci --only=production

# 启用并启动服务
sudo systemctl enable solana-monitor
sudo systemctl start solana-monitor

# 检查状态
sudo systemctl status solana-monitor

# 查看日志
sudo journalctl -u solana-monitor -f
```

## 🌐 Nginx 反向代理

### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 2. 配置 Nginx

```nginx
# /etc/nginx/sites-available/solana-monitor
server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 配置
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'" always;
    
    # 日志配置
    access_log /var/log/nginx/solana-monitor.access.log;
    error_log /var/log/nginx/solana-monitor.error.log;
    
    # 主应用代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Webhook 端点优化
    location /webhook {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 限制请求大小
        client_max_body_size 10M;
        
        # 超时设置（Webhook 需要较长时间）
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # 监控端点限制访问
    location /monitoring {
        # 限制访问 IP
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
        
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

### 3. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/solana-monitor /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 设置开机自启
sudo systemctl enable nginx
```

## 🔐 SSL/HTTPS 配置

### 使用 Let's Encrypt

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

### 使用自签名证书（测试用）

```bash
# 生成私钥
sudo openssl genrsa -out /etc/ssl/private/solana-monitor.key 2048

# 生成证书
sudo openssl req -new -x509 -key /etc/ssl/private/solana-monitor.key \
  -out /etc/ssl/certs/solana-monitor.crt -days 365
```

## 📊 监控和日志

### 1. 日志轮转配置

```bash
# 创建 logrotate 配置
sudo nano /etc/logrotate.d/solana-monitor
```

```
/opt/solana-monitor/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 nodejs nodejs
    postrotate
        systemctl reload solana-monitor
    endscript
}
```

### 2. 监控脚本

```bash
#!/bin/bash
# monitor.sh - 应用监控脚本

APP_NAME="solana-monitor"
HEALTH_URL="http://localhost:3000/health"
LOG_FILE="/var/log/solana-monitor-check.log"

# 检查应用健康状态
check_health() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
    if [ "$response" != "200" ]; then
        echo "$(date): Health check failed (HTTP $response)" >> $LOG_FILE
        # 重启应用
        systemctl restart $APP_NAME
        echo "$(date): Application restarted" >> $LOG_FILE
    else
        echo "$(date): Health check passed" >> $LOG_FILE
    fi
}

# 执行检查
check_health
```

```bash
# 添加到 crontab（每5分钟检查一次）
*/5 * * * * /opt/scripts/monitor.sh
```

## 🚀 性能优化

### 1. 系统优化

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 优化网络参数
echo "net.core.somaxconn = 65536" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65536" >> /etc/sysctl.conf

# 应用配置
sysctl -p
```

### 2. Node.js 优化

```bash
# 设置 Node.js 优化参数
export NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size"

# PM2 配置优化
pm2 start ecosystem.config.js --node-args="--max-old-space-size=512"
```

### 3. 数据库优化

```sql
-- PostgreSQL 优化配置
-- postgresql.conf
shared_buffers = 128MB
effective_cache_size = 256MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
```

## 🔧 故障排除

### 常见问题

1. **端口占用**
```bash
# 检查端口占用
sudo netstat -tlnp | grep :3000
# 或
sudo lsof -i :3000
```

2. **权限问题**
```bash
# 检查文件权限
ls -la /opt/solana-monitor/
# 修正权限
sudo chown -R nodejs:nodejs /opt/solana-monitor/
```

3. **内存不足**
```bash
# 检查内存使用
free -h
# 检查进程内存
ps aux | grep node
```

4. **数据库连接问题**
```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql
# 测试连接
psql -h localhost -U username -d database_name
```

### 日志分析

```bash
# 查看应用日志
tail -f /opt/solana-monitor/logs/combined.log

# 查看系统日志
sudo journalctl -u solana-monitor -f

# 查看 Nginx 日志
tail -f /var/log/nginx/solana-monitor.error.log
```

## 📋 部署清单

部署前检查清单：

- [ ] 环境变量配置完成
- [ ] 数据库初始化完成
- [ ] SSL 证书配置完成
- [ ] 防火墙规则配置完成
- [ ] 监控脚本配置完成
- [ ] 日志轮转配置完成
- [ ] 备份策略制定完成
- [ ] 健康检查测试通过
- [ ] 负载测试完成
- [ ] 文档更新完成

---

通过以上部署指南，您可以根据实际需求选择合适的部署方式。建议生产环境使用 Docker 或系统服务方式部署，并配置相应的监控和备份策略。