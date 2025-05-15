'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var main = {};

var role_harvester = {
    run(creep) {
        // 自动清理无效内存
        if (!creep.memory.sourceId || !Game.getObjectById(creep.memory.sourceId)) {
            delete creep.memory.sourceId;
            delete creep.memory.cachedPath;
        }

        // ✅ 尝试重新绑定 source
        if (!creep.memory.sourceId) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                creep.memory.sourceId = source.id;
                const path = creep.pos.findPathTo(source, {
                    serialize: true,
                    ignoreCreeps: true
                });
                creep.memory.cachedPath = path;
            } else {
                // ✅ 如果找不到能量源，moveTo 控制器附近等待
                if (creep.room.controller) {
                    creep.moveTo(creep.room.controller);
                }
                return;
            }
        }

        const source = Game.getObjectById(creep.memory.sourceId);

        if (creep.store.getFreeCapacity() > 0) {
            // 首先尝试从Container获取能量
            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                    s.store[RESOURCE_ENERGY] > 0
            });

            if (container) {
                if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 3
                    });
                }
            } else if (source) {
                const harvestResult = creep.harvest(source);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    // 使用带缓存的移动
                    if (creep.memory.cachedPath && creep.memory.cachedPath.length > 0) {
                        const moveResult = creep.moveByPath(creep.memory.cachedPath);
                        // ✅ fallback：如果 moveByPath 返回 ERR_NOT_FOUND 或 ERR_NO_PATH，则直接 moveTo
                        if (moveResult < 0) {
                            creep.moveTo(source, {
                                visualizePathStyle: { stroke: '#ffaa00' },
                                reusePath: 3
                            });
                            delete creep.memory.cachedPath;
                        } else if (creep.pos.isNearTo(source)) {
                            creep.memory.cachedPath = creep.pos.findPathTo(source, {
                                serialize: true,
                                ignoreCreeps: true
                            });
                        }
                    } else {
                        creep.moveTo(source, {
                            visualizePathStyle: { stroke: '#ffaa00' },
                            reusePath: 3
                        });
                    }
                }
            }
        } else {
            // 能量运输逻辑
            let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_EXTENSION ||
                        s.structureType === STRUCTURE_SPAWN ||
                        s.structureType === STRUCTURE_TOWER) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });

            if (!target) {
                target = creep.room.storage ||  // 优先使用Storage
                    creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: s =>
                            s.structureType === STRUCTURE_CONTAINER &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    });
            }

            if (!target && creep.room.controller) {
                target = creep.room.controller;
            }

            if (target) {
                const result = (target.structureType === STRUCTURE_CONTROLLER)
                    ? creep.upgradeController(target)
                    : creep.transfer(target, RESOURCE_ENERGY);

                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: { stroke: '#ffffff' },
                        reusePath: 3
                    });
                }

                if (!creep.pos.inRangeTo(target, 3)) {
                    delete creep.memory.cachedPath;
                }
            }
        }
    },
};

var role_builder = {
  run(creep) {
    // 设置工作状态
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.building = false;
      creep.say('🔄 采集');
    }
    if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
      creep.memory.building = true;
      creep.say('🚧 建造');
    }

    // 建造模式
    if (creep.memory.building) {
      const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
      if (target) {
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
        }
      } else {
        // 如果没有工地，默认去升级控制器，避免浪费
        const controller = creep.room.controller;
        if (controller) {
          if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffffff'}});
          }
        }
      }
    }
    // 采集能量模式
    else {
      // 优先捡取掉落的能量
      const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType === RESOURCE_ENERGY
      });
      
      if (droppedEnergy && droppedEnergy.amount > 50) {
        if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
          creep.moveTo(droppedEnergy, {visualizePathStyle: {stroke: '#ffaa00'}});
          return;
        }
      }
      
      // 优先从存储设施获取能量（新增Storage优先级）
      const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: structure => {
          return (structure.structureType === STRUCTURE_STORAGE || 
                  structure.structureType === STRUCTURE_CONTAINER) && 
                  structure.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity();
        }
      });
      
      if (container) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'}});
          return;
        }
      }
      
      // 最后从能量源直接采集
      const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
      }
    }
  },
};

