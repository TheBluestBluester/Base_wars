const { brs } = OMEGGA_UTIL;
const raycasttest = require('./Raycast');
const weplist = require('./Weaponslist');
const speciallist = require('./SpecialBrickSizeTable');
const fs = require('fs');

const clr = {
red: "<color=\"FF0000\">",
grn: "<color=\"00FF00\">",
ylw: "<color=\"FFFF00\">",
orn: "<color=\"FF9900\">",
dgrn: "<color=\"007700\">",
prpl: "<color=\"8822FF\">",
slv: "<color=\"ddddcc\">",
cyn: "<color=\"33ddff\">",
end: "</>"
}
let shoplist = [
	{weapon: 'micro smg', price: 20},
	{weapon: 'heavy smg', price: 60},
	{weapon: 'barrage launcher', price: 100, explosive: {radius: 30, damage: 12, penetration: 30}},
	{weapon: 'suppressed bullpup smg', price: 300},
	{weapon: 'auto shotgun', price: 440},
	{weapon: 'assault rifle', price: 600},
	{weapon: 'sniper', price: 840},
	{weapon: 'service rifle', price: 1100},
	{weapon: 'slug shotgun', price: 1200},
	{weapon: 'impact grenade launcher', price: 1600, explosive: {radius: 15, damage: 8, penetration: 10}},
	{weapon: 'classic assault rifle', price: 2100, trader: {tradeonly: false,discount: 0.5}},
	{weapon: 'bazooka', price: 2800, explosive: {radius: 30, damage: 8, penetration: 8}},
	{weapon: 'rocket launcher', price: 3800, explosive: {radius: 80, damage: 30, penetration: 90}, trader: {tradeonly: false,discount: 0.5}},
	{weapon: 'twin cannon', price: 4600, explosive: {radius: 20, damage: 18, penetration: 3}, trader: {tradeonly: false,discount: 0.5}},
	{weapon: 'health potion', price: 2000, trader: {tradeonly: true,discount: 0.1}},
	{weapon: 'amr', price: 2300, trader: {tradeonly: true,discount: 1}},
	{weapon: 'derringer', price: 5000, trader: {tradeonly: true, discount: 0.001}},
	{weapon: 'pulse carbine', price: 2050, trader: {tradeonly: true, discount: 0.5}}
];

let specialslist = [
	{special: 'EMF grenade', price: 600}
];

const moneyfile = fs.readFileSync(__dirname + "/Other/Money.brs");
const moneybrs = brs.read(moneyfile);
const corefile = fs.readFileSync(__dirname + "/Other/Base core.brs");
const corebrs = brs.read(corefile);
const traderfile = fs.readFileSync(__dirname + "/Other/tradingstation.brs");
const traderbrs = brs.read(traderfile);

let online = [];
let todie = [];
let basecores = [];

let activeemfs = [];

let weapons;
let specials;
let delay = 200;
let projrange = 1000;
let turretrange = 400;
let spawned = [];
let e = false;
let enablechecker = false;
let time = 10;
let XYBoundry = 30000;
let ZBoundry = 9000;

let maxtraderheight = 9000;
let traderinrange = [];

let finished = true;

let publicbricks = [];

let totax = [];
let minbrickcount = 5000;
let printerstore = [];

let tradingstation = {pos: [], offers: [], remaining: 0, cooldown: 1};

let buildtime = 10;
let fighttime = 10;

let ProjectileCheckInterval;
let CountDownInterval;
let skipnturretinterval;

let machinesbrs = [];
let allowerase = false;
let machines = [];
let mcntimeout = [];

let skipcooldown = 0;
let skiptime = 0;
let wanttoskip = [];
let minplayers = 0;

let tick = 0;

class Base_wars {
	
	constructor(omegga, config, store) {
		this.omegga = omegga;
		this.config = config;
		this.store = store
		delay = this.config.UpdateFrequency;
		projrange = this.config.DetectionRange;
		buildtime = this.config.BuildTime;
		fighttime = this.config.FightTime;
		XYBoundry = this.config.XYBoundry;
		ZBoundry = this.config.ZBoundry;
		maxtraderheight = this.config.MaxTraderHeight;
		minbrickcount = this.config.ImmuneBrickCount;
	}
	async CheckProjectiles(enabled) {
		if(!enabled) { return; }
		// Gets location of the spherecomponent.
		const projectileRegExp = new RegExp(`SphereComponent .+?RelativeLocation = \\(X=(?<x>[\\d\\.-]+),Y=(?<y>[\\d\\.-]+),Z=(?<z>[\\d\\.-]+)\\)`);
		const projectiles = await this.omegga.addWatcher(projectileRegExp, {
			exec: () =>
			this.omegga.writeln(
				`GetAll SphereComponent RelativeLocation`
			),
			timeoutDelay: 90,
			bundle: true
		});
		if(projectiles[0] == null) {return;}
		let projectile = 0;
		let pos;
		let rot;
		let todelete = [];
		// This here exists so it doesnt keep activating on the same spherecomponent over and over again.
		for(var i in projectiles) {
			const pr = projectiles[i].input;
			if(todelete.includes(pr.substr(pr.indexOf(("_C_")),14),1)) {
				todelete.splice(todelete.indexOf(pr.substr(pr.indexOf(("_C_")),14),1));
			}
			if(!spawned.includes(pr.substr(pr.indexOf(("_C_")),14),1)){
				spawned.push(pr.substr(pr.indexOf(("_C_")),14),1);
				projectile = projectiles[i];
			}
		}
		if(todelete[0] !== 1) {
			for(var i in todelete) {
				spawned.splice(spawned.indexOf(todelete[i]),1);
			}
		}
		// e is supposed to prevent it form detecting previous projectiles or whatever idk it doesn't work eitherway.
		if(projectile !== 0 && e) {
			let outer = projectiles[0].input;
			outer = outer.substr(Number(outer.indexOf('PersistentLevel')) + 16, Number(outer.indexOf('CollisionComponent')) - Number(outer.indexOf('PersistentLevel')) - 17);
			const projectileRegExptwo = new RegExp(`${outer}\\.CollisionComponent.RelativeRotation = \\(Pitch=(?<pitch>[\\d\\.-]+),Yaw=(?<yaw>[\\d\\.-]+),Roll=(?<roll>[\\d\\.-]+)\\)`);
			// Gets rotation of the spherecomponent.
			const projrot = await this.omegga.addWatcher(projectileRegExptwo, {
			exec: () =>
			this.omegga.writeln(
				`GetAll SphereComponent RelativeRotation Outer=${outer}`
			),
			timeoutDelay: 90,
			bundle: true
			});
			// Gets BP_PlayerState_C which is used to get the player.
			const projtype = outer.substr(0,outer.indexOf('C_') + 1);
			let plstate = await this.omegga.addWatcher(new RegExp(`BP_PlayerState_C`), {
			exec: () =>
			this.omegga.writeln(
				`GetAll ${projtype} InstigatorState`
			),
			timeoutDelay: 90,
			bundle: true
			});
			if(plstate[0] == null) {return;}
			let bpstate = plstate[0].input;
			bpstate = bpstate.substr(bpstate.indexOf('PersistentLevel.BP_PlayerState_C_') + 16, 27);
			if(projrot[0] == null) {return;}
			pos = projectiles[0].groups;
			rot = projrot[0].groups;
			const projname = projrot[0].input.substr(projrot[0].input.indexOf('Projectile_') + 11, projrot[0].input.indexOf('_C_')-projrot[0].input.indexOf('Projectile_')-11);
			this.raycast(pos, rot, projname, bpstate).catch();
		}
		else if(!e) {
			e = true;
		}
		
	}
	
	async tax() {
		for(var pl in totax) {
			const evader = totax[pl];
			const pid = await this.omegga.getPlayer(evader.name);
			if(pid != null) {
			let invn = await this.store.get(pid.id);
			invn.money -= evader.tax;
			if(invn.money < 0) {
				invn.money = 0;
			}
			this.store.set(pid.id,invn);
			}
		}
	}
	
