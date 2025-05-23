'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var main = {};

var role_harvester = {
    run(creep) {
        // 检查房间是否处于攻击状态
        if (creep.room.memory.underAttack) {
            // 寻找最近的塔来提供能量
            const tower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });

            // 如果有塔并且背包有能量，优先给塔充能
            if (tower && creep.store[RESOURCE_ENERGY] > 0) {
                if (creep.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(tower, {visualizePathStyle: {stroke: '#ff0000'}});
                }
                return;
            }

            // 如果没有塔或没有能量，撤退到最近的出生点
            const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                creep.moveTo(spawn, {visualizePathStyle: {stroke: '#ff0000'}});
                creep.say('🚨 撤退!');
                return;
            }
        }

        // 优化工作状态切换逻辑
        // 1. 当采集状态且能量达到80%以上时切换到运输模式
        // 2. 当运输状态且能量低于20%时切换到采集模式
        // 3. 当能量源耗尽且背包有能量时切换到运输模式
        // 4. 当所有Extension和Spawn都满了，优先考虑其他目标
        const capacityThreshold = creep.store.getCapacity() * 0.8;
        const emptyThreshold = creep.store.getCapacity() * 0.2;
        
        if (creep.memory.harvesting && creep.store.getUsedCapacity(RESOURCE_ENERGY) >= capacityThreshold) {
            creep.memory.harvesting = false;
            creep.say('🚚 运输');
            // 提前规划运输目标
            creep.memory.targetId = this.findEnergyTarget(creep);
        }
        if (!creep.memory.harvesting && creep.store.getUsedCapacity(RESOURCE_ENERGY) <= emptyThreshold) {
            creep.memory.harvesting = true;
            creep.say('🔄 采集');
            // 重新选择能量源
            delete creep.memory.sourceId;
            delete creep.memory.cachedPath;
            delete creep.memory.targetId;
        }

        // 自动清理无效内存
        if (creep.memory.sourceId && !Game.getObjectById(creep.memory.sourceId)) {
            delete creep.memory.sourceId;
            delete creep.memory.cachedPath;
        }
        if (creep.memory.targetId && !Game.getObjectById(creep.memory.targetId)) {
            delete creep.memory.targetId;
        }

        // 采集模式
        if (creep.memory.harvesting) {
            // 尝试重新绑定 source
            if (!creep.memory.sourceId) {
                // 使用FIND_SOURCES而不是FIND_SOURCES_ACTIVE
                const sources = creep.room.find(FIND_SOURCES);

                // 找到当前分配harvester最少的能量源
                const sourceAssignments = {};

                // 初始化每个能量源的harvester数量为0
                for (const source of sources) {
                    sourceAssignments[source.id] = 0;
                }

                // 统计每个能量源的harvester数量
                for (const name in Game.creeps) {
                    const otherCreep = Game.creeps[name];
                    if (otherCreep.memory.role === 'harvester' && otherCreep.memory.sourceId) {
                        sourceAssignments[otherCreep.memory.sourceId] =
                            (sourceAssignments[otherCreep.memory.sourceId] || 0) + 1;
                    }
                }

                // 找到分配harvester最少的能量源
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
                } else {
                    // 如果找不到能量源，moveTo 控制器附近等待
                    if (creep.room.controller) {
                        creep.moveTo(creep.room.controller);
                    }
                    return;
                }
            }

            const source = Game.getObjectById(creep.memory.sourceId);

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
                // 如果容器能量不多但已经获取了一些能量，考虑提前切换到运输模式
                if (container.store[RESOURCE_ENERGY] < 50 && creep.store.getUsedCapacity(RESOURCE_ENERGY) > emptyThreshold) {
                    creep.memory.harvesting = false;
                    creep.say('🚚 运输');
                    creep.memory.targetId = this.findEnergyTarget(creep);
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
                } else if (harvestResult === ERR_NOT_ENOUGH_RESOURCES) {
                    // 如果能量源已空但背包有能量，切换到运输模式
                    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > emptyThreshold) {
                        creep.memory.harvesting = false;
                        creep.say('🚚 运输');
                        creep.memory.targetId = this.findEnergyTarget(creep);
                    } else {
                        // 如果背包能量太少，寻找新的能量源
                        delete creep.memory.sourceId;
                        delete creep.memory.cachedPath;
                    }
                }
            }
        } else {
            // 能量运输逻辑
            let target;
            
            // 如果已经有目标ID，直接使用
            if (creep.memory.targetId) {
                target = Game.getObjectById(creep.memory.targetId);
                // 如果目标不再需要能量，清除目标
                if (target && target.structureType !== STRUCTURE_CONTROLLER && 
                    target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    delete creep.memory.targetId;
                    target = null;
                }
            }
            
            // 如果没有有效目标，重新寻找
            if (!target) {
                target = this.findEnergyTarget(creep);
                if (target) {
                    creep.memory.targetId = target.id;
                }
            }

            // 如果仍然没有目标，考虑切换回采集模式
            if (!target && creep.store.getUsedCapacity(RESOURCE_ENERGY) <= capacityThreshold) {
                creep.memory.harvesting = true;
                creep.say('🔄 采集');
                delete creep.memory.targetId;
                return;
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
    
    // 寻找需要能量的目标
    findEnergyTarget(creep) {
        // 检查房间能量状态
        const roomEnergySufficient = this.isRoomEnergySufficient(creep.room);
        
        // 如果房间能量充足（所有Extension和Spawn都满了），调整优先级
        if (roomEnergySufficient) {
            // 优先级调整为：tower > storage > 升级控制器 > container
            let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            if (!target) {
                // 检查是否有storage并且未满
                target = creep.room.storage &&
                    creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ?
                    creep.room.storage : null;
            }
            
            // 如果没有tower和storage需要能量，考虑升级控制器
            if (!target && creep.room.controller) {
                // 检查控制器是否接近降级
                const needsUrgentUpgrade = creep.room.controller.ticksToDowngrade < 10000;
                
                if (needsUrgentUpgrade || Math.random() < 0.7) { // 70%概率选择升级控制器
                    target = creep.room.controller;
                }
            }
            
            // 如果不升级控制器，考虑container
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s =>
                        s.structureType === STRUCTURE_CONTAINER &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }
            
            // 如果还是没有目标，默认选择控制器
            if (!target && creep.room.controller) {
                target = creep.room.controller;
            }
            
            return target;
        } else {
            // 房间能量不足，使用原来的优先级
            // 优先级：spawn/extension > tower > storage > container > controller
            let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_EXTENSION ||
                        s.structureType === STRUCTURE_SPAWN) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_TOWER &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            if (!target) {
                target = creep.room.storage &&
                    creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ?
                    creep.room.storage : null;
            }
            
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s =>
                        s.structureType === STRUCTURE_CONTAINER &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            if (!target && creep.room.controller) {
                target = creep.room.controller;
            }
            
            return target;
        }
    },
    
    // 检查房间能量是否充足（所有Extension和Spawn都满了）
    isRoomEnergySufficient(room) {
        // 获取所有的Extension和Spawn
        const energyStructures = room.find(FIND_STRUCTURES, {
            filter: s => 
                (s.structureType === STRUCTURE_EXTENSION || 
                 s.structureType === STRUCTURE_SPAWN) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        // 如果没有找到需要能量的Extension或Spawn，说明都已经满了
        return energyStructures.length === 0;
    }
};

var role_builder = {
  run(creep) {
    // 检查房间是否处于攻击状态
    if (creep.room.memory.underAttack) {
      // 如果有能量，优先修复防御建筑
      if (creep.store[RESOURCE_ENERGY] > 0) {
        // 优先修复防御塔
        const damagedTower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_TOWER && s.hits < s.hitsMax
        });

        if (damagedTower) {
          if (creep.repair(damagedTower) === ERR_NOT_IN_RANGE) {
            creep.moveTo(damagedTower, { visualizePathStyle: { stroke: '#ff0000' } });
          }
          return;
        }

        // 其次修复墙和城墙
        const barrier = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => (s.structureType === STRUCTURE_WALL ||
            s.structureType === STRUCTURE_RAMPART) &&
            s.hits < 10000
        });

        if (barrier) {
          if (creep.repair(barrier) === ERR_NOT_IN_RANGE) {
            creep.moveTo(barrier, { visualizePathStyle: { stroke: '#ff0000' } });
          }
          return;
        }
      }

      // 如果没有能量或没有需要修复的建筑，撤退到出生点
      const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
      if (spawn && creep.pos.getRangeTo(spawn) > 3) {
        creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
        creep.say('🚨 撤退!');
        return;
      }
    }

    // 如果目前不在W27N45就前往
    // if (creep.room.name !== 'W27N45') {
    //   const targetRoom = new RoomPosition(27, 45, 'W27N45');
    //   creep.moveTo(targetRoom, {visualizePathStyle: {stroke: '#ffffff'}});
    //   return;
    // }
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
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      } else {
        // 如果没有工地，默认去升级控制器，避免浪费
        const controller = creep.room.controller;
        if (controller) {
          if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
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
          creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' } });
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
          creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
          return;
        }
      }

      // 最后从能量源直接采集
      const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    }
  },
};