var role_upgrader = {
  run(creep) {
    // 设置工作状态
    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.upgrading = false;
      creep.say('🔄 采集');
    }
    if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
      creep.memory.upgrading = true;
      creep.say('⚡ 升级');
    }

    // 升级模式
    if (creep.memory.upgrading) {
      const controller = creep.room.controller;
      if (controller) {
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(controller, {
            visualizePathStyle: { stroke: '#ffffff' },
            reusePath: 5
          });
        }
      }
    }
    // 采集能量模式
    else {
      // 优先从容器或存储中获取能量
      const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_CONTAINER || 
                      s.structureType === STRUCTURE_STORAGE) && 
                     s.store[RESOURCE_ENERGY] > 0
      });
      
      if (container) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(container, { 
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 3
          });
        }
      } else {
        // 其次捡取掉落的能量
        const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
          filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
        });
        
        if (droppedEnergy) {
          if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
            creep.moveTo(droppedEnergy, { 
              visualizePathStyle: { stroke: '#ffaa00' },
              reusePath: 3
            });
          }
        } else {
          // 最后从能量源直接采集
          const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
          if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
              creep.moveTo(source, { 
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 3
              });
            }
          }
        }
      }
    }
    
    // 添加卡住检测
    if (creep.memory.lastPos && 
        creep.memory.lastPos.x === creep.pos.x && 
        creep.memory.lastPos.y === creep.pos.y) {
      
      creep.memory.stuckCount = (creep.memory.stuckCount || 0) + 1;
      
      // 如果卡住超过10个tick，尝试随机移动解除卡住状态
      if (creep.memory.stuckCount > 10) {
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        creep.move(directions[Math.floor(Math.random() * directions.length)]);
        creep.memory.stuckCount = 0;
      }
    } else {
      creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
      creep.memory.stuckCount = 0;
    }
  }
};

var roleRepairer$1 = {
    run(creep) {
        // 设置工作状态
        if (creep.memory.repairing && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.repairing = false;
            creep.say('🔄 采集');
        }
        if (!creep.memory.repairing && creep.store.getFreeCapacity() === 0) {
            creep.memory.repairing = true;
            creep.say('🔧 修理');
        }

        // 修理模式
        if (creep.memory.repairing) {
            // 按优先级查找需要修理的建筑
            // 1. 首先修理重要基础设施（容器、道路）
            let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_CONTAINER || 
                              s.structureType === STRUCTURE_ROAD) &&
                             s.hits < s.hitsMax * 0.5  // 低于50%生命值优先修理
            });
            
            // 2. 其次修理一般建筑
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.hits < s.hitsMax && 
                                 s.structureType !== STRUCTURE_WALL && 
                                 s.structureType !== STRUCTURE_RAMPART
                });
            }
            
            // 3. 最后修理防御建筑，但有上限
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_WALL || 
                                  s.structureType === STRUCTURE_RAMPART) && 
                                 s.hits < 10000  // 防御建筑修理上限提高到10000
                });
            }

            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ff00ff' } });
                }
            } else {
                // 没有修理目标时，转为升级控制器
                const controller = creep.room.controller;
                if (controller) {
                    if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            }
        } else {
            // 采集能量模式 - 优化能量获取方式
            // 优先从容器或存储中获取能量
            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_CONTAINER || 
                              s.structureType === STRUCTURE_STORAGE) && 
                             s.store[RESOURCE_ENERGY] > 0
            });
            
            if (container) {
                if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                // 其次捡取掉落的能量
                const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                    filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
                });
                
                if (droppedEnergy) {
                    if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                } else {
                    // 最后从能量源直接采集
                    const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                    if (source) {
                        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                        }
                    }
                }
            }
        }
    },
};

var role_repairer = roleRepairer$1;

