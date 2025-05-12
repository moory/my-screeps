module.exports = {
    run(room) {
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.room.name === room.name);
        const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder' && creep.room.name === room.name);
        const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader' && creep.room.name === room.name);
        const repairers = _.filter(Game.creeps, (creep) => creep.memory.role === 'repairer' && creep.room.name === room.name); // ✅ 新增统计

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) {
            return;
        }

        const energyAvailable = room.energyAvailable;

        const generateBody = (role) => {
            const maxCost = room.energyCapacityAvailable;
            const currentEnergy = room.energyAvailable;
            let body = [];

            switch (role) {
                case 'harvester':
                    if (currentEnergy < 300) {
                        // 🆘 紧急配置，确保能造出基础 harvester
                        body = [WORK, CARRY, MOVE]; // 200 能量
                    } else if (maxCost >= 350) {
                        body = [WORK, WORK, WORK, CARRY, MOVE, MOVE];
                    } else {
                        body = [WORK, WORK, CARRY, MOVE];
                    }
                    break;
                case 'builder':
                case 'upgrader':
                    if (currentEnergy < 300) {
                        body = [WORK, CARRY, MOVE];
                    } else {
                        body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
                    }
                    break;
                case 'repairer':
                    body = [CARRY, CARRY, MOVE, WORK];
                    break;
            }

            // 确保不超出 energyAvailable（不是 energyCapacity）
            while (body.reduce((cost, part) => cost + BODYPART_COST[part], 0) > currentEnergy) {
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
                console.log(`Failed to spawn ${role}: ${result}, energy: ${room.energyAvailable}, body: ${JSON.stringify(body)}`);
            }
        };

        if (harvesters.length < 1) {
            // 应急逻辑
            const body = [WORK, CARRY, MOVE];
            const name = 'HarvesterEmergency' + Game.time;
            const result = spawn.spawnCreep(body, name, { memory: { role: 'harvester' } });
            if (result === OK) {
                console.log(`⚠️ Emergency harvester spawned: ${name}`);
            } else {
                console.log(`❌ Failed to spawn emergency harvester: ${result}`);
            }
            return;
        }

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