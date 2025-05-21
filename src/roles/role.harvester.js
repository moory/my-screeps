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
                    // 使用缓存路径移动到塔
                    if (!creep.memory.towerPath || Game.time % 50 === 0) {
                        creep.memory.towerPath = creep.pos.findPathTo(tower, {
                            serialize: true,
                            ignoreCreeps: true,
                            maxOps: 500,
                            range: 1
                        });
                    }
                    creep.moveByPath(creep.memory.towerPath);
                }
                return;
            }
            
            // 如果没有塔或没有能量，撤退到最近的出生点
            const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                // 使用缓存路径移动到出生点
                if (!creep.memory.spawnPath || Game.time % 50 === 0) {
                    creep.memory.spawnPath = creep.pos.findPathTo(spawn, {
                        serialize: true,
                        ignoreCreeps: true,
                        maxOps: 500,
                        range: 3
                    });
                }
                creep.moveByPath(creep.memory.spawnPath);
                return;
            }
        }
        
        // 设置工作状态
        if (creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            // 清除采集路径缓存，准备运输
            delete creep.memory.cachedPath;
        }
        if (!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
            // 重新选择能量源
            delete creep.memory.sourceId;
            delete creep.memory.cachedPath;
            delete creep.memory.targetPath; // 清除目标路径缓存
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
                    creep.memory.cachedPath = creep.pos.findPathTo(source, {
                        serialize: true,
                        ignoreCreeps: true,
                        maxOps: 500,
                        range: 1
                    });
                } else {
                    // 如果找不到能量源，移动到控制器附近等待
                    if (creep.room.controller) {
                        // 使用缓存路径移动到控制器
                        if (!creep.memory.controllerPath || Game.time % 50 === 0) {
                            creep.memory.controllerPath = creep.pos.findPathTo(creep.room.controller, {
                                serialize: true,
                                ignoreCreeps: true,
                                maxOps: 500,
                                range: 3
                            });
                        }
                        creep.moveByPath(creep.memory.controllerPath);
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
                    // 使用缓存路径移动到容器
                    if (!creep.memory.containerPath || Game.time % 20 === 0) {
                        creep.memory.containerPath = creep.pos.findPathTo(container, {
                            serialize: true,
                            ignoreCreeps: true,
                            maxOps: 500,
                            range: 1
                        });
                    }
                    creep.moveByPath(creep.memory.containerPath);
                }
            } else if (source) {
                const harvestResult = creep.harvest(source);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    // 使用带缓存的移动
                    if (creep.memory.cachedPath && creep.memory.cachedPath.length > 0) {
                        const moveResult = creep.moveByPath(creep.memory.cachedPath);
                        // 只有在路径失效时才重新计算
                        if (moveResult === ERR_NOT_FOUND || moveResult === ERR_INVALID_ARGS) {
                            // 重新计算路径并缓存
                            creep.memory.cachedPath = creep.pos.findPathTo(source, {
                                serialize: true,
                                ignoreCreeps: true,
                                maxOps: 500,  // 限制寻路操作数
                                range: 1      // 只需要到达能量源旁边
                            });
                            // 立即使用新路径
                            creep.moveByPath(creep.memory.cachedPath);
                        }
                    } else {
                        // 初次计算路径
                        creep.memory.cachedPath = creep.pos.findPathTo(source, {
                            serialize: true,
                            ignoreCreeps: true,
                            maxOps: 500,
                            range: 1
                        });
                        creep.moveByPath(creep.memory.cachedPath);
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
                    // 使用缓存路径移动到目标
                    if (!creep.memory.targetPath || Game.time % 20 === 0 || 
                        (creep.memory.lastTargetId && creep.memory.lastTargetId !== target.id)) {
                        // 如果目标改变或定期刷新，重新计算路径
                        creep.memory.targetPath = creep.pos.findPathTo(target, {
                            serialize: true,
                            ignoreCreeps: true,
                            maxOps: 500,
                            range: 1
                        });
                        creep.memory.lastTargetId = target.id; // 记录当前目标ID
                    }
                    creep.moveByPath(creep.memory.targetPath);
                }
            }
        }
    },
};