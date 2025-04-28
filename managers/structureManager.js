module.exports = {
  run(room) {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });

    for (const tower of towers) {
      const target = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (target) {
        tower.attack(target);
      }
    }
  },
};