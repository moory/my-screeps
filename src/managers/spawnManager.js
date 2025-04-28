module.exports = {
  run(room) {
    const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.room.name === room.name);
    const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder' && creep.room.name === room.name);
    const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader' && creep.room.name === room.name);

    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn || spawn.spawning) {
      return;
    }

    if (harvesters.length < 2) {
      const newName = 'Harvester' + Game.time;
      spawn.spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: 'harvester' } });
    } else if (upgraders.length < 2) {
      const newName = 'Upgrader' + Game.time;
      spawn.spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: 'upgrader' } });
    } else if (builders.length < 2) {
      const newName = 'Builder' + Game.time;
      spawn.spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: 'builder' } });
    }
  }
};