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
            if (source) {
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
                target = creep.room.storage ||
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
    if (creep.store[RESOURCE_ENERGY] === 0) {
      const source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source);
        }
      }
    } else {
      const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
      if (target) {
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
      } else {
        // 如果没有工地，默认去升级控制器，避免浪费
        const controller = creep.room.controller;
        if (controller) {
          if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller);
          }
        }
      }
    }
  },
};

var role_upgrader = {
  run(creep) {
    if (creep.store[RESOURCE_ENERGY] === 0) {
      const source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source);
        }
      }
    } else {
      const controller = creep.room.controller;
      if (controller) {
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(controller);
        }
      }
    }
  },
};

var roleRepairer$1 = {
    run(creep) {
        if (creep.store[RESOURCE_ENERGY] === 0) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES);
            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#00ff00' } });
                }
            }
        } else {
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_WALL) &&
                    s.hits < s.hitsMax &&  // 修复所有不满血建筑
                    (s.structureType !== STRUCTURE_WALL || s.hits < 5000) // 墙壁只修到 5000
            });

            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ff00ff' } });
                }
            } else {
                // 没事干时靠近 controller 待命
                const controller = creep.room.controller;
                if (controller) {
                    creep.moveTo(controller);
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

    for (const tower of towers) {
      // 1. 首先攻击敌人
      const hostileCreep = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (hostileCreep) {
        tower.attack(hostileCreep);
        continue; // 如果有敌人，优先攻击，不执行其他操作
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
             s.hits < 10000) // 防御墙和城墙低于 10000 时修复
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
      // 发送通知
      Game.notify(`警告：检测到 ${hostiles.length} 个敌对 creep 在房间 ${room.name}`);
      
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

        const baseHarvesters = room.controller.level < 3 ? 3 : 2;
        const desiredBuilders = room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 2 : 1;
        const desiredRepairers = room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.8
        }).length > 0 ? 2 : 1;
        // 每个能量源分配一个矿工
        const desiredMiners = room.controller.level >= 2 ? room.find(FIND_SOURCES).length : 0;

        const bodyTemplates = {
            harvester: {
                base: [WORK, CARRY, MOVE],
                pattern: [WORK, WORK, MOVE],
                maxPatternRepeats: 4
            },
            worker: {
                base: [WORK, CARRY, MOVE],
                pattern: [WORK, CARRY, MOVE],
                maxPatternRepeats: 4
            },
            repairer: {
                base: [WORK, CARRY, MOVE],
                pattern: [CARRY, CARRY, MOVE],
                maxPatternRepeats: 3
            },
            miner: {
                base: [WORK, WORK, MOVE],
                pattern: [WORK, WORK, MOVE],
                maxPatternRepeats: 3
            }
        };

        const generateOptimalBody = (role) => {
            const energyAvailable = room.energyAvailable;
            const energyCapacity = room.energyCapacityAvailable;

            const template = bodyTemplates[role === 'harvester' ? 'harvester'
                : role === 'repairer' ? 'repairer'
                    : 'worker'];

            let body = [...template.base];
            const patternCost = _.sum(template.pattern.map(p => BODYPART_COST[p]));
            const baseCost = _.sum(body.map(p => BODYPART_COST[p]));

            const maxRepeats = Math.min(
                Math.floor((energyCapacity - baseCost) / patternCost),
                template.maxPatternRepeats
            );

            for (let i = 0; i < maxRepeats; i++) {
                body.push(...template.pattern);
            }

            // 调整：至少保留一个完整的基本功能（WORK + CARRY + MOVE）
            while (_.sum(body.map(p => BODYPART_COST[p])) > energyAvailable) {
                if (body.length <= 3) break;
                const idx =
                    body.lastIndexOf(WORK) >= 0 ? body.lastIndexOf(WORK) :
                    body.lastIndexOf(CARRY) >= 0 ? body.lastIndexOf(CARRY) :
                    body.lastIndexOf(MOVE);
                if (idx !== -1) body.splice(idx, 1);
                else break;
            }

            const finalCost = _.sum(body.map(p => BODYPART_COST[p]));
            const hasBasicParts = body.includes(WORK) && body.includes(CARRY) && body.includes(MOVE);

            return (finalCost <= energyAvailable && hasBasicParts) ? body : null;
        };

        const spawnRole = (role) => {
            const body = generateOptimalBody(role);
            if (!body) {
                console.log(`⚠️ Cannot generate valid body for role: ${role}`);
                return false;
            }
            const result = spawn.spawnCreep(
                body,
                `${role[0].toUpperCase()}${role.slice(1)}_${Game.time}`,
                { memory: { role } }
            );
            if (result === OK) {
                console.log(`🛠️ Spawning ${role}: ${JSON.stringify(body)}`);
                return true;
            }
            console.log(`⚠️ Failed to spawn ${role}: ${result}`);
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
                    console.log(`🚨 Emergency harvester spawned!`);
                } else {
                    console.log(`❌ Emergency spawn failed: ${result}`);
                }
            } else {
                console.log(`🚫 Not enough energy (${energy}) to spawn emergency harvester.`);
            }
            return;
        }

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

const creepManager = creepManager$1;
const structureManager = structureManager$1;
const defenseManager = defenseManager$1;
const spawnManager = spawnManager$1;

var roomManager$1 = {
  run(room) {
    spawnManager.run(room);
    creepManager.run(room);
    structureManager.run(room);
    defenseManager.run(room);
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

const roomManager = roomManager$1;
const memoryManager = memoryManager$1;
const cpuManager = cpuManager$1;
const { tryCatch } = errorCatcher;

var loop = main.loop = function () {
  tryCatch(() => {
    memoryManager.run();

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      roomManager.run(room);
    }

    cpuManager.run();
  });
};

exports.default = main;
exports.loop = loop;
