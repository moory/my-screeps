const roomManager = require('./managers/roomManager');
const memoryManager = require('./managers/memoryManager');
const cpuManager = require('./managers/cpuManager');
const { tryCatch } = require('./utils/errorCatcher');
const constructionManager = require('./managers/constructionManager');
const expansionManager = require('./managers/expansionManager');

module.exports.loop = function () {
  tryCatch(() => {
    memoryManager.run();

    // 调用扩张管理器
    expansionManager.run(Game);

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      roomManager.run(room);
    }

    cpuManager.run();
  });
};