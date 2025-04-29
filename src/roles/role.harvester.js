module.exports = {
    run(creep) {
        // 自动清理无效内存
        if (!creep.memory.sourceId || !Game.getObjectById(creep.memory.sourceId)) {
            delete creep.memory.sourceId;
            delete creep.memory.cachedPath;
        }

        // 绑定能量源 + 路径缓存
        if (!creep.memory.sourceId) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES, {
                filter: s => s.energy > 0
            });

            if (source) {
                creep.memory.sourceId = source.id;
                // 缓存初始路径
                const path = creep.pos.findPathTo(source, {
                    serialize: true,
                    ignoreCreeps: true
                });
                creep.memory.cachedPath = path;
            }
        }

        const source = Game.getObjectById(creep.memory.sourceId);

        if (creep.store.getFreeCapacity() > 0) {
            // 优先采集已绑定的能量源
            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    // 使用带缓存的移动
                    if (creep.memory.cachedPath?.length > 0) {
                        creep.moveByPath(creep.memory.cachedPath);
                        // 更新路径缓存（应对地形变化）
                        if (creep.pos.isNearTo(source)) {
                            creep.memory.cachedPath = creep.pos.findPathTo(source, {
                                serialize: true,
                                ignoreCreeps: true
                            });
                        }
                    } else {
                        creep.moveTo(source, {
                            visualizePathStyle: { stroke: '#ffaa00' },
                            reusePath: 5  // 优化路径重用
                        });
                    }
                }
            }
        } else {
            // 能量运输逻辑
            let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_EXTENSION ||
                        s.structureType === STRUCTURE_SPAWN ||
                        s.structureType === STRUCTURE_TOWER) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });

            // 如果常规目标已满，尝试存入存储设施
            if (!target) {
                target = creep.room.storage ||
                    creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    });
            }

            // 最终备用方案：升级控制器
            if (!target) {
                target = creep.room.controller;
            }

            if (target) {
                const transferResult = target.structureType === STRUCTURE_CONTROLLER ?
                    creep.upgradeController(target) :
                    creep.transfer(target, RESOURCE_ENERGY);

                if (transferResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: { stroke: '#ffffff' },
                        reusePath: 3  // 优化路径重用
                    });
                }

                // 清空路径缓存（返回时可能需要新路径）
                if (!creep.pos.inRangeTo(target, 3)) {
                    delete creep.memory.cachedPath;
                }
            }
        }
    },
};