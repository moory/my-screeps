/**
 * 建筑管理模块
 * 负责自动规划和建造房间内的建筑
 */
module.exports = {
  /**
   * 运行建筑管理器
   * @param {Room} room - 要管理的房间
   */
  run(room) {
    // 检查是否有建筑工地需要创建
    this.checkConstructionSites(room);
    
    // 规划新的建筑
    this.planBuildings(room);
  },

  /**
   * 检查现有的建筑工地
   * @param {Room} room - 要检查的房间
   */
  checkConstructionSites(room) {
    // 获取房间中所有的建筑工地
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    
    // 如果建筑工地数量达到上限，则不再创建新的
    if (sites.length >= 10) { // 游戏限制每个房间最多10个建筑工地
      return;
    }
  },

  /**
   * 规划新的建筑
   * @param {Room} room - 要规划的房间
   */
  planBuildings(room) {
    // 只有当房间控制器存在且被我们控制时才规划建筑
    if (!room.controller || !room.controller.my) {
      return;
    }

    // 根据控制器等级规划不同的建筑
    const level = room.controller.level;
    
    // 检查并建造扩展
    this.planExtensions(room, level);
    
    // 检查并建造塔
    this.planTowers(room, level);
    
    // 检查并建造存储和链接
    if (level >= 4) {
      this.planStorage(room);
    }
    
    // 高级建筑
    if (level >= 6) {
      this.planTerminal(room);
      this.planLabs(room);
    }
  },

  /**
   * 规划扩展
   * @param {Room} room - 要规划的房间
   * @param {number} level - 控制器等级
   */
  planExtensions(room, level) {
    // 根据控制器等级确定可以建造的扩展数量
    const maxExtensions = {
      1: 0,
      2: 5,
      3: 10,
      4: 20,
      5: 30,
      6: 40,
      7: 50,
      8: 60
    }[level] || 0;
    
    // 获取当前已有的扩展数量
    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    });
    
    // 如果已有的扩展数量达到上限，则不再建造
    if (extensions.length >= maxExtensions) {
      return;
    }
    
    // 寻找合适的位置建造扩展
    // 这里使用简单的策略：在出生点周围寻找空地
    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length === 0) {
      return;
    }
    
    const spawn = spawns[0];
    const terrain = room.getTerrain();
    
    // 在出生点周围的区域寻找空地
    for (let x = spawn.pos.x - 5; x <= spawn.pos.x + 5; x++) {
      for (let y = spawn.pos.y - 5; y <= spawn.pos.y + 5; y++) {
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
          // 创建新的扩展建筑工地
          const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
          if (result === OK) {
            // 每次只创建一个，避免一次创建太多
            return;
          }
        }
      }
    }
  },

  /**
   * 规划防御塔
   * @param {Room} room - 要规划的房间
   * @param {number} level - 控制器等级
   */
  planTowers(room, level) {
    // 根据控制器等级确定可以建造的塔数量
    const maxTowers = {
      1: 0,
      2: 0,
      3: 1,
      4: 1,
      5: 2,
      6: 2,
      7: 3,
      8: 6
    }[level] || 0;
    
    // 获取当前已有的塔数量
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });
    
    // 如果已有的塔数量达到上限，则不再建造
    if (towers.length >= maxTowers) {
      return;
    }
    
    // 寻找合适的位置建造塔
    // 策略：在房间中心区域建造，便于覆盖整个房间
    const center = this.getRoomCenter(room);
    
    // 在中心点周围寻找空地
    for (let radius = 2; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // 只考虑半径为radius的圆周上的点
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          
          const x = center.x + dx;
          const y = center.y + dy;
          
          // 检查位置是否在房间边界内
          if (x < 1 || x > 48 || y < 1 || y > 48) {
            continue;
          }
          
          // 检查地形是否可通行
          const terrain = room.getTerrain();
          if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
            continue;
          }
          
          // 检查位置是否已有建筑或建筑工地
          const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
          const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
          
          if (structures.length === 0 && constructionSites.length === 0) {
            // 创建新的塔建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_TOWER);
            if (result === OK) {
              return;
            }
          }
        }
      }
    }
  },

  /**
   * 规划存储
   * @param {Room} room - 要规划的房间
   */
  planStorage(room) {
    // 检查是否已有存储
    const storage = room.storage;
    if (storage) {
      return;
    }
    
    // 检查是否已有存储建筑工地
    const storageSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: { structureType: STRUCTURE_STORAGE }
    });
    
    if (storageSites.length > 0) {
      return;
    }
    
    // 在房间中心附近寻找合适的位置建造存储
    const center = this.getRoomCenter(room);
    const terrain = room.getTerrain();
    
    for (let radius = 3; radius <= 6; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          
          const x = center.x + dx;
          const y = center.y + dy;
          
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
            // 创建新的存储建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_STORAGE);
            if (result === OK) {
              return;
            }
          }
        }
      }
    }
  },

  /**
   * 规划终端
   * @param {Room} room - 要规划的房间
   */
  planTerminal(room) {
    // 检查是否已有终端
    const terminal = room.terminal;
    if (terminal) {
      return;
    }
    
    // 检查是否已有终端建筑工地
    const terminalSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: { structureType: STRUCTURE_TERMINAL }
    });
    
    if (terminalSites.length > 0) {
      return;
    }
    
    // 在存储附近寻找合适的位置建造终端
    if (!room.storage) {
      return;
    }
    
    const storage = room.storage;
    const terrain = room.getTerrain();
    
    for (let radius = 2; radius <= 4; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          
          const x = storage.pos.x + dx;
          const y = storage.pos.y + dy;
          
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
            // 创建新的终端建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_TERMINAL);
            if (result === OK) {
              return;
            }
          }
        }
      }
    }
  },

  /**
   * 规划实验室
   * @param {Room} room - 要规划的房间
   */
  planLabs(room) {
    // 根据控制器等级确定可以建造的实验室数量
    const maxLabs = {
      6: 3,
      7: 6,
      8: 10
    }[room.controller.level] || 0;
    
    // 获取当前已有的实验室数量
    const labs = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_LAB }
    });
    
    // 如果已有的实验室数量达到上限，则不再建造
    if (labs.length >= maxLabs) {
      return;
    }
    
    // 检查是否已有实验室建筑工地
    const labSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: { structureType: STRUCTURE_LAB }
    });
    
    // 计算总数
    if (labs.length + labSites.length >= maxLabs) {
      return;
    }
    
    // 在房间的一角寻找合适的位置建造实验室集群
    // 实验室应该靠近放置在一起，以便于反应
    const terrain = room.getTerrain();
    
    // 如果没有实验室，先确定一个起始位置
    if (labs.length === 0 && labSites.length === 0) {
      // 选择房间的一角
      const corners = [
        {x: 10, y: 10},
        {x: 10, y: 40},
        {x: 40, y: 10},
        {x: 40, y: 40}
      ];
      
      // 选择最适合的角落
      for (const corner of corners) {
        // 检查3x3区域是否适合建造实验室集群
        let suitable = true;
        
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const x = corner.x + dx;
            const y = corner.y + dy;
            
            // 检查位置是否在房间边界内
            if (x < 1 || x > 48 || y < 1 || y > 48) {
              suitable = false;
              break;
            }
            
            // 检查地形是否可通行
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
              suitable = false;
              break;
            }
            
            // 检查位置是否已有建筑
            const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
            if (structures.length > 0) {
              suitable = false;
              break;
            }
          }
          
          if (!suitable) {
            break;
          }
        }
        
        if (suitable) {
          // 在中心位置建造第一个实验室
          const result = room.createConstructionSite(corner.x, corner.y, STRUCTURE_LAB);
          if (result === OK) {
            return;
          }
        }
      }
    } else {
      // 已有实验室，在周围继续建造
      const existingLab = labs.length > 0 ? labs[0] : labSites[0];
      const centerX = existingLab.pos.x;
      const centerY = existingLab.pos.y;
      
      // 在周围寻找空位
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          // 跳过中心点
          if (dx === 0 && dy === 0) {
            continue;
          }
          
          const x = centerX + dx;
          const y = centerY + dy;
          
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
            // 创建新的实验室建筑工地
            const result = room.createConstructionSite(x, y, STRUCTURE_LAB);
            if (result === OK) {
              return;
            }
          }
        }
      }
    }
  },

  /**
   * 获取房间中心位置
   * @param {Room} room - 房间
   * @returns {Object} 中心坐标
   */
  getRoomCenter(room) {
    // 获取所有我的建筑
    const myStructures = room.find(FIND_MY_STRUCTURES);
    
    // 如果没有建筑，使用第一个出生点作为中心
    if (myStructures.length === 0) {
      const spawns = room.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) {
        return {x: spawns[0].pos.x, y: spawns[0].pos.y};
      }
      // 如果没有出生点，使用房间几何中心
      return {x: 25, y: 25};
    }
    
    // 计算所有建筑的平均位置
    let sumX = 0;
    let sumY = 0;
    
    for (const structure of myStructures) {
      sumX += structure.pos.x;
      sumY += structure.pos.y;
    }
    
    return {
      x: Math.round(sumX / myStructures.length),
      y: Math.round(sumY / myStructures.length)
    };
  }
};