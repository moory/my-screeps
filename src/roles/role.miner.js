module.exports = {
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