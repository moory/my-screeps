const creepManager = require('./creepManager');
const structureManager = require('./structureManager');
const defenseManager = require('./defenseManager');
const spawnManager = require('./spawnManager');
const constructionManager = require('./constructionManager');

// 房间管理器
const roomManager = {
  run: function(room, mode = 'normal') {
    // 根据不同模式执行不同的房间管理逻辑
    if (mode === 'emergency') {
      this.runEmergencyMode(room);
    } else if (mode === 'expansion') {
      this.runExpansionMode(room);
    } else {
      this.runNormalMode(room);
    }
    
    // 通用房间管理逻辑
    this.manageSpawns(room, mode);
    this.manageTowers(room, mode);
  },
  
  runEmergencyMode: function(room) {
    // 紧急模式下的房间管理
    console.log(`房间 ${room.name} 正在执行紧急模式管理`);
    // 专注于防御和基本资源收集
  },
  
  runExpansionMode: function(room) {
    // 扩张模式下的房间管理
    console.log(`房间 ${room.name} 正在执行扩张模式管理`);
    
    // 调整生产优先级，增加建造者和升级者的数量
    if (!room.memory.expansionPriorities) {
      room.memory.expansionPriorities = {
        builders: 3,
        upgraders: 3,
        harvesters: 2,
        miners: room.find(FIND_SOURCES).length
      };
    }
    
    // 确保有足够的能量储备
    const energyFullness = room.energyAvailable / room.energyCapacityAvailable;
    if (energyFullness < 0.7) {
      console.log(`房间 ${room.name} 能量储备不足 (${Math.floor(energyFullness * 100)}%)，暂缓扩张`);
    }
    
    // 检查是否有足够的 creep
    const creepCount = room.find(FIND_MY_CREEPS).length;
    if (creepCount < 8) {
      console.log(`房间 ${room.name} creep 数量不足 (${creepCount}/8)，暂缓扩张`);
    }
  },
  
  runNormalMode: function(room) {
    // 正常模式下的房间管理
    console.log(`房间 ${room.name} 正在执行正常模式管理`);
    // 平衡发展
  },
  
  manageSpawns: function(room, mode) {
    // 根据不同模式调整生产优先级
    const spawns = room.find(FIND_MY_SPAWNS);
    
    for (const spawn of spawns) {
      if (spawn.spawning) continue;
      
      if (mode === 'emergency') {
        // 紧急模式下优先生产采集单位和防御单位
        // ...
      } else if (mode === 'expansion') {
        // 扩张模式下优先生产建造单位和升级单位
        // ...
      } else {
        // 正常模式下平衡生产
        // ...
      }
    }
  },
  
  manageTowers: function(room, mode) {
    // 根据不同模式调整防御塔行为
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });
    
    for (const tower of towers) {
      if (mode === 'emergency') {
        // 紧急模式下优先攻击敌人
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
          tower.attack(hostiles[0]);
          continue;
        }
      }
      
      // 其他模式或没有敌人时的行为
      // ...
    }
  }
};

module.exports = roomManager;