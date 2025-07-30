// 飞书配置文件
// 使用说明：
// 1. 在飞书群中添加机器人
// 2. 获取webhook地址
// 3. 将地址填入下面的FEISHU_WEBHOOK_URL中

module.exports = {
  // 飞书机器人webhook地址
  FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/e6085f37-1251-4235-8bd2-5ed05c157d5d',
  
  // 是否启用飞书推送
  ENABLE_FEISHU: true,
  
  // 飞书消息配置
  MESSAGE_CONFIG: {
    msg_type: 'text', // 消息类型：text, post, image, interactive等
    at_all: false,    // 是否@所有人
  }
}; 