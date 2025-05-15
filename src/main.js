const roomManager = require('./managers/roomManager');
const memoryManager = require('./managers/memoryManager');
const cpuManager = require('./managers/cpuManager');
const { tryCatch } = require('./utils/errorCatcher');
const constructionManager = require('./managers/constructionManager');
const expansionManager = require('./managers/expansionManager');
const configManager = require('./managers/configManager');
const consoleCommands = require('./utils/consoleCommands');

// 加载控制台命令
consoleCommands();

module.exports.loop = function () {
  tryCatch(() => {
    // 初始化配置
    configManager.init();
    
    // 清理内存
    memoryManager.run();
    
    // 根据当前模式执行不同逻辑
    const currentMode = configManager.getMode();
    
    if (currentMode === 'emergency') {
      // 紧急模式逻辑
      runEmergencyMode();
    } else if (currentMode === 'expansion') {
      // 扩张模式逻辑
      runExpansionMode();
      // 调用扩张管理器
      expansionManager.run(Game);
    } else {
      // 正常模式逻辑
      runNormalMode();
    }
    
    // 通用逻辑
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      roomManager.run(room, currentMode);
    }
    
    cpuManager.run();
    
    // 检测是否需要自动切换模式
    checkAndSwitchModes();
  });
};

function runEmergencyMode() {
  // 紧急模式下的特殊逻辑
  console.log('正在执行紧急模式...');
  // 优先孵化基本单位，停止建造，专注防御和能量收集
}

function runExpansionMode() {
  // 扩张模式下的特殊逻辑
  console.log('正在执行扩张模式...');
  // 优先建造和升级，准备扩张到新房间
}

function runNormalMode() {
  // 正常模式下的特殊逻辑
  console.log('正在执行正常模式...');
  // 平衡发展
}

function checkAndSwitchModes() {
  // 检查是否有任何房间需要紧急模式
  let needEmergency = false;
  let canExpand = true;
  let currentMode = configManager.getMode();
  
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    
    // 检查是否需要紧急模式
    if (room.energyAvailable < room.energyCapacityAvailable * 0.2 || 
        room.find(FIND_HOSTILE_CREEPS).length > 0) {
      needEmergency = true;
    }
    
    // 检查是否不满足扩张条件
    if (!(room.energyAvailable > room.energyCapacityAvailable * 0.8 && 
        room.controller && room.controller.level >= 3)) {
      canExpand = false;
    }
  }
  
  // 根据检查结果切换模式
  if (needEmergency) {
    // 如果需要紧急模式且当前不是紧急模式，切换到紧急模式
    if (currentMode !== 'emergency') {
      configManager.switchToEmergency();
    }
  } else if (canExpand && currentMode === 'normal') {
    // 如果可以扩张且当前是正常模式，切换到扩张模式
    configManager.switchToExpansion();
  } else if (!needEmergency) {
    // 从紧急模式恢复
    if (currentMode === 'emergency') {
      configManager.switchToNormal();
    }
    
    // 从扩张模式返回（可以根据需要添加额外条件）
    if (currentMode === 'expansion' && !canExpand) {
      configManager.switchToNormal();
    }
  }
}