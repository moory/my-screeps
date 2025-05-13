const roleHarvester = require('../roles/role.harvester');
const roleBuilder = require('../roles/role.builder');
const roleUpgrader = require('../roles/role.upgrader');
const roleRepairer = require('../roles/role.repairer');
const roleMiner = require('../roles/role.miner');

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