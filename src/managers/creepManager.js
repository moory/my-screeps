const roleHarvester = require('../roles/role.harvester');
const roleBuilder = require('../roles/role.builder');
const roleUpgrader = require('../roles/role.upgrader');

module.exports = {
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