var role_upgrader = {
  run(creep) {
    // 检查房间是否处于攻击状态
    if (creep.room.memory.underAttack) {
      // 在受到攻击时，升级者应该撤退到安全区域
      const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
      if (spawn && creep.pos.getRangeTo(spawn) > 3) {
        safeMoveTo(creep, spawn, { visualizePathStyle: { stroke: '#ff0000' } });
        creep.say('🚨 撤退!');
        return;
      }
    }

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
          safeMoveTo(creep, controller, {
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
          safeMoveTo(creep, container, {
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
            safeMoveTo(creep, droppedEnergy, {
              visualizePathStyle: { stroke: '#ffaa00' },
              reusePath: 3
            });
          }
        } else {
          // 最后从能量源直接采集
          const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
          if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
              safeMoveTo(creep, source, {
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

function safeMoveTo(creep, target, opts = {}) {
  return creep.moveTo(target, {
    visualizePathStyle: { stroke: '#ffaa00' },
    reusePath: 3,
    ...opts,
    costCallback: (roomName, costMatrix) => {
      const room = Game.rooms[roomName];
      if (!room) return;

      const matrix = costMatrix.clone();

      // 禁用四条边缘
      for (let x = 0; x < 50; x++) {
        matrix.set(x, 0, 255);
        matrix.set(x, 49, 255);
      }
      for (let y = 0; y < 50; y++) {
        matrix.set(0, y, 255);
        matrix.set(49, y, 255);
      }

      return matrix;
    }
  });
}

var role_repairer = {
    run(creep) {
        // 检查房间是否处于攻击状态
        if (creep.room.memory.underAttack) {
            // 如果有能量，优先修复防御建筑
            if (creep.store[RESOURCE_ENERGY] > 0) {
                // 优先修复防御塔
                const damagedTower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_TOWER && s.hits < s.hitsMax
                });

                if (damagedTower) {
                    if (creep.repair(damagedTower) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(damagedTower, { visualizePathStyle: { stroke: '#ff0000' } });
                    }
                    return;
                }

                // 其次修复墙和城墙
                const barrier = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_WALL ||
                        s.structureType === STRUCTURE_RAMPART) &&
                        s.hits < 10000
                });

                if (barrier) {
                    if (creep.repair(barrier) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(barrier, { visualizePathStyle: { stroke: '#ff0000' } });
                    }
                    return;
                }
            }
        }

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
    }
};

var role_miner = {
    run(creep) {
        // 检查房间是否处于攻击状态
        if (creep.room.memory.underAttack) {
            // 矿工在受到攻击时应该继续工作，但如果生命值低于50%则撤退
            if (creep.hits < creep.hitsMax * 0.5) {
                const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
                if (spawn) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
                    creep.say('🚨 受伤撤退!');
                    return;
                }
            }
        }

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

            // 只有当矿工数量为0时才分配新矿工到这个能源
            if (minAssignedSource && minAssignedCount === 0) {
                creep.memory.sourceId = minAssignedSource;
                const source = Game.getObjectById(minAssignedSource);
                const path = creep.pos.findPathTo(source, {
                    serialize: true,
                    ignoreCreeps: true
                });
                creep.memory.cachedPath = path;
                console.log(`矿工 ${creep.name} 被分配到能量源 ${minAssignedSource}`);
            } else if (minAssignedSource && minAssignedCount > 0) {
                // 如果所有能源都已有矿工，检查是否有即将死亡的矿工
                let replacementFound = false;
                for (const name in Game.creeps) {
                    const otherCreep = Game.creeps[name];
                    if (otherCreep.memory.role === 'miner' &&
                        otherCreep.memory.sourceId &&
                        otherCreep.ticksToLive < 150) { // 如果矿工剩余寿命不足150tick
                        creep.memory.sourceId = otherCreep.memory.sourceId;
                        creep.memory.replacingMiner = otherCreep.name;
                        const source = Game.getObjectById(otherCreep.memory.sourceId);
                        const path = creep.pos.findPathTo(source, {
                            serialize: true,
                            ignoreCreeps: true
                        });
                        creep.memory.cachedPath = path;
                        console.log(`矿工 ${creep.name} 将替换即将死亡的矿工 ${otherCreep.name}`);
                        replacementFound = true;
                        break;
                    }
                }

                // 如果没有找到需要替换的矿工，则选择矿工最少的能源
                if (!replacementFound) {
                    creep.memory.sourceId = minAssignedSource;
                    const source = Game.getObjectById(minAssignedSource);
                    const path = creep.pos.findPathTo(source, {
                        serialize: true,
                        ignoreCreeps: true
                    });
                    creep.memory.cachedPath = path;
                    console.log(`矿工 ${creep.name} 被分配到已有矿工的能量源 ${minAssignedSource}`);
                }
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
            // 检查是否有其他矿工已经绑定了这个能源附近的容器
            let containerAlreadyAssigned = false;
            let nearestContainer = null;

            // 查找附近的容器
            const containers = creep.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });

            if (containers.length > 0) {
                nearestContainer = containers[0];

                // 检查这个容器是否已被其他矿工绑定
                for (const name in Game.creeps) {
                    const otherCreep = Game.creeps[name];
                    if (otherCreep.id !== creep.id &&
                        otherCreep.memory.role === 'miner' &&
                        otherCreep.memory.containerId === nearestContainer.id) {
                        containerAlreadyAssigned = true;
                        break;
                    }
                }

                // 如果容器未被绑定，则绑定它
                if (!containerAlreadyAssigned) {
                    creep.memory.containerId = nearestContainer.id;
                    console.log(`矿工 ${creep.name} 绑定到容器 ${nearestContainer.id}`);
                }
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
    }
};

var role_collector = {
  run(creep) {
    const withdrawOrMove = (target, resourceType, say) => {
      if (creep.withdraw(target, resourceType) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      if (say) creep.say(say);
    };

    const pickupOrMove = (resource, say) => {
      if (creep.pickup(resource) === ERR_NOT_IN_RANGE) {
        creep.moveTo(resource, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      if (say) creep.say(say);
    };

    // 🚨 战时策略：优先支援塔、防止浪费资源
    if (creep.room.memory.underAttack) {
      if (creep.store[RESOURCE_ENERGY] > 0) {
        const tower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_TOWER &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (tower) {
          if (creep.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(tower, { visualizePathStyle: { stroke: '#ff0000' } });
          }
          return;
        }
      }

      const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
      if (dropped) return pickupOrMove(dropped);

      const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
      if (spawn && creep.pos.getRangeTo(spawn) > 3) {
        creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
        creep.say('🚨 撤退!');
        return;
      }
    }

    // 🎒 满载状态 -> 投递资源
    if (creep.store.getFreeCapacity() === 0) {

      let target = creep.room.storage;

      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => (s.structureType === STRUCTURE_EXTENSION ||
            s.structureType === STRUCTURE_SPAWN) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }

      if (target) {
        for (const resourceType in creep.store) {
          if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            break;
          }
        }
      }
      return;
    }

    // 📦 背包未满 -> 搜集资源
    // 优先非能量
    let dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType !== RESOURCE_ENERGY
    });

    if (!dropped) {
      dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
    }

    if (dropped) return pickupOrMove(dropped, '🧹 收集');

    const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
      filter: t => t.store && t.store.getUsedCapacity() > 0
    });

    if (tombstone) {
      for (const res in tombstone.store) {
        if (tombstone.store[res] > 0) {
          withdrawOrMove(tombstone, res, '💀 收集');
          return;
        }
      }
    }

    const ruin = creep.pos.findClosestByPath(FIND_RUINS, {
      filter: r => r.store && r.store.getUsedCapacity() > 0
    });

    if (ruin) {
      for (const res in ruin.store) {
        if (ruin.store[res] > 0) {
          withdrawOrMove(ruin, res, '🏚️ 收集');
          return;
        }
      }
    }
  }
};

