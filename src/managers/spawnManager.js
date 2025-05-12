module.exports = {
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
            { condition: repairers.length < desiredRepairers, role: 'repairer' },
            { condition: builders.length < desiredBuilders, role: 'builder' },
            { condition: upgraders.length < 2, role: 'upgrader' }
        ];

        for (const { condition, role } of spawnPriority) {
            if (condition && spawnRole(role)) break;
        }
    }
};