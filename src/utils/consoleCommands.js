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

// 添加侦察兵控制命令
global.moveScout = function(roomName) {
  const scout = Game.creeps.scout_69511200;
  if (!scout) {
    return '找不到侦察兵 scout_69511200';
  }
  
  if (!roomName) {
    return '请指定目标房间名称';
  }
  
  // 设置移动目标
  scout.memory.targetRoom = roomName;
  
  // 简单的移动逻辑
  if (scout.room.name !== roomName) {
    const exitDir = Game.map.findExit(scout.room, roomName);
    if (exitDir === ERR_NO_PATH) {
      return `无法找到到达 ${roomName} 的路径`;
    }
    
    const exit = scout.pos.findClosestByPath(exitDir);
    scout.moveTo(exit);
    return `侦察兵正在移动到 ${roomName}`;
  } else {
    return `侦察兵已经在 ${roomName} 房间内`;
  }
};

module.exports = function() {
  // 初始化控制台命令
  console.log('控制台命令已加载，可使用以下命令:');
  console.log('- setEmergencyMode(): 切换到紧急模式');
  console.log('- setNormalMode(): 切换到正常模式');
  console.log('- setExpansionMode(): 切换到扩张模式');
  console.log('- setCustomMode(modeName, options): 切换到自定义模式');
};