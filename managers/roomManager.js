const creepManager = require('./creepManager');
const structureManager = require('./structureManager');
const defenseManager = require('./defenseManager');

module.exports = {
  run(room) {
    creepManager.run(room);
    structureManager.run(room);
    defenseManager.run(room);
  },
};