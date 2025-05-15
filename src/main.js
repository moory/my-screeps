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
  // 自动检测是否需要切换模式
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    
    // 如果房间能量严重不足或受到攻击，切换到紧急模式
    if (room.energyAvailable < room.energyCapacityAvailable * 0.2 || 
        room.find(FIND_HOSTILE_CREEPS).length > 0) {
      configManager.switchToEmergency();
      return;
    }
    
    // 如果房间能量充足且控制器等级高，考虑切换到扩张模式
    if (room.energyAvailable > room.energyCapacityAvailable * 0.8 && 
        room.controller && room.controller.level >= 3 &&
        configManager.getMode() === 'normal') {
      configManager.switchToExpansion();
      return;
    }
    
    // 其他条件...
  }
}