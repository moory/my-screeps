module.exports = {
  // 状态常量
  STATE: {
    COLLECTING: 'collecting',  // 收集能量
    DELIVERING: 'delivering'    // 运送能量
  },

  // 优先级常量
  PRIORITY: {
    EMERGENCY: 0,   // 紧急情况（战时、能量危机）
    SPAWN: 1,       // 出生点和扩展
    TOWER: 2,       // 防御塔
    LINK: 3,        // 能量链接
    STORAGE: 4,     // 存储
    CONTAINER: 5    // 容器
  },

  run(creep) {
    // 初始化状态
    if (!creep.memory.state) {
      creep.memory.state = this.STATE.COLLECTING;
    }

    // 战时策略：优先支援塔、撤退
    if (creep.room.memory.underAttack) {
      if (creep.store[RESOURCE_ENERGY] > 0) {
        const tower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_TOWER &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (tower) {
          if (creep.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(tower, { visualizePathStyle: { stroke: '#ff0000' } });
          }
          return;
        }
      }

      // 如果生命值低于50%则撤退
      if (creep.hits < creep.hitsMax * 0.5) {
        const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn && creep.pos.getRangeTo(spawn) > 3) {
          creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
          creep.say('🚨 撤退!');
          return;
        }
      }
    }

    // 状态切换逻辑
    if (creep.memory.state === this.STATE.COLLECTING && creep.store.getFreeCapacity() === 0) {
      creep.memory.state = this.STATE.DELIVERING;
      creep.say('🚚 运输');
      // 提前规划运输目标
      delete creep.memory.targetId;
    }
    if (creep.memory.state === this.STATE.DELIVERING && creep.store.getUsedCapacity() === 0) {
      creep.memory.state = this.STATE.COLLECTING;
      creep.say('🔄 收集');
      // 清除目标
      delete creep.memory.targetId;
      delete creep.memory.sourceId;
    }

    // 自动清理无效内存
    if (creep.memory.targetId && !Game.getObjectById(creep.memory.targetId)) {
      delete creep.memory.targetId;
    }
    if (creep.memory.sourceId && !Game.getObjectById(creep.memory.sourceId)) {
      delete creep.memory.sourceId;
    }

    // 根据状态执行相应行为
    if (creep.memory.state === this.STATE.COLLECTING) {
      this.collectEnergy(creep);
    } else {
      this.deliverEnergy(creep);
    }

    // 添加卡住检测
    this.checkStuck(creep);
  },

  // 收集能量
  collectEnergy(creep) {
    // 如果已经有目标，直接前往
    if (creep.memory.sourceId) {
      const source = Game.getObjectById(creep.memory.sourceId);
      if (source) {
        this.withdrawFromSource(creep, source);
        return;
      }
    }

    // 寻找能量来源，按优先级排序
    const sources = this.findEnergySources(creep);
    if (sources.length > 0) {
      creep.memory.sourceId = sources[0].id;
      this.withdrawFromSource(creep, sources[0]);
    } else {
      // 如果找不到能量源，移动到存储附近等待
      const storage = creep.room.storage;
      if (storage) {
        creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
      } else {
        // 如果没有存储，移动到控制器附近
        if (creep.room.controller) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    }
  },

  // 从能量源提取能量
  withdrawFromSource(creep, source) {
    let resourceType = RESOURCE_ENERGY;
    
    // 如果是容器、存储或废墟，可能有多种资源
    if (source.store) {
      // 优先提取非能量资源
      for (const resource in source.store) {
        if (resource !== RESOURCE_ENERGY && source.store[resource] > 0) {
          resourceType = resource;
          break;
        }
      }
      
      // 如果没有非能量资源或者只有能量，提取能量
      if (source.store[resourceType] > 0) {
        if (creep.withdraw(source, resourceType) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    } 
    // 如果是掉落的资源
    else if (source.resourceType) {
      if (creep.pickup(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
    }
  },

  // 寻找能量来源
  findEnergySources(creep) {
    const sources = [];
    
    // 1. 掉落的资源（优先非能量资源）
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
    if (droppedResources.length > 0) {
      // 优先非能量资源
      const nonEnergyResources = droppedResources.filter(r => r.resourceType !== RESOURCE_ENERGY);
      if (nonEnergyResources.length > 0) {
        sources.push(...nonEnergyResources);
      } else {
        sources.push(...droppedResources);
      }
    }
    
    // 2. 墓碑
    const tombstones = creep.room.find(FIND_TOMBSTONES, {
      filter: t => t.store && t.store.getUsedCapacity() > 0
    });
    sources.push(...tombstones);
    
    // 3. 废墟
    const ruins = creep.room.find(FIND_RUINS, {
      filter: r => r.store && r.store.getUsedCapacity() > 0
    });
    sources.push(...ruins);
    
    // 4. 矿工旁边的容器（优先考虑能量多的）
    const minerContainers = creep.room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER &&
               s.store[RESOURCE_ENERGY] > creep.store.getCapacity() * 0.5
    });
    
    // 按能量数量排序
    minerContainers.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
    sources.push(...minerContainers);
    
    // 5. 存储（如果存储中有足够能量）
    if (creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 1000) {
      sources.push(creep.room.storage);
    }
    
    // 6. Link（如果有）
    const links = creep.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_LINK &&
               s.store[RESOURCE_ENERGY] > 0
    });
    sources.push(...links);
    
    // 按距离排序
    return sources.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
  },

  // 运送能量
  deliverEnergy(creep) {
    // 如果已经有目标，直接前往
    if (creep.memory.targetId) {
      const target = Game.getObjectById(creep.memory.targetId);
      if (target) {
        this.transferToTarget(creep, target);
        return;
      }
    }

    // 寻找需要能量的目标
    const target = this.findEnergyTarget(creep);
    if (target) {
      creep.memory.targetId = target.id;
      this.transferToTarget(creep, target);
    } else {
      // 如果找不到目标，移动到存储附近等待
      const storage = creep.room.storage;
      if (storage) {
        if (creep.transfer(storage, Object.keys(creep.store)[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      } else {
        // 如果没有存储，移动到控制器附近
        if (creep.room.controller) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
      }
    }
  },

  // 向目标转移资源
  transferToTarget(creep, target) {
    // 如果是控制器，升级它
    if (target.structureType === STRUCTURE_CONTROLLER) {
      if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
      }
      return;
    }
    
    // 对于其他目标，转移资源
    for (const resourceType in creep.store) {
      if (creep.store[resourceType] > 0) {
        if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
          break;
        }
      }
    }
  },

  // 寻找需要能量的目标
  findEnergyTarget(creep) {
    // 检查房间能量状态
    const roomEnergySufficient = this.isRoomEnergySufficient(creep.room);
    const targets = [];
    
    // 紧急情况：房间能量不足
    if (!roomEnergySufficient) {
      // 优先级：spawn/extension > tower > link > storage > container
      const spawnsAndExtensions = creep.room.find(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      
      if (spawnsAndExtensions.length > 0) {
        return spawnsAndExtensions[0];
      }
      
      const towers = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                 s.store.getUsedCapacity(RESOURCE_ENERGY) < s.store.getCapacity(RESOURCE_ENERGY) * 0.7
      });
      
      if (towers.length > 0) {
        return towers[0];
      }
    } 
    // 正常情况：房间能量充足
    else {
      // 优先级：tower > link > storage > container
      
      // 1. 塔（保持在70%能量）
      const towers = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                 s.store.getUsedCapacity(RESOURCE_ENERGY) < s.store.getCapacity(RESOURCE_ENERGY) * 0.7
      });
      
      if (towers.length > 0) {
        return towers[0];
      }
      
      // 2. Link（如果有）
      const links = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LINK &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      
      if (links.length > 0) {
        // 优先填充接收Link
        const receiverLinks = links.filter(link => {
          // 这里可以添加判断接收Link的逻辑，例如通过memory标记
          return link.pos.getRangeTo(creep.room.controller) <= 5;
        });
        
        if (receiverLinks.length > 0) {
          return receiverLinks[0];
        }
      }
    }
    
    // 3. 存储
    if (creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
      return creep.room.storage;
    }
    
    // 4. 容器（非矿工容器）
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER &&
               s.store.getFreeCapacity() > 0 &&
               // 排除矿工旁边的容器
               !this.isNearSource(s, creep.room)
    });
    
    if (containers.length > 0) {
      return containers[0];
    }
    
    // 5. 如果没有其他目标，考虑升级控制器
    if (creep.room.controller && (!creep.room.storage || creep.room.storage.store[RESOURCE_ENERGY] > 10000)) {
      return creep.room.controller;
    }
    
    return null;
  },
  
  // 检查容器是否靠近能量源（矿工容器）
  isNearSource(container, room) {
    const sources = room.find(FIND_SOURCES);
    for (const source of sources) {
      if (container.pos.inRangeTo(source, 2)) {
        return true;
      }
    }
    return false;
  },
  
  // 检查房间能量是否充足（所有Extension和Spawn都满了）
  isRoomEnergySufficient(room) {
    const energyStructures = room.find(FIND_STRUCTURES, {
      filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
               s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    
    return energyStructures.length === 0;
  },
  
  // 检测并处理卡住情况
  checkStuck(creep) {
    if (creep.memory.lastPos &&
        creep.memory.lastPos.x === creep.pos.x &&
        creep.memory.lastPos.y === creep.pos.y) {
      creep.memory.stuckCount = (creep.memory.stuckCount || 0) + 1;
      
      // 如果卡住超过10个tick，尝试随机移动
      if (creep.memory.stuckCount > 10) {
        creep.say('🚧 卡住了!'); // 先说话
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        creep.move(directions[Math.floor(Math.random() * directions.length)]);
        delete creep.memory.targetId; // 清除当前目标
        delete creep.memory.sourceId;
        creep.memory.stuckCount = 0;
      }
    } else {
      creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
      creep.memory.stuckCount = 0;
    }
  }
};