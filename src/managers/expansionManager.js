/**
 * 扩张管理模块
 * 负责评估、选择和扩张到新房间
 */
module.exports = {
  /**
   * 运行扩张管理器
   * @param {Game} game - 游戏对象
   */
  run(game) {
    // 暂时屏蔽扩张功能
    console.log('扩张功能已暂时禁用，等待逻辑改进');
    return;
    
    // 检查是否有正在进行的扩张任务
    if (Memory.expansion) {
      // 如果有扩张任务，处理它
      this.processExpansion();
      return;
    }
    
    // 检查是否有房间处于扩张模式
    const roomsInExpansionMode = Object.values(Game.rooms).filter(room => 
      room.controller && room.controller.my && room.memory.mode === 'expansion'
    );
    
    if (roomsInExpansionMode.length > 0) {
      console.log(`检测到${roomsInExpansionMode.length}个房间处于扩张模式，开始评估扩张目标`);
      
      // 寻找最适合扩张的基地房间
      const baseRoom = this.findBestBaseRoom(roomsInExpansionMode);
      if (!baseRoom) {
        return;
      }
      
      // 寻找最佳的扩张目标房间
      const targetRoomName = this.findExpansionTarget(baseRoom);
      if (!targetRoomName) {
        console.log(`未找到合适的扩张目标房间`);
        return;
      }
      
      // 开始扩张流程
      this.startExpansion(baseRoom, targetRoomName);
      return;
    }
    
    // 如果没有扩张任务和扩张模式的房间，每100个tick检查一次扩张机会
    if (Game.time % 100 !== 0) {
      return;
    }
    
    // 检查是否有房间已经达到可以支持扩张的等级（至少RCL 3）
    const myRooms = Object.values(Game.rooms).filter(room => 
      room.controller && room.controller.my && room.controller.level >= 3
    );
    
    if (myRooms.length === 0) {
      return; // 没有房间达到扩张条件
    }
    
    // 检查是否已经达到最大房间数量限制
    const maxRooms = 3; // 可以根据需要调整
    if (myRooms.length >= maxRooms) {
      return;
    }
    
    // 寻找最适合扩张的基地房间
    const baseRoom = this.findBestBaseRoom(myRooms);
    if (!baseRoom) {
      return;
    }
    
    // 寻找最佳的扩张目标房间
    const targetRoomName = this.findExpansionTarget(baseRoom);
    if (!targetRoomName) {
      return;
    }
    
    // 开始扩张流程
    this.startExpansion(baseRoom, targetRoomName);
  },
  
  /**
   * 寻找最适合作为扩张基地的房间
   * @param {Array<Room>} rooms - 我控制的房间列表
   * @returns {Room} 最适合的基地房间
   */
  findBestBaseRoom(rooms) {
    // 按照控制器等级、能量储备和creep产能排序
    return rooms.sort((a, b) => {
      // 优先选择控制器等级高的房间
      if (a.controller.level !== b.controller.level) {
        return b.controller.level - a.controller.level;
      }
      
      // 其次考虑能量储备
      const aEnergy = a.energyAvailable + (a.storage ? a.storage.store[RESOURCE_ENERGY] : 0);
      const bEnergy = b.energyAvailable + (b.storage ? b.storage.store[RESOURCE_ENERGY] : 0);
      
      return bEnergy - aEnergy;
    })[0];
  },
  
  /**
   * 寻找最佳的扩张目标房间
   * @param {Room} baseRoom - 扩张基地房间
   * @returns {string|null} 目标房间名称或null
   */
  findExpansionTarget(baseRoom) {
    // 获取附近的房间
    const exits = Game.map.describeExits(baseRoom.name);
    const nearbyRooms = Object.values(exits);
    
    // 评估每个房间的适合度
    let bestRoom = null;
    let bestScore = -Infinity;
    
    for (const roomName of nearbyRooms) {
      // 跳过已经被占领的房间
      const roomStatus = Game.map.getRoomStatus(roomName);
      if (roomStatus.status !== 'normal') {
        continue;
      }
      
      // 跳过已标记为不适合的房间
      if (Memory.unsuitable_rooms && Memory.unsuitable_rooms[roomName]) {
        // 可以选择性地添加过期逻辑，例如一段时间后重新考虑
        // const expirationTime = 20000; // 约10小时游戏时间
        // if (Game.time - Memory.unsuitable_rooms[roomName].timestamp > expirationTime) {
        //   delete Memory.unsuitable_rooms[roomName];
        // } else {
        //   continue;
        // }
        continue;
      }
      
      // 如果我们已经可以看到这个房间，检查它是否已经被占领
      if (Game.rooms[roomName] && 
          Game.rooms[roomName].controller && 
          Game.rooms[roomName].controller.owner) {
        continue;
      }
      
      // 评估房间分数
      const score = this.evaluateRoom(roomName, baseRoom);
      
      if (score > bestScore) {
        bestScore = score;
        bestRoom = roomName;
      }
    }
    
    return bestRoom;
  },
  
  /**
   * 评估房间的适合度
   * @param {string} roomName - 房间名称
   * @param {Room} baseRoom - 基地房间
   * @returns {number} 房间评分
   */
  evaluateRoom(roomName, baseRoom) {
    // 这里需要派遣侦察兵前往房间进行评估
    // 或者使用Game.map.getTerrainAt进行初步评估
    
    // 简单评分示例
    let score = 0;
    
    // 距离评分（距离适中最好）
    const distance = Game.map.getRoomLinearDistance(baseRoom.name, roomName);
    if (distance === 1) {
      score += 10; // 相邻房间
    } else if (distance === 2) {
      score += 5;  // 距离适中
    } else {
      score -= distance * 2; // 距离越远越不适合
    }
    
    // 如果我们有房间视野，进行更详细的评估
    if (Game.rooms[roomName]) {
      const room = Game.rooms[roomName];
      
      // 能量源数量
      const sources = room.find(FIND_SOURCES);
      score += sources.length * 20;
      
      // 矿物资源
      const minerals = room.find(FIND_MINERALS);
      score += minerals.length * 10;
      
      // 控制器位置评估
      if (room.controller) {
        // 检查控制器周围是否有足够的建筑空间
        const terrain = room.getTerrain();
        let buildableSpaces = 0;
        
        for (let x = room.controller.pos.x - 3; x <= room.controller.pos.x + 3; x++) {
          for (let y = room.controller.pos.y - 3; y <= room.controller.pos.y + 3; y++) {
            if (x >= 0 && x < 50 && y >= 0 && y < 50 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
              buildableSpaces++;
            }
          }
        }
        
        score += buildableSpaces;
      }
    }
    
    return score;
  },
  
  /**
   * 开始扩张流程
   * @param {Room} baseRoom - 基地房间
   * @param {string} targetRoomName - 目标房间名称
   */
  startExpansion(baseRoom, targetRoomName) {
    // 检查是否已经有扩张任务
    if (Memory.expansion && Memory.expansion.targetRoom === targetRoomName) {
      return;
    }
    
    // 创建扩张内存结构
    Memory.expansion = {
      baseRoom: baseRoom.name,
      targetRoom: targetRoomName,
      phase: 'scout', // 扩张阶段：scout, claim, build
      startTime: Game.time,
      creeps: []
    };
    
    console.log(`开始扩张到新房间: ${targetRoomName}，基地房间: ${baseRoom.name}`);
    
    // 创建侦察兵
    this.spawnScout(baseRoom, targetRoomName);
  },
  
  /**
   * 生成侦察兵
   * @param {Room} baseRoom - 基地房间
   * @param {string} targetRoomName - 目标房间名称
   */
  spawnScout(baseRoom, targetRoomName) {
    const spawns = baseRoom.find(FIND_MY_SPAWNS, {
      filter: spawn => !spawn.spawning
    });
    
    if (spawns.length === 0) {
      return;
    }
    
    const spawn = spawns[0];
    const scoutName = `scout_${Game.time}`;
    
    // 创建一个简单的侦察兵
    const result = spawn.spawnCreep([MOVE], scoutName, {
      memory: {
        role: 'scout',
        targetRoom: targetRoomName,
        home: baseRoom.name
      }
    });
    
    if (result === OK) {
      Memory.expansion.creeps.push(scoutName);
      console.log(`生成侦察兵 ${scoutName} 前往房间 ${targetRoomName}`);
    }
  },
  
  /**
   * 处理扩张任务
   * 这个方法应该在main循环中调用
   */
  processExpansion() {
    if (!Memory.expansion) {
      return;
    }
    
    const expansion = Memory.expansion;
    const baseRoom = Game.rooms[expansion.baseRoom];
    
    // 检查扩张是否超时
    const expansionTimeout = 10000; // ticks
    if (Game.time - expansion.startTime > expansionTimeout) {
      console.log(`扩张到房间 ${expansion.targetRoom} 超时，取消扩张`);
      delete Memory.expansion;
      return;
    }
    
    // 根据不同阶段处理扩张
    switch (expansion.phase) {
      case 'scout':
        this.processScoutPhase();
        break;
      case 'claim':
        this.processClaimPhase();
        break;
      case 'build':
        this.processBuildPhase();
        break;
    }
  },
  
  /**
   * 处理侦察阶段
   */
  processScoutPhase() {
    const expansion = Memory.expansion;
    
    // 检查是否有侦察兵到达目标房间
    if (Game.rooms[expansion.targetRoom]) {
      // 我们有房间视野，评估房间
      const room = Game.rooms[expansion.targetRoom];
      
      // 检查房间是否已被占领
      if (room.controller && room.controller.owner && !room.controller.my) {
        console.log(`房间 ${expansion.targetRoom} 已被其他玩家占领，取消扩张`);
        
        // 将房间标记为不适合扩张
        if (!Memory.unsuitable_rooms) {
          Memory.unsuitable_rooms = {};
        }
        Memory.unsuitable_rooms[expansion.targetRoom] = {
          reason: 'occupied',
          owner: room.controller.owner.username,
          timestamp: Game.time
        };
        
        delete Memory.expansion;
        return;
      }
      
      // 检查房间是否有足够的资源
      const sources = room.find(FIND_SOURCES);
      if (sources.length < 1) {
        console.log(`房间 ${expansion.targetRoom} 能量源不足，取消扩张`);
        delete Memory.expansion;
        return;
      }
      
      // 侦察成功，进入占领阶段
      expansion.phase = 'claim';
      console.log(`房间 ${expansion.targetRoom} 侦察完成，开始占领阶段`);
      
      // 生成占领者
      this.spawnClaimer(Game.rooms[expansion.baseRoom], expansion.targetRoom);
    } else {
      // 检查侦察兵是否存活
      let scoutAlive = false;
      for (const creepName of expansion.creeps) {
        if (Game.creeps[creepName] && Game.creeps[creepName].memory.role === 'scout') {
          scoutAlive = true;
          break;
        }
      }
      
      // 如果没有侦察兵，重新生成
      if (!scoutAlive) {
        this.spawnScout(Game.rooms[expansion.baseRoom], expansion.targetRoom);
      }
    }
  },
  
  /**
   * 生成占领者
   * @param {Room} baseRoom - 基地房间
   * @param {string} targetRoomName - 目标房间名称
   */
  spawnClaimer(baseRoom, targetRoomName) {
    const spawns = baseRoom.find(FIND_MY_SPAWNS, {
      filter: spawn => !spawn.spawning
    });
    
    if (spawns.length === 0) {
      return;
    }
    
    const spawn = spawns[0];
    const claimerName = `claimer_${Game.time}`;
    
    // 创建占领者
    const result = spawn.spawnCreep([CLAIM, MOVE], claimerName, {
      memory: {
        role: 'claimer',
        targetRoom: targetRoomName,
        home: baseRoom.name
      }
    });
    
    if (result === OK) {
      Memory.expansion.creeps.push(claimerName);
      console.log(`生成占领者 ${claimerName} 前往房间 ${targetRoomName}`);
    }
  },
  
  /**
   * 处理占领阶段
   */
  processClaimPhase() {
    const expansion = Memory.expansion;
    
    // 检查目标房间是否已被占领
    if (Game.rooms[expansion.targetRoom] && 
        Game.rooms[expansion.targetRoom].controller && 
        Game.rooms[expansion.targetRoom].controller.my) {
      // 已成功占领，进入建造阶段
      expansion.phase = 'build';
      console.log(`房间 ${expansion.targetRoom} 已成功占领，开始建造阶段`);
      
      // 生成建造者和采集者
      this.spawnBuilders(Game.rooms[expansion.baseRoom], expansion.targetRoom);
      return;
    }
    
    // 检查占领者是否存活
    let claimerAlive = false;
    for (const creepName of expansion.creeps) {
      if (Game.creeps[creepName] && Game.creeps[creepName].memory.role === 'claimer') {
        claimerAlive = true;
        break;
      }
    }
    
    // 如果没有占领者，重新生成
    if (!claimerAlive) {
      this.spawnClaimer(Game.rooms[expansion.baseRoom], expansion.targetRoom);
    }
  },
  
  /**
   * 生成建造者
   * @param {Room} baseRoom - 基地房间
   * @param {string} targetRoomName - 目标房间名称
   */
  spawnBuilders(baseRoom, targetRoomName) {
    const spawns = baseRoom.find(FIND_MY_SPAWNS, {
      filter: spawn => !spawn.spawning
    });
    
    if (spawns.length === 0) {
      return;
    }
    
    const spawn = spawns[0];
    
    // 生成多个建造者
    for (let i = 0; i < 3; i++) {
      const builderName = `builder_${Game.time}_${i}`;
      
      // 创建建造者
      const result = spawn.spawnCreep(
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE], 
        builderName, 
        {
          memory: {
            role: 'builder',
            targetRoom: targetRoomName,
            home: baseRoom.name
          }
        }
      );
      
      if (result === OK) {
        Memory.expansion.creeps.push(builderName);
        console.log(`生成建造者 ${builderName} 前往房间 ${targetRoomName}`);
      }
    }
  },
  
  /**
   * 处理建造阶段
   */
  processBuildPhase() {
    const expansion = Memory.expansion;
    
    // 检查目标房间是否有出生点
    if (Game.rooms[expansion.targetRoom]) {
      const spawns = Game.rooms[expansion.targetRoom].find(FIND_MY_SPAWNS);
      
      if (spawns.length > 0) {
        // 已成功建造出生点，扩张完成
        console.log(`房间 ${expansion.targetRoom} 扩张完成，已建造出生点`);
        delete Memory.expansion;
        return;
      }
      
      // 检查是否有出生点建筑工地
      const spawnSites = Game.rooms[expansion.targetRoom].find(FIND_CONSTRUCTION_SITES, {
        filter: site => site.structureType === STRUCTURE_SPAWN
      });
      
      // 如果没有出生点建筑工地，创建一个
      if (spawnSites.length === 0) {
        this.createSpawnConstructionSite(Game.rooms[expansion.targetRoom]);
      }
    }
    
    // 检查建造者是否足够
    let builderCount = 0;
    for (const creepName of expansion.creeps) {
      if (Game.creeps[creepName] && Game.creeps[creepName].memory.role === 'builder') {
        builderCount++;
      }
    }
    
    // 如果建造者不足，生成更多
    if (builderCount < 3) {
      this.spawnBuilders(Game.rooms[expansion.baseRoom], expansion.targetRoom);
    }
  },
  
  /**
   * 在新房间创建出生点建筑工地
   * @param {Room} room - 目标房间
   */
  createSpawnConstructionSite(room) {
    // 寻找合适的位置建造出生点
    // 优先选择靠近能量源的位置
    const sources = room.find(FIND_SOURCES);
    if (sources.length === 0) {
      return;
    }
    
    const source = sources[0];
    const terrain = room.getTerrain();
    
    // 在能量源周围寻找合适的位置
    for (let radius = 2; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          
          const x = source.pos.x + dx;
          const y = source.pos.y + dy;
          
          // 检查位置是否在房间边界内
          if (x < 1 || x > 48 || y < 1 || y > 48) {
            continue;
          }
          
          // 检查地形是否可通行
          if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
            continue;
          }
          
          // 检查位置是否已有建筑或建筑工地
          const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
          const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
          
          if (structures.length === 0 && constructionSites.length === 0) {
            // 创建新的出生点建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_SPAWN);
            if (result === OK) {
              console.log(`在房间 ${room.name} 创建了出生点建筑工地，坐标: ${x},${y}`);
              return;
            }
          }
        }
      }
    }
  }
};