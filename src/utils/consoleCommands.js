// 控制台命令
const configManager = require('../managers/configManager');

// 将这些函数添加到全局作用域，以便在控制台中调用
global.setEmergencyMode = function() {
  configManager.switchToEmergency();
  return '已切换到紧急模式';
};

global.setNormalMode = function() {
  configManager.switchToNormal();
  return '已切换到正常模式';
};

global.setExpansionMode = function() {
  configManager.switchToExpansion();
  return '已切换到扩张模式';
};

// 自定义模式切换
global.setCustomMode = function(modeName, options = {}) {
  if (!Memory.config) Memory.config = {};
  Memory.config.mode = modeName;
  
  // 合并自定义选项
  for (let key in options) {
    Memory.config[key] = options[key];
  }
  
  return `已切换到自定义模式: ${modeName}`;
};

module.exports = function() {
  // 初始化控制台命令
  console.log('控制台命令已加载，可使用以下命令:');
  console.log('- setEmergencyMode(): 切换到紧急模式');
  console.log('- setNormalMode(): 切换到正常模式');
  console.log('- setExpansionMode(): 切换到扩张模式');
  console.log('- setCustomMode(modeName, options): 切换到自定义模式');
};