var role_miner = {
    run(creep) {
        // 自动清理无效内存
        if (!creep.memory.sourceId || !Game.getObjectById(creep.memory.sourceId)) {
            delete creep.memory.sourceId;
            delete creep.memory.cachedPath;
        }
        
        // 检查容器是否还存在，如果不存在则清除容器ID
        if (creep.memory.containerId && !Game.getObjectById(creep.memory.containerId)) {
            delete creep.memory.containerId;
        }

        // 尝试绑定 source
        if (!creep.memory.sourceId) {
            const sources = creep.room.find(FIND_SOURCES);
            // 找到当前分配矿工最少的能量源
            const sourceAssignments = {};
            
            // 初始化每个能量源的矿工数量为0
            for (const source of sources) {
                sourceAssignments[source.id] = 0;
            }
            
            // 统计每个能量源的矿工数量
            for (const name in Game.creeps) {
                const otherCreep = Game.creeps[name];
                if (otherCreep.memory.role === 'miner' && otherCreep.memory.sourceId) {
                    sourceAssignments[otherCreep.memory.sourceId] = 
                        (sourceAssignments[otherCreep.memory.sourceId] || 0) + 1;
                }
            }
            
            // 找到分配矿工最少的能量源
            let minAssignedSource = null;
            let minAssignedCount = Infinity;
            
            for (const sourceId in sourceAssignments) {
                if (sourceAssignments[sourceId] < minAssignedCount) {
                    minAssignedCount = sourceAssignments[sourceId];
                    minAssignedSource = sourceId;
                }
            }
            
            if (minAssignedSource) {
                creep.memory.sourceId = minAssignedSource;
                const source = Game.getObjectById(minAssignedSource);
                const path = creep.pos.findPathTo(source, {
                    serialize: true,
                    ignoreCreeps: true
                });
                creep.memory.cachedPath = path;
                console.log(`矿工 ${creep.name} 被分配到能量源 ${minAssignedSource}`);
            } else {
                // 如果找不到能量源，移动到控制器附近等待
                if (creep.room.controller) {
                    creep.moveTo(creep.room.controller);
                }
                return;
            }
        }

        const source = Game.getObjectById(creep.memory.sourceId);
        
        // 寻找附近的容器
        if (!creep.memory.containerId) {
            const containers = creep.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            
            // 如果附近有容器，记住它
            if (containers.length > 0) {
                creep.memory.containerId = containers[0].id;
            }
        }
        
        const container = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
        
        // 如果有容器，站在容器上挖矿
        if (container) {
            if (!creep.pos.isEqualTo(container.pos)) {
                creep.moveTo(container, {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    reusePath: 5
                });
            } else {
                // 站在容器上挖矿，能量会自动掉入容器
                if (source) {
                    creep.harvest(source);
                }
            }
        } else {
            // 没有容器，正常挖矿
            if (source) {
                const harvestResult = creep.harvest(source);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    // 定期重新计算路径，避免卡住
                    if (!creep.memory.pathUpdateTime || Game.time - creep.memory.pathUpdateTime > 20) {
                        const path = creep.pos.findPathTo(source, {
                            serialize: true,
                            ignoreCreeps: true
                        });
                        creep.memory.cachedPath = path;
                        creep.memory.pathUpdateTime = Game.time;
                    }
                    
                    // 使用带缓存的移动
                    if (creep.memory.cachedPath && creep.memory.cachedPath.length > 0) {
                        const moveResult = creep.moveByPath(creep.memory.cachedPath);
                        // fallback：如果 moveByPath 失败，则直接 moveTo
                        if (moveResult < 0) {
                            creep.moveTo(source, {
                                visualizePathStyle: { stroke: '#ffaa00' },
                                reusePath: 3
                            });
                            // 如果移动失败，重新计算路径
                            delete creep.memory.cachedPath;
                        }
                    } else {
                        creep.moveTo(source, {
                            visualizePathStyle: { stroke: '#ffaa00' },
                            reusePath: 3
                        });
                    }
                }
                
                // 如果背包满了，尝试将能量放入附近的容器或存储
                if (creep.store.getFreeCapacity() === 0) {
                    const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: s => 
                            (s.structureType === STRUCTURE_CONTAINER || 
                             s.structureType === STRUCTURE_STORAGE) &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    });
                    
                    if (container) {
                        if (creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(container, {
                                visualizePathStyle: { stroke: '#ffffff' }
                            });
                        }
                    } else {
                        // 如果找不到容器，尝试建造一个容器
                        const constructionSites = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 3, {
                            filter: site => site.structureType === STRUCTURE_CONTAINER
                        });
                        
                        if (constructionSites.length > 0) {
                            if (creep.build(constructionSites[0]) === ERR_NOT_IN_RANGE) {
                                creep.moveTo(constructionSites[0]);
                            }
                        } else if (creep.pos.isNearTo(source)) {
                            // 在能量源旁边创建一个容器建筑工地
                            creep.room.createConstructionSite(creep.pos, STRUCTURE_CONTAINER);
                        } else {
                            // 如果实在没地方放，就丢弃一些能量以继续挖矿
                            creep.drop(RESOURCE_ENERGY, creep.store.getUsedCapacity(RESOURCE_ENERGY) / 2);
                        }
                    }
                }
            }
        }
        
        // 添加卡住检测
        if (creep.memory.lastPos && 
            creep.memory.lastPos.x === creep.pos.x && 
            creep.memory.lastPos.y === creep.pos.y && 
            creep.memory.stuckCount) {
            
            creep.memory.stuckCount++;
            
            // 如果卡住超过10个tick，重新计算路径
            if (creep.memory.stuckCount > 10) {
                delete creep.memory.cachedPath;
                creep.memory.stuckCount = 0;
                // 随机移动一下尝试解除卡住状态
                const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
                creep.move(directions[Math.floor(Math.random() * directions.length)]);
            }
        } else {
            creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
            creep.memory.stuckCount = (creep.memory.stuckCount || 0) + 1;
        }
    }
};

