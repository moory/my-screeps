module.exports = {
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
            // 提前规划运输目标
            creep.memory.targetId = this.findEnergyTarget(creep);
        }
        if (!creep.memory.harvesting && creep.store.getUsedCapacity(RESOURCE_ENERGY) <= emptyThreshold) {
            creep.memory.harvesting = true;
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
                    creep.memory.targetId = this.findEnergyTarget(creep);
                }
            } else if (source) {
                const harvestResult = creep.harvest(source);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    // 使用带缓存的移动
                    if (creep.memory.cachedPath && creep.memory.cachedPath.length > 0) {
                        const moveResult = creep.moveByPath(creep.memory.cachedPath);
                        // fallback：如果 moveByPath 返回 ERR_NOT_FOUND 或 ERR_NO_PATH，则直接 moveTo
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