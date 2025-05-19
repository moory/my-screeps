module.exports = {
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