const roleHarvester = role_harvester;
const roleBuilder = role_builder;
const roleUpgrader = role_upgrader;
const roleRepairer = role_repairer;
const roleMiner = role_miner;

var creepManager$1 = {
    run(room) {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            // 移除房间检查，让所有Creep都能执行其角色逻辑
            // 或者改为检查Creep的home属性，如果有的话
            // if (creep.room.name !== room.name) continue;

            switch (creep.memory.role) {
                case 'harvester':
                    roleHarvester.run(creep);
                    break;
                case 'builder':
                    roleBuilder.run(creep);
                    break;
                case 'upgrader':
                    roleUpgrader.run(creep);
                    break;
                case 'repairer':
                    roleRepairer.run(creep);
                    break;
                case 'miner':
                    roleMiner.run(creep);
                    break;
            }
        }
    },
};

// 房间管理器
const roomManager$1 = {
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

var roomManager_1 = roomManager$1;

var memoryManager$1 = {
  run() {
    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
        console.log('Clearing non-existing creep memory:', name);
      }
    }
  },
};

var cpuManager$1 = {
  run() {
    if (Game.cpu.bucket > 9000) {
      Game.cpu.generatePixel();
    }
  },
};

var errorCatcher = {
  tryCatch(fn) {
    try {
      fn();
    } catch (e) {
      console.log('Error in main loop:', e.stack);
    }
  },
};

/**
 * 扩张管理模块
 * 负责评估、选择和扩张到新房间
 */

