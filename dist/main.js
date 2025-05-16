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

var role_collector = {
  run(creep) {
    // 如果背包已满，将资源运送到存储设施
    if (creep.store.getFreeCapacity() === 0) {
      // 优先存放到Storage
      let target = creep.room.storage;
      
      // 如果没有Storage，则寻找Container
      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_CONTAINER &&
                      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }
      
      // 如果没有存储设施，则将能量送到Spawn或Extension
      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => (s.structureType === STRUCTURE_EXTENSION ||
                      s.structureType === STRUCTURE_SPAWN) &&
                      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }
      
      if (target) {
        // 遍历背包中的所有资源类型并转移
        for (const resourceType in creep.store) {
          if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
            break; // 一旦开始移动就跳出循环
          }
        }
      }
    }
    // 如果背包未满，寻找掉落资源
    else {
      // 优先寻找非能量资源（可能是Invader掉落的矿物）
      let droppedResource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType !== RESOURCE_ENERGY
      });
      
      // 如果没有找到非能量资源，再寻找掉落的能量
      if (!droppedResource) {
        droppedResource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
      }
      
      // 如果找到了掉落资源，拾取它
      if (droppedResource) {
        if (creep.pickup(droppedResource) === ERR_NOT_IN_RANGE) {
          creep.moveTo(droppedResource, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        creep.say('🧹 收集');
      } else {
        // 如果没有掉落资源，寻找墓碑并获取其中的资源
        const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
          filter: tomb => tomb.store.getUsedCapacity() > 0
        });
        
        if (tombstone) {
          // 从墓碑中提取第一种可用资源
          for (const resourceType in tombstone.store) {
            if (creep.withdraw(tombstone, resourceType) === ERR_NOT_IN_RANGE) {
              creep.moveTo(tombstone, {visualizePathStyle: {stroke: '#ffaa00'}});
              break; // 一旦开始移动就跳出循环
            }
          }
          creep.say('💀 收集');
        } else {
          // 如果没有掉落资源和墓碑，寻找废墟
          const ruin = creep.pos.findClosestByPath(FIND_RUINS, {
            filter: r => r.store.getUsedCapacity() > 0
          });
          
          if (ruin) {
            // 从废墟中提取第一种可用资源
            for (const resourceType in ruin.store) {
              if (creep.withdraw(ruin, resourceType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(ruin, {visualizePathStyle: {stroke: '#ffaa00'}});
                break; // 一旦开始移动就跳出循环
              }
            }
            creep.say('🏚️ 收集');
          } else {
            // 如果什么都没找到，就待在房间中央或控制器附近
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
              visualizePathStyle: {stroke: '#ffaa00'},
              range: 5
            });
          }
        }
      }
    }
  }
};

var role_claimer = {
  run(creep) {
    // 1) 先移到目标房间
    if (creep.room.name !== creep.memory.targetRoom) {
      const exit = creep.room.findExitTo(creep.memory.targetRoom);
      creep.moveTo(creep.pos.findClosestByRange(exit));
      return;
    }

    // 2) 到房间后，拿 Controller 升到自己名下
    const ctrl = creep.room.controller;
    if (ctrl) {
      // 如果 RCL 还是 0，直接 claim，成功后 RCL===1
      if (!ctrl.owner || !ctrl.my) {
        const res = creep.claimController(ctrl);
        if (res === OK) {
          creep.say('Claimed! 👍');
        }
      }
    }
  }
};

const roleHarvester = role_harvester;
const roleBuilder = role_builder;
const roleUpgrader = role_upgrader;
const roleRepairer = role_repairer;
const roleMiner = role_miner;
const roleCollector = role_collector;
const roleClaimer = role_claimer;

var creepManager$1 = {
    run(room, mode = 'normal') {
        // 现在可以根据 mode 调整 creep 行为
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            
            switch (creep.memory.role) {
                case 'harvester':
                    roleHarvester.run(creep, mode);
                    break;
                    case 'claimer':
                        roleClaimer.run(creep, mode);
                        break;
                case 'builder':
                    roleBuilder.run(creep, mode);
                    break;
                case 'upgrader':
                    // 在紧急模式下可能想要暂停升级控制器
                    if (mode === 'emergency' && room.memory.pauseUpgrade) {
                        // 可以让升级者临时变成采集者
                        roleHarvester.run(creep, mode);
                    } else {
                        roleUpgrader.run(creep, mode);
                    }
                    break;
                case 'repairer':
                    roleRepairer.run(creep, mode);
                    break;
                case 'miner':
                    roleMiner.run(creep, mode);
                    break;
                case 'collector':
                    roleCollector.run(creep, mode);
                    break;
            }
        }
    }
};

