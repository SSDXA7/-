// cleanupWebhooks.js - 清理多余的 Webhook
const HELIUS_API_KEY = 'ce41efcd-9698-48f2-818e-7d3049bb7190';

// 要删除的 Webhook IDs（保留第一个）
const WEBHOOKS_TO_DELETE = [
  'e407290e-7fb9-40b4-a2ed-ecb3b86901b4',
  'e33b8814-99cc-499a-a1d4-347e900011f8',
  'bed3295a-d3ef-46d3-bbda-257a790a7463'
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
  console.log('🧹 开始清理多余的 Webhook...');
  
  for (const webhookId of WEBHOOKS_TO_DELETE) {
    await deleteWebhook(webhookId);
    // 添加延迟避免API限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✨ 清理完成！');
  console.log('📋 保留的 Webhook ID: ce8c0972-f150-48f5-959a-b6c918dcb625');
}

cleanupWebhooks(); 