'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var main = {};

var role_harvester = {
  run(creep) {
    if (creep.store.getFreeCapacity() > 0) {
      const source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source) {
        if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
          creep.moveTo(source);
        }
      }
    } else {
      const targets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType == STRUCTURE_EXTENSION ||
                  structure.structureType == STRUCTURE_SPAWN ||
                  structure.structureType == STRUCTURE_TOWER) &&
                  structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });
      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0]);
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

const roleHarvester = role_harvester;
const roleBuilder = role_builder;
const roleUpgrader = role_upgrader;

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

    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn || spawn.spawning) {
      return;
    }

    if (harvesters.length < 2) {
      const newName = 'Harvester' + Game.time;
      spawn.spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: 'harvester' } });
    } else if (upgraders.length < 2) {
      const newName = 'Upgrader' + Game.time;
      spawn.spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: 'upgrader' } });
    } else if (builders.length < 2) {
      const newName = 'Builder' + Game.time;
      spawn.spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: 'builder' } });
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
