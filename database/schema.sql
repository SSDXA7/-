-- 创建数据库和用户（如果需要）
-- CREATE DATABASE solana_monitor;
-- CREATE USER monitor_user WITH PASSWORD 'your_password';
-- GRANT ALL PRIVILEGES ON DATABASE solana_monitor TO monitor_user;

-- 使用数据库
-- \c solana_monitor;

-- 钱包地址表
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    address VARCHAR(44) UNIQUE NOT NULL,
    nickname VARCHAR(100),
    description TEXT,
    is_monitored BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    signature VARCHAR(88) UNIQUE NOT NULL,
    block_time TIMESTAMP WITH TIME ZONE,
    slot BIGINT,
    transaction_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    raw_data JSONB,
    parsed_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 代币信息表
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    mint VARCHAR(44) UNIQUE NOT NULL,
    name VARCHAR(200),
    symbol VARCHAR(20),
    decimals INTEGER,
    logo_uri TEXT,
    metadata_uri TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 交易参与者表（多对多关系）
CREATE TABLE IF NOT EXISTS transaction_participants (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    wallet_id INTEGER REFERENCES wallets(id),
    role VARCHAR(20), -- 'from', 'to', 'authority', etc.
    amount DECIMAL(20, 10),
    token_id INTEGER REFERENCES tokens(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 通知记录表
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    platform VARCHAR(20), -- 'telegram', 'feishu'
    status VARCHAR(20), -- 'sent', 'failed', 'pending'
    message TEXT,
    response_data JSONB,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DEX 信息表
CREATE TABLE IF NOT EXISTS dex_info (
    id SERIAL PRIMARY KEY,
    program_id VARCHAR(44) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 系统统计表
CREATE TABLE IF NOT EXISTS system_stats (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    total_transactions INTEGER DEFAULT 0,
    successful_notifications INTEGER DEFAULT 0,
    failed_notifications INTEGER DEFAULT 0,
    unique_wallets INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_transactions_signature ON transactions(signature);
CREATE INDEX IF NOT EXISTS idx_transactions_block_time ON transactions(block_time DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_monitored ON wallets(is_monitored);
CREATE INDEX IF NOT EXISTS idx_tokens_mint ON tokens(mint);
CREATE INDEX IF NOT EXISTS idx_transaction_participants_transaction_id ON transaction_participants(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_participants_wallet_id ON transaction_participants(wallet_id);
CREATE INDEX IF NOT EXISTS idx_notifications_transaction_id ON notifications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_notifications_platform ON notifications(platform);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建更新时间触发器
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tokens_updated_at BEFORE UPDATE ON tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入一些默认的 DEX 信息
INSERT INTO dex_info (program_id, name) VALUES
('CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', 'Raydium CPMM'),
('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium AMM'),
('9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', 'Orca'),
('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'Jupiter V6'),
('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', 'Orca Whirlpool')
ON CONFLICT (program_id) DO NOTHING;

-- 插入一些默认的代币信息
INSERT INTO tokens (mint, name, symbol, decimals, is_verified) VALUES
('So11111111111111111111111111111111111111112', 'Solana', 'SOL', 9, true),
('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USD Coin', 'USDC', 6, true),
('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'Tether USD', 'USDT', 6, true)
ON CONFLICT (mint) DO NOTHING;