var role_defender = {
    run(creep) {
        // 检查房间是否处于攻击状态
        if (!creep.room.memory.underAttack) {
            // 如果没有敌人，返回出生点附近待命
            const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                creep.moveTo(spawn);
            }
            return;
        }

        // 寻找最近的敌人
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length === 0) {
            // 没有敌人但房间仍标记为被攻击，可能是误报
            return;
        }

        // 优先攻击治疗单位
        const healers = hostiles.filter(c => 
            c.body.some(part => part.type === HEAL && part.hits > 0)
        );
        
        // 如果有治疗单位，优先攻击
        let target = null;
        if (healers.length > 0) {
            target = creep.pos.findClosestByPath(healers);
        } else {
            // 否则攻击最近的敌人
            target = creep.pos.findClosestByPath(hostiles);
        }

        // 执行攻击
        if (target) {
            // 检查敌人是否在攻击范围内
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { 
                    reusePath: 3
                });
            }
            
            // 如果生命值低于50%，撤退到出生点附近
            if (creep.hits < creep.hitsMax * 0.5) {
                const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
                if (spawn) {
                    creep.moveTo(spawn);
                }
            }
        }
    }
};

var role_transporter = {
  // 状态常量
  STATE: {
    COLLECTING: 'collecting',  // 收集能量
    DELIVERING: 'delivering'    // 运送能量
  },

  // 优先级常量
  PRIORITY: {
    EMERGENCY: 0,   // 紧急情况（战时、能量危机）
    SPAWN: 1,       // 出生点和扩展
    TOWER: 2,       // 防御塔
    LINK: 3,        // 能量链接
    STORAGE: 4,     // 存储
    CONTAINER: 5    // 容器
  },

  run(creep) {
    // 初始化状态
    if (!creep.memory.state) {
      creep.memory.state = this.STATE.COLLECTING;
    }

    // 战时策略：优先支援塔、撤退
    if (creep.room.memory.underAttack) {
      if (creep.store[RESOURCE_ENERGY] > 0) {
        const tower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_TOWER &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (tower) {
          if (creep.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(tower, { visualizePathStyle: { stroke: '#ff0000' } });
          }
          return;
        }
      }

      // 如果生命值低于50%则撤退
      if (creep.hits < creep.hitsMax * 0.5) {
        const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn && creep.pos.getRangeTo(spawn) > 3) {
          creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
          creep.say('🚨 撤退!');
          return;
        }
      }
    }

    // 状态切换逻辑
    if (creep.memory.state === this.STATE.COLLECTING && creep.store.getFreeCapacity() === 0) {
      creep.memory.state = this.STATE.DELIVERING;
      creep.say('🚚 运输');
      // 提前规划运输目标
      delete creep.memory.targetId;
    }
    if (creep.memory.state === this.STATE.DELIVERING && creep.store.getUsedCapacity() === 0) {
      creep.memory.state = this.STATE.COLLECTING;
      creep.say('🔄 收集');
      // 清除目标
      delete creep.memory.targetId;
      delete creep.memory.sourceId;
    }

    // 自动清理无效内存
    if (creep.memory.targetId && !Game.getObjectById(creep.memory.targetId)) {
      delete creep.memory.targetId;
    }
    if (creep.memory.sourceId && !Game.getObjectById(creep.memory.sourceId)) {
      delete creep.memory.sourceId;
    }

    // 根据状态执行相应行为
    if (creep.memory.state === this.STATE.COLLECTING) {
      this.collectEnergy(creep);
    } else {
      this.deliverEnergy(creep);
    }

    // 添加卡住检测
    this.checkStuck(creep);
  },

  // 收集能量
  collectEnergy(creep) {
    // 如果已经有目标，直接前往
    if (creep.memory.sourceId) {
      const source = Game.getObjectById(creep.memory.sourceId);
      if (source) {
        this.withdrawFromSource(creep, source);
        return;
      }
    }

    // 寻找能量来源，按优先级排序
    const sources = this.findEnergySources(creep);
    if (sources.length > 0) {
      creep.memory.sourceId = sources[0].id;
      this.withdrawFromSource(creep, sources[0]);
    } else {
      // 如果找不到能量源，移动到存储附近等待
      const storage = creep.room.storage;
      if (storage) {
        creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
      } else {
        // 如果没有存储，移动到控制器附近
        if (creep.room.controller) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    }
  },

  // 从能量源提取能量
  withdrawFromSource(creep, source) {
    let resourceType = RESOURCE_ENERGY;
    
    // 如果是容器、存储或废墟，可能有多种资源
    if (source.store) {
      // 优先提取非能量资源
      for (const resource in source.store) {
        if (resource !== RESOURCE_ENERGY && source.store[resource] > 0) {
          resourceType = resource;
          break;
        }
      }
      
      // 如果没有非能量资源或者只有能量，提取能量
      if (source.store[resourceType] > 0) {
        if (creep.withdraw(source, resourceType) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    } 
    // 如果是掉落的资源
    else if (source.resourceType) {
      if (creep.pickup(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
    }
  },

  // 寻找能量来源
  findEnergySources(creep) {
    const sources = [];
    
    // 1. 掉落的资源（优先非能量资源）
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
    if (droppedResources.length > 0) {
      // 优先非能量资源
      const nonEnergyResources = droppedResources.filter(r => r.resourceType !== RESOURCE_ENERGY);
      if (nonEnergyResources.length > 0) {
        sources.push(...nonEnergyResources);
      } else {
        sources.push(...droppedResources);
      }
    }
    
    // 2. 墓碑
    const tombstones = creep.room.find(FIND_TOMBSTONES, {
      filter: t => t.store && t.store.getUsedCapacity() > 0
    });
    sources.push(...tombstones);
    
    // 3. 废墟
    const ruins = creep.room.find(FIND_RUINS, {
      filter: r => r.store && r.store.getUsedCapacity() > 0
    });
    sources.push(...ruins);
    
    // 4. 矿工旁边的容器（优先考虑能量多的）
    const minerContainers = creep.room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER &&
               s.store[RESOURCE_ENERGY] > creep.store.getCapacity() * 0.5
    });
    
    // 按能量数量排序
    minerContainers.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
    sources.push(...minerContainers);
    
    // 5. 存储（如果存储中有足够能量）
    if (creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 1000) {
      sources.push(creep.room.storage);
    }
    
    // 6. Link（如果有）
    const links = creep.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_LINK &&
               s.store[RESOURCE_ENERGY] > 0
    });
    sources.push(...links);
    
    // 按距离排序
    return sources.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
  },

  // 运送能量
  deliverEnergy(creep) {
    // 如果已经有目标，直接前往
    if (creep.memory.targetId) {
      const target = Game.getObjectById(creep.memory.targetId);
      if (target) {
        this.transferToTarget(creep, target);
        return;
      }
    }

    // 寻找需要能量的目标
    const target = this.findEnergyTarget(creep);
    if (target) {
      creep.memory.targetId = target.id;
      this.transferToTarget(creep, target);
    } else {
      // 如果找不到目标，移动到存储附近等待
      const storage = creep.room.storage;
      if (storage) {
        if (creep.transfer(storage, Object.keys(creep.store)[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      } else {
        // 如果没有存储，移动到控制器附近
        if (creep.room.controller) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    }
  },

  // 向目标转移资源
  transferToTarget(creep, target) {
    // 如果是控制器，升级它
    if (target.structureType === STRUCTURE_CONTROLLER) {
      if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
      }
      return;
    }
    
    // 对于其他目标，转移资源
    for (const resourceType in creep.store) {
      if (creep.store[resourceType] > 0) {
        if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
          break;
        }
      }
    }
  },

  // 寻找需要能量的目标
  findEnergyTarget(creep) {
    // 检查房间能量状态
    const roomEnergySufficient = this.isRoomEnergySufficient(creep.room);
    
    // 紧急情况：房间能量不足
    if (!roomEnergySufficient) {
      // 优先级：spawn/extension > tower > link > storage > container
      const spawnsAndExtensions = creep.room.find(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      
      if (spawnsAndExtensions.length > 0) {
        return spawnsAndExtensions[0];
      }
      
      const towers = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                 s.store.getUsedCapacity(RESOURCE_ENERGY) < s.store.getCapacity(RESOURCE_ENERGY) * 0.7
      });
      
      if (towers.length > 0) {
        return towers[0];
      }
    } 
    // 正常情况：房间能量充足
    else {
      // 优先级：tower > link > storage > container
      
      // 1. 塔（保持在70%能量）
      const towers = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                 s.store.getUsedCapacity(RESOURCE_ENERGY) < s.store.getCapacity(RESOURCE_ENERGY) * 0.7
      });
      
      if (towers.length > 0) {
        return towers[0];
      }
      
      // 2. Link（如果有）
      const links = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LINK &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      
      if (links.length > 0) {
        // 优先填充接收Link
        const receiverLinks = links.filter(link => {
          // 这里可以添加判断接收Link的逻辑，例如通过memory标记
          return link.pos.getRangeTo(creep.room.controller) <= 5;
        });
        
        if (receiverLinks.length > 0) {
          return receiverLinks[0];
        }
      }
    }
    
    // 3. 存储
    if (creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
      return creep.room.storage;
    }
    
    // 4. 容器（非矿工容器）
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER &&
               s.store.getFreeCapacity() > 0 &&
               // 排除矿工旁边的容器
               !this.isNearSource(s, creep.room)
    });
    
    if (containers.length > 0) {
      return containers[0];
    }
    
    // 5. 如果没有其他目标，考虑升级控制器
    if (creep.room.controller && (!creep.room.storage || creep.room.storage.store[RESOURCE_ENERGY] > 10000)) {
      return creep.room.controller;
    }
    
    return null;
  },
  
  // 检查容器是否靠近能量源（矿工容器）
  isNearSource(container, room) {
    const sources = room.find(FIND_SOURCES);
    for (const source of sources) {
      if (container.pos.inRangeTo(source, 2)) {
        return true;
      }
    }
    return false;
  },
  
  // 检查房间能量是否充足（所有Extension和Spawn都满了）
  isRoomEnergySufficient(room) {
    const energyStructures = room.find(FIND_STRUCTURES, {
      filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
               s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    
    return energyStructures.length === 0;
  },
  
  // 检测并处理卡住情况
  checkStuck(creep) {
    if (creep.memory.lastPos &&
        creep.memory.lastPos.x === creep.pos.x &&
        creep.memory.lastPos.y === creep.pos.y) {
      creep.memory.stuckCount = (creep.memory.stuckCount || 0) + 1;
      
      // 如果卡住超过10个tick，尝试随机移动
      if (creep.memory.stuckCount > 10) {
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        creep.move(directions[Math.floor(Math.random() * directions.length)]);
        delete creep.memory.targetId; // 清除当前目标
        delete creep.memory.sourceId;
        creep.memory.stuckCount = 0;
        creep.say('🚧 卡住了!');
      }
    } else {
      creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
      creep.memory.stuckCount = 0;
    }
  }
};

const roleHarvester = role_harvester;
const roleBuilder = role_builder;
const roleUpgrader = role_upgrader;
const roleRepairer = role_repairer;
const roleMiner = role_miner;
const roleCollector = role_collector;
const roleDefender = role_defender;
const roleTransporter = role_transporter; // 添加运输者模块

var creepManager$1 = {
    run(room, mode = 'normal') {
        // 现在可以根据 mode 调整 creep 行为
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            
            switch (creep.memory.role) {
                case 'harvester':
                    roleHarvester.run(creep, mode);
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
                case 'defender':
                    roleDefender.run(creep, mode);
                    break;
                case 'transporter':
                    roleTransporter.run(creep, mode);
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
          const hostilesInRange = tower.pos.findInRange(hostiles, 20);
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
       
       // 只有当入侵者不全是 NPC 或入侵者数量大于1时才发送通知
       if (!isAllNPC || hostiles.length > 1) {
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
        const collectors = getCreepsByRole('collector');
        const defenders = getCreepsByRole('defender');
        const transporters = getCreepsByRole('transporter');

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) return;

        // 根据RCL和情况动态调整所需数量
        const baseHarvesters = 2;//room.controller.level < 3 ? 2 : 2;
        const desiredBuilders = room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 2 : 1;
        const desiredRepairers =  room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.8 &&
                (s.structureType !== STRUCTURE_WALL || s.hits < 10000) &&
                (s.structureType !== STRUCTURE_RAMPART || s.hits < 10000)
        }).length > 0 ? 1 : 1;
        
        const desiredMiners = room.controller.level >= 2 ? 2 : 0;

        // 检查是否有掉落资源或墓碑来决定是否需要收集者
        const droppedResources = room.find(FIND_DROPPED_RESOURCES);
        const tombstones = room.find(FIND_TOMBSTONES, {
            filter: tomb => tomb.store.getUsedCapacity() > 0
        });
        const ruins = room.find(FIND_RUINS, {
            filter: ruin => ruin.store.getUsedCapacity() > 0
        });
        const desiredDefenders = 2;
        // 如果有掉落资源、墓碑或废墟，则需要收集者
        const desiredCollectors = (droppedResources.length > 0 || tombstones.length > 0 || ruins.length > 0) ? 1 : 0;
        
        // 运输者数量：根据房间等级和矿工数量决定
        const desiredTransporters = 1;//room.controller.level >= 3 ? Math.min(miners.length, 2) : 0;

        // 优化后的身体部件模板 - 根据房间等级动态调整
        const bodyTemplates = {
            // 采集者：基础配置更轻量，适合低级房间
            harvester: {
                base: [WORK, CARRY, MOVE],
                pattern: [CARRY, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 4 : 2
            },
            // 工人：平衡建造和升级能力
            worker: {
                base: [WORK, CARRY, MOVE],
                pattern: [WORK, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 4 : 2
            },
            // 修理者：基础配置更轻量
            repairer: {
                base: [WORK, CARRY, MOVE, MOVE],
                pattern: [WORK, CARRY, CARRY, MOVE, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 2 : 1
            },
            // 矿工：根据房间等级调整
            miner: {
                base: room.controller.level >= 4 ? 
                    [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE] : 
                    [WORK, WORK, CARRY, MOVE],
                pattern: [],
                maxPatternRepeats: 0
            },
            // 升级者：基础配置更轻量
            upgrader: {
                base: [WORK, CARRY, MOVE],
                pattern: [WORK, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 4 : 2
            },
            // 防御者：基础配置更轻量
            defender: {
                base: [TOUGH, ATTACK, MOVE, MOVE],
                pattern: [ATTACK, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 3 : 1
            },
            // 收集者：新增角色，专注于收集掉落资源
            collector: {
                base: [CARRY, CARRY, MOVE, MOVE],
                pattern: [CARRY, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 3 : 1
            },
            
            // 运输者：专注于运输能量
            transporter: {
                base: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
                pattern: [CARRY, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 4 : 2
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
            } else if (role === 'upgrader' && bodyTemplates.upgrader) {
                template = bodyTemplates.upgrader;
            } else if (role === 'builder' && bodyTemplates.worker) {
                template = bodyTemplates.worker;
            } else if (role === 'defender' && bodyTemplates.defender) {
                template = bodyTemplates.defender;
            } else {
                template = bodyTemplates.worker;
            }

            // 特殊处理矿工
            if (role === 'miner') {
                // 如果能量足够，直接返回固定的矿工身体
                if (energyAvailable >= _.sum(template.base.map(p => BODYPART_COST[p]))) {
                    return template.base;
                } else if (energyAvailable >= 500) {
                    // 否则生成一个低配矿工
                    return [WORK, WORK, WORK, MOVE, MOVE];
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
            // 优先生成防御者
            { condition: room.memory.underAttack && defenders.length < 2, role: 'defender' },
            { condition: harvesters.length < baseHarvesters, role: 'harvester' },
            { condition: upgraders.length < 2, role: 'upgrader' },
            { condition: builders.length < desiredBuilders, role: 'builder' },
            { condition: repairers.length < desiredRepairers, role: 'repairer' },
            { condition: miners.length < desiredMiners, role: 'miner' },
            { condition: collectors.length < desiredCollectors && desiredCollectors > 0, role: 'collector' },
            { condition: transporters.length < desiredTransporters && desiredTransporters > 0, role: 'transporter' },
        ];

        // 添加调试信息
        console.log(`房间 ${room.name} 能量: ${room.energyAvailable}/${room.energyCapacityAvailable}`);
        console.log(`当前房间 ${room.name} creep 数量: 采集者=${harvesters.length}/${baseHarvesters}, 收集者=${collectors.length}/${desiredCollectors}, 升级者=${upgraders.length}/2, 建造者=${builders.length}/${desiredBuilders}, 修理工=${repairers.length}/${desiredRepairers}, 矿工=${miners.length}/${desiredMiners}, 防御者=${defenders.length}/${desiredDefenders} `);

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

const creepManager = creepManager$1;
const towerManager = towerManager$1;
const defenseManager = defenseManager$1;
const spawnManager = spawnManager$1;
// const linkManager = require('./linkManager');

// 房间管理器
const roomManager$1 = {
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
    // linkManager.run(room);

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
    // 初始化配置
    configManager.init();
    
    // 清理内存
    memoryManager.run();
    
    // 根据当前模式执行不同逻辑
    // const currentMode = configManager.getMode();
    
    // if (currentMode === 'emergency') {
    //   // 紧急模式逻辑
    //   runEmergencyMode();
    // } else if (currentMode === 'expansion') {
    //   // 扩张模式逻辑
    //   runExpansionMode();
    //   // 暂时屏蔽扩张管理器调用
    //   // expansionManager.run(Game);
    // } else {
    //   // 正常模式逻辑
    //   runNormalMode();
    // }

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller && room.controller.my) {
        roomManager.run(room);
      }
    }
    
    // 暂时屏蔽扩张管理器调用
    // expansionManager.run(Game);
    
    cpuManager.run();
    
    // 检测是否需要自动切换模式
    // checkAndSwitchModes();
  }, function(error) {
    // 添加错误处理回调，记录详细错误信息
    console.log('游戏循环出错: ' + error + '\n' + error.stack);
  });
};

exports.default = main;
exports.loop = loop;