var expansionManager$1 = {
  /**
   * 运行扩张管理器
   * @param {Game} game - 游戏对象
   */
  run(game) {
    // 检查是否有正在进行的扩张任务
    if (Memory.expansion) {
      // 如果有扩张任务，处理它
      this.processExpansion();
      return;
    }
    
    // 检查是否有房间处于扩张模式
    const roomsInExpansionMode = Object.values(Game.rooms).filter(room => 
      room.controller && room.controller.my && room.memory.mode === 'expansion'
    );
    
    if (roomsInExpansionMode.length > 0) {
      console.log(`检测到${roomsInExpansionMode.length}个房间处于扩张模式，开始评估扩张目标`);
      
      // 寻找最适合扩张的基地房间
      const baseRoom = this.findBestBaseRoom(roomsInExpansionMode);
      if (!baseRoom) {
        return;
      }
      
      // 寻找最佳的扩张目标房间
      const targetRoomName = this.findExpansionTarget(baseRoom);
      if (!targetRoomName) {
        console.log(`未找到合适的扩张目标房间`);
        return;
      }
      
      // 开始扩张流程
      this.startExpansion(baseRoom, targetRoomName);
      return;
    }
    
    // 如果没有扩张任务和扩张模式的房间，每100个tick检查一次扩张机会
    if (Game.time % 100 !== 0) {
      return;
    }
    
    // 检查是否有房间已经达到可以支持扩张的等级（至少RCL 3）
    const myRooms = Object.values(Game.rooms).filter(room => 
      room.controller && room.controller.my && room.controller.level >= 3
    );
    
    if (myRooms.length === 0) {
      return; // 没有房间达到扩张条件
    }
    
    // 检查是否已经达到最大房间数量限制
    const maxRooms = 3; // 可以根据需要调整
    if (myRooms.length >= maxRooms) {
      return;
    }
    
    // 寻找最适合扩张的基地房间
    const baseRoom = this.findBestBaseRoom(myRooms);
    if (!baseRoom) {
      return;
    }
    
    // 寻找最佳的扩张目标房间
    const targetRoomName = this.findExpansionTarget(baseRoom);
    if (!targetRoomName) {
      return;
    }
    
    // 开始扩张流程
    this.startExpansion(baseRoom, targetRoomName);
  },
  
  /**
   * 寻找最适合作为扩张基地的房间
   * @param {Array<Room>} rooms - 我控制的房间列表
   * @returns {Room} 最适合的基地房间
   */
  findBestBaseRoom(rooms) {
    // 按照控制器等级、能量储备和creep产能排序
    return rooms.sort((a, b) => {
      // 优先选择控制器等级高的房间
      if (a.controller.level !== b.controller.level) {
        return b.controller.level - a.controller.level;
      }
      
      // 其次考虑能量储备
      const aEnergy = a.energyAvailable + (a.storage ? a.storage.store[RESOURCE_ENERGY] : 0);
      const bEnergy = b.energyAvailable + (b.storage ? b.storage.store[RESOURCE_ENERGY] : 0);
      
      return bEnergy - aEnergy;
    })[0];
  },
  
  /**
   * 寻找最佳的扩张目标房间
   * @param {Room} baseRoom - 扩张基地房间
   * @returns {string|null} 目标房间名称或null
   */
  findExpansionTarget(baseRoom) {
    // 获取附近的房间
    const exits = Game.map.describeExits(baseRoom.name);
    const nearbyRooms = Object.values(exits);
    
    // 评估每个房间的适合度
    let bestRoom = null;
    let bestScore = -Infinity;
    
    for (const roomName of nearbyRooms) {
      // 跳过已经被占领的房间
      const roomStatus = Game.map.getRoomStatus(roomName);
      if (roomStatus.status !== 'normal') {
        continue;
      }
      
      // 如果我们已经可以看到这个房间，检查它是否已经被占领
      if (Game.rooms[roomName] && 
          Game.rooms[roomName].controller && 
          Game.rooms[roomName].controller.owner) {
        continue;
      }
      
      // 评估房间分数
      const score = this.evaluateRoom(roomName, baseRoom);
      
      if (score > bestScore) {
        bestScore = score;
        bestRoom = roomName;
      }
    }
    
    return bestRoom;
  },
  
  /**
   * 评估房间的适合度
   * @param {string} roomName - 房间名称
   * @param {Room} baseRoom - 基地房间
   * @returns {number} 房间评分
   */
  evaluateRoom(roomName, baseRoom) {
    // 这里需要派遣侦察兵前往房间进行评估
    // 或者使用Game.map.getTerrainAt进行初步评估
    
    // 简单评分示例
    let score = 0;
    
    // 距离评分（距离适中最好）
    const distance = Game.map.getRoomLinearDistance(baseRoom.name, roomName);
    if (distance === 1) {
      score += 10; // 相邻房间
    } else if (distance === 2) {
      score += 5;  // 距离适中
    } else {
      score -= distance * 2; // 距离越远越不适合
    }
    
    // 如果我们有房间视野，进行更详细的评估
    if (Game.rooms[roomName]) {
      const room = Game.rooms[roomName];
      
      // 能量源数量
      const sources = room.find(FIND_SOURCES);
      score += sources.length * 20;
      
      // 矿物资源
      const minerals = room.find(FIND_MINERALS);
      score += minerals.length * 10;
      
      // 控制器位置评估
      if (room.controller) {
        // 检查控制器周围是否有足够的建筑空间
        const terrain = room.getTerrain();
        let buildableSpaces = 0;
        
        for (let x = room.controller.pos.x - 3; x <= room.controller.pos.x + 3; x++) {
          for (let y = room.controller.pos.y - 3; y <= room.controller.pos.y + 3; y++) {
            if (x >= 0 && x < 50 && y >= 0 && y < 50 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
              buildableSpaces++;
            }
          }
        }
        
        score += buildableSpaces;
      }
    }
    
    return score;
  },
  
  /**
   * 开始扩张流程
   * @param {Room} baseRoom - 基地房间
   * @param {string} targetRoomName - 目标房间名称
   */
  startExpansion(baseRoom, targetRoomName) {
    // 检查是否已经有扩张任务
    if (Memory.expansion && Memory.expansion.targetRoom === targetRoomName) {
      return;
    }
    
    // 创建扩张内存结构
    Memory.expansion = {
      baseRoom: baseRoom.name,
      targetRoom: targetRoomName,
      phase: 'scout', // 扩张阶段：scout, claim, build
      startTime: Game.time,
      creeps: []
    };
    
    console.log(`开始扩张到新房间: ${targetRoomName}，基地房间: ${baseRoom.name}`);
    
    // 创建侦察兵
    this.spawnScout(baseRoom, targetRoomName);
  },
  
  /**
   * 生成侦察兵
   * @param {Room} baseRoom - 基地房间
   * @param {string} targetRoomName - 目标房间名称
   */
  spawnScout(baseRoom, targetRoomName) {
    const spawns = baseRoom.find(FIND_MY_SPAWNS, {
      filter: spawn => !spawn.spawning
    });
    
    if (spawns.length === 0) {
      return;
    }
    
    const spawn = spawns[0];
    const scoutName = `scout_${Game.time}`;
    
    // 创建一个简单的侦察兵
    const result = spawn.spawnCreep([MOVE], scoutName, {
      memory: {
        role: 'scout',
        targetRoom: targetRoomName,
        home: baseRoom.name
      }
    });
    
    if (result === OK) {
      Memory.expansion.creeps.push(scoutName);
      console.log(`生成侦察兵 ${scoutName} 前往房间 ${targetRoomName}`);
    }
  },
  
  /**
   * 处理扩张任务
   * 这个方法应该在main循环中调用
   */
  processExpansion() {
    if (!Memory.expansion) {
      return;
    }
    
    const expansion = Memory.expansion;
    Game.rooms[expansion.baseRoom];
    
    // 检查扩张是否超时
    const expansionTimeout = 10000; // ticks
    if (Game.time - expansion.startTime > expansionTimeout) {
      console.log(`扩张到房间 ${expansion.targetRoom} 超时，取消扩张`);
      delete Memory.expansion;
      return;
    }
    
    // 根据不同阶段处理扩张
    switch (expansion.phase) {
      case 'scout':
        this.processScoutPhase();
        break;
      case 'claim':
        this.processClaimPhase();
        break;
      case 'build':
        this.processBuildPhase();
        break;
    }
  },
  
  /**
   * 处理侦察阶段
   */
  processScoutPhase() {
    const expansion = Memory.expansion;
    
    // 检查是否有侦察兵到达目标房间
    if (Game.rooms[expansion.targetRoom]) {
      // 我们有房间视野，评估房间
      const room = Game.rooms[expansion.targetRoom];
      
      // 检查房间是否已被占领
      if (room.controller && room.controller.owner && !room.controller.my) {
        console.log(`房间 ${expansion.targetRoom} 已被其他玩家占领，取消扩张`);
        delete Memory.expansion;
        return;
      }
      
      // 检查房间是否有足够的资源
      const sources = room.find(FIND_SOURCES);
      if (sources.length < 1) {
        console.log(`房间 ${expansion.targetRoom} 能量源不足，取消扩张`);
        delete Memory.expansion;
        return;
      }
      
      // 侦察成功，进入占领阶段
      expansion.phase = 'claim';
      console.log(`房间 ${expansion.targetRoom} 侦察完成，开始占领阶段`);
      
      // 生成占领者
      this.spawnClaimer(Game.rooms[expansion.baseRoom], expansion.targetRoom);
    } else {
      // 检查侦察兵是否存活
      let scoutAlive = false;
      for (const creepName of expansion.creeps) {
        if (Game.creeps[creepName] && Game.creeps[creepName].memory.role === 'scout') {
          scoutAlive = true;
          break;
        }
      }
      
      // 如果没有侦察兵，重新生成
      if (!scoutAlive) {
        this.spawnScout(Game.rooms[expansion.baseRoom], expansion.targetRoom);
      }
    }
  },
  
  /**
   * 生成占领者
   * @param {Room} baseRoom - 基地房间
   * @param {string} targetRoomName - 目标房间名称
   */
  spawnClaimer(baseRoom, targetRoomName) {
    const spawns = baseRoom.find(FIND_MY_SPAWNS, {
      filter: spawn => !spawn.spawning
    });
    
    if (spawns.length === 0) {
      return;
    }
    
    const spawn = spawns[0];
    const claimerName = `claimer_${Game.time}`;
    
    // 创建占领者
    const result = spawn.spawnCreep([CLAIM, MOVE], claimerName, {
      memory: {
        role: 'claimer',
        targetRoom: targetRoomName,
        home: baseRoom.name
      }
    });
    
    if (result === OK) {
      Memory.expansion.creeps.push(claimerName);
      console.log(`生成占领者 ${claimerName} 前往房间 ${targetRoomName}`);
    }
  },
  
  /**
   * 处理占领阶段
   */
  processClaimPhase() {
    const expansion = Memory.expansion;
    
    // 检查目标房间是否已被占领
    if (Game.rooms[expansion.targetRoom] && 
        Game.rooms[expansion.targetRoom].controller && 
        Game.rooms[expansion.targetRoom].controller.my) {
      // 已成功占领，进入建造阶段
      expansion.phase = 'build';
      console.log(`房间 ${expansion.targetRoom} 已成功占领，开始建造阶段`);
      
      // 生成建造者和采集者
      this.spawnBuilders(Game.rooms[expansion.baseRoom], expansion.targetRoom);
      return;
    }
    
    // 检查占领者是否存活
    let claimerAlive = false;
    for (const creepName of expansion.creeps) {
      if (Game.creeps[creepName] && Game.creeps[creepName].memory.role === 'claimer') {
        claimerAlive = true;
        break;
      }
    }
    
    // 如果没有占领者，重新生成
    if (!claimerAlive) {
      this.spawnClaimer(Game.rooms[expansion.baseRoom], expansion.targetRoom);
    }
  },
  
  /**
   * 生成建造者
   * @param {Room} baseRoom - 基地房间
   * @param {string} targetRoomName - 目标房间名称
   */
  spawnBuilders(baseRoom, targetRoomName) {
    const spawns = baseRoom.find(FIND_MY_SPAWNS, {
      filter: spawn => !spawn.spawning
    });
    
    if (spawns.length === 0) {
      return;
    }
    
    const spawn = spawns[0];
    
    // 生成多个建造者
    for (let i = 0; i < 3; i++) {
      const builderName = `builder_${Game.time}_${i}`;
      
      // 创建建造者
      const result = spawn.spawnCreep(
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE], 
        builderName, 
        {
          memory: {
            role: 'builder',
            targetRoom: targetRoomName,
            home: baseRoom.name
          }
        }
      );
      
      if (result === OK) {
        Memory.expansion.creeps.push(builderName);
        console.log(`生成建造者 ${builderName} 前往房间 ${targetRoomName}`);
      }
    }
  },
  
  /**
   * 处理建造阶段
   */
  processBuildPhase() {
    const expansion = Memory.expansion;
    
    // 检查目标房间是否有出生点
    if (Game.rooms[expansion.targetRoom]) {
      const spawns = Game.rooms[expansion.targetRoom].find(FIND_MY_SPAWNS);
      
      if (spawns.length > 0) {
        // 已成功建造出生点，扩张完成
        console.log(`房间 ${expansion.targetRoom} 扩张完成，已建造出生点`);
        delete Memory.expansion;
        return;
      }
      
      // 检查是否有出生点建筑工地
      const spawnSites = Game.rooms[expansion.targetRoom].find(FIND_CONSTRUCTION_SITES, {
        filter: site => site.structureType === STRUCTURE_SPAWN
      });
      
      // 如果没有出生点建筑工地，创建一个
      if (spawnSites.length === 0) {
        this.createSpawnConstructionSite(Game.rooms[expansion.targetRoom]);
      }
    }
    
    // 检查建造者是否足够
    let builderCount = 0;
    for (const creepName of expansion.creeps) {
      if (Game.creeps[creepName] && Game.creeps[creepName].memory.role === 'builder') {
        builderCount++;
      }
    }
    
    // 如果建造者不足，生成更多
    if (builderCount < 3) {
      this.spawnBuilders(Game.rooms[expansion.baseRoom], expansion.targetRoom);
    }
  },
  
  /**
   * 在新房间创建出生点建筑工地
   * @param {Room} room - 目标房间
   */
  createSpawnConstructionSite(room) {
    // 寻找合适的位置建造出生点
    // 优先选择靠近能量源的位置
    const sources = room.find(FIND_SOURCES);
    if (sources.length === 0) {
      return;
    }
    
    const source = sources[0];
    const terrain = room.getTerrain();
    
    // 在能量源周围寻找合适的位置
    for (let radius = 2; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          
          const x = source.pos.x + dx;
          const y = source.pos.y + dy;
          
          // 检查位置是否在房间边界内
          if (x < 1 || x > 48 || y < 1 || y > 48) {
            continue;
          }
          
          // 检查地形是否可通行
          if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
            continue;
          }
          
          // 检查位置是否已有建筑或建筑工地
          const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
          const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
          
          if (structures.length === 0 && constructionSites.length === 0) {
            // 创建新的出生点建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_SPAWN);
            if (result === OK) {
              console.log(`在房间 ${room.name} 创建了出生点建筑工地，坐标: ${x},${y}`);
              return;
            }
          }
        }
      }
    }
  }
};

