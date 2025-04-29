var roleRepairer = {
  run(creep) {
    if (creep.store[RESOURCE_ENERGY] === 0) {
      const source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { visualizePathStyle: { stroke: '#00ff00' } });
        }
      }
    } else {
      const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
          s.hits < 50000 // 你可以根据房间 RCL 设定更高阈值
      });

      if (target) {
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ff00ff' } });
        }
      } else {
        // 没事干时靠近 controller 待命
        const controller = creep.room.controller;
        if (controller) {
          creep.moveTo(controller);
        }
      }
    }
  },
};

module.exports = roleRepairer;