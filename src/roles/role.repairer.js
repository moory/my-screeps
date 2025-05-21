module.exports = {
    run(creep) {
        // 移动到目标的优化函数
        const moveToTarget = (target, pathType, visualStyle = { stroke: '#ffaa00' }) => {
            // 如果没有路径缓存或者到了刷新时间，重新计算路径
            if (!creep.memory[pathType] || Game.time % 50 === 0) {
                creep.memory[pathType] = creep.pos.findPathTo(target, {
                    serialize: true,
                    ignoreCreeps: true,
                    maxOps: 500,
                    range: 1
                });
            }
            // 使用缓存的路径移动
            const moveResult = creep.moveByPath(creep.memory[pathType]);
            
            // 如果移动失败，清除路径缓存并尝试直接移动
            if (moveResult !== OK && moveResult !== ERR_TIRED) {
                delete creep.memory[pathType];
                creep.moveTo(target, { visualizePathStyle: visualStyle, reusePath: 5 });
            }
        };

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
                        moveToTarget(damagedTower, 'towerPath');
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
                        moveToTarget(barrier, 'barrierPath');
                    }
                    return;
                }
            }
        }

        // 设置工作状态
        if (creep.memory.repairing && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.repairing = false;
            // 清除修理目标的路径缓存
            delete creep.memory.repairPath;
        }
        if (!creep.memory.repairing && creep.store.getFreeCapacity() === 0) {
            creep.memory.repairing = true;
            // 清除能量源的路径缓存
            delete creep.memory.energyPath;
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
                    moveToTarget(target, 'repairPath', { stroke: '#ffffff' });
                }
            } else {
                // 没有修理目标时，转为升级控制器
                const controller = creep.room.controller;
                if (controller) {
                    if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                        moveToTarget(controller, 'controllerPath', { stroke: '#ffffff' });
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
                    moveToTarget(container, 'containerPath');
                }
            } else {
                // 其次捡取掉落的能量
                const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                    filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
                });

                if (droppedEnergy) {
                    if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                        moveToTarget(droppedEnergy, 'droppedPath');
                    }
                } else {
                    // 最后从能量源直接采集
                    const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                    if (source) {
                        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                            moveToTarget(source, 'sourcePath');
                        }
                    }
                }
            }
        }
    }
};