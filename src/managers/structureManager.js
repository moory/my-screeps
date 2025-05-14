module.exports = {
  run(room) {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });

    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    let primaryTarget = null;

    if (hostiles.length > 0) {
      // 1. 优先选择带有 HEAL 的敌人
      const healers = hostiles.filter(c =>
        c.body.some(part => part.type === HEAL && part.hits > 0)
      );

      if (healers.length > 0) {
        // 找最近的 healer (相对于控制器)
        primaryTarget = room.controller.pos.findClosestByPath(healers);
      }
      // 如果没有找到可路径到达的 healer，或者没有 healer，则尝试找其他敌人
      if (!primaryTarget) {
        // 没有 HEAL，就打最近的敌人 (相对于控制器)
        primaryTarget = room.controller.pos.findClosestByPath(hostiles);
      }
    }

    for (const tower of towers) {
      // 1. 攻击敌人（优先目标）
      if (primaryTarget) {
        tower.attack(primaryTarget);
        continue; // 如果有主要目标，优先攻击，不执行其他操作
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
             s.hits < 200000) // 防御墙和城墙低于 200000 时修复 (这个值可以根据您的基地情况调整)
        });

        if (criticalStructure) {
          tower.repair(criticalStructure);
        }
      }
    }
  },
};