	async runmachines() {
		finished = false;
		let usedgenerators = [];
		const toplace =  {...moneybrs, bricks: basecores, brick_owners : [{
		id: '00000000-0000-0000-0000-000000000040',
		name: 'BaseCore',
		bricks: 0}]};
		for(var brk in toplace.bricks) {
			let brick = toplace.bricks[brk];
			brick.owner_index = 1;
			brick.asset_name_index = 0;
			toplace.bricks[brk] = brick;
		}
		if(toplace.bricks.length > 0) {
			setTimeout(() => this.omegga.loadSaveData(toplace,{quiet: true}),1000);
		}
		if(machinesbrs.length === 0) {
			return;
		}
		for(var mcn=0;mcn<machinesbrs.length;mcn++) {
			const mcnb = machinesbrs[mcn];
			const data = mcnb.components.BCD_Interact.ConsoleTag.split(' ');
			const pname = data.splice(6,data.length - 6).join(' ');
			if(data[0] === 'Printer' && data[1] === 'Auto') {
				let bpos = mcnb.position;
				if(typeof bpos == 'Object') {
					bpos =  Object.values(bpos);
				}
				const generators = machinesbrs.filter(gmcn => gmcn.components.BCD_Interact.ConsoleTag.split(' ')[0] === 'Gen' && Math.sqrt(
				(bpos[0] - gmcn.position[0]) * (bpos[0] - gmcn.position[0]) +
				(bpos[1] - gmcn.position[1]) * (bpos[1] - gmcn.position[1]) +
				(bpos[2] - gmcn.position[2]) * (bpos[2] - gmcn.position[2])
				) < 500 && !usedgenerators.includes(gmcn.position));
				let energy = 0;
				for(var gen in generators) {
					const gdata = generators[gen].components.BCD_Interact.ConsoleTag.split(' ');
					const gpname = gdata.splice(5,data.length - 5).join(' ');
					if(pname === gpname && energy < Number(data[5])) {
						energy += Number(gdata[4]);
						usedgenerators.push(generators[gen].position);
					}
				}
				if(energy >= Number(data[5])) {
					const player = await this.omegga.getPlayer(pname);
					if(online.includes(pname)) {
						let invn = await this.store.get(player.id);
						invn.money += Number(data[4]);
						//console.log(data[4]);
						this.store.set(player.id,invn);
					}
					else {
						let store = [];
						if(printerstore.length > 0) {
							for(var pr in printerstore) {
								const printer = printerstore[pr];
								if(printer.pos != null) {
									if(printer.pos.join(' ') === bpos.join(' ')) {
										store.push(printer);
									}
								}
							}
						}
						if(store.length > 0) {
							store = store[0];
							const index = printerstore.indexOf(store);
							if(store.money < Number(data[4]) * fighttime) {
								store.money += Number(data[4]);
								printerstore[index] = store;
							}
						}
						else {
							printerstore.push({pos: bpos, money: Number(data[4])});
							
						}
					}
				}
			}
			else if(data[0] === 'Sld') {
				if(Number(data[4]) < Number(data[2])) {
					let bpos = mcnb.position;
					if(typeof bpos == 'Object') {
						bpos =  Object.values(bpos);
					}
					const emfs = activeemfs.filter(emf => Math.sqrt(
					(bpos[0] - emf.pos[0]) * (bpos[0] - emf.pos[0]) +
					(bpos[1] - emf.pos[1]) * (bpos[1] - emf.pos[1]) +
					(bpos[2] - emf.pos[2]) * (bpos[2] - emf.pos[2])
					) < Number(data[5]) * 20);
					if(emfs.length > 0) {
						continue;
					}
					const generators = machinesbrs.filter(gmcn => gmcn.components.BCD_Interact.ConsoleTag.split(' ')[0] === 'Gen' && Math.sqrt(
					(bpos[0] - gmcn.position[0]) * (bpos[0] - gmcn.position[0]) +
					(bpos[1] - gmcn.position[1]) * (bpos[1] - gmcn.position[1]) +
					(bpos[2] - gmcn.position[2]) * (bpos[2] - gmcn.position[2])
					) < 500 && !usedgenerators.includes(gmcn.position));
					let energy = 0;
					for(var gen in generators) {
						const gdata = generators[gen].components.BCD_Interact.ConsoleTag.split(' ');
						const gpname = gdata.splice(5,data.length - 5).join(' ');
						if(pname === gpname && energy < Number(data[2])) {
							energy += Number(gdata[4]);
							usedgenerators.push(generators[gen].position);
						}
					}
					data[4] += energy;
					data[4] = Math.min(data[4],data[2]);
					machinesbrs[mcn].components.BCD_Interact.ConsoleTag = data.join(' ');
				}
			}
		}
		let machinestoreload = moneybrs;
		if(machinestoreload.length > 0) {
			machinestoreload.bricks = machinesbrs;
			machinestoreload.brick_owners = [{
		id: '00000000-0000-0000-0000-000000000040',
		name: 'BaseCore',
		bricks: 0}];
			this.omegga.loadSaveData(machinestoreload,{quiet: true});
		}
		finished = true;
	}
	
	async getinrange() {
		//console.log(tradingstation);
		if(tradingstation.pos.length < 3) {
			return;
		}
		for(var pl in online) {
			const player = await this.omegga.getPlayer(online[pl]);
			const ppos = await player.getPosition();
			const tpos = tradingstation.pos;
			const dist = Math.sqrt(
			(ppos[0] - tpos[0]) * (ppos[0] - tpos[0]) +
			(ppos[1] - tpos[1]) * (ppos[1] - tpos[1]) +
			(ppos[2] - tpos[2]) * (ppos[2] - tpos[2])
			);
			if(dist < 100 && !traderinrange.includes(player.name)) {
				traderinrange.push(player.name);
				this.omegga.whisper(player.name,clr.orn+'<b>Welcome to the trading station! Today\'s items are:</>');
				for(var wep=0;wep<4;wep++) {
					if(wep > tradingstation.offers.length - 1) {
						this.omegga.whisper(player.name,clr.slv + '<b>-[Sold out]-</>');
						continue;
					}
					const weapon = tradingstation.offers[wep];
					if(Object.keys(weapon).includes('weapon')) {
						this.omegga.whisper(player.name, clr.ylw + '<b>' + weapon.weapon + ' $' + clr.dgrn + (weapon.price * weapon.trader.discount) + '</>');
					}
					else {
						this.omegga.whisper(player.name, clr.ylw + '<b>' + weapon.special + ' $' + clr.dgrn + weapon.price + '</>');
					}
				}
				//this.omegga.whisper(player.name,'<b>'+clr.ylw+tradingstation.offers.join('</>, \n<oSet.Begin(WScript.ScriptBaseName, 0x1 /*POB_READ*/);>' + clr.ylw) + '</>');
			}
			if(dist >= 100 && traderinrange.includes(player.name)) {
				traderinrange.splice(traderinrange.indexOf(player.name), 1);
				this.omegga.whisper(player.name,clr.orn+'<b>Come back next time!</>');
			}
		}
	}
	
	async skipdecrementnturrets() {
		if(tick%30 == 0) {
			this.decrement(true);
		}
		else if(online.length > 0) {
			this.getinrange();
		}
		this.emf();
		tick++;
		if(skipcooldown > 0) {
			skipcooldown -= 2;
		}
		if(skiptime > 0) {
			skiptime--;
			if(skiptime === 0) {
				this.omegga.broadcast(clr.red + '<b>Not enough people have voted to skip the round. Skip has been cancelled.</>');
				wanttoskip = [];
				skipcooldown = 30;
			}
		}
	}
	
	async removetrader(outofstock) {
		tradingstation.cooldown = Math.floor(Math.random() * 4 + 3);
		if(outofstock) {
			this.omegga.broadcast(clr.orn+'<b>The trading station has ran out of offers! Come back next time!</>');
		}
		else {
			this.omegga.broadcast(clr.orn+'<b>The trading station has disappeared! Come back next time!</>');
			tradingstation.remaining = 0;
		}
		this.omegga.clearBricks('00000000-0000-0000-0000-000000000024',{quiet:true});
		tradingstation.pos = [];
		tradingstation.offers = [];
		traderinrange = [];
	}
	
	async emf() {
		for(var emf in activeemfs) {
			activeemfs[emf].dur -= 2;
			const emfg = activeemfs[emf];
			for(var mcn=0;mcn<machinesbrs.length;mcn++) {
				const mcnb = machinesbrs[mcn];
				const data = mcnb.components.BCD_Interact.ConsoleTag.split(' ');
				let bpos = mcnb.position;
				if(data[0] === 'Sld') {
					const dist = Math.sqrt((bpos[0] - emfg.pos[0]) * (bpos[0] - emfg.pos[0]) +
					(bpos[1] - emfg.pos[1]) * (bpos[1] - emfg.pos[1]) +
					(bpos[2] - emfg.pos[2]) * (bpos[2] - emfg.pos[2])
					);
					if(dist < Number(data[5]) * 20) {
						data[4] = Number(data[4]);
						data[4] -= 20;
						data[4] = Math.max(data[4],0);
						machinesbrs[mcn].components.BCD_Interact.ConsoleTag = data.join(' ');
					}
				}
			}
		}
		activeemfs = activeemfs.filter(e => e.dur > 0);
	}
	
	async decrement(enabled) {
		if(enablechecker && finished) {
			this.runmachines().catch();
			this.tax();
		}
		if(tradingstation.remaining > 0) {
			tradingstation.remaining--;
		}
		else if(tradingstation.cooldown === 0) {
			this.removetrader(false);
		}
		time--;
		switch(time) {
			case 3:
				this.omegga.broadcast('<b>'+clr.ylw+'3</color> minutes remaining.</>');
				break;
			case 2:
				this.omegga.broadcast('<b>'+clr.orn+'2</color> minutes remaining.</>');
				break;
			case 1:
				this.omegga.broadcast('<b>'+clr.red+'1</color> minute remaining.</>');
				break;
			case 0:
				this.omegga.broadcast('<b>Time\'s up!</>');
				this.modetoggle("egg").catch();
				break;
		}
	}
	
	async runspecial(playerstate,pos) {
		const player = this.omegga.getPlayer(playerstate);
		const invn = await this.store.get(player.id);
		const selspecial = invn.selected[2];
		if(selspecial === 'EMF grenade') {
			activeemfs.push({pos: [pos.x,pos.y,pos.z], dur: 60});
			this.omegga.middlePrint(player.name,clr.cyn+'<b>EMF grenade active!</>');
		}
	}
	
