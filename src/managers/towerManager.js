module.exports = {
  run(room, mode = 'normal') {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });

    if (towers.length === 0) return;

    // 根据模式设置塔的行为优先级
    const priorities = mode === 'emergency' 
      ? ['attack', 'heal', 'repair'] 
      : ['heal', 'attack', 'repair'];
    
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
      // 根据优先级执行塔的行为
      for (const action of priorities) {
        if (this.executeTowerAction(tower, action, room, primaryTarget, hostiles)) {
          break; // 如果执行了某个行为，就不再执行后续行为
        }
      }
    }
  },

  /**
   * 执行塔的具体行为
   * @param {StructureTower} tower - 防御塔对象
   * @param {string} action - 行为类型
   * @param {Room} room - 房间对象
   * @param {Creep} primaryTarget - 主要攻击目标
   * @param {Array<Creep>} hostiles - 敌对creep列表
   * @returns {boolean} 是否执行了行为
   */
  executeTowerAction(tower, action, room, primaryTarget, hostiles) {
    switch(action) {
      case 'attack':
        if (hostiles.length > 0) {
          // 优先攻击主要目标
          if (primaryTarget) {
            tower.attack(primaryTarget);
            return true;
          }
          
          // 改进墙体穿透检测逻辑
          const hostilesInRange = tower.pos.findInRange(hostiles, 20);
          if (hostilesInRange.length > 0) {
            const attackTarget = tower.pos.findClosestByRange(hostilesInRange.filter(c => {
              // 只检查是否有墙，而不是任何结构
              const structures = c.pos.lookFor(LOOK_STRUCTURES);
              return !structures.some(s => s.structureType === STRUCTURE_WALL);
            }));
            
            if (attackTarget) {
              tower.attack(attackTarget);
              return true;
            }
          }
        }
        break;
        
      case 'heal':
        // 治疗受伤的友方 creep
        const injuredCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: c => c.hits < c.hitsMax
        });
        if (injuredCreep) {
          tower.heal(injuredCreep);
          return true;
        }
        break;
        
      case 'repair':
        // 只有当能量超过 50% 时才修复建筑，保留能量应对攻击
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
          // 优先修复重要建筑：容器、道路、防御墙和城墙
          // 使用 findInRange 限制修复范围在 20 格以内，保证至少 50% 的修复效率
          const criticalStructures = tower.pos.findInRange(FIND_STRUCTURES, 20, {
            filter: s =>
              ((s.structureType === STRUCTURE_CONTAINER ||
                s.structureType === STRUCTURE_ROAD) &&
               s.hits < s.hitsMax * 0.5) || // 容器和道路低于 50% 时修复
              ((s.structureType === STRUCTURE_RAMPART ||
                s.structureType === STRUCTURE_WALL) &&
               s.hits < 300000) // 防御墙和城墙低于 300000 时修复
          });
        
          if (criticalStructures.length > 0) {
            // 从范围内的建筑中找到最近的一个进行修复
            const criticalStructure = tower.pos.findClosestByRange(criticalStructures);
            if (criticalStructure) {
              tower.repair(criticalStructure);
              return true;
            }
          }
        }
        break;
    }
    return false;
  }
};