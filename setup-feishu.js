const fs = require('fs');
const path = require('path');

console.log('🚀 飞书机器人配置向导');
console.log('');

// 显示配置说明
console.log('📋 配置步骤：');
console.log('1. 在飞书群中添加机器人');
console.log('2. 获取机器人的Webhook地址');
console.log('3. 运行此脚本进行配置');
console.log('');

// 获取用户输入
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('请输入飞书机器人的Webhook地址: ', (webhookUrl) => {
  if (!webhookUrl || !webhookUrl.includes('open.feishu.cn')) {
    console.log('❌ 无效的Webhook地址，请检查后重试');
    rl.close();
    return;
  }

  rl.question('是否启用@所有人功能? (y/n): ', (atAll) => {
    const enableAtAll = atAll.toLowerCase() === 'y';
    
    // 更新配置文件
    const configContent = `// 飞书配置文件
// 使用说明：
// 1. 在飞书群中添加机器人
// 2. 获取webhook地址
// 3. 将地址填入下面的FEISHU_WEBHOOK_URL中

module.exports = {
  // 飞书机器人webhook地址
  FEISHU_WEBHOOK_URL: '${webhookUrl}',
  
  // 是否启用飞书推送
  ENABLE_FEISHU: true,
  
  // 飞书消息配置
  MESSAGE_CONFIG: {
    msg_type: 'text', // 消息类型：text, post, image, interactive等
    at_all: ${enableAtAll},    // 是否@所有人
  }
};`;

    try {
      fs.writeFileSync('feishu-config.js', configContent);
      console.log('');
      console.log('✅ 飞书配置已保存！');
      console.log('💡 现在可以重启服务器来应用配置');
      console.log('');
    } catch (error) {
      console.error('❌ 保存配置文件失败:', error.message);
    }
    
    rl.close();
  });
}); 