	async raycast(pos, rot, type, playerstate) {
		let brs = await this.omegga.getSaveData({center: [pos.x,pos.y,pos.z], extent: [projrange,projrange,projrange]});
		if(brs == null) {return;}
		brs.bricks.length = Math.min(brs.bricks.length, 20000);
		const yaw = Number(rot.yaw);
		const pitch = Number(rot.pitch);
		const deg2rad = Math.PI / 180;
		let ray1 = {x: Number(pos.x), y: Number(pos.y), z: Number(pos.z)};
		let hitbrick = [];
		let projstrength = 0;
		let projradius = 0;
		let projdamage = 0;
		switch(type) {
			case 'ImpactGrenade':
				projradius = 30;
				projdamage = 10;
				projstrength = 20;
				break;
			case 'ImpactGrenadeLauncher':
				projradius = 15;
				projdamage = 8;
				projstrength = 10;
				break;
			case 'RocketLauncher':
				projradius = 80;
				projdamage = 30;
				projstrength = 90;
				break;
			case 'QuadLauncher':
				projradius = 30;
				projdamage = 12;
				projstrength = 30;
				break;
			case 'Bazooka':
				projradius = 30;
				projdamage = 8
				projstrength = 8;
				break;
			case 'TwinCannon':
				projradius = 20;
				projdamage = 18;
				projstrength = 3;
				break;
			case 'ImpulseGrenade':
				this.runspecial(playerstate,pos);
			default:
				return;
		}
		for(var B in brs.bricks) {
			
			let ray2 = {
			x: Number(pos.x) + Math.sin((-yaw + 90) * deg2rad) * projrange * Math.cos(pitch * deg2rad),
			y: Number(pos.y) + Math.cos((-yaw + 90) * deg2rad) * projrange * Math.cos(pitch * deg2rad),
			z: Number(pos.z) + projrange * Math.sin(pitch * deg2rad)
			};
			
			let brick = brs.bricks[B];
			let size = brick.size;
			if(size[0] === 0) {
				size = specials[brs.brick_assets[brick.asset_name_index]];
			}
			if(brick.rotation%2 == 1) {
				size = [size[1],size[0],size[2]];
			}
			const directions = [[2,1,0],[0,2,1],[0,1,2]];
			const brdr = Math.floor(brick.direction/2);
			size = [size[directions[brdr][0]],size[directions[brdr][1]],size[directions[brdr][2]]];
			brick.size = size;
			//console.log(brick);
			const bpos = brick.position;
			const BP1 = {
			x: bpos[0] - size[0],
			y: bpos[1] - size[1],
			z: bpos[2] - size[2],
			};
			const BP2 = {
			x: bpos[0] + size[0],
			y: bpos[1] + size[1],
			z: bpos[2] + size[2],
			};
			if(await raycasttest.CheckLineBox(BP1, BP2, ray1, ray2)) {
				const owner = brs.brick_owners[brick.owner_index - 1];
				hitbrick.push({p: bpos, s: size, o: owner});
			}
		}
		let closetbrick = projrange;
		let brc = 0
		// Get the closest brick.
		for(var b in hitbrick) {
			const br = hitbrick[b];
			const distance = Math.sqrt((br.p[0] - ray1.x)*(br.p[0] - ray1.x)+(br.p[1] - ray1.y)*(br.p[1] - ray1.y)+(br.p[2] - ray1.z)*(br.p[2] - ray1.z));
			if(distance < closetbrick) {
				closetbrick = distance;
				brc = br;
			}
		}
		if(brc.s == null) {return;}
		if(brc !== 0) {
			if(brc.o.name == 'PUBLIC') {
				return;
			}
			brc.s = [Math.max(brc.s[0],projradius),Math.max(brc.s[1],projradius),Math.max(brc.s[2],projradius)];
			let moneymcn = 0;
			let isdamaged = true;
			const shields = machinesbrs.filter(smcn => smcn.components.BCD_Interact.ConsoleTag.indexOf('Sld') !== -1);
			const inrange = [];
			let prevdist = 100000;
			for(var sld in shields) {
				const smcn = shields[sld];
				const data = smcn.components.BCD_Interact.ConsoleTag.split(' ');
				const townr = data.splice(6,data.length - 6).join(' ');
				const dist = Math.sqrt(
				(brc.p[0] - smcn.position[0]) * (brc.p[0] - smcn.position[0]) +
				(brc.p[1] - smcn.position[1]) * (brc.p[1] - smcn.position[1]) +
				(brc.p[2] - smcn.position[2]) * (brc.p[2] - smcn.position[2])
				);
				if(dist < Number(data[5]) * 10 && Number(data[4]) > 0) {
					inrange.push(smcn);
				}
			}
			if(inrange.length > 0) {
				const shield = inrange[0];
				let data = shield.components.BCD_Interact.ConsoleTag.split(' ');
				const index = machinesbrs.indexOf(shield);
				data[4] = Math.max(Number(data[4]) - projstrength, 0);
				this.omegga.middlePrint(playerstate, '<b>Shield charge: ' + data[4] + '</>');
				shield.components.BCD_Interact.ConsoleTag = data.join(' ');
				machinesbrs[index] = shield;
				return;
			}
			for(var mcn in machinesbrs) {
				if(machinesbrs[mcn].position[0] === brc.p[0] && machinesbrs[mcn].position[1] === brc.p[1] && machinesbrs[mcn].position[2] === brc.p[2]) {
					moneymcn = machinesbrs[mcn];
					let moneybrick = moneybrs.bricks[0];
					moneybrick.position = [Math.floor(Number(pos.x)),Math.floor(Number(pos.y)),Math.floor(Number(pos.z))];
					let mmcnd = moneymcn.components.BCD_Interact.ConsoleTag.split(' ');
					mmcnd[2] = Number(mmcnd[2]) - projdamage;
					if(Number(mmcnd[2]) > 0) {
						this.omegga.middlePrint(playerstate,'<b>Machine health: ' + mmcnd[2] + '</>');
						machinesbrs[mcn].components.BCD_Interact.ConsoleTag = mmcnd.join(' ');
						isdamaged = false;
					}
					else {
					if(mmcnd[3] > 0) {
						let store = 0;
						for(var prin=0;prin<printerstore.length;prin++) {
							const printer = printerstore[prin];
							if(printer.pos[0] == brc.p[0] && printer.pos[1] == brc.p[1] && printer.pos[2] == brc.p[2]) {
								store = printer;
								prin = printerstore.length;
							}
						}
						let storedmoney = 0;
						if(store != 0) {
							storedmoney = store.money;
							printerstore.splice(printerstore.indexOf(store),1);
						}
						this.omegga.middlePrint(playerstate,clr.ylw + '<b>$' + clr.dgrn + Math.floor((Number(mmcnd[3]) + storedmoney) * 0.8) + '</>');
						const powner = await this.omegga.getPlayer(playerstate);
						let invn = await this.store.get(powner.id);
						invn.money += Math.floor((Number(mmcnd[3]) + storedmoney) * 0.8);
						this.store.set(powner.id, invn);
					}
					let pname = '';
					if(mmcnd.includes('Printer')) {
						pname = mmcnd.splice(6,mmcnd.length - 6).join(' ');
					}
					else {
						pname = mmcnd.splice(5,mmcnd.length - 5).join(' ');
					}
					if(mmcnd.includes('Manual')) {
						pname = mmcnd.splice(4,mmcnd.length - 4).join(' ');
					}
					if(online.includes(pname)) {
						this.omegga.whisper(pname, clr.red + '<b>One of your machines has been destroyed!</>');
					}
					machinesbrs.splice(mcn,1);
					}
				}
			}
			if(isdamaged) {
				// This was done because omegga thinks that machines are not players.
				this.omegga.writeln('Bricks.ClearRegion ' + brc.p.join(' ') + ' ' + brc.s.join(' ') + ' ' + brc.o.id);
			}
		}
	}
	
	async getrotation(controller) {
		const rotRegExp = new RegExp(`${controller}\\.TransformComponent0.RelativeRotation = \\(Pitch=(?<x>[\\d\\.-]+),Yaw=(?<y>[\\d\\.-]+),Roll=(?<z>[\\d\\.-]+)\\)`);
		const [
		{
			groups: { x, y, z },
		},
		] = await this.omegga.addWatcher(rotRegExp, {
			exec: () =>
			this.omegga.writeln(
				`GetAll SceneComponent RelativeRotation Outer=${controller}`
			),
			timeoutDelay: 100,
			bundle: true
		});
		return [Number(x),Number(y),Number(z)];
	}
	
	async test() {
		const rotRegExp = new RegExp(``);
		const test = await this.omegga.addWatcher(rotRegExp, {
			exec: () =>
			this.omegga.writeln(
				`GetAll SphereComponent RelativeRotation Name=Projectile`
			),
			timeoutDelay: 100,
			bundle: true
		});
		console.log(test);
	}
	
	//merca
	async preparetax(brickowners) {
		totax = [];
		for(var owner in brickowners) {
			const brickowner = brickowners[owner];
			if(brickowner.bricks > minbrickcount) {
				const tax = Math.ceil((brickowner.bricks - minbrickcount) / 6);
				this.omegga.whisper(brickowner.name, clr.orn + '<b>You have exceeded a minimum brick count of ' + clr.ylw + minbrickcount + clr.orn + ' bricks. You now will be taxed ' + clr.ylw + '$' + clr.dgrn + tax + clr.orn + ' each minute.</>');
				totax.push({name: brickowner.name, tax: tax});
			}
		}
	}
	
