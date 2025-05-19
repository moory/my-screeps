const creepManager = require('./creepManager');
const towerManager = require('./towerManager');
const defenseManager = require('./defenseManager');
const spawnManager = require('./spawnManager');
const constructionManager = require('./constructionManager');
const linkManager = require('./linkManager'); // 引入linkManager

// 房间管理器
const roomManager = {
  /**
   * 运行房间管理器
   * @param {Room} room - 要管理的房间
   * @param {string} mode - 运行模式（normal, emergency, expansion）
   */
  run: function (room, mode = 'normal') {
    // 确保房间有自己的内存对象
    if (!room.memory.stats) {
      room.memory.stats = {
        lastUpdate: Game.time,
        energyHarvested: 0,
        energySpent: 0,
        creepsProduced: 0
      };
    }

    // 更新房间状态
    this.updateRoomStatus(room);

    // 根据不同模式执行不同的房间管理策略
    this.executeRoomStrategy(room, mode);

    // 调用各个子系统管理器
    this.runSubsystems(room, mode);
  },

  /**
   * 运行所有子系统
   * @param {Room} room - 要管理的房间
   * @param {string} mode - 运行模式
   */
  runSubsystems: function (room, mode) {
    // 调用各个子系统，传入当前模式
    defenseManager.run(room, mode);
    // constructionManager.run(room);
    towerManager.run(room, mode);
    creepManager.run(room, mode);
    linkManager.run(room); // 调用linkManager的run方法

    // 生产管理放在最后，确保其他系统的需求已经确定
    this.manageSpawns(room, mode);
  },

  /**
   * 更新房间状态信息
   * @param {Room} room - 要更新的房间
   */
  updateRoomStatus: function (room) {
    // 更新房间基本信息
    const status = {
      energyAvailable: room.energyAvailable,
      energyCapacity: room.energyCapacityAvailable,
      controllerLevel: room.controller ? room.controller.level : 0,
      controllerProgress: room.controller ? room.controller.progress : 0,
      hostileCount: room.find(FIND_HOSTILE_CREEPS).length,
      myCreepCount: room.find(FIND_MY_CREEPS).length,
      constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
      timestamp: Game.time
    };

    // 存储状态信息
    room.memory.status = status;

    // 每100个tick记录一次历史数据
    if (Game.time % 100 === 0) {
      if (!room.memory.history) room.memory.history = [];
      room.memory.history.push(status);
      // 保持历史记录不超过50条
      if (room.memory.history.length > 50) {
        room.memory.history.shift();
      }
    }
  },

  /**
   * 根据模式执行房间策略
   * @param {Room} room - 要管理的房间
   * @param {string} mode - 运行模式
   */
  executeRoomStrategy: function (room, mode) {
    // 获取对应模式的策略并执行
    const strategy = this.strategies[mode] || this.strategies.normal;
    strategy.execute(room);

    // 记录当前执行的模式
    room.memory.currentMode = mode;
  },

  /**
   * 运行所有子系统
   * @param {Room} room - 要管理的房间
   * @param {string} mode - 运行模式
   */
  runSubsystems: function (room, mode) {
    // 调用各个子系统，传入当前模式
    defenseManager.run(room, mode);
    // constructionManager.run(room);
    towerManager.run(room, mode);
    creepManager.run(room, mode);

    // 生产管理放在最后，确保其他系统的需求已经确定
    this.manageSpawns(room, mode);
  },

  /**
   * 管理生产单位
   * @param {Room} room - 要管理的房间
   * @param {string} mode - 运行模式
   */
  manageSpawns: function (room, mode) {
    // 根据当前模式调整生产优先级
    const priorities = this.getPriorityByMode(room, mode);

    // 将优先级信息传递给生产管理器
    if (priorities) {
      room.memory.spawnPriorities = priorities;
    }

    // 调用生产管理器
    spawnManager.run(room);
  },

  /**
   * 根据模式获取生产优先级
   * @param {Room} room - 房间对象
   * @param {string} mode - 运行模式
   * @returns {Object} 优先级配置
   */
  getPriorityByMode: function (room, mode) {
    // 根据不同模式返回不同的优先级配置
    switch (mode) {
      case 'emergency':
        return {
          harvester: 3,
          upgrader: 1,
          builder: 1,
          repairer: 1,
          miner: room.find(FIND_SOURCES).length
        };
      case 'expansion':
        return {
          harvester: 2,
          upgrader: 3,
          builder: 3,
          repairer: 1,
          miner: room.find(FIND_SOURCES).length
        };
      default: // normal
        return {
          harvester: 2,
          upgrader: 2,
          builder: 2,
          repairer: 1,
          miner: room.find(FIND_SOURCES).length
        };
    }
  },

  /**
   * 不同模式的策略定义
   */
  strategies: {
    // 正常模式策略
    normal: {
      execute: function (room) {
        console.log(`房间 ${room.name} 正在执行正常模式管理`);
        // 平衡发展策略
        // 确保基础设施完善
        room.memory.buildPriority = ['extension', 'container', 'storage', 'tower'];
      }
    },

    // 紧急模式策略
    emergency: {
      execute: function (room) {
        console.log(`房间 ${room.name} 正在执行紧急模式管理`);
        // 专注于防御和基本资源收集
        // 暂停非必要建筑
        room.memory.buildPriority = ['tower', 'extension'];

        // 在紧急模式下，可以考虑关闭一些非必要的系统
        room.memory.pauseUpgrade = true;

        // 如果有存储，从存储中提取能量到扩展和生产单位
        const storage = room.storage;
        if (storage && storage.store[RESOURCE_ENERGY] > 1000) {
          // 标记存储为能量来源
          room.memory.useStorage = true;
        }
      }
    },

    // 扩张模式策略
    expansion: {
      execute: function (room) {
        console.log(`房间 ${room.name} 正在执行扩张模式管理`);

        // 调整建造优先级
        room.memory.buildPriority = ['extension', 'container', 'storage', 'tower', 'link'];

        // 确保有足够的能量储备
        const energyFullness = room.energyAvailable / room.energyCapacityAvailable;
        if (energyFullness < 0.7) {
          console.log(`房间 ${room.name} 能量储备不足 (${Math.floor(energyFullness * 100)}%)，暂缓扩张`);
          room.memory.pauseExpansion = true;
        } else {
          room.memory.pauseExpansion = false;
        }

        // 检查是否有足够的 creep
        const creepCount = room.find(FIND_MY_CREEPS).length;
        if (creepCount < 8) {
          console.log(`房间 ${room.name} creep 数量不足 (${creepCount}/8)，暂缓扩张`);
          room.memory.pauseExpansion = true;
        }
      }
    }
  }
};

module.exports = roomManager;