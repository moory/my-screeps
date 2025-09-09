module.exports = {
  run(creep) {
    // 检查房间是否处于攻击状态
    if (creep.room.memory.underAttack) {
      // 在受到攻击时，升级者应该撤退到安全区域
      const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
      if (spawn && creep.pos.getRangeTo(spawn) > 3) {
        safeMoveTo(creep, spawn, { visualizePathStyle: { stroke: '#ff0000' } });
        return;
      }
    }

    // 设置工作状态
    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.upgrading = false;
    }
    if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
      creep.memory.upgrading = true;
    }

    // 升级模式
    if (creep.memory.upgrading) {
      const controller = creep.room.controller;
      if (controller) {
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
          safeMoveTo(creep, controller, {
            visualizePathStyle: { stroke: '#ffffff' },
            reusePath: 5
          });
        }
      }
    }
    // 采集能量模式
    else {
      // 优先从容器或存储中获取能量
      const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_CONTAINER ||
          s.structureType === STRUCTURE_STORAGE) &&
          s.store[RESOURCE_ENERGY] > 0
      });

      if (container) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          safeMoveTo(creep, container, {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 3
          });
        }
      } else {
        // 其次捡取掉落的能量
        const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
          filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
        });

        if (droppedEnergy) {
          if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
            safeMoveTo(creep, droppedEnergy, {
              visualizePathStyle: { stroke: '#ffaa00' },
              reusePath: 3
            });
          }
        } else {
          // 最后从能量源直接采集
          const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
          if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
              safeMoveTo(creep, source, {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 3
              });
            }
          }
        }
      }
    }

    // 添加卡住检测
    if (creep.memory.lastPos &&
      creep.memory.lastPos.x === creep.pos.x &&
      creep.memory.lastPos.y === creep.pos.y) {

      creep.memory.stuckCount = (creep.memory.stuckCount || 0) + 1;

      // 如果卡住超过10个tick，尝试随机移动解除卡住状态
      if (creep.memory.stuckCount > 10) {
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        creep.move(directions[Math.floor(Math.random() * directions.length)]);
        creep.memory.stuckCount = 0;
      }
    } else {
      creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
      creep.memory.stuckCount = 0;
    }
  }
};

function safeMoveTo(creep, target, opts = {}) {
  return creep.moveTo(target, {
    visualizePathStyle: { stroke: '#ffaa00' },
    reusePath: 3,
    ...opts,
    costCallback: (roomName, costMatrix) => {
      const room = Game.rooms[roomName];
      if (!room) return;

      const matrix = costMatrix.clone();

      // 禁用四条边缘
      for (let x = 0; x < 50; x++) {
        matrix.set(x, 0, 255);
        matrix.set(x, 49, 255);
      }
      for (let y = 0; y < 50; y++) {
        matrix.set(0, y, 255);
        matrix.set(49, y, 255);
      }

      return matrix;
    }
  });
}