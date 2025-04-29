module.exports = {
  run(room) {
    const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.room.name === room.name);
    const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder' && creep.room.name === room.name);
    const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader' && creep.room.name === room.name);
    const repairers = _.filter(Game.creeps, (creep) => creep.memory.role === 'repairer' && creep.room.name === room.name); // ✅ 新增统计

    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn || spawn.spawning) {
      return;
    }

    const energyAvailable = room.energyAvailable;

    const generateBody = () => {
      const parts = Math.floor(energyAvailable / 200); // 每组 200 能量
      const body = [];
      for (let i = 0; i < parts; i++) {
        body.push(WORK, CARRY, MOVE);
      }
      return body;
    };

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

    // ✅ 增加 repairer 生成优先级控制
    if (harvesters.length < 2) {
      spawnCreepWithRole('harvester');
    } else if (upgraders.length < 2) {
      spawnCreepWithRole('upgrader');
    } else if (builders.length < 2) {
      spawnCreepWithRole('builder');
    } else if (repairers.length < 1) {
      spawnCreepWithRole('repairer');
    }
  }
};