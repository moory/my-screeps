module.exports = {
  run(creep) {
    // 检查房间是否处于攻击状态
    if (creep.room.memory.underAttack) {
      // 如果有能量，优先修复防御建筑
      if (creep.store[RESOURCE_ENERGY] > 0) {
        // 优先修复防御塔
        const damagedTower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_TOWER && s.hits < s.hitsMax
        });

        if (damagedTower) {
          if (creep.repair(damagedTower) === ERR_NOT_IN_RANGE) {
            creep.moveTo(damagedTower, { visualizePathStyle: { stroke: '#ff0000' } });
          }
          return;
        }

        // 其次修复墙和城墙
        const barrier = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => (s.structureType === STRUCTURE_WALL ||
            s.structureType === STRUCTURE_RAMPART) &&
            s.hits < 10000
        });

        if (barrier) {
          if (creep.repair(barrier) === ERR_NOT_IN_RANGE) {
            creep.moveTo(barrier, { visualizePathStyle: { stroke: '#ff0000' } });
          }
          return;
        }
      }

      // 如果没有能量或没有需要修复的建筑，撤退到出生点
      const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
      if (spawn && creep.pos.getRangeTo(spawn) > 3) {
        creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
        creep.say('🚨 撤退!');
        return;
      }
    }

    // 如果目前不在W27N45就前往
    // if (creep.room.name !== 'W27N45') {
    //   const targetRoom = new RoomPosition(27, 45, 'W27N45');
    //   creep.moveTo(targetRoom, {visualizePathStyle: {stroke: '#ffffff'}});
    //   return;
    // }
    // 设置工作状态
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.building = false;
      creep.say('🔄 采集');
    }
    if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
      creep.memory.building = true;
      creep.say('🚧 建造');
    }

    // 建造模式
    if (creep.memory.building) {
      const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
      if (target) {
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      } else {
        // 如果没有工地，默认去升级控制器，避免浪费
        const controller = creep.room.controller;
        if (controller) {
          if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
          }
        }
      }
    }
    // 采集能量模式
    else {
      // 优先捡取掉落的能量
      const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType === RESOURCE_ENERGY
      });

      if (droppedEnergy && droppedEnergy.amount > 50) {
        if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
          creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' } });
          return;
        }
      }

      // 优先从存储设施获取能量（新增Storage优先级）
      const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: structure => {
          return (structure.structureType === STRUCTURE_STORAGE ||
            structure.structureType === STRUCTURE_CONTAINER) &&
            structure.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity();
        }
      });

      if (container) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
          return;
        }
      }

      // 最后从能量源直接采集
      const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    }
  },
};