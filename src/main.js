const roomManager = require('./managers/roomManager');
const memoryManager = require('./managers/memoryManager');
const cpuManager = require('./managers/cpuManager');
const { tryCatch } = require('./utils/errorCatcher');
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

    const creep = Game.creeps['dismantler1'];
if (creep.room.name !== creep.memory.targetRoom) {
  const exit = creep.room.findExitTo(creep.memory.targetRoom);
  creep.moveTo(creep.pos.findClosestByRange(exit));
} else {
  const target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
  if (target) {
    if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
    }
  }
}
    
    // 根据当前模式执行不同逻辑
    const currentMode = configManager.getMode();
    
    if (currentMode === 'emergency') {
      // 紧急模式逻辑
      runEmergencyMode();
    } else if (currentMode === 'expansion') {
      // 扩张模式逻辑
      runExpansionMode();
      // 暂时屏蔽扩张管理器调用
      // expansionManager.run(Game);
    } else {
      // 正常模式逻辑
      runNormalMode();
    }

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller && room.controller.my) {
        roomManager.run(room, currentMode);
        // 移除对 creepManager.run 的调用，因为它现在在 roomManager 中被调用
      }
    }
    
    // 暂时屏蔽扩张管理器调用
    // expansionManager.run(Game);
    
    cpuManager.run();
    
    // 检测是否需要自动切换模式
    checkAndSwitchModes();
  }, function(error) {
    // 添加错误处理回调，记录详细错误信息
    console.log('游戏循环出错: ' + error + '\n' + error.stack);
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
  // 对每个房间单独进行模式管理
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    if (!room.controller || !room.controller.my) continue;
    
    // 初始化房间模式记忆
    if (!room.memory.mode) {
      room.memory.mode = 'normal';
      room.memory.lastModeChange = Game.time;
    }
    
    // 检查模式切换冷却时间
    const modeCooldown = 100; // ticks
    if (Game.time - room.memory.lastModeChange < modeCooldown) {
      continue; // 冷却期内不切换模式
    }
    
    // 检查当前模式的最小持续时间
    const minModeDuration = {
      'emergency': 200,
      'expansion': 500,
      'normal': 300
    };
    
    if (Game.time - room.memory.lastModeChange < minModeDuration[room.memory.mode]) {
      continue; // 未达到最小持续时间不切换
    }
    
    // 检查是否需要紧急模式
    const needEmergency = room.energyAvailable < room.energyCapacityAvailable * 0.2 || 
                          room.find(FIND_HOSTILE_CREEPS).length > 0;
    
    // 检查是否满足扩张条件
    const canExpand = room.energyAvailable > room.energyCapacityAvailable * 0.8 && 
                      room.controller && room.controller.level >= 3 &&
                      room.find(FIND_MY_CREEPS).length >= 8 && // 有足够的creep
                      room.find(FIND_HOSTILE_CREEPS).length === 0; // 没有敌人
    
    // 根据检查结果切换模式
    let newMode = room.memory.mode; // 默认保持当前模式
    
    if (needEmergency && room.memory.mode !== 'emergency') {
      newMode = 'emergency';
      console.log(`房间 ${room.name} 切换到紧急模式`);
    } else if (!needEmergency && room.memory.mode === 'emergency') {
      // 从紧急模式恢复需要更稳定的条件
      if (room.energyAvailable > room.energyCapacityAvailable * 0.5) {
        newMode = 'normal';
        console.log(`房间 ${room.name} 从紧急模式恢复到正常模式`);
      }
    } else if (canExpand && room.memory.mode === 'normal') {
      newMode = 'expansion';
      console.log(`房间 ${room.name} 切换到扩张模式`);
    } else if (!canExpand && room.memory.mode === 'expansion') {
      newMode = 'normal';
      console.log(`房间 ${room.name} 从扩张模式返回到正常模式`);
    }
    
    // 如果模式发生变化，更新记忆
    if (newMode !== room.memory.mode) {
      room.memory.mode = newMode;
      room.memory.lastModeChange = Game.time;
      
      // 更新全局配置以保持兼容性
      if (Object.values(Game.rooms).filter(r => r.memory.mode === 'emergency').length > 0) {
        Memory.config.mode = 'emergency';
      } else if (Object.values(Game.rooms).filter(r => r.memory.mode === 'expansion').length > 0) {
        Memory.config.mode = 'expansion';
      } else {
        Memory.config.mode = 'normal';
      }
    }
  }
}