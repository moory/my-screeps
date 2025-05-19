// Link管理器，用于管理房间中的Link结构
const linkManager = {
  // 运行Link管理器
  run(room) {
    // 查找房间中的所有Link结构
    const links = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_LINK }
    });

    // 如果没有Link结构，直接返回
    if (links.length === 0) return;

    // 识别sourceLink和targetLink
    const [sourceLink, targetLink] = this.identifyLinks(links);

    // 如果识别到sourceLink和targetLink，并且sourceLink中有能量，则进行能量传输
    if (sourceLink && targetLink && sourceLink.store[RESOURCE_ENERGY] > 0) {
      sourceLink.transferEnergy(targetLink);
    }
  },

  // 识别sourceLink和targetLink
  identifyLinks(links) {
    let sourceLink = null;
    let targetLink = null;

    // 遍历所有Link，识别sourceLink和targetLink
    links.forEach(link => {
      // 如果Link在控制器附近，则认为是targetLink
      if (link.pos.inRangeTo(link.room.controller, 3)) {
        targetLink = link;
      } else {
        // 否则认为是sourceLink
        sourceLink = link;
      }
    });

    // 返回识别结果
    return [sourceLink, targetLink];
  }
};

// 导出Link管理器模块
module.exports = linkManager;