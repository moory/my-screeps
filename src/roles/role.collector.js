module.exports = {
  run(creep) {
    // 如果背包已满，将资源运送到存储设施
    if (creep.store.getFreeCapacity() === 0) {
      // 优先存放到Storage
      let target = creep.room.storage;
      
      // 如果没有Storage，则寻找Container
      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_CONTAINER &&
                      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }
      
      // 如果没有存储设施，则将能量送到Spawn或Extension
      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: s => (s.structureType === STRUCTURE_EXTENSION ||
                      s.structureType === STRUCTURE_SPAWN) &&
                      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }
      
      if (target) {
        // 遍历背包中的所有资源类型并转移
        for (const resourceType in creep.store) {
          if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
            break; // 一旦开始移动就跳出循环
          }
        }
      }
    }
    // 如果背包未满，寻找掉落资源
    else {
      // 优先寻找非能量资源（可能是Invader掉落的矿物）
      let droppedResource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType !== RESOURCE_ENERGY
      });
      
      // 如果没有找到非能量资源，再寻找掉落的能量
      if (!droppedResource) {
        droppedResource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
      }
      
      // 如果找到了掉落资源，拾取它
      if (droppedResource) {
        if (creep.pickup(droppedResource) === ERR_NOT_IN_RANGE) {
          creep.moveTo(droppedResource, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        creep.say('🧹 收集');
      } else {
        // 如果没有掉落资源，寻找墓碑并获取其中的资源
        const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
          filter: tomb => tomb.store.getUsedCapacity() > 0
        });
        
        if (tombstone) {
          // 从墓碑中提取第一种可用资源
          for (const resourceType in tombstone.store) {
            if (creep.withdraw(tombstone, resourceType) === ERR_NOT_IN_RANGE) {
              creep.moveTo(tombstone, {visualizePathStyle: {stroke: '#ffaa00'}});
              break; // 一旦开始移动就跳出循环
            }
          }
          creep.say('💀 收集');
        } else {
          // 如果没有掉落资源和墓碑，寻找废墟
          const ruin = creep.pos.findClosestByPath(FIND_RUINS, {
            filter: r => r.store.getUsedCapacity() > 0
          });
          
          if (ruin) {
            // 从废墟中提取第一种可用资源
            for (const resourceType in ruin.store) {
              if (creep.withdraw(ruin, resourceType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(ruin, {visualizePathStyle: {stroke: '#ffaa00'}});
                break; // 一旦开始移动就跳出循环
              }
            }
            creep.say('🏚️ 收集');
          } else {
            // 如果什么都没找到，就待在房间中央或控制器附近
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
              visualizePathStyle: {stroke: '#ffaa00'},
              range: 5
            });
          }
        }
      }
    }
  }
};