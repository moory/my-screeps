module.exports = {
    run(room) {
        const getCreepsByRole = (role) =>
            room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === role });

        const harvesters = getCreepsByRole('harvester');
        const builders = getCreepsByRole('builder');
        const upgraders = getCreepsByRole('upgrader');
        const repairers = getCreepsByRole('repairer');
        const miners = getCreepsByRole('miner');
        const collectors = getCreepsByRole('collector');
        const defenders = getCreepsByRole('defender');
        const transporters = getCreepsByRole('transporter');

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) return;

        // 根据RCL和情况动态调整所需数量
        const baseHarvesters = 2//room.controller.level < 3 ? 2 : 2;
        const desiredBuilders = room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 2 : 1;
        const desiredRepairers =  room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.8 &&
                (s.structureType !== STRUCTURE_WALL || s.hits < 10000) &&
                (s.structureType !== STRUCTURE_RAMPART || s.hits < 10000)
        }).length > 0 ? 1 : 1;
        
        const desiredMiners = room.controller.level >= 2 ? 2 : 0;

        // 检查是否有掉落资源或墓碑来决定是否需要收集者
        const droppedResources = room.find(FIND_DROPPED_RESOURCES);
        const tombstones = room.find(FIND_TOMBSTONES, {
            filter: tomb => tomb.store.getUsedCapacity() > 0
        });
        const ruins = room.find(FIND_RUINS, {
            filter: ruin => ruin.store.getUsedCapacity() > 0
        });
        const desiredDefenders = 2;
        // 如果有掉落资源、墓碑或废墟，则需要收集者
        const desiredCollectors = (droppedResources.length > 0 || tombstones.length > 0 || ruins.length > 0) ? 1 : 0;
        
        // 运输者数量：根据房间等级和矿工数量决定
        const desiredTransporters = 1;//room.controller.level >= 3 ? Math.min(miners.length, 2) : 0;

        // 优化后的身体部件模板 - 根据房间等级动态调整
        const bodyTemplates = {
            // 采集者：基础配置更轻量，适合低级房间
            harvester: {
                base: [WORK, CARRY, MOVE],
                pattern: [CARRY, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 4 : 2
            },
            // 工人：平衡建造和升级能力
            worker: {
                base: [WORK, CARRY, MOVE],
                pattern: [WORK, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 4 : 2
            },
            // 修理者：基础配置更轻量
            repairer: {
                base: [WORK, CARRY, MOVE, MOVE],
                pattern: [WORK, CARRY, CARRY, MOVE, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 2 : 1
            },
            // 矿工：根据房间等级调整
            miner: {
                base: room.controller.level >= 4 ? 
                    [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE] : 
                    [WORK, WORK, CARRY, MOVE],
                pattern: [],
                maxPatternRepeats: 0
            },
            // 升级者：基础配置更轻量
            upgrader: {
                base: [WORK, CARRY, MOVE],
                pattern: [WORK, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 4 : 2
            },
            // 防御者：基础配置更轻量
            defender: {
                base: [TOUGH, ATTACK, MOVE, MOVE],
                pattern: [ATTACK, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 3 : 1
            },
            // 收集者：新增角色，专注于收集掉落资源
            collector: {
                base: [CARRY, CARRY, MOVE, MOVE],
                pattern: [CARRY, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 3 : 1
            },
            
            // 运输者：专注于运输能量
            transporter: {
                base: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
                pattern: [CARRY, CARRY, MOVE],
                maxPatternRepeats: room.controller.level >= 4 ? 4 : 2
            }
        };

        // 根据可用能量生成最优身体部件
        const generateOptimalBody = (role) => {
            const energyAvailable = room.energyAvailable;
            const energyCapacity = room.energyCapacityAvailable;

            // 选择合适的模板
            let template;
            if (role === 'miner') {
                template = bodyTemplates.miner;
            } else if (role === 'harvester') {
                template = bodyTemplates.harvester;
            } else if (role === 'repairer') {
                template = bodyTemplates.repairer;
            } else if (role === 'upgrader' && bodyTemplates.upgrader) {
                template = bodyTemplates.upgrader;
            } else if (role === 'builder' && bodyTemplates.worker) {
                template = bodyTemplates.worker;
            } else if (role === 'defender' && bodyTemplates.defender) {
                template = bodyTemplates.defender;
            } else {
                template = bodyTemplates.worker;
            }

            // 特殊处理矿工
            if (role === 'miner') {
                // 如果能量足够，直接返回固定的矿工身体
                if (energyAvailable >= _.sum(template.base.map(p => BODYPART_COST[p]))) {
                    return template.base;
                } else if (energyAvailable >= 500) {
                    // 否则生成一个低配矿工
                    return [WORK, WORK, WORK, MOVE, MOVE];
                }
                // 否则降级为基础矿工
                else if (energyAvailable >= 300) {
                    return [WORK, WORK, MOVE];
                }
                return null;
            }

            // 其他角色的身体生成
            let body = [...template.base];
            const baseCost = _.sum(body.map(p => BODYPART_COST[p]));

            // 如果模板有pattern且能量足够
            if (template.pattern.length > 0) {
                const patternCost = _.sum(template.pattern.map(p => BODYPART_COST[p]));

                // 计算可以添加多少个pattern
                const maxRepeats = Math.min(
                    Math.floor((energyCapacity - baseCost) / patternCost),
                    template.maxPatternRepeats
                );

                // 添加pattern
                for (let i = 0; i < maxRepeats; i++) {
                    body.push(...template.pattern);
                }

                // 如果当前能量不足以生成完整身体，逐步缩减
                while (_.sum(body.map(p => BODYPART_COST[p])) > energyAvailable) {
                    if (body.length <= template.base.length) break;

                    // 优先移除最后一个完整pattern
                    if (body.length >= template.base.length + template.pattern.length) {
                        body.splice(body.length - template.pattern.length, template.pattern.length);
                    } else {
                        // 如果不能完整移除pattern，则从后往前移除单个部件
                        const idx =
                            body.lastIndexOf(WORK) >= 0 ? body.lastIndexOf(WORK) :
                                body.lastIndexOf(CARRY) >= 0 ? body.lastIndexOf(CARRY) :
                                    body.lastIndexOf(MOVE);
                        if (idx !== -1) body.splice(idx, 1);
                        else break;
                    }
                }
            }

            // 确保身体部件不超过50个
            if (body.length > 50) {
                body = body.slice(0, 50);
            }

            const finalCost = _.sum(body.map(p => BODYPART_COST[p]));

            // 确保基本功能完整
            const hasBasicParts = role === 'miner'
                ? body.includes(WORK) && body.includes(MOVE)
                : body.includes(WORK) && body.includes(CARRY) && body.includes(MOVE);

            return (finalCost <= energyAvailable && hasBasicParts) ? body : null;
        };

        // 生成creep
        const spawnRole = (role) => {
            const body = generateOptimalBody(role);
            if (!body) {
                console.log(`⚠️ 无法为角色生成有效身体: ${role}`);
                return false;
            }

            // 计算身体部件统计
            const stats = body.reduce((acc, part) => {
                acc[part] = (acc[part] || 0) + 1;
                return acc;
            }, {});

            const result = spawn.spawnCreep(
                body,
                `${role[0].toUpperCase()}${role.slice(1)}_${Game.time}`,
                { memory: { role } }
            );

            if (result === OK) {
                console.log(`🛠️ 正在生成 ${role}: ${JSON.stringify(stats)} (总成本: ${_.sum(body.map(p => BODYPART_COST[p]))})`);
                return true;
            }
            console.log(`⚠️ 生成 ${role} 失败: ${result}`);
            return false;
        };

        // 应急逻辑：最低成本 fallback（只在没有 harvester 时触发）
        if (harvesters.length < 1) {
            const energy = room.energyAvailable;
            const emergencyBody = energy >= 350
                ? [WORK, WORK, CARRY, MOVE, MOVE]
                : energy >= 200
                    ? [WORK, CARRY, MOVE]
                    : null;

            if (emergencyBody) {
                const result = spawn.spawnCreep(
                    emergencyBody,
                    `EmergencyHarvester_${Game.time}`,
                    { memory: { role: 'harvester', emergency: true } }
                );
                if (result === OK) {
                    console.log(`🚨 紧急采集者已生成!`);
                } else {
                    console.log(`❌ 紧急生成失败: ${result}, 能量: ${energy}/${room.energyCapacityAvailable}`);
                }
            } else {
                console.log(`🚫 能量不足 (${energy}) 无法生成紧急采集者.`);
            }
            return;
        }
        
        // 生成优先级
        const spawnPriority = [
            // 优先生成防御者
            { condition: room.memory.underAttack && defenders.length < 2, role: 'defender' },
            { condition: harvesters.length < baseHarvesters, role: 'harvester' },
            { condition: upgraders.length < 2, role: 'upgrader' },
            { condition: builders.length < desiredBuilders, role: 'builder' },
            { condition: repairers.length < desiredRepairers, role: 'repairer' },
            { condition: miners.length < desiredMiners, role: 'miner' },
            { condition: collectors.length < desiredCollectors && desiredCollectors > 0, role: 'collector' },
            { condition: transporters.length < desiredTransporters && desiredTransporters > 0, role: 'transporter' },
        ];

        // 添加调试信息
        console.log(`房间 ${room.name} 能量: ${room.energyAvailable}/${room.energyCapacityAvailable}`);
        console.log(`当前房间 ${room.name} creep 数量: 采集者=${harvesters.length}/${baseHarvesters}, 收集者=${collectors.length}/${desiredCollectors}, 升级者=${upgraders.length}/2, 建造者=${builders.length}/${desiredBuilders}, 修理工=${repairers.length}/${desiredRepairers}, 矿工=${miners.length}/${desiredMiners}, 防御者=${defenders.length}/${desiredDefenders} `);

        // 尝试按优先级生成creep
        let spawnAttempted = false;
        for (const { condition, role } of spawnPriority) {
            if (condition) {
                console.log(`尝试生成 ${role}...`);
                if (spawnRole(role)) {
                    spawnAttempted = true;
                    break;
                }
            }
        }

        // 如果没有尝试生成任何creep，输出调试信息
        if (!spawnAttempted) {
            console.log(`没有需要生成的creep，所有角色数量已满足需求`);
        }
    }
};