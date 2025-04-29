module.exports = {
  run(creep) {
    if (!creep.memory.sourceId) {
      // 如果还没有绑定 source，找最近的 source 并记录下来
      const source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source) {
        creep.memory.sourceId = source.id;
      }
    }

    const source = Game.getObjectById(creep.memory.sourceId);

    if (creep.store.getFreeCapacity() > 0) {
      if (source) {
        if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    } else {
      const targets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType == STRUCTURE_EXTENSION ||
                  structure.structureType == STRUCTURE_SPAWN ||
                  structure.structureType == STRUCTURE_TOWER) &&
                  structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });
      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    }
  },
};