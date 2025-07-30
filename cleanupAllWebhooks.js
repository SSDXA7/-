// cleanupAllWebhooks.js - 清理所有多余的 Webhook
const HELIUS_API_KEY = 'ce41efcd-9698-48f2-818e-7d3049bb7190';

// 从截图中看到的所有新创建的 Webhook IDs（保留第一个）
const WEBHOOKS_TO_DELETE = [
  '74c07d07-0a73-4ecb-b740-efd50f3d77d0',
  '8d6ff2fb-a297-4eea-9e14-082a770f97fe', 
  '91b1af1f-eb96-4ca0-b63f-98d1858d35c3'
];

async function deleteWebhook(webhookId) {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/webhooks/${webhookId}?api-key=${HELIUS_API_KEY}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      console.log(`✅ 已删除 Webhook: ${webhookId}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ 删除 Webhook ${webhookId} 失败:`, error);
      return false;
    }
  } catch (error) {
    console.error(`❌ 删除 Webhook ${webhookId} 网络错误:`, error);
    return false;
  }
}

async function cleanupWebhooks() {
  console.log('🧹 开始清理所有多余的 Webhook...');
  
  for (const webhookId of WEBHOOKS_TO_DELETE) {
    await deleteWebhook(webhookId);
    // 添加延迟避免API限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✨ 清理完成！');
  console.log('📋 现在只保留: ce8c0972-f150-48f5-959a-b6c918dcb625');
}

cleanupWebhooks(); 