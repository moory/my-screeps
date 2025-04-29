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