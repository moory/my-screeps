const HOME = Game.spawns['Spawn1'];
const ROOM = Game.rooms['E27N47'];
const CREEP_TOTAL = 12;
// const CREEP_NAME = 'Worker';
const AllWork = {'Home': '', 'Repair': '', 'Build': '', 'Upgrade': '', 'Attack': ''}

const Priority = {
    'Worker0': ['Home', 'Repair', 'Build', 'Upgrade', 'Attack'],
    'Worker1': ['Home', 'Repair', 'Build', 'Upgrade', 'Attack'],
    'Worker2': ['Home', 'Repair', 'Build', 'Upgrade', 'Attack'],
    'Worker3': ['Home', 'Repair', 'Build', 'Upgrade', 'Attack'],
    'Worker4': ['Home', 'Repair', 'Build', 'Upgrade', 'Attack'],
    'Worker5': ['Repair', 'Home', 'Build', 'Upgrade', 'Attack'],
    'Worker6': ['Repair', 'Home', 'Build', 'Upgrade', 'Attack'],
    'Worker7': ['Repair', 'Home', 'Build', 'Upgrade', 'Attack'],
    'Worker8': ['Build', 'Home', 'Repair', 'Upgrade', 'Attack'],
    'Worker9': ['Build', 'Home', 'Repair', 'Upgrade', 'Attack'],
    'Worker10': ['Upgrade', 'Home', 'Repair', 'Build', 'Attack'],
    'Worker11': ['Upgrade', 'Home', 'Repair', 'Build', 'Attack'],
}

let workName = {}


module.exports.loop = function () {

    if (Game.time % 10 === 0) {

        for (const j in AllWork) {
            AllWork[j] = feasibility(j)
        }

        for (const k in Game.creeps) {
            for(let i=0;i<Priority[k].length;i++){

                let work=Priority[k][i]

                if(AllWork[work]){
                    workName[k]=work;
                    break;
                }

            }
        }

        return;
    }

    let creepsCount = 0


    for (const k in Game.creeps) {
        creepsCount++;

        work(workName[k], Game.creeps[k], HOME)

    }

    if (creepsCount < CREEP_TOTAL) {
        born();
    }

}

/*
* 爆兵
* */
const born = () => {
    if (!Game.creeps["Worker0"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker0');
        return;
    }
    if (!Game.creeps["Worker1"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker1');
        return;
    }
    if (!Game.creeps["Worker2"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker2');
        return;
    }
    if (!Game.creeps["Worker3"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker3');
        return;
    }
    if (!Game.creeps["Worker4"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker4');
        return;
    }
    if (!Game.creeps["Worker5"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker5');
        return;
    }
    if (!Game.creeps["Worker6"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker6');
        return;
    }
    if (!Game.creeps["Worker7"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker7');
        return;
    }
    if (!Game.creeps["Worker8"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker8');
        return;
    }
    if (!Game.creeps["Worker9"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker9');
        return;
    }
    if (!Game.creeps["Worker10"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker10');
        return;
    }
    if (!Game.creeps["Worker11"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker11');
        return;
    }
    if (!Game.creeps["Worker12"]) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], 'Worker12');
        return;
    }

}

//可行性分析
const feasibility = (work) => {
    if (work === 'Home') {
        return HOME.energy !== HOME.energyCapacity;
    } else if (work === 'Build') {
        for (let k in Game.constructionSites) {
            return true
        }
        return false
    } else if (work === 'Repair') {
        for (let k in Game.structures) {
            if (Game.structures[k].hits < Game.structures[k].hitsMax) {
                return true
            }
        }
        return false
    } else if (work === 'Upgrade') {
        return true
    } else if (work === 'Attack') {
        return false
    }
    return false
}

const work = (w, c, t, s) => {
    if (w === 'Home') {
        home(c, t, s)
    } else if (w === 'Build') {
        build(c)
    } else if (w === 'Repair') {
        repair(c)
    } else if (w === 'Upgrade') {
        upgradeRCL(c)
    } else if (w === 'Attack') {
        console.log('error')
    }
    if (!w) {
        console.log('e')
    }
}

/*
* 采集
* */
const home = (c, t, s) => {
    if (c.carry.energy < c.carryCapacity) {
        let source = nearGold(c);
        if (c.harvest(source) === ERR_NOT_IN_RANGE) {
            c.moveTo(source);
        }
    } else {
        if (c.transfer(t, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            c.moveTo(t);
        }
    }
}

/*
* 建造
* */
const build = (c) => {
    for (let k in Game.constructionSites) {

        let target = Game.constructionSites[k];
        let source = nearGold(c);

        if (c.carry.energy === 0) {

            if (c.harvest(source) === ERR_NOT_IN_RANGE) {
                c.moveTo(source);
                return;
            }

        } else if (c.carry.energy === c.carryCapacity) {
            if (c.build(target) === ERR_NOT_IN_RANGE) {
                c.moveTo(target);
                return;
            }
        } else if (calcPath(target, c) > calcPath(source, c)) {//离矿更近

            let sources = c.room.find(FIND_SOURCES);
            if (c.harvest(source) === ERR_NOT_IN_RANGE) {
                c.moveTo(source);
                return;
            }

        } else {
            if (c.build(target) === ERR_NOT_IN_RANGE) {
                c.moveTo(target);
                return;
            }
        }


    }
}

/*
* 升级RCL
* */
const upgradeRCL = (c) => {
    let source = nearGold(c);

    if (c.carry.energy === 0) {
        if (c.harvest(source) === ERR_NOT_IN_RANGE) {
            c.moveTo(source);
        }
    } else if (c.carry.energy === c.carryCapacity) {
        if (c.upgradeController(ROOM.controller) === ERR_NOT_IN_RANGE) {
            c.moveTo(ROOM.controller);
        }
    } else if (calcPath(ROOM.controller, c) > calcPath(source, c)) {//离矿更近
        if (c.harvest(source) === ERR_NOT_IN_RANGE) {
            c.moveTo(source);
        }
    } else {
        if (c.upgradeController(ROOM.controller) === ERR_NOT_IN_RANGE) {
            c.moveTo(ROOM.controller);
        }
    }

}

/*维修*/
const repair = (c) => {
    let target = null;
    for (let k in Game.structures) {
        if (Game.structures[k].hits < Game.structures[k].hitsMax) {
            target = Game.structures[k];
            break;
        }
    }

    let source = nearGold(c);
    if (c.carry.energy === 0) {

        if (c.harvest(source) === ERR_NOT_IN_RANGE) {
            c.moveTo(source);
        }
    } else if (c.carry.energy === c.carryCapacity) {
        if (c.repair(target) === ERR_NOT_IN_RANGE) {
            c.moveTo(target);
        }
    } else if (calcPath(target, c) > calcPath(source, c)) {//离矿更近
        if (c.harvest(source) === ERR_NOT_IN_RANGE) {
            c.moveTo(source);
        }
    } else {
        if (c.repair(target) === ERR_NOT_IN_RANGE) {
            c.moveTo(target);
        }
    }

}

/*
* 计算最近的金矿
* */
const nearGold = (c) => {
    let sources = ROOM.find(FIND_SOURCES);
    if (calcPath(sources[0], c) < calcPath(sources[1], c)) {
        return sources[0]
    } else {
        return sources[1]
    }

}

/*
* 距离量算
* */
const calcPath = (t, c) => {
    return PathFinder.search(t.pos, c).cost
}

const findCreeps = (name) => {
    return Game.creeps[name]
}

//=========================================

// 修路
// Game.rooms['W14N11'].createConstructionSite(12,16,STRUCTURE_ROAD);


