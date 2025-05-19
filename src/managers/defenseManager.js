module.exports = {
  run(room) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
       // 提取敌人用户名（去重）
       const hostileUsers = [...new Set(hostiles.map(c => c.owner.username))];
       
       // 检查是否所有入侵者都是 NPC (Invader 或 Source Keeper)
       const isAllNPC = hostileUsers.every(username => username === 'Invader' || username === 'Source Keeper');
       
       // 只有当入侵者不全是 NPC 或入侵者数量大于1时才发送通知
       if (!isAllNPC || hostiles.length > 1) {
         Game.notify(`⚠️ 警告：检测到 ${hostiles.length} 个敌对 creep 入侵房间 ${room.name}，入侵者：${hostileUsers.join(', ')}`);
       }
      
      // 激活安全模式（如果可用且敌人数量超过阈值）
      if (hostiles.length >= 3 && room.controller && 
          room.controller.my && !room.controller.safeMode && 
          room.controller.safeModeAvailable > 0) {
        // 只有当我们的 creep 数量少于敌人的两倍时才激活安全模式
        const myCreeps = room.find(FIND_MY_CREEPS);
        if (myCreeps.length < hostiles.length * 2) {
          room.controller.activateSafeMode();
          Game.notify(`房间 ${room.name} 已激活安全模式以应对入侵！`);
        }
      }
      
      // 在有敌人时，将所有 creep 召集到出生点附近
      if (room.memory.underAttack !== true) {
        room.memory.underAttack = true;
        console.log(`⚠️ 房间 ${room.name} 正在遭受攻击！`);
      }
    } else if (room.memory.underAttack) {
      // 解除警报
      delete room.memory.underAttack;
      console.log(`✅ 房间 ${room.name} 的威胁已解除`);
    }
  },
};