var towerManager$1 = {
  run(room, mode = 'normal') {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });

    if (towers.length === 0) return;

    // 根据模式设置塔的行为优先级
    const priorities = mode === 'emergency' 
      ? ['attack', 'heal', 'repair'] 
      : ['heal', 'attack', 'repair'];
    
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    let primaryTarget = null;

    if (hostiles.length > 0) {
      // 1. 优先选择带有 HEAL 的敌人
      const healers = hostiles.filter(c =>
        c.body.some(part => part.type === HEAL && part.hits > 0)
      );

      if (healers.length > 0) {
        // 找最近的 healer (相对于控制器)
        primaryTarget = room.controller.pos.findClosestByPath(healers);
      }
      // 如果没有找到可路径到达的 healer，或者没有 healer，则尝试找其他敌人
      if (!primaryTarget) {
        // 没有 HEAL，就打最近的敌人 (相对于控制器)
        primaryTarget = room.controller.pos.findClosestByPath(hostiles);
      }
    }

    for (const tower of towers) {
      // 根据优先级执行塔的行为
      for (const action of priorities) {
        if (this.executeTowerAction(tower, action, room, primaryTarget, hostiles)) {
          break; // 如果执行了某个行为，就不再执行后续行为
        }
      }
    }
  },

  /**
   * 执行塔的具体行为
   * @param {StructureTower} tower - 防御塔对象
   * @param {string} action - 行为类型
   * @param {Room} room - 房间对象
   * @param {Creep} primaryTarget - 主要攻击目标
   * @param {Array<Creep>} hostiles - 敌对creep列表
   * @returns {boolean} 是否执行了行为
   */
  executeTowerAction(tower, action, room, primaryTarget, hostiles) {
    switch(action) {
      case 'attack':
        if (hostiles.length > 0) {
          // 优先攻击主要目标
          if (primaryTarget) {
            tower.attack(primaryTarget);
            return true;
          }
          
          // 改进墙体穿透检测逻辑
          const hostilesInRange = tower.pos.findInRange(hostiles, 25);
          if (hostilesInRange.length > 0) {
            const attackTarget = tower.pos.findClosestByRange(hostilesInRange.filter(c => {
              // 只检查是否有墙，而不是任何结构
              const structures = c.pos.lookFor(LOOK_STRUCTURES);
              return !structures.some(s => s.structureType === STRUCTURE_WALL);
            }));
            
            if (attackTarget) {
              tower.attack(attackTarget);
              return true;
            }
          }
        }
        break;
        
      case 'heal':
        // 治疗受伤的友方 creep
        const injuredCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: c => c.hits < c.hitsMax
        });
        if (injuredCreep) {
          tower.heal(injuredCreep);
          return true;
        }
        break;
        
      case 'repair':
        // 只有当能量超过 50% 时才修复建筑，保留能量应对攻击
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
          // 优先修复重要建筑：容器、道路、防御墙和城墙
          // 使用 findInRange 限制修复范围在 20 格以内，保证至少 50% 的修复效率
          const criticalStructures = tower.pos.findInRange(FIND_STRUCTURES, 20, {
            filter: s =>
              ((s.structureType === STRUCTURE_CONTAINER ||
                s.structureType === STRUCTURE_ROAD) &&
               s.hits < s.hitsMax * 0.5) || // 容器和道路低于 50% 时修复
              ((s.structureType === STRUCTURE_RAMPART ||
                s.structureType === STRUCTURE_WALL) &&
               s.hits < 300000) // 防御墙和城墙低于 300000 时修复
          });
        
          if (criticalStructures.length > 0) {
            // 从范围内的建筑中找到最近的一个进行修复
            const criticalStructure = tower.pos.findClosestByRange(criticalStructures);
            if (criticalStructure) {
              tower.repair(criticalStructure);
              return true;
            }
          }
        }
        break;
    }
    return false;
  }
};

