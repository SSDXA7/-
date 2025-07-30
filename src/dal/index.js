const database = require('../services/database');
const logger = require('../utils/logger');

/**
 * 交易数据访问层
 */
class TransactionDAL {
  /**
   * 保存交易记录
   */
  async saveTransaction(transactionData) {
    const {
      signature,
      blockTime,
      slot,
      transactionType,
      status = 'processed',
      rawData,
      parsedData
    } = transactionData;

    try {
      const query = `
        INSERT INTO transactions (signature, block_time, slot, transaction_type, status, raw_data, parsed_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (signature) 
        DO UPDATE SET 
          block_time = EXCLUDED.block_time,
          slot = EXCLUDED.slot,
          transaction_type = EXCLUDED.transaction_type,
          status = EXCLUDED.status,
          raw_data = EXCLUDED.raw_data,
          parsed_data = EXCLUDED.parsed_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const values = [
        signature,
        blockTime ? new Date(blockTime * 1000) : null,
        slot,
        transactionType,
        status,
        JSON.stringify(rawData),
        JSON.stringify(parsedData)
      ];

      const result = await database.query(query, values);
      return result.rows[0].id;

    } catch (error) {
      logger.error('Failed to save transaction:', error, { signature });
      throw error;
    }
  }

  /**
   * 根据签名获取交易
   */
  async getTransactionBySignature(signature) {
    try {
      const query = 'SELECT * FROM transactions WHERE signature = $1';
      const result = await database.query(query, [signature]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get transaction:', error, { signature });
      throw error;
    }
  }

  /**
   * 获取最近的交易列表
   */
  async getRecentTransactions(limit = 50, offset = 0) {
    try {
      const query = `
        SELECT * FROM transactions 
        ORDER BY block_time DESC NULLS LAST, created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await database.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get recent transactions:', error);
      throw error;
    }
  }

  /**
   * 根据类型获取交易统计
   */
  async getTransactionStats(days = 7) {
    try {
      const query = `
        SELECT 
          transaction_type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM transactions 
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY transaction_type, DATE(created_at)
        ORDER BY date DESC, count DESC
      `;
      const result = await database.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get transaction stats:', error);
      throw error;
    }
  }

  /**
   * 保存交易参与者信息
   */
  async saveTransactionParticipants(transactionId, participants) {
    try {
      await database.transaction(async (client) => {
        // 先删除现有的参与者记录
        await client.query(
          'DELETE FROM transaction_participants WHERE transaction_id = $1',
          [transactionId]
        );

        // 插入新的参与者记录
        for (const participant of participants) {
          const { walletAddress, role, amount, tokenMint } = participant;
          
          // 确保钱包存在
          const walletId = await this.ensureWallet(walletAddress, client);
          
          // 确保代币存在
          const tokenId = tokenMint ? await this.ensureToken(tokenMint, client) : null;

          await client.query(`
            INSERT INTO transaction_participants (transaction_id, wallet_id, role, amount, token_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [transactionId, walletId, role, amount, tokenId]);
        }
      });
    } catch (error) {
      logger.error('Failed to save transaction participants:', error, { transactionId });
      throw error;
    }
  }

  /**
   * 确保钱包存在
   */
  async ensureWallet(address, client = null) {
    const queryClient = client || database;
    
    try {
      // 尝试获取现有钱包
      const selectQuery = 'SELECT id FROM wallets WHERE address = $1';
      const selectResult = await queryClient.query(selectQuery, [address]);
      
      if (selectResult.rows.length > 0) {
        return selectResult.rows[0].id;
      }

      // 创建新钱包
      const insertQuery = `
        INSERT INTO wallets (address, is_monitored)
        VALUES ($1, false)
        RETURNING id
      `;
      const insertResult = await queryClient.query(insertQuery, [address]);
      return insertResult.rows[0].id;

    } catch (error) {
      logger.error('Failed to ensure wallet:', error, { address });
      throw error;
    }
  }

  /**
   * 确保代币存在
   */
  async ensureToken(mint, client = null) {
    const queryClient = client || database;
    
    try {
      // 尝试获取现有代币
      const selectQuery = 'SELECT id FROM tokens WHERE mint = $1';
      const selectResult = await queryClient.query(selectQuery, [mint]);
      
      if (selectResult.rows.length > 0) {
        return selectResult.rows[0].id;
      }

      // 创建新代币（使用默认值）
      const insertQuery = `
        INSERT INTO tokens (mint, symbol, decimals)
        VALUES ($1, $2, 9)
        RETURNING id
      `;
      const symbol = mint.slice(0, 4) + '...';
      const insertResult = await queryClient.query(insertQuery, [mint, symbol]);
      return insertResult.rows[0].id;

    } catch (error) {
      logger.error('Failed to ensure token:', error, { mint });
      throw error;
    }
  }
}

/**
 * 通知数据访问层
 */
class NotificationDAL {
  /**
   * 保存通知记录
   */
  async saveNotification(notificationData) {
    const {
      transactionId,
      platform,
      status,
      message,
      responseData,
      errorMessage,
      sentAt
    } = notificationData;

    try {
      const query = `
        INSERT INTO notifications (transaction_id, platform, status, message, response_data, error_message, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const values = [
        transactionId,
        platform,
        status,
        message,
        responseData ? JSON.stringify(responseData) : null,
        errorMessage,
        sentAt ? new Date(sentAt) : null
      ];

      const result = await database.query(query, values);
      return result.rows[0].id;

    } catch (error) {
      logger.error('Failed to save notification:', error, { transactionId, platform });
      throw error;
    }
  }

  /**
   * 获取通知统计
   */
  async getNotificationStats(days = 7) {
    try {
      const query = `
        SELECT 
          platform,
          status,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM notifications 
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY platform, status, DATE(created_at)
        ORDER BY date DESC, count DESC
      `;
      const result = await database.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get notification stats:', error);
      throw error;
    }
  }
}

/**
 * 系统统计数据访问层
 */
class SystemStatsDAL {
  /**
   * 更新每日统计
   */
  async updateDailyStats(date = new Date()) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      const query = `
        INSERT INTO system_stats (date, total_transactions, successful_notifications, failed_notifications, unique_wallets)
        VALUES ($1, 
          (SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = $1),
          (SELECT COUNT(*) FROM notifications WHERE DATE(created_at) = $1 AND status = 'sent'),
          (SELECT COUNT(*) FROM notifications WHERE DATE(created_at) = $1 AND status = 'failed'),
          (SELECT COUNT(DISTINCT wallet_id) FROM transaction_participants tp 
           JOIN transactions t ON tp.transaction_id = t.id 
           WHERE DATE(t.created_at) = $1)
        )
        ON CONFLICT (date)
        DO UPDATE SET
          total_transactions = EXCLUDED.total_transactions,
          successful_notifications = EXCLUDED.successful_notifications,
          failed_notifications = EXCLUDED.failed_notifications,
          unique_wallets = EXCLUDED.unique_wallets
      `;

      await database.query(query, [dateStr]);
      
    } catch (error) {
      logger.error('Failed to update daily stats:', error, { date: dateStr });
      throw error;
    }
  }

  /**
   * 获取统计数据
   */
  async getStats(days = 30) {
    try {
      const query = `
        SELECT * FROM system_stats 
        WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC
      `;
      const result = await database.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get system stats:', error);
      throw error;
    }
  }
}

module.exports = {
  TransactionDAL: new TransactionDAL(),
  NotificationDAL: new NotificationDAL(),
  SystemStatsDAL: new SystemStatsDAL()
};