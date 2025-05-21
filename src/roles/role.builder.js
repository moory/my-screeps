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
            // 使用缓存路径移动到受损塔
            if (!creep.memory.towerPath || Game.time % 50 === 0) {
              creep.memory.towerPath = creep.pos.findPathTo(damagedTower, {
                serialize: true,
                ignoreCreeps: true,
                maxOps: 500,
                range: 3
              });
            }
            creep.moveByPath(creep.memory.towerPath);
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
            // 使用缓存路径移动到防御墙
            if (!creep.memory.barrierPath || Game.time % 50 === 0) {
              creep.memory.barrierPath = creep.pos.findPathTo(barrier, {
                serialize: true,
                ignoreCreeps: true,
                maxOps: 500,
                range: 3
              });
            }
            creep.moveByPath(creep.memory.barrierPath);
          }
          return;
        }
      }

      // 如果没有能量或没有需要修复的建筑，撤退到出生点
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
        // creep.say('🚨 撤退!');
        return;
      }
    }
    
    // 设置工作状态
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.building = false;
      // 清除建造路径缓存
      delete creep.memory.targetPath;
      delete creep.memory.controllerPath;
      // creep.say('🔄 采集');
    }
    if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
      creep.memory.building = true;
      // 清除采集路径缓存
      delete creep.memory.sourcePath;
      delete creep.memory.containerPath;
      delete creep.memory.droppedEnergyPath;
      // creep.say('🚧 建造');
    }

    // 建造模式
    if (creep.memory.building) {
      const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
      if (target) {
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
          // 使用缓存路径移动到建筑工地
          if (!creep.memory.targetPath || Game.time % 20 === 0 || 
              (creep.memory.lastTargetId && creep.memory.lastTargetId !== target.id)) {
            creep.memory.targetPath = creep.pos.findPathTo(target, {
              serialize: true,
              ignoreCreeps: true,
              maxOps: 500,
              range: 3
            });
            creep.memory.lastTargetId = target.id; // 记录当前目标ID
          }
          creep.moveByPath(creep.memory.targetPath);
        }
      } else {
        // 如果没有工地，默认去升级控制器，避免浪费
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
    }
    // 采集能量模式
    else {
      // 优先捡取掉落的能量
      const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType === RESOURCE_ENERGY
      });

      if (droppedEnergy && droppedEnergy.amount > 50) {
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
          return;
        }
      }

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
  },
};