var defenseManager$1 = {
  run(room) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
       // 提取敌人用户名（去重）
       const hostileUsers = [...new Set(hostiles.map(c => c.owner.username))];
       
       // 检查是否所有入侵者都是 NPC (Invader 或 Source Keeper)
       const isAllNPC = hostileUsers.every(username => username === 'Invader' || username === 'Source Keeper');
       
       // 只有当入侵者不全是 NPC 时才发送通知
       if (!isAllNPC) {
         Game.notify(`⚠️ 警告：检测到 ${hostiles.length} 个敌对 creep 入侵房间 ${room.name}，入侵者：${hostileUsers.join(', ')}`);
       }
      
      // 激活安全模式（如果可用且敌人数量超过阈值）
      if (hostiles.length >= 3 && room.controller && 
          room.controller.my && !room.controller.safeMode && 
          room.controller.safeModeAvailable > 0) {
        // 只有当我们的 creep 数量少于敌人的两倍时才激活安全模式
        const myCreeps = room.find(FIND_MY_CREEPS);
        if (myCreeps.length < hostiles.length * 2) {
          room.controller.activateSafeMode();
          Game.notify(`房间 ${room.name} 已激活安全模式以应对入侵！`);
        }
      }
      
      // 在有敌人时，将所有 creep 召集到出生点附近
      if (room.memory.underAttack !== true) {
        room.memory.underAttack = true;
        console.log(`⚠️ 房间 ${room.name} 正在遭受攻击！`);
      }
    } else if (room.memory.underAttack) {
      // 解除警报
      delete room.memory.underAttack;
      console.log(`✅ 房间 ${room.name} 的威胁已解除`);
    }
  },
};

