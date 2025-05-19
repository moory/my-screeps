module.exports = {
    run(creep) {
        // 检查房间是否处于攻击状态
        if (!creep.room.memory.underAttack) {
            // 如果没有敌人，返回出生点附近待命
            const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffffff' } });
                creep.say('🛡️ 待命');
            }
            return;
        }

        // 寻找最近的敌人
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length === 0) {
            // 没有敌人但房间仍标记为被攻击，可能是误报
            creep.say('🛡️ 巡逻');
            return;
        }

        // 优先攻击治疗单位
        const healers = hostiles.filter(c => 
            c.body.some(part => part.type === HEAL && part.hits > 0)
        );
        
        // 如果有治疗单位，优先攻击
        let target = null;
        if (healers.length > 0) {
            target = creep.pos.findClosestByPath(healers);
        } else {
            // 否则攻击最近的敌人
            target = creep.pos.findClosestByPath(hostiles);
        }

        // 执行攻击
        if (target) {
            // 检查敌人是否在攻击范围内
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { 
                    visualizePathStyle: { stroke: '#ff0000' },
                    reusePath: 3
                });
                creep.say('⚔️ 攻击');
            } else {
                creep.say('⚔️ 战斗中');
            }
            
            // 如果生命值低于50%，撤退到出生点附近
            if (creep.hits < creep.hitsMax * 0.5) {
                const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
                if (spawn) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
                    creep.say('🛡️ 撤退');
                }
            }
        }
    }
};