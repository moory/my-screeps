const roomManager = require('roomManager');
const memoryManager = require('memoryManager');
const cpuManager = require('cpuManager');
const { tryCatch } = require('errorCatcher');

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