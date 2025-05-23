const roleHarvester = require('../roles/role.harvester');
const roleBuilder = require('../roles/role.builder');
const roleUpgrader = require('../roles/role.upgrader');
const roleRepairer = require('../roles/role.repairer');
const roleMiner = require('../roles/role.miner');
const roleCollector = require('../roles/role.collector');
const roleDefender = require('../roles/role.defender');
const roleTransporter = require('../roles/role.transporter'); // 添加运输者模块

module.exports = {
    run(room, mode = 'normal') {
        // 现在可以根据 mode 调整 creep 行为
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            
            switch (creep.memory.role) {
                case 'harvester':
                    roleHarvester.run(creep, mode);
                    break;
                case 'builder':
                    roleBuilder.run(creep, mode);
                    break;
                case 'upgrader':
                    // 在紧急模式下可能想要暂停升级控制器
                    if (mode === 'emergency' && room.memory.pauseUpgrade) {
                        // 可以让升级者临时变成采集者
                        roleHarvester.run(creep, mode);
                    } else {
                        roleUpgrader.run(creep, mode);
                    }
                    break;
                case 'repairer':
                    roleRepairer.run(creep, mode);
                    break;
                case 'miner':
                    roleMiner.run(creep, mode);
                    break;
                case 'collector':
                    roleCollector.run(creep, mode);
                    break;
                case 'defender':
                    roleDefender.run(creep, mode);
                    break;
                case 'transporter':
                    roleTransporter.run(creep, mode);
                    break;
            }
        }
    }
};