// 配置管理器
const configManager$2 = {
  // 默认配置
  defaultConfig: {
    mode: 'normal', // 正常模式
    energyPriority: 'upgrade', // 能量优先用于升级
    defenseLevel: 'medium', // 中等防御水平
    // 其他配置...
  },
  
  // 初始化配置
  init: function() {
    if(!Memory.config) {
      Memory.config = this.defaultConfig;
    }
  },
  
  // 获取当前模式
  getMode: function() {
    return Memory.config.mode;
  },
  
  // 切换到紧急模式
  switchToEmergency: function() {
    Memory.config.mode = 'emergency';
    Memory.config.energyPriority = 'spawn';
    Memory.config.defenseLevel = 'high';
    console.log('已切换到紧急模式!');
  },
  
  // 切换到正常模式
  switchToNormal: function() {
    Memory.config.mode = 'normal';
    Memory.config.energyPriority = 'upgrade';
    Memory.config.defenseLevel = 'medium';
    console.log('已切换到正常模式!');
  },
  
  // 切换到扩张模式
  switchToExpansion: function() {
    Memory.config.mode = 'expansion';
    Memory.config.energyPriority = 'build';
    Memory.config.defenseLevel = 'low';
    console.log('已切换到扩张模式!');
  }
};

var configManager_1 = configManager$2;

