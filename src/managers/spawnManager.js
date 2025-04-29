module.exports = {
  run(room) {
    const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.room.name === room.name);
    const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder' && creep.room.name === room.name);
    const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader' && creep.room.name === room.name);

    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn || spawn.spawning) {
      return;
    }

    const energyAvailable = room.energyAvailable;
    const energyCapacity = room.energyCapacityAvailable;

    // 生成 creep 的身体部件
    const generateBody = () => {
      const parts = Math.floor(energyAvailable / 200); // 每组需要200能量：1WORK+1CARRY+1MOVE
      const body = [];
      for (let i = 0; i < parts; i++) {
        body.push(WORK, CARRY, MOVE);
      }
      return body;
    };

    // 统一生成方法
    const spawnCreepWithRole = (role) => {
      const body = generateBody();
      const newName = role.charAt(0).toUpperCase() + role.slice(1) + Game.time;
      const result = spawn.spawnCreep(body, newName, { memory: { role } });
      if (result === OK) {
        console.log(`Spawning new ${role}: ${newName}`);
      } else {
        console.log(`Failed to spawn ${role}: ${result}`);
      }
    };

    if (harvesters.length < 2) {
      spawnCreepWithRole('harvester');
    } else if (upgraders.length < 2) {
      spawnCreepWithRole('upgrader');
    } else if (builders.length < 2) {
      spawnCreepWithRole('builder');
    }
  }
};