	setuptrader() {
		const trstbrs = {...traderbrs, brick_owners: [{
			id: '00000000-0000-0000-0000-000000000024',
			name: 'TradingStation',
			bricks: 0
		}]};
		const trsc = [40,40,36];
		let poslist = [];
		for(var br=0;br<publicbricks.length; br++) {
			const bric = publicbricks[br];
			//        VVVV Can we not?
			let pos = JSON.parse(JSON.stringify(bric.position));
			const size = JSON.parse(JSON.stringify(bric.size));
			pos[2] = pos[2] + size[2] + trsc[2];
			let colliding = false;
			for(var clb=0;clb<publicbricks.length;clb++) {
				const colb = publicbricks[clb];
				let cols = colb.size;
				const colp = colb.position;
				if(colb.rotation%2 == 1) {
					cols = [cols[1],cols[0],cols[2]];
				}
				if(pos[2] > maxtraderheight * 10 || pos[0] < colp[0] + cols[0] + trsc[0] && pos[0] > colp[0] - cols[0] - trsc[0] &&
				pos[1] < colp[1] + cols[1] + trsc[1] && pos[1] > colp[1] - cols[1] - trsc[1] &&
				pos[2] < colp[2] + cols[2] + trsc[2] && pos[2] > colp[2] - cols[2] - trsc[2]) {
					colliding = true;
					break;
				}
			}
			if(!colliding) {
				poslist.push(pos);
			}
		}
		if(poslist.length > 0) {
			const pos = poslist[Math.floor(Math.random() * poslist.length + 0)];
			tradingstation.pos = pos;
			for(var i=0;i<4;i++) {
				const items = shoplist.filter(wep => Object.keys(wep).includes('trader'));
				if(Math.floor(Math.random() * 4) === 3) {
					tradingstation.offers.push(specialslist[Math.floor(Math.random() * specialslist.length)]);
				}
				else if(items.length > 0) {
					const item = items[Math.floor(Math.random() * items.length)];
					tradingstation.offers.push(item);
				}
			}
			this.omegga.loadSaveData(trstbrs,{offX: pos[0], offY: pos[1], offZ: pos[2] - trsc[2], quiet: true});
		}
	}
	
	async modetoggle(name) {
		finished = false;
		enablechecker = !enablechecker;
		const players = this.omegga.getPlayers();
		// Credits to tallen
		if(enablechecker) {
			if(players == null || players === []) {
				enablechecker = false;
				return;
			}
			for(var pl in players) {
			const player = players[pl];
			this.omegga.getPlayer(player.id).setTeam(1);
		}
		let brs = await this.omegga.getSaveData();
		if(brs == null) {return;}
		//let startTime = new Date();
		let bricjowners = brs.brick_owners.filter(owner => online.includes(owner.name));
		let cores = new Array();
		let machinebricks = new Array();
		
		for(var i = 0; i < brs.bricks.length; i++) {
		const brick = brs.bricks[i];
		if('BCD_ItemSpawn' in brick.components) {
			let size = brick.size;
			if(brick.rotation%2 == 1) {
				size = [size[1],size[0],size[2]];
			}
			this.omegga.clearRegion({center: brick.position, extent: size});
			} else if('BCD_Interact' in brick.components) {
				if(brs.brick_owners[brick.owner_index - 1].name.indexOf('BaseCore') !== -1) {
					cores.push(brick);
				} else if(brs.brick_owners[brick.owner_index - 1].name.indexOf('MCN') === 0 && Math.abs(brick.position[0]) < XYBoundry * 10 && Math.abs(brick.position[1]) < XYBoundry * 10 && brick.position[2] > 0 && brick.position[2] < ZBoundry * 10) {
						machinebricks.push(brick);
					}
				}
			}
			
			
			machinesbrs = machinebricks;
			basecores = cores;
			
			//let endTime = new Date();
			//let finalTime = (endTime - startTime) / 1000;
			//this.omegga.broadcast("Took: " + finalTime + " seconds.");
			this.omegga.broadcast("<size=\"50\"><b>Fight!</>");
			this.omegga.broadcast("<b>You have " + fighttime + " minutes of fight time.</>");
			this.preparetax(bricjowners);
			time = fighttime;
		}
		else {
			for(var pl in players) {
				const player = players[pl];
				this.omegga.getPlayer(player.id).setTeam(0);
				const invnt = await this.store.get(player.id);
				const pos = (invnt.base).join(" ");
				const playername = player.name;
				if(pos.length > 0) {
					this.omegga.writeln('Chat.Command /TP '+playername+' ' +pos+' 0');
				}
			}
			this.omegga.broadcast("<size=\"50\"><b>Build!</>");
			this.omegga.broadcast("<b>You have " + buildtime + " minutes of build time.</>");
			time = buildtime;
		}
		if(tradingstation.cooldown > 0) {
			tradingstation.cooldown--;
		}
		if(tradingstation.cooldown == 0 && tradingstation.remaining == 0) {
			this.setuptrader();
			tradingstation.remaining = Math.floor(Math.random() * 5 + 6);
			this.omegga.broadcast(clr.orn + '<b>The trading station has appeared! Find it in ' + (tradingstation.remaining + 1) + ' minutes for potentially good offerings.</>');
		}
		finished = true;
	}
	
	async loadmapbricks() {
		const mapfolder = fs.readdirSync(__dirname + "/Map");
		if(mapfolder.length > 0) {
			console.log('Loading ' + mapfolder.length + ' map save(s).');
		}
		for(var mp in mapfolder) {
			if(mapfolder[mp].indexOf('.brs') < 0) {
				continue;
			}
			const mapfile = fs.readFileSync(__dirname + "/Map/"+mapfolder[mp]);
			let map = brs.read(mapfile);
			map.brick_owners = [{
			id: '00000000-0000-0000-0000-000000000000',
			name: 'PUBLIC',
			bricks: 0}];
			publicbricks = publicbricks.concat(map.bricks);
			this.omegga.loadSaveData(map,{quiet:true});
		}
	}
	
	async initializemachines() {
		const machinefolder = fs.readdirSync(__dirname + "/Machines");
		for(var mcn in machinefolder) {
			const machinefile = fs.readFileSync(__dirname + "/Machines/"+machinefolder[mcn]);
			let machine = brs.read(machinefile);
			let machinename = machinefolder[mcn];
			machinename = machinename.substr(0,machinename.length - 4);
			const databrick = machine.bricks.filter(brick => 'BCD_Interact' in brick.components);
			machines.push({name: machinename, brs: machine, data: databrick[0].components.BCD_Interact});
		}
	}
	
	async viewinv(name) {
		const player = await this.omegga.getPlayer(name);
		const keys = await this.store.keys();
		if(keys.includes(player.id)) {
			const inv = await this.store.get(player.id);
			const inventory = inv.inv;
			const machines = inv.machines;
			const specials = inv.charm;
			const loadout = inv.selected;
			this.omegga.whisper(name, "<b>Your inventory --------------" + clr.end);
			this.omegga.whisper(name,'<b>' + clr.ylw + inventory.join('</color>,</>\n<b>' + clr.ylw) + '</>');
			this.omegga.whisper(name,"<b>Money: " + clr.ylw + '$'  + clr.dgrn + inv.money + clr.end);
			this.omegga.whisper(name, "<b>" + clr.slv +"Current loadout: "  + clr.orn + '<b>' + loadout.join(', ') + clr.end);
			this.omegga.whisper(name,"<b>Machines:" + clr.end);
			this.omegga.whisper(name,'<b>' + clr.dgrn + machines.join('</color>,</>\n<b>' + clr.dgrn) + '</>');
			this.omegga.whisper(name,"<b>Specials:" + clr.end);
			this.omegga.whisper(name,'<b>' + clr.red + specials.join('</color>,</>\n<b>' + clr.red) + '</>');
			this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
		}
	}
	