var spawnManager$1 = {
    run(room) {
        const getCreepsByRole = (role) =>
            room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === role });

        const harvesters = getCreepsByRole('harvester');
        const builders = getCreepsByRole('builder');
        const upgraders = getCreepsByRole('upgrader');
        const repairers = getCreepsByRole('repairer');
        const miners = getCreepsByRole('miner');
        const collectors = getCreepsByRole('collector'); // 添加收集者
        getCreepsByRole('scout');

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) return;

        // 根据RCL和情况动态调整所需数量
        const baseHarvesters = room.controller.level < 3 ? 3 : 2;
        const desiredBuilders = room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 2 : 1;
        const desiredRepairers = room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.8 && 
                     (s.structureType !== STRUCTURE_WALL || s.hits < 10000) && 
                     (s.structureType !== STRUCTURE_RAMPART || s.hits < 10000)
        }).length > 0 ? 2 : 1;
        // 每个能量源分配一个矿工
        const desiredMiners = room.controller.level >= 2 ? room.find(FIND_SOURCES).length : 0;
        
        // 检查是否有掉落资源或墓碑来决定是否需要收集者
        const droppedResources = room.find(FIND_DROPPED_RESOURCES);
        const tombstones = room.find(FIND_TOMBSTONES, { 
            filter: tomb => tomb.store.getUsedCapacity() > 0 
        });
        const ruins = room.find(FIND_RUINS, { 
            filter: ruin => ruin.store.getUsedCapacity() > 0 
        });
        
        // 如果有掉落资源、墓碑或废墟，则需要收集者
        const desiredCollectors = (droppedResources.length > 0 || tombstones.length > 0 || ruins.length > 0) ? 1 : 0;

        // 优化后的身体部件模板
        const bodyTemplates = {
            // 采集者：增强运输能力，适合RCL4
            harvester: {
                base: [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
                pattern: [CARRY, CARRY, MOVE],
                maxPatternRepeats: 3
            },
            // 工人：平衡建造和升级能力，增加WORK部件
            worker: {
                base: [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
                pattern: [WORK, CARRY, MOVE],
                maxPatternRepeats: 3
            },
            // 修理者：增加WORK和CARRY部件，提高修理效率
            repairer: {
                base: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
                pattern: [WORK, CARRY, CARRY, MOVE, MOVE],
                maxPatternRepeats: 2
            },
            // 矿工：专注于采集，固定5个WORK部件，增加移动速度
            miner: {
                base: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
                pattern: [],
                maxPatternRepeats: 0
            },
            // 升级者：专注于升级控制器
            upgrader: {
                base: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE],
                pattern: [WORK, CARRY, MOVE],
                maxPatternRepeats: 3
            },
        };

        // 根据可用能量生成最优身体部件
        const generateOptimalBody = (role) => {
            const energyAvailable = room.energyAvailable;
            const energyCapacity = room.energyCapacityAvailable;

            // 选择合适的模板
            let template;
            if (role === 'miner') {
                template = bodyTemplates.miner;
            } else if (role === 'harvester') {
                template = bodyTemplates.harvester;
            } else if (role === 'repairer') {
                template = bodyTemplates.repairer;
            } else if (role === 'upgrader' && bodyTemplates.upgrader) {
                template = bodyTemplates.upgrader;
            } else {
                template = bodyTemplates.worker;
            }

            // 特殊处理矿工
            if (role === 'miner') {
                // 如果能量足够，直接返回固定的矿工身体
                if (energyAvailable >= _.sum(template.base.map(p => BODYPART_COST[p]))) {
                    return template.base;
                }
                // 否则降级为基础矿工
                else if (energyAvailable >= 300) {
                    return [WORK, WORK, MOVE];
                }
                return null;
            }

            // 其他角色的身体生成
            let body = [...template.base];
            const baseCost = _.sum(body.map(p => BODYPART_COST[p]));
            
            // 如果模板有pattern且能量足够
            if (template.pattern.length > 0) {
                const patternCost = _.sum(template.pattern.map(p => BODYPART_COST[p]));
                
                // 计算可以添加多少个pattern
                const maxRepeats = Math.min(
                    Math.floor((energyCapacity - baseCost) / patternCost),
                    template.maxPatternRepeats
                );

                // 添加pattern
                for (let i = 0; i < maxRepeats; i++) {
                    body.push(...template.pattern);
                }

                // 如果当前能量不足以生成完整身体，逐步缩减
                while (_.sum(body.map(p => BODYPART_COST[p])) > energyAvailable) {
                    if (body.length <= template.base.length) break;
                    
                    // 优先移除最后一个完整pattern
                    if (body.length >= template.base.length + template.pattern.length) {
                        body.splice(body.length - template.pattern.length, template.pattern.length);
                    } else {
                        // 如果不能完整移除pattern，则从后往前移除单个部件
                        const idx =
                            body.lastIndexOf(WORK) >= 0 ? body.lastIndexOf(WORK) :
                            body.lastIndexOf(CARRY) >= 0 ? body.lastIndexOf(CARRY) :
                            body.lastIndexOf(MOVE);
                        if (idx !== -1) body.splice(idx, 1);
                        else break;
                    }
                }
            }

            // 确保身体部件不超过50个
            if (body.length > 50) {
                body = body.slice(0, 50);
            }

            const finalCost = _.sum(body.map(p => BODYPART_COST[p]));
            
            // 确保基本功能完整
            const hasBasicParts = role === 'miner' 
                ? body.includes(WORK) && body.includes(MOVE)
                : body.includes(WORK) && body.includes(CARRY) && body.includes(MOVE);

            return (finalCost <= energyAvailable && hasBasicParts) ? body : null;
        };

        // 生成creep
        const spawnRole = (role) => {
            const body = generateOptimalBody(role);
            if (!body) {
                console.log(`⚠️ 无法为角色生成有效身体: ${role}`);
                return false;
            }
            
            // 计算身体部件统计
            const stats = body.reduce((acc, part) => {
                acc[part] = (acc[part] || 0) + 1;
                return acc;
            }, {});
            
            const result = spawn.spawnCreep(
                body,
                `${role[0].toUpperCase()}${role.slice(1)}_${Game.time}`,
                { memory: { role } }
            );
            
            if (result === OK) {
                console.log(`🛠️ 正在生成 ${role}: ${JSON.stringify(stats)} (总成本: ${_.sum(body.map(p => BODYPART_COST[p]))})`);
                return true;
            }
            console.log(`⚠️ 生成 ${role} 失败: ${result}`);
            return false;
        };

        // 应急逻辑：最低成本 fallback（只在没有 harvester 时触发）
        if (harvesters.length < 1) {
            const energy = room.energyAvailable;
            const emergencyBody = energy >= 350
                ? [WORK, WORK, CARRY, MOVE, MOVE]
                : energy >= 200
                    ? [WORK, CARRY, MOVE]
                    : null;

            if (emergencyBody) {
                const result = spawn.spawnCreep(
                    emergencyBody,
                    `EmergencyHarvester_${Game.time}`,
                    { memory: { role: 'harvester', emergency: true } }
                );
                if (result === OK) {
                    console.log(`🚨 紧急采集者已生成!`);
                } else {
                    console.log(`❌ 紧急生成失败: ${result}, 能量: ${energy}/${room.energyCapacityAvailable}`);
                }
            } else {
                console.log(`🚫 能量不足 (${energy}) 无法生成紧急采集者.`);
            }
            return;
        }

        // 生成优先级
        const spawnPriority = [
            { condition: harvesters.length < baseHarvesters, role: 'harvester' },
            { condition: collectors.length < desiredCollectors, role: 'collector' },
            { condition: upgraders.length < 2, role: 'upgrader' },
            { condition: builders.length < desiredBuilders, role: 'builder' },
            { condition: repairers.length < desiredRepairers, role: 'repairer' },
            { condition: miners.length < desiredMiners, role: 'miner' }
        ];

        // 添加调试信息
        console.log(`房间 ${room.name} 能量: ${room.energyAvailable}/${room.energyCapacityAvailable}`);
        console.log(`当前 creep 数量: 采集者=${harvesters.length}/${baseHarvesters}, 收集者=${collectors.length}/${desiredCollectors}, 升级者=${upgraders.length}/2, 建造者=${builders.length}/${desiredBuilders}, 修理工=${repairers.length}/${desiredRepairers}, 矿工=${miners.length}/${desiredMiners}`);

        // 尝试按优先级生成creep
        let spawnAttempted = false;
        for (const { condition, role } of spawnPriority) {
            if (condition) {
                console.log(`尝试生成 ${role}...`);
                if (spawnRole(role)) {
                    spawnAttempted = true;
                    break;
                }
            }
        }

        // 如果没有尝试生成任何creep，输出调试信息
        if (!spawnAttempted) {
            console.log(`没有需要生成的creep，所有角色数量已满足需求`);
        }
    }
};

