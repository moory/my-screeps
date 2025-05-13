module.exports = {
  run(room) {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });

    for (const tower of towers) {
      // 1. 首先攻击敌人
      const hostileCreep = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (hostileCreep) {
        tower.attack(hostileCreep);
        continue; // 如果有敌人，优先攻击，不执行其他操作
      }

      // 2. 治疗受伤的友方 creep
      const injuredCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: c => c.hits < c.hitsMax
      });
      if (injuredCreep) {
        tower.heal(injuredCreep);
        continue; // 如果有受伤的 creep，优先治疗，不执行修复
      }

      // 3. 修复重要建筑
      // 只有当能量超过 50% 时才修复建筑，保留能量应对攻击
      if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
        // 优先修复重要建筑：容器、道路、防御墙和城墙
        const criticalStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: s => 
            ((s.structureType === STRUCTURE_CONTAINER || 
              s.structureType === STRUCTURE_ROAD) && 
             s.hits < s.hitsMax * 0.5) || // 容器和道路低于 50% 时修复
            ((s.structureType === STRUCTURE_RAMPART || 
              s.structureType === STRUCTURE_WALL) && 
             s.hits < 10000) // 防御墙和城墙低于 10000 时修复
        });
        
        if (criticalStructure) {
          tower.repair(criticalStructure);
        }
      }
    }
  },
};