	async init() {
		const deathevents = await this.omegga.getPlugin('deathevents');
		if(deathevents) {
			console.log('Deathevents detected.');
			deathevents.emitPlugin('subscribe');
		}
		else {
			console.error('You need deathevents plugin to run this.');
			return;
		}
		this.initializemachines();
		weapons = await weplist.list()
		specials = await speciallist.list();
		/*
		this.omegga.on('cmd:enable', async name => {
			this.modetoggle(name);
		})
		
		.on('cmd:test', async player => {
			this.runmachines();
		})
		
		this.omegga.on('cmd:test2', async name => {
			this.omegga.getPlayer(name).damage(10);
			console.log("test");
		});
		
		this.omegga.on('cmd:lt', async name => {
			const br = await this.omegga.getSaveData();
			console.log(br.bricks[0]);
		});
		*/
		this.omegga.on('cmd:place', async (name, ...args) => {
			try {
			const mcntoplace = args.join(' ');
			let machinert = machines.filter(mcn => mcn.name === mcntoplace);
			const player = await this.omegga.getPlayer(name);
			const ppos = await player.getPosition();
			let nearbybricks = await this.omegga.getSaveData({center: [Math.floor(ppos[0]), Math.floor(ppos[1]), Math.floor(ppos[2])], extent: [projrange,projrange,projrange]});
			let invn = await this.store.get(player.id);
			if(machinert.length > 0) {
				if(!(invn.machines.includes(mcntoplace) || mcntoplace === 'manual printer')) {
					this.omegga.whisper(name, clr.red+'<b>You don\'t have that machine.</>');
					return;
				}
				machinert = machinert[0];
				// VVV i will not forgive javascript for this
				let mcnbrs = JSON.parse(JSON.stringify(machinert.brs));
				mcnbrs.brick_owners = [{
					id: '00000000-0000-0000-0000-000000000060',
					name: 'MCN',
					bricks: 0
				}];
				ppos[0] = Math.round(ppos[0]/10)*10;
				ppos[1] = Math.round(ppos[1]/10)*10;
				ppos[2] = Math.round(ppos[2]);
				if(Math.abs(ppos[0]) > XYBoundry * 10 || Math.abs(ppos[1]) > XYBoundry * 10 || Math.abs(ppos[2]) > ZBoundry * 10 || Math.abs(ppos[2]) < 0) {
					this.omegga.whisper(name, clr.red + '<b>You can\'t place machines outside the boundries.</>');
					return;
				}
				let mcnsize = [0,0,0];
				for(var b=0;b<mcnbrs.brick_count;b++) {
					let brick = mcnbrs.bricks[b];
					if('components' in brick) {
						if('BCD_Interact' in brick.components) {
							brick.components.BCD_Interact.ConsoleTag = brick.components.BCD_Interact.ConsoleTag + ' ' + name;
							mcnbrs.bricks[b] = brick;
						}
					}
					let size = brick.size;
					const rotation = brick.rotation;
					if(rotation%2 == 1) {
						size = [size[1],size[0],size[2]];
					}
					/*
					brick.size = size;
					if(mcnsize[0] < brick.size[0]) {
						mcnsize[0] = brick.size[0];
					}
					if(mcnsize[1] < brick.size[1]) {
						mcnsize[1] = brick.size[1];
					}
					if(mcnsize[2] < brick.size[2]) {
						mcnsize[2] = brick.size[2];
					}
					*/
					mcnsize = size;
				}
				if(nearbybricks != null) {
				for(var b in nearbybricks.bricks) {
					let brick = nearbybricks.bricks[b];
					let size = brick.size;
					const rotation = brick.rotation;
					if(rotation%2 == 1) {
						size = [size[1],size[0],size[2]];
					}
					const directions = [[2,1,0],[0,2,1],[0,1,2]];
					const brdr = Math.floor(brick.direction/2);
					size = [size[directions[brdr][0]],size[directions[brdr][1]],size[directions[brdr][2]]];
					nearbybricks.bricks[b] = {...brick, size: size};
				}
				const colliding = nearbybricks.bricks.filter(
					brck => brck.position[0] < ppos[0] + mcnsize[0] + brck.size[0] &&
					brck.position[0] > ppos[0] - mcnsize[0] - brck.size[0] &&
					brck.position[1] < ppos[1] + mcnsize[1] + brck.size[1] &&
					brck.position[1] > ppos[1] - mcnsize[1] - brck.size[1] &&
					brck.position[2] < ppos[2] - 25 + mcnsize[2] + brck.size[2] + mcnsize[2] &&
					brck.position[2] > ppos[2] - 25 - brck.size[2]
				);
				if(colliding.length > 0) {
					this.omegga.whisper(name,clr.red+'<b>The machine is overlapping with other bricks.</>');
					return;
				}
				}
				let br = mcnbrs.bricks[0];
				br.position = [br.position[0] + ppos[0], br.position[1] + ppos[1], br.position[2] + ppos[2] - 25];
				let topl = {...mcnbrs, bricks: [br]};
				this.omegga.loadSaveData(topl,{quiet: true});
				invn.machines.splice(invn.machines.indexOf(mcntoplace),1);
				this.store.set(player.id,invn);
				machinesbrs.push(br);
				this.omegga.whisper(name,'<b>Succesfully placed ' + clr.ylw + machinert.name + '</color>.</>');
				const ontop = [br.position[0], br.position[1], br.position[2] + br.size[2]];
				this.omegga.writeln('Chat.Command /TP '+name+' ' +ontop.join(' ')+' 0');
			}
			}
			catch (e){
			}
		})
		.on('cmd:skip', async name => {
			const players = this.omegga.players;
			const minimum = players.length * 0.8;
			if(skipcooldown > 0) {
				this.omegga.whisper(name, clr.red + '<b>You must wait ' + clr.orn + skipcooldown + clr.red + ' seconds before starting a next vote skip.</>');
				return;
			}
			if(wanttoskip.includes(name)) {
				this.omegga.whisper(name, clr.orn + '<b>You already have voted to skip</>');
				return;
			}
			if(skiptime === 0) {
				this.omegga.broadcast(clr.ylw + '<b>' + name + clr.grn + ' has started a vote skip!</>');
				skiptime = 30;
				minplayers = Math.ceil(minimum);
			}
			wanttoskip.push(name);
			const lefttovote = minplayers - wanttoskip.length;
			this.omegga.broadcast(clr.ylw + '<b>' + name + '</></><b> wants to skip this round. At least ' + clr.grn + lefttovote + '</><b> more players needed to skip the round.</>');
			if(lefttovote < 1) {
				this.omegga.broadcast(clr.ylw + '<b>Enough players have voted to skip this round.</>');
				skiptime = 0;
				wanttoskip = [];
				time = 1;
				this.decrement(true);
				skipcooldown = 30;
			}
		})
		.on('cmd:pay', async (name, ...args) => {
			const money = Math.ceil(Number(args[0]));
			args.splice(0,1);
			const player = args.join(' ');
			if(!online.includes(player)) {
				this.omegga.whisper(name, clr.red + '<b>That player either doesn\'t exist or they are not online.</>');
				return;
			}
			if(money < 0) {
				this.omegga.whisper(name, clr.red + '<b>Negative money doesn\'t exist.</>');
				return;
			}
			if(isNaN(money)) {
				this.omegga.whisper(name, clr.red + '<b>NaN money doesn\'t exist.</> <emoji>egg</>');
				return;
			}
			const pid1 = await this.omegga.getPlayer(name);
			let invn = await this.store.get(pid1.id);
			if(invn.money < money) {
				this.omegga.whisper(name, clr.red + '<b>You don\'t have enough money to pay ' + clr.ylw + '$' + clr.dgrn + money + clr.red + '.</>');
				return;
			}
			invn.money -= money;
			this.store.set(pid1.id, invn);
			const pid2 = await this.omegga.getPlayer(player);
			let reciver = await this.store.get(pid2.id);
			reciver.money += money;
			this.store.set(pid2.id, reciver);
			this.omegga.whisper(name, '<b>You have paid ' + clr.ylw + '$' + clr.dgrn + money + '</></><b> to ' + clr.ylw + player + '</><b>.</>');
			this.omegga.whisper(player, '<b>You have recieved ' + clr.ylw + '$' + clr.dgrn + money + '</></><b> from ' + clr.ylw + name + '</><b>.</>');
		})
		.on('interact', async data => {
			const checklegitimacy = machinesbrs.filter(brick => brick.position.join(' ') === data.position.join(' '));
			if(checklegitimacy.length === 0) { return; }
			const argsarray = data.message.split(' ');
			let pname = '';
			if(argsarray.includes('Printer') || argsarray.includes('Sld')) {
				pname = argsarray.splice(6,argsarray.length - 6).join(' ');
			}
			else {
				pname = argsarray.splice(5,argsarray.length - 5).join(' ');
			}
			if(argsarray.includes('Manual')) {
				pname = argsarray.splice(4,argsarray.length - 4).join(' ');
			}
			if(!mcntimeout.includes(data.player.id)) {
			if(pname === data.player.name) {
				if(argsarray[0] === 'Printer' && argsarray[1] === 'Manual') {
					if(!enablechecker) {
						this.omegga.middlePrint(data.player.name,clr.red+'<b>Printers can only work during fight mode.</>');
						return;
					}
					let pdata = await this.store.get(data.player.id);
					pdata.money += 2;
					this.store.set(data.player.id,pdata);
					mcntimeout.push(data.player.id);
					setTimeout(() => mcntimeout.splice(mcntimeout.indexOf(data.player.id),1), 5000);
				}
				if(argsarray[0] === 'Printer' && argsarray[1] === 'Auto') {
					const prpos = data.position;
					let store = 0;
					for(var prin=0;prin<printerstore.length;prin++) {
						const printer = printerstore[prin];
						if(printer.pos.join(' ') === prpos.join(' ')) {
							store = printer;
							prin = printerstore.length;
						}
					}
					if(store != 0) {
						let invn = await this.store.get(data.player.id);
						invn.money += store.money;
						this.omegga.middlePrint(data.player.id,clr.ylw + '<b>$' + clr.dgrn + store.money + '</>');
						printerstore.splice(printerstore.indexOf(store),1);
						this.store.set(data.player.id,invn);
						mcntimeout.push(data.player.id);
						setTimeout(() => mcntimeout.splice(mcntimeout.indexOf(data.player.id),1), 5000);
					}
				}
			}
			else {
				this.omegga.middlePrint(data.player.id,'<b>This machine is owned by: ' + clr.ylw + pname + '</>');
			}
			}
			else {
				this.omegga.middlePrint(data.player.name,clr.red+'<b>You need to wait 5 seconds before using this machine again.</>');
			}
		})
		.on('cmd:changelog', async name => {
			this.omegga.whisper(name, clr.ylw + "<size=\"30\"><b>--ChangeLog--</>");
			this.omegga.whisper(name, clr.orn + "<b>Replaced some of the code with tallen's for optimizations.</>");
			this.omegga.whisper(name, clr.orn + "<b>Removed require(turrethandler).</>");
			this.omegga.whisper(name, clr.orn + "<b>Added more config options.</>");
			this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
		})
		.on('cmd:placecore', async name => {
			const player = await this.omegga.getPlayer(name);
			const ppos = await player.getPosition();
			const alreadyplaced = basecores.filter(brick => brick.components.BCD_Interact.ConsoleTag.indexOf(name) > -1);
			if(alreadyplaced.length > 0) {
				this.omegga.whisper(name, clr.red + '<b>You can\'t have more than 1 core.</>');
				return;
			}
			let nearbybricks = await this.omegga.getSaveData({center: [Math.floor(ppos[0]), Math.floor(ppos[1]), Math.floor(ppos[2])], extent: [projrange,projrange,projrange]});
			let core = corebrs.bricks[0];
			ppos[0] = Math.round(ppos[0]/10)*10;
			ppos[1] = Math.round(ppos[1]/10)*10;
			ppos[2] = Math.round(ppos[2]);
			core.position = ppos;
			const mcnsize = core.size
			if(nearbybricks != null) {
				for(var b in nearbybricks.bricks) {
					let brick = nearbybricks.bricks[b];
					let size = brick.size;
					const rotation = brick.rotation;
					if(rotation%2 == 1) {
						size = [size[1],size[0],size[2]];
					}
					const directions = [[2,1,0],[0,2,1],[0,1,2]];
					const brdr = Math.floor(brick.direction/2);
					size = [size[directions[brdr][0]],size[directions[brdr][1]],size[directions[brdr][2]]];
					nearbybricks.bricks[b] = {...brick, size: size};
				}
				const colliding = nearbybricks.bricks.filter(
					brck => brck.position[0] < ppos[0] + mcnsize[0] + brck.size[0] &&
					brck.position[0] > ppos[0] - mcnsize[0] - brck.size[0] &&
					brck.position[1] < ppos[1] + mcnsize[1] + brck.size[1] &&
					brck.position[1] > ppos[1] - mcnsize[1] - brck.size[1] &&
					brck.position[2] < ppos[2] - 25 + mcnsize[2] + brck.size[2] + mcnsize[2] &&
					brck.position[2] > ppos[2] - 25 - brck.size[2]
				);
				if(colliding.length > 0) {
					this.omegga.whisper(name,clr.red+'<b>The core is overlapping with other bricks.</>');
					return;
				}
			}
			core.components.BCD_Interact.ConsoleTag = name;
			const toplace = {...corebrs, bricks: [core], brick_owners: [{
				id: '00000000-0000-0000-0000-000000000040',
				name: 'BaseCore',
				bricks: 0
			}]};
			basecores.push(core);
			this.omegga.loadSaveData(toplace, {quiet: true});
			this.omegga.whisper(name, clr.ylw + '<b>Succesfully placed the base core.</>');
		})
		.on('cmd:removecore', async name => {
			const core = basecores.filter(brick => brick.components.BCD_Interact.ConsoleTag.indexOf(name) > -1);
			if(core.length === 0) {
				this.omegga.whisper(name, clr.red + '<b>You don\'t have any cores.</>');
				return;
			}
			basecores.splice(basecores.indexOf(core), 1);
			this.omegga.clearRegion({center: core[0].position, extent: core[0].size});
			this.omegga.whisper(name, clr.ylw + '<b>Removed a base core sucessfully.</>');
		})
		.on('cmd:refund', async name => {
			try {
			const player = await this.omegga.getPlayer(name);
			let pos = await player.getPosition();
			let rot = await this.getrotation(player.controller);
			let brs = machinesbrs;
			if(brs == null) {return;}
			pos = {x: pos[0], y: pos[1], z: pos[2]};
			rot = {pitch: rot[0], yaw: rot[1], roll: rot[2]};
			const yaw = Number(rot.yaw);
			const pitch = Number(rot.pitch);
			const deg2rad = Math.PI / 180;
			let ray1 = {x: pos.x, y: pos.y, z: pos.z};
			let hitbrick = [];
			for(var B in brs) {
				
				let ray2 = {
				x: Number(pos.x) + Math.sin((-yaw + 90) * deg2rad) * projrange * Math.cos(pitch * deg2rad),
				y: Number(pos.y) + Math.cos((-yaw + 90) * deg2rad) * projrange * Math.cos(pitch * deg2rad),
				z: Number(pos.z) + projrange * Math.sin(pitch * deg2rad)
				};
				
				let brick = brs[B];
				let size = brick.size;
				if(brick.rotation%2 == 1) {
					size = [size[1],size[0],size[2]];
				}
				brick.size = size;
				const bpos = brick.position;
				const BP1 = {
				x: bpos[0] - size[0],
				y: bpos[1] - size[1],
				z: bpos[2] - size[2],
				};
				const BP2 = {
				x: bpos[0] + size[0],
				y: bpos[1] + size[1],
				z: bpos[2] + size[2],
				};
				if(await raycasttest.CheckLineBox(BP1, BP2, ray1, ray2)) {
					hitbrick.push({p: bpos, s: size});
				}
			}
			let closetbrick = 100;
			let brc = 0
			if(hitbrick.length === 0) {
				this.omegga.whisper(name,clr.red + '<b>Can\'t find any machines infront. Maybe try looking from a different angle? Or get closer.</>');
				return;
			}
			for(var b in hitbrick) {
				const br = hitbrick[b];
				const distance = Math.sqrt((br.p[0] - ray1.x)*(br.p[0] - ray1.x)+(br.p[1] - ray1.y)*(br.p[1] - ray1.y)+(br.p[2] - ray1.z)*(br.p[2] - ray1.z));
				if(distance < closetbrick) {
					closetbrick = distance;
					brc = br;
				}
			}
			if(brc.s == null) {return;}
			if(brc !== 0) {
				brc.s = [Math.max(brc.s[0],0),Math.max(brc.s[1],0),Math.max(brc.s[2],0)];
				let moneymcn = 0;
				moneymcn = machinesbrs.filter(mcn => mcn.position.join(' ') === brc.p.join(' '));
				let invn = await this.store.get(player.id);
				moneymcn = moneymcn[0];
				const data = moneymcn.components.BCD_Interact.ConsoleTag.split(' ');
				let pname = '';
				if((data.includes('Printer') && !data.includes('Manual')) || data.includes('Sld')) {
					pname = data.splice(6,data.length - 6).join(' ');
				}
				else if(data.includes('Manual')){
					pname = data.splice(4,data.length - 4).join(' ');
				}
				else {
					pname = data.splice(5,data.length - 5).join(' ');
				}
				if(pname === player.name) {
				let moneybrick = moneybrs.bricks[0];
				moneybrick.position = [Math.floor(Number(pos.x)),Math.floor(Number(pos.y)),Math.floor(Number(pos.z))];
				const mmcnd = moneymcn.components.BCD_Interact.ConsoleTag.split(' ');
				if(mmcnd[3] > 0) {
					invn.money += Math.floor(Number(mmcnd[3]) * 0.7);
					this.store.set(player.id,invn);
				}
						
				this.omegga.clearRegion({center: brc.p, extent: brc.s});
				machinesbrs.splice(machinesbrs.indexOf(moneymcn),1);
				this.omegga.whisper(name,clr.ylw +'<b>Machine refunded succesfully.</>');
				}
				else {
					this.omegga.whisper(name,clr.red + '<b>This machine belongs to ' + pname + '.</>');
				}
			}
			}
			catch (e){
			}
		})
		.on('cmd:trust', async (name, ...args) => {
			const arg = args[0];
			args.splice(0,1);
			const trustpl = args.join('');
			const player = this.omegga.getPlayer(name);
			let trust = await this.store.get("Trusted");
			switch(arg) {
				case 'add':
					trust.push({player: name, trusts: trustpl});
					this.store.set("Trusted",trust);
					this.omegga.whisper(name,clr.grn + '<b>You now trust ' + trustpl + '.</>');
					break;
				case 'remove':
					const trs = trust.filter(e => e.player === name && e.trusts === trustpl);
					if(trs.length === 0) {
						this.omegga.whisper(name,clr.red + '<b>You don\'t have that player trusted yet.</>');
						return;
					}
					trust.splice(trust.indexOf(trs[0]),1);
					this.store.set("Trusted", trust);
					this.omegga.whisper(name,clr.orn + '<b>You nolonger trust ' + trustpl + '.</>');
					break;
				default:
					const trs2 = trust.filter(e => e.player === name);
					this.omegga.whisper(name,clr.grn + '<b>---Trusted---</>');
					for(var t in trs2) {
						this.omegga.whisper(name,clr.ylw + '<b>' + trs2[t].trusts + '</>');
					}
					this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
					break;
			}
		})
		.on('cmd:buy', async (name, ...args) => {
			try {
				const test = args.join(' ');
				if(traderinrange.includes(name)) {
					const weapon = args.join(' ');
					const shopweapon = tradingstation.offers.filter(wpn => wpn.weapon === weapon);
					const currentspecials = tradingstation.offers.filter(spl => spl.special === weapon);
					if(shopweapon.length > 0) {
						const player = await this.omegga.getPlayer(name);
						let invn = await this.store.get(player.id);
						if(invn.money >= shopweapon[0].price) {
							invn.money -= shopweapon[0].price;
							invn.inv.push(shopweapon[0].weapon);
							tradingstation.offers.splice(tradingstation.offers.indexOf(shopweapon[0]),1);
							if(tradingstation.offers.length === 0) {
								this.removetrader(true);
							}
							this.omegga.whisper(name, '<b>You have bought: ' + clr.ylw + shopweapon[0].weapon + '</color>.</>');
							this.store.set(player.id,invn);
						}
						else {
							this.omegga.whisper(name, clr.red + '<b>You don\'t have enough money to buy that weapon.</>');
						}
					}
					else if(currentspecials.length > 0) {
						const player = await this.omegga.getPlayer(name);
						let invn = await this.store.get(player.id);
						if(invn.money >= currentspecials[0].price) {
							invn.money -= currentspecials[0].price;
							invn.charm.push(currentspecials[0].special);
							tradingstation.offers.splice(tradingstation.offers.indexOf(currentspecials[0]),1);
							if(tradingstation.offers.length === 0) {
								this.removetrader(true);
							}
							this.omegga.whisper(name, '<b>You have bought: ' + clr.ylw + currentspecials[0].special + '</color>.</>');
							this.store.set(player.id,invn);
						}
						else {
							this.omegga.whisper(name, clr.red + '<b>You don\'t have enough money to buy that weapon.</>');
						}
					}
					else {
						this.omegga.whisper(name,clr.red+'<b>The trading station doesn\'t have that item.</>');
					}
					return;
				}
				if(shoplist.filter(wpn => wpn.weapon === test).length > 0) {
					const weapon = args.join(' ');
					const shopweapon = shoplist.filter(wpn => wpn.weapon === weapon);
					if(shopweapon.length > 0) {
						if(Object.keys(shopweapon[0]).includes('trader')) {
							if(shopweapon[0].trader.tradeonly) {
								this.omegga.whisper(name, clr.red + '<b>This weapon is only available in trading stations.</>');
								return;
							}
						}
						const player = await this.omegga.getPlayer(name);
						let invn = await this.store.get(player.id);
						if(invn.money >= shopweapon[0].price) {
							invn.money -= shopweapon[0].price;
							invn.inv.push(shopweapon[0].weapon);
							this.omegga.whisper(name, '<b>You have bought: ' + clr.ylw + shopweapon[0].weapon + '</color>.</>');
							this.store.set(player.id,invn);
						}
						else {
							this.omegga.whisper(name, clr.red + '<b>You don\'t have enough money to buy that weapon.</>');
						}
					}
				}
				else if(machines.filter(mcn => mcn.name === test).length > 0) {
					const machine = args.join(' ');
					if(machine == 'manual printer') {
						this.omegga.whisper(name,clr.ylw+'<i><b>The machine is free lmao.</>');
						return;
					}
					const isvalid = machines.filter(mcn => mcn.name === machine);
					const data = isvalid[0].data.ConsoleTag.split(' ');
					const player = await this.omegga.getPlayer(name);
					let invn = await this.store.get(player.id);
					if(invn.money < data[3]) {
						this.omegga.whisper(name, clr.red + '<b>You don\'t have enough money to buy that machine.</>');
						return;
					}
					invn.money -= Number(data[3]);
					invn.machines.push(machine);
					this.store.set(player.id,invn);
					this.omegga.whisper(name, '<b>You have bought: ' + clr.ylw + machine + '</color>.</>');
				}
				else {
					this.omegga.whisper(name,clr.red+'<b>That item doesn\'t exist.</>');
					//break;
				}
			}
			catch (e){
			}
		})
		.on('leave', async player => {
			if(online.indexOf(player.name) > -1){
				online.splice(online.indexOf(player.name),1);
			}
		})
		.on('join', async player => {
			const keys = await this.store.keys();
			if(!keys.includes(player.id)) {
				this.store.set(player.id,{inv: ['pistol','impact grenade'], money: 0, base: [], selected: ['pistol','impact grenade','none'], machines: [], charm: []});
				this.omegga.whisper(player.name,clr.grn+'<b>You\'re new so you recieved basic guns. Please use /basewars for basic info.</>')
			}
			let invn = await this.store.get(player.id);
			if(invn.charm === '') {
				invn.charm = [];
				invn.selected.push('none');
				this.store.set(player.id,invn);
			}
			online.push(player.name);
			if(!keys.includes("Trusted")){
				this.store.set("Trusted",[]);
			}
			const plyr = this.omegga.getPlayer(player.id);
			if(enablechecker) {
				plyr.setTeam(1);
				plyr.giveItem(weapons[invn.selected[0]]);
				plyr.giveItem(weapons[invn.selected[1]]);
				plyr.giveItem(weapons['rocket jumper']);
			}
			else {
				plyr.setTeam(0);
			}
			if(invn.base.length > 0) {
				const joinedpos = (invn.base).join(' ');
				this.omegga.writeln('Chat.Command /TP '+player.name+' ' +joinedpos+' 0');
			}
		})
		.on('cmd:setspawn', async name => {
			const haskey = await this.store.keys();
			const player = await this.omegga.getPlayer(name);
			let trust = await this.store.get("Trusted");
			if(haskey.includes(player.id)) {
				const pos = await player.getPosition();
				if(await player.isDead()) {
					this.omegga.whisper(name,clr.red+'<b>You can\'t set spawn while you are dead.</>');
					return;
				}
				const cores = basecores.filter(brick => brick.components.BCD_Interact.ConsoleTag.indexOf(name) === -1 && Math.sqrt(
				(pos[0] - brick.position[0]) * (pos[0] - brick.position[0]) +
				(pos[1] - brick.position[1]) * (pos[1] - brick.position[1]) +
				(pos[2] - brick.position[2]) * (pos[2] - brick.position[2])
				) < 1280);
				if(cores.length > 0) {
					let canset = false;
					for(var cr in cores){
						const core = cores[cr].components.BCD_Interact.ConsoleTag;
						for(var trs in trust) {
							const trusted = trust[trs];
							if(trusted.player === core && trusted.trusts === name) {
								canset = true;
							}
						}
					}
					if(!canset) {
						this.omegga.whisper(name, clr.red + '<b>You cannot set spawn near base cores.</>');
						return;
					}
				}
				let invnt = await this.store.get(player.id);
				invnt.base = [Math.floor(pos[0]),Math.floor(pos[1]),Math.floor(pos[2])];
				this.store.set(player.id,invnt);
				this.omegga.whisper(name,clr.ylw+"<b>Base spawn has been set.</>");
			}
		})
		.on('cmd:clearspawn', async name => {
			const haskey = await this.store.keys();
			const player = await this.omegga.getPlayer(name);
			if(haskey.includes(player.id)) {
				let invnt = await this.store.get(player.id);
				invnt.base = [];
				this.store.set(player.id,invnt);
				this.omegga.whisper(name,clr.ylw+"<b>Base spawn has been cleared.</>");
			}
		})
		.on('cmd:listshop', async (name, ...args) => {
			try {
			switch (args[0])
			{
				case 'weapons':
					this.omegga.whisper(name, "<b>Weapons --------------" + clr.end);
					for(var w=0;w<shoplist.length;w++) {
						if(Object.keys(shoplist[w]).includes('trader')) {
							const stat = shoplist[w].trader;
							if(stat.tradeonly) {
								continue;
							}
						}
						if(shoplist[w].explosive != null) {
							const stat = shoplist[w].explosive;
							this.omegga.whisper(name,'<b>' + clr.orn + shoplist[w].weapon + '</color>: ' + clr.ylw + '$' + clr.dgrn + shoplist[w].price + clr.red + ' damage: ' + stat.damage + clr.ylw + ' radius: ' + (stat.radius * 0.1) + clr.cyn + ' strenght: ' + stat.penetration + '</>');
							continue;
						}
						this.omegga.whisper(name,'<b>' + clr.orn + shoplist[w].weapon + '</color>: ' + clr.ylw + '$' + clr.dgrn + shoplist[w].price + '</>');
					}
					this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
					break;
				case 'machines':
					this.omegga.whisper(name, "<b>Machines --------------" + clr.end);
					for(var mcn=0;mcn<machines.length;mcn++) {
						const data = machines[mcn].data.ConsoleTag.split(' ');
						if(!data.includes('Manual')) {
							switch(data[0]) {
								case 'Printer':
									this.omegga.whisper(name, '<b>' + clr.dgrn + machines[mcn].name + '</color>: ' + clr.ylw + '$' + clr.dgrn + data[3] + clr.slv + ' uses: ' + clr.cyn + data[5] + 'Eu ' + clr.slv + 'produces: ' + clr.ylw + '$' + clr.dgrn + data[4] + '</>');
									break;
								case 'Gen':
									this.omegga.whisper(name, '<b>' + clr.orn + machines[mcn].name + '</color>: ' + clr.ylw + '$' + clr.dgrn + data[3] + clr.slv + ' produces: ' + clr.cyn + data[4] + 'Eu</>');
									break;
								case 'Sld':
									this.omegga.whisper(name, '<b>' + clr.cyn + machines[mcn].name + '</color>: ' + clr.ylw + '$' + clr.dgrn + data[3] + clr.slv + ' capacity: ' + clr.orn + data[2] + 'Eu' + clr.slv + ' range: ' + clr.ylw + data[5] + '</>');
									break;
							}
						}
					}
					this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
					break;
				default:
					this.omegga.whisper(name, clr.red + '<b>You need to input if you want to show weapons or machines.</>');
					break;
			}
			}
			catch (e){
			}
		})
		.on('cmd:loadout', async (name, ...args) => {
			try {
			const haskey = await this.store.keys();
			const player = await this.omegga.getPlayer(name);
			if(haskey.includes(player.id)) {
				const slot = args[0];
				if(slot > 3) {
					this.omegga.whisper(name,clr.red + '<b>You have only 3 slots.</>');
					return;
				}
				if(slot < 1) {
					this.omegga.whisper(name,clr.red + '<b>There is no zero or negative slots.</>');
					return;
				}
				args.splice(0,1);
				const weapon = args.join(' ');
				let inv = await this.store.get(player.id);
				if(inv.inv.includes(weapon) && slot < 3) {
					player.takeItem(weapons[inv.selected[0]]);
					player.takeItem(weapons[inv.selected[1]]);
					player.takeItem(weapons['rocket jumper']);
					player.takeItem(weapons['impulse grenade']);
					inv.selected[slot - 1] = weapon;
					if(enablechecker) {
						player.giveItem(weapons[inv.selected[0]]);
						player.giveItem(weapons[inv.selected[1]]);
						player.giveItem(weapons['rocket jumper']);
						if(inv.selected[2] !== 'none') {
							player.giveItem(weapons['impulse grenade']);
						}
					}
					this.store.set(player.id,inv);
					if(todie.includes(name) && !inv.selected.includes(weapon)) {
						todie.splice(todie.indexOf(name), 1);
					}
					this.omegga.whisper(name,'<b>Slot '+clr.ylw+slot+'</color> has been set to '+clr.orn+weapon+'</color>.</>');
				}
				else if((inv.charm.includes(weapon) || weapon === 'none') && slot == 3) {
					player.takeItem(weapons['impulse grenade']);
					inv.selected[slot - 1] = weapon;
					if(enablechecker && weapon !== 'none') {
						player.giveItem(weapons['impulse grenade']);
					}
					this.store.set(player.id,inv);
					this.omegga.whisper(name,'<b>Special slot has been set to '+clr.red+weapon+'</color>.</>');
				}
				else {
					this.omegga.whisper(name, clr.red+'<b>You don\'t have that weapon.</>')
				}
			}
			}
			catch (e){
			}
		})
		.on('cmd:basewars', async (name, ...args) => {
			try {
			const arg = args.join(' ');
			this.omegga.whisper(name, '<size="50"><b>' + clr.red + 'Base wars</> -----------------</>');
			switch(arg) {
				default:
					this.omegga.whisper(name, '<b>' + clr.grn + '/basewars</color> you are here.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/basewars how to play</color> basics to Base wars.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/basewars commands</color> commands for Base wars.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/basewars machines</color> info about machines in Base wars.</>');
					break;
				case 'how to play':
					this.omegga.whisper(name, '<size="30"><b>How to play.</>');
					this.omegga.whisper(name, '<b>Welcome to Base wars! Where you build and destroy basses, if you are not aware already.</>');
					this.omegga.whisper(name, '<b>Each couple of minutes the modes get switched to fight mode and build mode.</>');
					this.omegga.whisper(name, '<b>Your goal is to build and defend machines which generate money. You can destroy other people\'s machines for money. With money you can buy more machines and better weapons to kill and destroy.</>');
					this.omegga.whisper(name, '<b>During build mode you can build... Obviously... During fight mode you can destroy each other\'s bases. Bases can ONLY be destroyed with explosives.</>');
					this.omegga.whisper(name, '<b>To begin making money place down a manual printer with /place manual printer . Machines only get checked everytime fight mode begins so if you place down any machines during fight mode they wont be detected.</>');
					break;
				case 'commands':
					this.omegga.whisper(name, '<size="30"><b>Commands.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/basewars</color> info about Base wars.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/viewinv</color> view your inventory.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/listshop (machines/weapons) (page number)</color> list machines/weapons.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/loadout (1 - 3) (weapon)</color> set your weapon slot.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/buy (machine/weapon name)</color> buy a machine/weapon.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/setspawn</color> set your base spawn.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/clearspawn</color> clears your base spawn.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/place (machine name)</color> place down a machine.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/refund </color>removes a machine that you are looking at. Refunded machines return 80% of their original price.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/placecore </color>places a core which prevents players from setting spawn at your base. You can ONLY place 1.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/removecore </color>removes a core.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/pay (money) (player)</color> gives a player money.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/skip</color> vote to skip the round.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/trust (add/remove/nothing) (player name) </color> gives/removes/views trust. Trusted users will not be damaged by your turrets and will be able to set spawn within your base core.</>');
					break;
				case 'machines':
					this.omegga.whisper(name, '<size="30"><b>Machines.</>');
					this.omegga.whisper(name, '<b>There are 3 types of machines. Printers generate money. Generators generate energy for the printers.</>');
					this.omegga.whisper(name, '<b>Generators can only work within a radius of 50 studs from printers.</>');
					this.omegga.whisper(name, '<b>Upon being destroyed machines drop 80% of their original price as a money brick.</>');
 					this.omegga.whisper(name, '<b>Machines can ONLY generate money during fight mode and when you are online on the server.</>');
					this.omegga.whisper(name, '<b>Shields protect bricks and machines that are within it\'s range. Shields have a limited charge, which once drained the shield will stop working. Amount of charge that is regenerated each minute depends on the printers around the shields.</>');
 					break;
			}
			this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
			}
			catch (e){
			}
		})
		.on('cmd:viewinv', async name => {
			await this.viewinv(name).catch();
		})
		.on('cmd:wipeall', async name => {
			const host = await this.omegga.host;
			if(host.name !== name) {
				this.omegga.whisper(name,'You are not allowed to wipe everyone\'s progress.');
				return;
			}
			if(!allowerase) {
				allowerase = true;
				this.omegga.whisper(name, 'Are you sure you want to wipe all the progress? This will remove everyone\'s guns, money and base position. Type this again to confirm.')
			}
			else {
				allowerase = false;
				this.store.wipe();
				this.omegga.whisper(name, 'Everyone\'s progress has been wiped.')
			}
		});
		let brs = await this.omegga.getSaveData();
		if(brs != null) {
			brs = brs.bricks.filter(brick => 'BCD_Interact' in brick.components && brs.brick_owners[brick.owner_index - 1].name.indexOf('BaseCore') === 0);
			basecores = brs;
		}
		const players = await this.omegga.getPlayers();
		for(var pl in players) {
			online.push(players[pl].name);
			this.omegga.getPlayer(players[pl].name).setTeam(0);
		}
		this.loadmapbricks();
		ProjectileCheckInterval = setInterval(() => this.CheckProjectiles(enablechecker && online.length > 0),delay);
		skipnturretinterval = setInterval(() => this.skipdecrementnturrets(),2000);
		return { registeredCommands: ['wipeall','loadout','viewinv','setspawn','clearspawn','place','buy','listshop','basewars','refund','pay','changelog','placecore','removecore','skip','trust'] };
	}
	async pluginEvent(event, from, ...args) {
		if(event === 'spawn') {
			const player = args[0].player;
			const invn = await this.store.get(player.id);
			if(invn == null) {
				return;
			}
			if(invn.base.length > 0) {
				const joinedpos = (invn.base).join(' ');
				this.omegga.writeln('Chat.Command /TP '+player.name+' ' +joinedpos+' 0');
			}
			if(enablechecker) {
				const ply = this.omegga.getPlayer(player.id);
				if(ply != null) {
					ply.giveItem(weapons[invn.selected[0]]);
					ply.giveItem(weapons[invn.selected[1]]);
					ply.giveItem(weapons['rocket jumper']);
					if(invn.selected[2] !== 'none') {
						ply.giveItem(weapons['impulse grenade']);
					}
				}
			}
		}
		if(event === 'death') {
			if(!enablechecker) {
				return;
			}
			const player = args[0].player;
			const invn = await this.store.get(player.id);
			for(var invwep in invn.selected) {
				const weps = shoplist.filter(wep => wep.weapon === invn.selected[invwep] && wep.price > 2000);
				const spesls = specialslist.filter(spl => spl.special === invn.selected[invwep]);
				if(weps.length > 0) {
					const deletewep = weps[0]
					invn.selected[invn.selected.indexOf(deletewep.weapon)] = 'pistol';
					invn.inv.splice(invn.inv.indexOf(deletewep.weapon), 1);
					this.store.set(player.id, invn);
					this.omegga.whisper(player.name, clr.red + "<b>You have lost your " + deletewep.weapon + ".</>");
				}
				if(spesls.length > 0) {
					const deletespl = spesls[0]
					invn.selected[invn.selected.indexOf(deletespl.special)] = 'none';
					invn.charm.splice(invn.charm.indexOf(deletespl.special), 1);
					this.store.set(player.id, invn);
					this.omegga.whisper(player.name, clr.red + "<b>You have lost your " + deletespl.special + ".</>");
				}
			}
		}
	}
	async stop() {
		const deathevents = await this.omegga.getPlugin('deathevents');
		if(deathevents) {
			console.log('Unsubbing...');
			deathevents.emitPlugin('unsubscribe');
		}
		clearInterval(ProjectileCheckInterval);
		clearInterval(skipnturretinterval);
	}
}
module.exports = Base_wars;