// 控制台命令
const configManager$1 = configManager_1;

// 将这些函数添加到全局作用域，以便在控制台中调用
commonjsGlobal.setEmergencyMode = function() {
  configManager$1.switchToEmergency();
  return '已切换到紧急模式';
};

commonjsGlobal.setNormalMode = function() {
  configManager$1.switchToNormal();
  return '已切换到正常模式';
};

commonjsGlobal.setExpansionMode = function() {
  configManager$1.switchToExpansion();
  return '已切换到扩张模式';
};

// 自定义模式切换
commonjsGlobal.setCustomMode = function(modeName, options = {}) {
  if (!Memory.config) Memory.config = {};
  Memory.config.mode = modeName;
  
  // 合并自定义选项
  for (let key in options) {
    Memory.config[key] = options[key];
  }
  
  return `已切换到自定义模式: ${modeName}`;
};

// 添加侦察兵控制命令
commonjsGlobal.moveScout = function(roomName) {
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

var consoleCommands$1 = function() {
  // 初始化控制台命令
  console.log('控制台命令已加载，可使用以下命令:');
  console.log('- setEmergencyMode(): 切换到紧急模式');
  console.log('- setNormalMode(): 切换到正常模式');
  console.log('- setExpansionMode(): 切换到扩张模式');
  console.log('- setCustomMode(modeName, options): 切换到自定义模式');
};

const roomManager = roomManager_1;
const memoryManager = memoryManager$1;
const cpuManager = cpuManager$1;
const { tryCatch } = errorCatcher;
const expansionManager = expansionManager$1;
const configManager = configManager_1;
const consoleCommands = consoleCommands$1;
const creepManager = creepManager$1; // 确保导入 creepManager

// 加载控制台命令
consoleCommands();

var loop = main.loop = function () {
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
    
    // 在通用逻辑部分调用扩张管理器
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      roomManager.run(room, currentMode);
      
      // 确保每个房间的 creep 都被管理
      if (room.controller && room.controller.my) {
        creepManager.run(room);
      }
    }
    
    // 无论当前模式如何，都调用扩张管理器
    expansionManager.run(Game);
    
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

exports.default = main;
exports.loop = loop;
