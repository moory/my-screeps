module.exports = {
  run(creep) {
    // 1) 先移到目标房间
    if (creep.room.name !== creep.memory.targetRoom) {
      const exit = creep.room.findExitTo(creep.memory.targetRoom);
      creep.moveTo(creep.pos.findClosestByRange(exit));
      return;
    }

    // 2) 到房间后，拿 Controller 升到自己名下
    const ctrl = creep.room.controller;
    if (ctrl) {
      // 如果 RCL 还是 0，直接 claim，成功后 RCL===1
      if (!ctrl.owner || !ctrl.my) {
        const res = creep.claimController(ctrl);
        if (res === OK) {
          creep.say('Claimed! 👍');
        }
      }
    }
  }
};