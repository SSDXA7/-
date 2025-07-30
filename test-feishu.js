const feishuConfig = require('./feishu-config');

async function testFeishuPush() {
  console.log('🧪 测试飞书推送功能...');
  
  if (!feishuConfig.ENABLE_FEISHU) {
    console.log('❌ 飞书推送已禁用');
    return;
  }
  
  if (feishuConfig.FEISHU_WEBHOOK_URL === 'https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_WEBHOOK_KEY') {
    console.log('❌ 请先配置飞书webhook地址');
    console.log('💡 运行 node setup-feishu.js 进行配置');
    return;
  }

  const testMessage = `🎯 飞书推送测试
时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}
状态: 测试消息发送成功！

这是一条来自Solana交易监控系统的测试消息。`;

  try {
    const response = await fetch(feishuConfig.FEISHU_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msg_type: feishuConfig.MESSAGE_CONFIG.msg_type,
        content: {
          text: testMessage
        }
      })
    });
    
    if (response.ok) {
      console.log('✅ 飞书推送测试成功！');
      console.log('📱 请检查飞书群是否收到测试消息');
    } else {
      console.error('❌ 飞书推送测试失败:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('错误详情:', errorText);
    }
  } catch (error) {
    console.error('❌ 飞书推送测试错误:', error.message);
  }
}

// 运行测试
testFeishuPush(); 