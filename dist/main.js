'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
            if (creep.room.name !== room.name) continue;

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

var structureManager$1 = {
  run(room) {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });

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
      // 1. 攻击敌人（优先目标）
      const hostilesInRange = tower.pos.findInRange(FIND_HOSTILE_CREEPS, 25);
      if (hostilesInRange.length > 0) {
        // 改进墙体穿透检测逻辑
        const attackTarget = tower.pos.findClosestByRange(hostilesInRange.filter(c => {
          // 只检查是否有墙，而不是任何结构
          const structures = c.pos.lookFor(LOOK_STRUCTURES);
          return !structures.some(s => s.structureType === STRUCTURE_WALL);
        }));
        
        if (attackTarget) {
          tower.attack(attackTarget);
          continue;
        }
      }
      if (primaryTarget) {
        tower.attack(primaryTarget);
        continue; // 如果有主要目标，优先攻击，不执行其他操作
      }

      // 2. 治疗受伤的友方 creep
      const injuredCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: c => c.hits < c.hitsMax
      });
      if (injuredCreep) {
        tower.heal(injuredCreep);
        continue; // 如果有受伤的 creep，优先治疗，不执行修复
      }

      // 3. 修复重要建筑
      // 只有当能量超过 50% 时才修复建筑，保留能量应对攻击
      if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
        // 优先修复重要建筑：容器、道路、防御墙和城墙
        const criticalStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: s =>
            ((s.structureType === STRUCTURE_CONTAINER ||
              s.structureType === STRUCTURE_ROAD) &&
             s.hits < s.hitsMax * 0.5) || // 容器和道路低于 50% 时修复
            ((s.structureType === STRUCTURE_RAMPART ||
              s.structureType === STRUCTURE_WALL) &&
             s.hits < 300000) // 防御墙和城墙低于 200000 时修复 (这个值可以根据您的基地情况调整)
        });

        if (criticalStructure) {
          tower.repair(criticalStructure);
        }
      }
    }
  },
};

var defenseManager$1 = {
  run(room) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
       // 提取敌人用户名（去重）
       const hostileUsers = [...new Set(hostiles.map(c => c.owner.username))];

       // 发送通知，包括敌人数量和用户名
       Game.notify(`⚠️ 警告：检测到 ${hostiles.length} 个敌对 creep 入侵房间 ${room.name}，入侵者：${hostileUsers.join(', ')}`); 
      
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

        // 优化后的身体部件模板
        const bodyTemplates = {
            // 采集者：平衡采集和运输能力
            harvester: {
                base: [WORK, CARRY, MOVE],
                pattern: [WORK, CARRY, CARRY, MOVE, MOVE],
                maxPatternRepeats: 2
            },
            // 工人：平衡建造和升级能力
            worker: {
                base: [WORK, CARRY, MOVE],
                pattern: [WORK, CARRY, MOVE],
                maxPatternRepeats: 4
            },
            // 修理者：增加WORK部件，提高修理效率
            repairer: {
                base: [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
                pattern: [WORK, CARRY, CARRY, MOVE],
                maxPatternRepeats: 2
            },
            // 矿工：专注于采集，固定5个WORK部件
            miner: {
                base: [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE],
                pattern: [],
                maxPatternRepeats: 0
            }
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
                    console.log(`❌ 紧急生成失败: ${result}`);
                }
            } else {
                console.log(`🚫 能量不足 (${energy}) 无法生成紧急采集者.`);
            }
            return;
        }

        // 生成优先级
        const spawnPriority = [
            { condition: harvesters.length < baseHarvesters, role: 'harvester' },
            { condition: miners.length < desiredMiners, role: 'miner' },
            { condition: repairers.length < desiredRepairers, role: 'repairer' },
            { condition: builders.length < desiredBuilders, role: 'builder' },
            { condition: upgraders.length < 2, role: 'upgrader' }
        ];

        for (const { condition, role } of spawnPriority) {
            if (condition && spawnRole(role)) break;
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
const structureManager = structureManager$1;
const defenseManager = defenseManager$1;
const spawnManager = spawnManager$1;
const constructionManager = constructionManager$1;

var roomManager$1 = {
  run(room) {
    spawnManager.run(room);
    creepManager.run(room);
    structureManager.run(room);
    defenseManager.run(room);
    constructionManager.run(room);
  },
};

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
    // 每100个tick检查一次扩张机会
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

const roomManager = roomManager$1;
const memoryManager = memoryManager$1;
const cpuManager = cpuManager$1;
const { tryCatch } = errorCatcher;
const expansionManager = expansionManager$1;

var loop = main.loop = function () {
  tryCatch(() => {
    memoryManager.run();

    // 调用扩张管理器
    expansionManager.run(Game);

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      roomManager.run(room);
    }

    cpuManager.run();
  });
};

exports.default = main;
exports.loop = loop;
