module.exports = {
  run(room) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      Game.notify(`Hostiles detected in room ${room.name}`);
    }
  },
};