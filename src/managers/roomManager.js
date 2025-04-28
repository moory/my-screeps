const creepManager = require('./creepManager');
const structureManager = require('./structureManager');
const defenseManager = require('./defenseManager');
const spawnManager = require('./spawnManager');

module.exports = {
  run(room) {
    spawnManager.run(room);
    creepManager.run(room);
    structureManager.run(room);
    defenseManager.run(room);
  },
};