/**
 * 建筑管理模块
 * 负责自动规划和建造房间内的建筑
 */

var constructionManager$1 = {
  /**
   * 运行建筑管理器
   * @param {Room} room - 要管理的房间
   */
  run(room) {
    // 检查是否有建筑工地需要创建
    this.checkConstructionSites(room);
    
    // 规划新的建筑
    this.planBuildings(room);
  },

  /**
   * 检查现有的建筑工地
   * @param {Room} room - 要检查的房间
   */
  checkConstructionSites(room) {
    // 获取房间中所有的建筑工地
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    
    // 如果建筑工地数量达到上限，则不再创建新的
    if (sites.length >= 10) { // 游戏限制每个房间最多10个建筑工地
      return;
    }
  },

  /**
   * 规划新的建筑
   * @param {Room} room - 要规划的房间
   */
  planBuildings(room) {
    // 只有当房间控制器存在且被我们控制时才规划建筑
    if (!room.controller || !room.controller.my) {
      return;
    }

    // 根据控制器等级规划不同的建筑
    const level = room.controller.level;
    
    // 检查并建造扩展
    this.planExtensions(room, level);
    
    // 检查并建造塔
    this.planTowers(room, level);
    
    // 检查并建造存储和链接
    if (level >= 4) {
      this.planStorage(room);
    }
    
    // 高级建筑
    if (level >= 6) {
      this.planTerminal(room);
      this.planLabs(room);
    }
  },

  /**
   * 规划扩展
   * @param {Room} room - 要规划的房间
   * @param {number} level - 控制器等级
   */
  planExtensions(room, level) {
    // 根据控制器等级确定可以建造的扩展数量
    const maxExtensions = {
      1: 0,
      2: 5,
      3: 10,
      4: 20,
      5: 30,
      6: 40,
      7: 50,
      8: 60
    }[level] || 0;
    
    // 获取当前已有的扩展数量
    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    });
    
    // 如果已有的扩展数量达到上限，则不再建造
    if (extensions.length >= maxExtensions) {
      return;
    }
    
    // 寻找合适的位置建造扩展
    // 这里使用简单的策略：在出生点周围寻找空地
    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length === 0) {
      return;
    }
    
    const spawn = spawns[0];
    const terrain = room.getTerrain();
    
    // 在出生点周围的区域寻找空地
    for (let x = spawn.pos.x - 5; x <= spawn.pos.x + 5; x++) {
      for (let y = spawn.pos.y - 5; y <= spawn.pos.y + 5; y++) {
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
          // 创建新的扩展建筑工地
          const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
          if (result === OK) {
            // 每次只创建一个，避免一次创建太多
            return;
          }
        }
      }
    }
  },

  /**
   * 规划防御塔
   * @param {Room} room - 要规划的房间
   * @param {number} level - 控制器等级
   */
  planTowers(room, level) {
    // 根据控制器等级确定可以建造的塔数量
    const maxTowers = {
      1: 0,
      2: 0,
      3: 1,
      4: 1,
      5: 2,
      6: 2,
      7: 3,
      8: 6
    }[level] || 0;
    
    // 获取当前已有的塔数量
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });
    
    // 如果已有的塔数量达到上限，则不再建造
    if (towers.length >= maxTowers) {
      return;
    }
    
    // 寻找合适的位置建造塔
    // 策略：在房间中心区域建造，便于覆盖整个房间
    const center = this.getRoomCenter(room);
    
    // 在中心点周围寻找空地
    for (let radius = 2; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // 只考虑半径为radius的圆周上的点
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          
          const x = center.x + dx;
          const y = center.y + dy;
          
          // 检查位置是否在房间边界内
          if (x < 1 || x > 48 || y < 1 || y > 48) {
            continue;
          }
          
          // 检查地形是否可通行
          const terrain = room.getTerrain();
          if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
            continue;
          }
          
          // 检查位置是否已有建筑或建筑工地
          const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
          const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
          
          if (structures.length === 0 && constructionSites.length === 0) {
            // 创建新的塔建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_TOWER);
            if (result === OK) {
              return;
            }
          }
        }
      }
    }
  },

  /**
   * 规划存储
   * @param {Room} room - 要规划的房间
   */
  planStorage(room) {
    // 检查是否已有存储
    const storage = room.storage;
    if (storage) {
      return;
    }
    
    // 检查是否已有存储建筑工地
    const storageSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: { structureType: STRUCTURE_STORAGE }
    });
    
    if (storageSites.length > 0) {
      return;
    }
    
    // 在房间中心附近寻找合适的位置建造存储
    const center = this.getRoomCenter(room);
    const terrain = room.getTerrain();
    
    for (let radius = 3; radius <= 6; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          
          const x = center.x + dx;
          const y = center.y + dy;
          
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
            // 创建新的存储建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_STORAGE);
            if (result === OK) {
              return;
            }
          }
        }
      }
    }
  },

  /**
   * 规划终端
   * @param {Room} room - 要规划的房间
   */
  planTerminal(room) {
    // 检查是否已有终端
    const terminal = room.terminal;
    if (terminal) {
      return;
    }
    
    // 检查是否已有终端建筑工地
    const terminalSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: { structureType: STRUCTURE_TERMINAL }
    });
    
    if (terminalSites.length > 0) {
      return;
    }
    
    // 在存储附近寻找合适的位置建造终端
    if (!room.storage) {
      return;
    }
    
    const storage = room.storage;
    const terrain = room.getTerrain();
    
    for (let radius = 2; radius <= 4; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          
          const x = storage.pos.x + dx;
          const y = storage.pos.y + dy;
          
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
            // 创建新的终端建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_TERMINAL);
            if (result === OK) {
              return;
            }
          }
        }
      }
    }
  },

  /**
   * 规划实验室
   * @param {Room} room - 要规划的房间
   */
  planLabs(room) {
    // 根据控制器等级确定可以建造的实验室数量
    const maxLabs = {
      6: 3,
      7: 6,
      8: 10
    }[room.controller.level] || 0;
    
    // 获取当前已有的实验室数量
    const labs = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_LAB }
    });
    
    // 如果已有的实验室数量达到上限，则不再建造
    if (labs.length >= maxLabs) {
      return;
    }
    
    // 检查是否已有实验室建筑工地
    const labSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: { structureType: STRUCTURE_LAB }
    });
    
    // 计算总数
    if (labs.length + labSites.length >= maxLabs) {
      return;
    }
    
    // 在房间的一角寻找合适的位置建造实验室集群
    // 实验室应该靠近放置在一起，以便于反应
    const terrain = room.getTerrain();
    
    // 如果没有实验室，先确定一个起始位置
    if (labs.length === 0 && labSites.length === 0) {
      // 选择房间的一角
      const corners = [
        {x: 10, y: 10},
        {x: 10, y: 40},
        {x: 40, y: 10},
        {x: 40, y: 40}
      ];
      
      // 选择最适合的角落
      for (const corner of corners) {
        // 检查3x3区域是否适合建造实验室集群
        let suitable = true;
        
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const x = corner.x + dx;
            const y = corner.y + dy;
            
            // 检查位置是否在房间边界内
            if (x < 1 || x > 48 || y < 1 || y > 48) {
              suitable = false;
              break;
            }
            
            // 检查地形是否可通行
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
              suitable = false;
              break;
            }
            
            // 检查位置是否已有建筑
            const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
            if (structures.length > 0) {
              suitable = false;
              break;
            }
          }
          
          if (!suitable) {
            break;
          }
        }
        
        if (suitable) {
          // 在中心位置建造第一个实验室
          const result = room.createConstructionSite(corner.x, corner.y, STRUCTURE_LAB);
          if (result === OK) {
            return;
          }
        }
      }
    } else {
      // 已有实验室，在周围继续建造
      const existingLab = labs.length > 0 ? labs[0] : labSites[0];
      const centerX = existingLab.pos.x;
      const centerY = existingLab.pos.y;
      
      // 在周围寻找空位
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          // 跳过中心点
          if (dx === 0 && dy === 0) {
            continue;
          }
          
          const x = centerX + dx;
          const y = centerY + dy;
          
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
            // 创建新的实验室建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_LAB);
            if (result === OK) {
              return;
            }
          }
        }
      }
    }
  },

  /**
   * 获取房间中心位置
   * @param {Room} room - 房间
   * @returns {Object} 中心坐标
   */
  getRoomCenter(room) {
    // 获取所有我的建筑
    const myStructures = room.find(FIND_MY_STRUCTURES);
    
    // 如果没有建筑，使用第一个出生点作为中心
    if (myStructures.length === 0) {
      const spawns = room.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) {
        return {x: spawns[0].pos.x, y: spawns[0].pos.y};
      }
      // 如果没有出生点，使用房间几何中心
      return {x: 25, y: 25};
    }
    
    // 计算所有建筑的平均位置
    let sumX = 0;
    let sumY = 0;
    
    for (const structure of myStructures) {
      sumX += structure.pos.x;
      sumY += structure.pos.y;
    }
    
    return {
      x: Math.round(sumX / myStructures.length),
      y: Math.round(sumY / myStructures.length)
    };
  }
};

