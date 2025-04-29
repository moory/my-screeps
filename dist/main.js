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
          (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
          s.hits < 50000 // 你可以根据房间 RCL 设定更高阈值
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
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.room.name === room.name);
        const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder' && creep.room.name === room.name);
        const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader' && creep.room.name === room.name);
        const repairers = _.filter(Game.creeps, (creep) => creep.memory.role === 'repairer' && creep.room.name === room.name); // ✅ 新增统计

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) {
            return;
        }

        room.energyAvailable;

        const generateBody = (role) => {
            const maxCost = room.energyCapacityAvailable; // 当前房间可用能量上限
            let body = [];

            switch (role) {
                case 'harvester':
                    // 早期采集需要快速补充能量，WORK*2 + MOVE*1 (250能量)
                    body = [WORK, WORK, CARRY, MOVE];
                    if (maxCost >= 350) body = [WORK, WORK, WORK, CARRY, MOVE, MOVE]; // 更高配置
                    break;
                case 'builder':
                case 'upgrader':
                    // 平衡搬运与工作能力
                    body = [WORK, CARRY, MOVE, MOVE]; // 200能量
                    if (maxCost >= 400) body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
                    break;
                case 'repairer':
                    // 修理需要更多搬运能力
                    body = [CARRY, CARRY, MOVE, WORK]; // 250能量
                    break;
            }

            // 确保不超过能量上限
            while (body.reduce((cost, part) => cost + BODYPART_COST[part], 0) > maxCost) {
                body.pop();
            }
            return body;
        };

        const spawnCreepWithRole = (role) => {
            const body = generateBody(role);
            const newName = role.charAt(0).toUpperCase() + role.slice(1) + Game.time;
            const result = spawn.spawnCreep(body, newName, { memory: { role } });
            if (result === OK) {
                console.log(`Spawning new ${role}: ${newName}`);
            } else {
                console.log(`Failed to spawn ${role}: ${result}`);
            }
        };

        // ✅ 增加 repairer 生成优先级控制
        if (harvesters.length < 2) {
            spawnCreepWithRole('harvester');
        } else if (upgraders.length < 2) {
            spawnCreepWithRole('upgrader');
        } else if (builders.length < 2) {
            spawnCreepWithRole('builder');
        } else if (repairers.length < 1) {
            spawnCreepWithRole('repairer');
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
