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
                    if (creep.memory.cachedPath && creep.memory.cachedPath.length > 0) {
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

const roleHarvester = role_harvester;
const roleBuilder = role_builder;
const roleUpgrader = role_upgrader;
const roleRepairer = role_repairer;

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
      const target = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (target) {
        tower.attack(target);
      }
    }
  },
};

var defenseManager$1 = {
  run(room) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      Game.notify(`Hostiles detected in room ${room.name}`);
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

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) return;

        const baseHarvesters = room.controller.level < 3 ? 3 : 2;
        const desiredBuilders = room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 2 : 1;
        const desiredRepairers = room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.8
        }).length > 0 ? 2 : 1;

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

            // 移除多余部件，直到符合当前可用能量（同时保底功能）
            while (_.sum(body.map(p => BODYPART_COST[p])) > energyAvailable) {
                const idx =
                    body.lastIndexOf(WORK) >= 0 ? body.lastIndexOf(WORK) :
                        body.lastIndexOf(CARRY) >= 0 ? body.lastIndexOf(CARRY) :
                            body.lastIndexOf(MOVE);

                if (body.length <= 3) break; // 最少保留 3 个核心组件
                if (idx !== -1) body.splice(idx, 1);
                else break;
            }

            const finalCost = _.sum(body.map(p => BODYPART_COST[p]));
            if (finalCost <= energyAvailable && body.includes(WORK) && body.includes(CARRY) && body.includes(MOVE)) {
                return body;
            } else {
                return null; // 明确返回 null 表示无法构建合格 creep
            }
        };

        const spawnRole = (role) => {
            const body = generateOptimalBody(role);
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

        // 应急逻辑：最低成本 fallback
        if (harvesters.length < 1) {
            const energy = room.energyAvailable;
            const emergencyBody = energy >= 350
                ? [WORK, WORK, CARRY, MOVE, MOVE]
                : [WORK, CARRY, MOVE];

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
            return;
        }

        const spawnPriority = [
            { condition: harvesters.length < baseHarvesters, role: 'harvester' },
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
