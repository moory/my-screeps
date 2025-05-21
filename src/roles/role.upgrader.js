module.exports = {
  run(creep) {
    // 检查房间是否处于攻击状态
    if (creep.room.memory.underAttack) {
      // 在受到攻击时，升级者应该撤退到安全区域
      const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
      if (spawn && creep.pos.getRangeTo(spawn) > 3) {
        // 使用缓存路径移动到出生点
        if (!creep.memory.spawnPath || Game.time % 50 === 0) {
          creep.memory.spawnPath = creep.pos.findPathTo(spawn, {
            serialize: true,
            ignoreCreeps: true,
            maxOps: 500,
            range: 3
          });
        }
        creep.moveByPath(creep.memory.spawnPath);
        return;
      }
    }

    // 设置工作状态
    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.upgrading = false;
      // 清除升级路径缓存
      delete creep.memory.controllerPath;
    }
    if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
      creep.memory.upgrading = true;
      // 清除采集路径缓存
      delete creep.memory.containerPath;
      delete creep.memory.droppedEnergyPath;
      delete creep.memory.sourcePath;
    }

    // 升级模式
    if (creep.memory.upgrading) {
      const controller = creep.room.controller;
      if (controller) {
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
          // 使用缓存路径移动到控制器
          if (!creep.memory.controllerPath || Game.time % 100 === 0) {
            creep.memory.controllerPath = creep.pos.findPathTo(controller, {
              serialize: true,
              ignoreCreeps: true,
              maxOps: 500,
              range: 3
            });
          }
          creep.moveByPath(creep.memory.controllerPath);
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
          // 使用缓存路径移动到容器
          if (!creep.memory.containerPath || Game.time % 20 === 0 || 
              (creep.memory.lastContainerId && creep.memory.lastContainerId !== container.id)) {
            creep.memory.containerPath = creep.pos.findPathTo(container, {
              serialize: true,
              ignoreCreeps: true,
              maxOps: 500,
              range: 1
            });
            creep.memory.lastContainerId = container.id; // 记录当前容器ID
          }
          creep.moveByPath(creep.memory.containerPath);
        }
      } else {
        // 其次捡取掉落的能量
        const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
          filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
        });

        if (droppedEnergy) {
          if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
            // 使用缓存路径移动到掉落能量
            if (!creep.memory.droppedEnergyPath || Game.time % 10 === 0 || 
                (creep.memory.lastDroppedId && creep.memory.lastDroppedId !== droppedEnergy.id)) {
              creep.memory.droppedEnergyPath = creep.pos.findPathTo(droppedEnergy, {
                serialize: true,
                ignoreCreeps: true,
                maxOps: 500,
                range: 1
              });
              creep.memory.lastDroppedId = droppedEnergy.id; // 记录当前掉落能量ID
            }
            creep.moveByPath(creep.memory.droppedEnergyPath);
          }
        } else {
          // 最后从能量源直接采集
          const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
          if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
              // 使用缓存路径移动到能量源
              if (!creep.memory.sourcePath || Game.time % 30 === 0 || 
                  (creep.memory.lastSourceId && creep.memory.lastSourceId !== source.id)) {
                creep.memory.sourcePath = creep.pos.findPathTo(source, {
                  serialize: true,
                  ignoreCreeps: true,
                  maxOps: 500,
                  range: 1
                });
                creep.memory.lastSourceId = source.id; // 记录当前能量源ID
              }
              creep.moveByPath(creep.memory.sourcePath);
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
        
        // 清除所有路径缓存，强制重新计算路径
        delete creep.memory.controllerPath;
        delete creep.memory.containerPath;
        delete creep.memory.droppedEnergyPath;
        delete creep.memory.sourcePath;
        delete creep.memory.spawnPath;
      }
    } else {
      creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
      creep.memory.stuckCount = 0;
    }
  }
};