const creepManager = creepManager$1;
const towerManager = towerManager$1;
const defenseManager = defenseManager$1;
const spawnManager = spawnManager$1;
const constructionManager = constructionManager$1;

// 房间管理器
const roomManager$1 = {
  /**
   * 运行房间管理器
   * @param {Room} room - 要管理的房间
   * @param {string} mode - 运行模式（normal, emergency, expansion）
   */
  run: function(room, mode = 'normal') {
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
   * 更新房间状态信息
   * @param {Room} room - 要更新的房间
   */
  updateRoomStatus: function(room) {
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
  executeRoomStrategy: function(room, mode) {
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
  runSubsystems: function(room, mode) {
    // 调用各个子系统，传入当前模式
    defenseManager.run(room, mode);
    constructionManager.run(room);
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
  manageSpawns: function(room, mode) {
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
  getPriorityByMode: function(room, mode) {
    // 根据不同模式返回不同的优先级配置
    switch(mode) {
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
      execute: function(room) {
        console.log(`房间 ${room.name} 正在执行正常模式管理`);
        // 平衡发展策略
        // 确保基础设施完善
        room.memory.buildPriority = ['extension', 'container', 'storage', 'tower'];
      }
    },
    
    // 紧急模式策略
    emergency: {
      execute: function(room) {
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
      execute: function(room) {
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
const configManager = configManager_1;
const consoleCommands = consoleCommands$1;

// 加载控制台命令
consoleCommands();

var loop = main.loop = function () {
  tryCatch(() => {
    if (Game.creeps['Claimer1'].room.name !== 'W27N45') {     const exitDir = Game.creeps['Claimer1'].room.findExitTo('W28N44');     const exit = Game.creeps['Claimer1'].pos.findClosestByRange(exitDir);     Game.creeps['Claimer1'].moveTo(exit); } else {     const controller = Game.creeps['Claimer1'].room.controller;     if (controller && Game.creeps['Claimer1'].claimController(controller) === ERR_NOT_IN_RANGE) {         Game.creeps['Claimer1'].moveTo(controller);     } }
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

exports.default = main;
exports.loop = loop;
