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

var spawnManager$1 = {
    run(room) {
        const getCreepsByRole = (role) =>
            room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === role });

        const harvesters = getCreepsByRole('harvester');
        const builders = getCreepsByRole('builder');
        const upgraders = getCreepsByRole('upgrader');
        const repairers = getCreepsByRole('repairer');
        const miners = getCreepsByRole('miner');
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
            { condition: miners.length < desiredMiners, role: 'miner' },
            { condition: repairers.length < desiredRepairers, role: 'repairer' },
            { condition: builders.length < desiredBuilders, role: 'builder' },
            { condition: upgraders.length < 2, role: 'upgrader' }
        ];

        // 添加调试信息
        console.log(`房间 ${room.name} 能量: ${room.energyAvailable}/${room.energyCapacityAvailable}`);
        console.log(`当前 creep 数量: 采集者=${harvesters.length}/${baseHarvesters}, 矿工=${miners.length}/${desiredMiners}, 修理工=${repairers.length}/${desiredRepairers}, 建造者=${builders.length}/${desiredBuilders}, 升级者=${upgraders.length}/2`);

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

const spawnManager = spawnManager$1;

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
    // 调用 spawnManager 来处理 creep 的生产
    spawnManager.run(room);
    
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
      // 暂时屏蔽扩张管理器调用
      // expansionManager.run(Game);
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
