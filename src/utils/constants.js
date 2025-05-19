/**
 * 游戏常量配置文件
 * 集中管理所有在代码中使用的常量值
 */

// 角色相关常量
const ROLES = {
  HARVESTER: 'harvester',
  BUILDER: 'builder',
  UPGRADER: 'upgrader',
  REPAIRER: 'repairer',
  MINER: 'miner'
};

// 结构类型常量（方便引用，避免拼写错误）
const STRUCTURE_TYPES = {
  SPAWN: STRUCTURE_SPAWN,
  EXTENSION: STRUCTURE_EXTENSION,
  ROAD: STRUCTURE_ROAD,
  WALL: STRUCTURE_WALL,
  RAMPART: STRUCTURE_RAMPART,
  CONTAINER: STRUCTURE_CONTAINER,
  STORAGE: STRUCTURE_STORAGE,
  TOWER: STRUCTURE_TOWER,
  CONTROLLER: STRUCTURE_CONTROLLER
};

// 资源类型
const RESOURCES = {
  ENERGY: RESOURCE_ENERGY
};

// 移动方向常量
const DIRECTIONS = {
  TOP: TOP,
  TOP_RIGHT: TOP_RIGHT,
  RIGHT: RIGHT,
  BOTTOM_RIGHT: BOTTOM_RIGHT,
  BOTTOM: BOTTOM,
  BOTTOM_LEFT: BOTTOM_LEFT,
  LEFT: LEFT,
  TOP_LEFT: TOP_LEFT
};

// 寻路相关常量
const PATHFINDING = {
  // 路径可视化样式
  VISUAL_STYLE: {
    HARVEST: { stroke: '#ffaa00' },
    BUILD: { stroke: '#ffffff' },
    REPAIR: { stroke: '#ff00ff' },
    UPGRADE: { stroke: '#ffffff' }
  },
  // 路径重用时间
  REUSE_PATH: {
    DEFAULT: 3,
    LONG: 5
  }
};

// 建筑维护相关常量
const MAINTENANCE = {
  // 道路和容器修理阈值（低于最大生命值的百分比）
  INFRASTRUCTURE_REPAIR_THRESHOLD: 0.5,
  // 防御建筑修理上限（对于creep）
  DEFENSE_REPAIR_LIMIT: 100000,
  // 防御建筑建造上限（对于tower）
  DEFENSE_BUILD_LIMIT: 300000,
};

// Creep 行为相关常量
const BEHAVIOR = {
  // 卡住检测阈值
  STUCK_THRESHOLD: 10,
  // 掉落能量最小拾取量
  MIN_DROPPED_ENERGY: 50
};

// 房间管理相关常量
const ROOM_MANAGEMENT = {
  // 塔能量保留比例（用于防御）
  TOWER_ENERGY_RESERVE: 0.5
};

// Creep 身体部件模板
const BODY_TEMPLATES = {
  HARVESTER: {
    BASE: [WORK, CARRY, MOVE],
    PATTERN: [WORK, CARRY, CARRY, MOVE, MOVE],
    MAX_PATTERN_REPEATS: 2
  },
  WORKER: {
    BASE: [WORK, CARRY, MOVE],
    PATTERN: [WORK, CARRY, MOVE],
    MAX_PATTERN_REPEATS: 4
  },
  REPAIRER: {
    BASE: [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
    PATTERN: [WORK, CARRY, CARRY, MOVE],
    MAX_PATTERN_REPEATS: 2
  },
  MINER: {
    BASE: [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE],
    PATTERN: [],
    MAX_PATTERN_REPEATS: 0
  },
  EMERGENCY: {
    HARVESTER: [WORK, WORK, CARRY, MOVE, MOVE]
  }
};

module.exports = {
  ROLES,
  STRUCTURE_TYPES,
  RESOURCES,
  DIRECTIONS,
  PATHFINDING,
  MAINTENANCE,
  BEHAVIOR,
  ROOM_MANAGEMENT,
  BODY_TEMPLATES
};