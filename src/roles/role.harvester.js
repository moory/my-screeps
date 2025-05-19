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
                creep.say('🚨 撤退!');
                return;
            }
        }
        
        // 设置工作状态
        if (creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            creep.say('🚚 运输');
        }
        if (!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
            creep.say('🔄 采集');
            // 重新选择能量源
            delete creep.memory.sourceId;
            delete creep.memory.cachedPath;
        }
        
        // 自动清理无效内存
        if (creep.memory.sourceId && !Game.getObjectById(creep.memory.sourceId)) {
            delete creep.memory.sourceId;
            delete creep.memory.cachedPath;
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
                } else if (harvestResult === ERR_NOT_ENOUGH_RESOURCES && creep.store[RESOURCE_ENERGY] > 0) {
                    // 如果能量源已空但背包有能量，切换到运输模式
                    creep.memory.harvesting = false;
                    creep.say('🚚 运输');
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