module.exports = {
  run(creep) {
    const withdrawOrMove = (target, resourceType, say) => {
      if (creep.withdraw(target, resourceType) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      if (say) creep.say(say);
    };

    const pickupOrMove = (resource, say) => {
      if (creep.pickup(resource) === ERR_NOT_IN_RANGE) {
        creep.moveTo(resource, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
      if (say) creep.say(say);
    };

    // 🚨 战时策略：优先支援塔、防止浪费资源
    if (creep.room.memory.underAttack) {
      if (creep.store[RESOURCE_ENERGY] > 0) {
        const tower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_TOWER &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (tower) {
          if (creep.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(tower, { visualizePathStyle: { stroke: '#ff0000' } });
          }
          return;
        }
      }

      const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
      if (dropped) return pickupOrMove(dropped);

      const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
      if (spawn && creep.pos.getRangeTo(spawn) > 3) {
        creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
        creep.say('🚨 撤退!');
        return;
      }
    }

    // 🎒 满载状态 -> 投递资源
    if (creep.store.getFreeCapacity() === 0) {
      let target = creep.room.storage;

      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_CONTAINER &&
            s.store.getFreeCapacity() > 0
        });
      }

      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => (s.structureType === STRUCTURE_EXTENSION ||
            s.structureType === STRUCTURE_SPAWN) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }

      if (target) {
        for (const resourceType in creep.store) {
          if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            break;
          }
        }
      }
      return;
    }

    // 📦 背包未满 -> 搜集资源
    // 优先非能量
    let dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType !== RESOURCE_ENERGY
    });

    if (!dropped) {
      dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
    }

    if (dropped) return pickupOrMove(dropped, '🧹 收集');

    const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
      filter: t => t.store && t.store.getUsedCapacity() > 0
    });

    if (tombstone) {
      for (const res in tombstone.store) {
        if (tombstone.store[res] > 0) {
          withdrawOrMove(tombstone, res, '💀 收集');
          return;
        }
      }
    }

    const ruin = creep.pos.findClosestByPath(FIND_RUINS, {
      filter: r => r.store && r.store.getUsedCapacity() > 0
    });

    if (ruin) {
      for (const res in ruin.store) {
        if (ruin.store[res] > 0) {
          withdrawOrMove(ruin, res, '🏚️ 收集');
          return;
        }
      }
    }

    // 🔁 从 Container 搬运资源到附近的 Link
    const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER &&
        s.store[RESOURCE_ENERGY] > 0
    });

    if (container) {
      const link = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LINK &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });

      // 如果 creep 背包是空的，先去拿能量
      if (creep.store.getFreeCapacity() > 0) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
          creep.say('📦 拿能量');
        }
      }
      // 如果身上有能量并且有目标 Link，运过去
      else if (creep.store[RESOURCE_ENERGY] > 0 && link) {
        if (creep.transfer(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(link, { visualizePathStyle: { stroke: '#aaffaa' } });
          creep.say('📤 投Link');
        }
      }
    }
  }
};