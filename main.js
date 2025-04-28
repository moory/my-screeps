const roomManager = require('./managers/roomManager');
const memoryManager = require('./managers/memoryManager');
const cpuManager = require('./managers/cpuManager');
const { tryCatch } = require('./utils/errorCatcher');

module.exports.loop = function () {
  tryCatch(() => {
    memoryManager.run();

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      roomManager.run(room);
    }

    cpuManager.run();
  });
}