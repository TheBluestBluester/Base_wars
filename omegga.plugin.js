const { brs } = OMEGGA_UTIL;
const raycasttest = require('./Raycast');
const weplist = require('./Weaponslist');
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
	{weapon: 'impact grenade launcher', price: 100},
	{weapon: 'suppressed bullpup smg', price: 300},
	{weapon: 'shotgun', price: 440},
	{weapon: 'assault rifle', price: 600},
	{weapon: 'sniper', price: 840},
	{weapon: 'classic assault rifle', price: 1100},
	{weapon: 'tactical shotgun', price: 1200},
	{weapon: 'barrage launcher', price: 1600},
	{weapon: 'suppressed service rifle', price: 2100},
	{weapon: 'bazooka', price: 3000},
	{weapon: 'rocket launcher', price: 3800},
	{weapon: 'twin cannon', price: 4600}
];

const moneyfile = fs.readFileSync(__dirname + "/Money.brs");
const moneybrs = brs.read(moneyfile);

let online = [];
let todie = [];

let weapons;
let delay = 200;
let projrange = 400;
let spawned = [];
let e = false;
let enablechecker = false;
let time = 10;

let buildtime = 10;
let fighttime = 10;

let ProjectileCheckInterval;
let CountDownInterval;

let machinesbrs = [];
let allowerase = false;
let machines = [];
let mcntimeout = [];

class Base_wars {
	
	constructor(omegga, config, store) {
		this.omegga = omegga;
		this.config = config;
		this.store = store
		delay = this.config.UpdateFrequency;
		projrange = this.config.DetectionRange;
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
			if(projrot[0] == null) {return;}
			pos = projectiles[0].groups;
			rot = projrot[0].groups;
			const projname = projrot[0].input.substr(projrot[0].input.indexOf('Projectile_') + 11, projrot[0].input.indexOf('_C_')-projrot[0].input.indexOf('Projectile_')-11);
			this.raycast(pos, rot, projname);
		}
		else if(!e) {
			e = true;
		}
		
	}
	
	async runmachines() {
		let usedgenerators = [];
		if(machinesbrs.length === 0) {
			return;
		}
		for(var mcn in machinesbrs) {
			const mcnb = machinesbrs[mcn];
			const data = mcnb.components.BCD_Interact.ConsoleTag.split(' ');
			const pname = data.splice(6,data.length - 6).join(' ');
			if(data[0] === 'Printer' && data[1] === 'Auto') {
				const bpos = mcnb.position;
				
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
				//console.log(energy, data[5]);
				if(energy >= Number(data[5])) {
					const player = await this.omegga.getPlayer(pname);
					if(online.includes(pname)) {
						let invn = await this.store.get(player.id);
						invn.money += Number(data[4]);
						//console.log(data[4]);
						this.store.set(player.id,invn);
						//this.omegga.whisper(pname,'You machine generated money.')
					}
				}
			}
		}
		let machinestoreload = moneybrs;
		if(machinestoreload.length > 0) {
			machinestoreload.bricks = machinesbrs;
			this.omegga.loadSaveData(machinestoreload,{quiet: true});
		}
		
	}
	
	async decrement(enabled) {
		if(enablechecker) {
			this.runmachines();
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
				this.modetoggle("egg");
				break;
		}
	}
	
	async raycast(pos, rot, type) {
		let brs = await this.omegga.getSaveData({center: [pos.x,pos.y,pos.z], extent: [projrange,projrange,projrange]});
		if(brs == null) {return;}
		const yaw = Number(rot.yaw);
		const pitch = Number(rot.pitch);
		const deg2rad = Math.PI / 180;
		let ray1 = {x: Number(pos.x), y: Number(pos.y), z: Number(pos.z)};
		let hitbrick = [];
		let projradius = 0;
		let projdamage = 0;
		switch(type) {
			case 'ImpactGrenade':
				projradius = 30;
				projdamage = 10;
				break;
			case 'ImpactGrenadeLauncher':
				projradius = 20;
				projdamage = 8;
				break;
			case 'RocketLauncher':
				projradius = 80;
				projdamage = 30;
				break;
			case 'QuadLauncher':
				projradius = 30;
				projdamage = 12;
				break;
			case 'Bazooka':
				projradius = 20;
				projdamage = 8
				break;
			case 'TwinCannon':
				projradius = 10;
				projdamage = 16;
				break;
		}
		for(var B in brs.bricks) {
			
			let ray2 = {
			x: Number(pos.x) + Math.sin((-yaw + 90) * deg2rad) * projrange * Math.cos(pitch * deg2rad),
			y: Number(pos.y) + Math.cos((-yaw + 90) * deg2rad) * projrange * Math.cos(pitch * deg2rad),
			z: Number(pos.z) + projrange * Math.sin(pitch * deg2rad)
			};
			
			let brick = brs.bricks[B];
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
			brc.s = [Math.max(brc.s[0],projradius),Math.max(brc.s[1],projradius),Math.max(brc.s[2],projradius)];
			let moneymcn = 0;
			let isdamaged = true;
			for(var mcn in machinesbrs) {
				if(machinesbrs[mcn].position[0] === brc.p[0] && machinesbrs[mcn].position[1] === brc.p[1] && machinesbrs[mcn].position[2] === brc.p[2]) {
					moneymcn = machinesbrs[mcn];
					let moneybrick = moneybrs.bricks[0];
					moneybrick.position = [Math.floor(Number(pos.x)),Math.floor(Number(pos.y)),Math.floor(Number(pos.z))];
					let mmcnd = moneymcn.components.BCD_Interact.ConsoleTag.split(' ');
					mmcnd[2] = Number(mmcnd[2]) - projdamage;
					if(Number(mmcnd[2]) > 0) {
						machinesbrs[mcn].components.BCD_Interact.ConsoleTag = mmcnd.join(' ');
						isdamaged = false;
					}
					else {
					if(mmcnd[3] > 0) {
						moneybrick.components.BCD_Interact.ConsoleTag = 'Money ' + Math.floor(Number(mmcnd[3]) * 0.8);
						const toplace =  {...moneybrs, bricks: [moneybrick], brick_owners : [{
						id: '00000000-0000-0000-0000-000000000080',
						name: 'Money',
						bricks: 0}]};
						this.omegga.loadSaveData(toplace,{quiet: true});
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
				this.omegga.clearRegion({center: brc.p, extent: brc.s});
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
	async modetoggle(name) {
		enablechecker = !enablechecker;
		const players = this.omegga.getPlayers();
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
			machinesbrs = brs;
			machinesbrs = machinesbrs.bricks.filter(machine => 'BCD_Interact' in machine.components && machinesbrs.brick_owners[machine.owner_index - 1].name.indexOf('MCN') === 0);
			brs.bricks = brs.bricks.filter(brick => 'BCD_ItemSpawn' in brick.components);
			for(var br in brs.bricks) {
				const brick = brs.bricks[br];
				let size = brick.size;
				if(brick.rotation%2 == 1) {
					size = [size[1],size[0],size[2]];
				}
				this.omegga.clearRegion({center: brick.position, extent: size});
			}
			this.omegga.broadcast("<size=\"50\"><b>Fight!</>");
			this.omegga.broadcast("<b>You have " + fighttime + " minutes of fight time.</>");
			time = fighttime;
		}
		else {
			const players = this.omegga.getPlayers();
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
		/*
		this.omegga.on('cmd:enable', async name => {
			this.modetoggle(name);
		})
		
		.on('cmd:test', async player => {
			this.runmachines();
		})
		
		this.omegga.on('cmd:test2', async name => {
			const player = await this.omegga.getPlayer(name);
			let invn = await this.store.get(player.id);
			invn.money += 9000;
			this.store.set(player.id, invn);
		});
		*/
		this.omegga.on('cmd:place', async (name, ...args) => {
			const mcntoplace = args.join(' ');
			let machinert = machines.filter(mcn => mcn.name === mcntoplace);
			const player = await this.omegga.getPlayer(name);
			const ppos = await player.getPosition();
			let nearbybricks = await this.omegga.getSaveData({center: [Math.floor(ppos[0]), Math.floor(ppos[1]), Math.floor(ppos[2])], extent: [200,200,200]});
			let invn = await this.store.get(player.id);
			if(machinert.length > 0) {
				if(!(invn.machines.includes(mcntoplace) || mcntoplace === 'manual printer')) {
					this.omegga.whisper(name, clr.red+'<b>You don\'t have that machine.</>');
					return;
				}
				machinert = machinert[0];
				// VVV i will not forgive javascript for this
				const mcnbrs = JSON.parse(JSON.stringify(machinert.brs));
				mcnbrs.brick_owners = [{
					id: '00000000-0000-0000-0000-000000000060',
					name: 'MCN',
					bricks: 0
				}];
				ppos[0] = Math.round(ppos[0]/10)*10;
				ppos[1] = Math.round(ppos[1]/10)*10;
				ppos[2] = Math.round(ppos[2]);
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
				this.omegga.loadSaveData(mcnbrs,{offX: ppos[0], offY: ppos[1], offZ: ppos[2] - 25, quiet: true});
				invn.machines.splice(invn.machines.indexOf(mcntoplace),1);
				this.store.set(player.id,invn);
				machinesbrs.push(mcnbrs.bricks[0]);
				this.omegga.whisper(name,'<b>Succesfully placed ' + clr.ylw + machinert.name + '</color>.</>');
			}
		})
		.on('cmd:pay', async (name, ...args) => {
			const money = Number(args[0]);
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
			const pid1 = await this.omegga.getPlayer(name);
			let invn = await this.store.get(pid1.id);
			if(invn.money < money) {
				this.omegga.whisper(name, clr.red + '<b>You don\'t have enouph money to pay ' + clr.ylw + '$' + clr.dgrn + money + clr.red + '.</>');
				return;
			}
			invn.money -= money;
			this.store.set(pid1.id, invn);
			const pid2 = await this.omegga.getPlayer(player);
			let reciver = await this.store.get(pid2.id);
			reciver.money += money;
			this.store.set(pid2.id, reciver);
			this.omegga.whisper(name, '<b>You have paid ' + clr.ylw + '$' + clr.dgrn + money + '</></><b> to ' + clr.ylw + player + '</><b>.</>');
			this.omegga.whisper(player, '<b>You have recived ' + clr.ylw + '$' + clr.dgrn + money + '</></><b> from ' + clr.ylw + name + '</><b>.</>');
		})
		.on('interact', async data => {
			if(data.message.indexOf('Money') === 0) {
				const argsarray = data.message.split(' ');
				const checklegitimacy = await this.omegga.getSaveData({center: data.position, extent: [5, 10, 2]});
				if(checklegitimacy.brick_owners[0].name === 'Money') {
					let invn = await this.store.get(data.player.id);
					invn.money += Number(argsarray[1]);
					this.store.set(data.player.id, invn);
					this.omegga.middlePrint(data.player.name, clr.ylw + '<b>$' + clr.dgrn + argsarray[1] + '</>');
					this.omegga.clearRegion({center: data.position, extent: [5, 10, 2]});
				}
				return;
			}
			const checklegitimacy = machinesbrs.filter(brick => brick.position.join(' ') === data.position.join(' '));
			if(checklegitimacy.length === 0) { return; }
			const argsarray = data.message.split(' ');
			if(argsarray[4] === data.player.name && !mcntimeout.includes(data.player.id)) {
				if(argsarray[0] === 'Printer' && argsarray[1] === 'Manual' && enablechecker) {
					let pdata = await this.store.get(data.player.id);
					pdata.money += 2;
					this.store.set(data.player.id,pdata);
					mcntimeout.push(data.player.id);
					setTimeout(() => mcntimeout.splice(mcntimeout.indexOf(data.player.id),1), 5000);
				}
			}
			else if(mcntimeout.includes(data.player.id)) {
				this.omegga.middlePrint(data.player.name,clr.red+'<b>You need to wait 5 seconds before using this machine again.</>');
			}
		})
		.on('cmd:changelog', async name => {
			this.omegga.whisper(name, clr.ylw + "<size=\"30\"><b>--ChangeLog--</>");
			this.omegga.whisper(name, clr.orn + "<b>Added a changelog.</>");
			this.omegga.whisper(name, clr.orn + "<b>Added a /pay command.</>");
			this.omegga.whisper(name, clr.orn + "<b>Weapons over 2000 will be lost on death.</>");
			this.omegga.whisper(name, clr.orn + "<b>/loadout now changes your inventory during fight mode so you don't have to die to switch weapons.</>");
			this.omegga.whisper(name, clr.orn + "<b>Manual printer now generates " + clr.ylw + "$" + clr.dgrn + "2" + clr.orn + ".</>");
			this.omegga.whisper(name, clr.orn + "<b>Machines placed after this update will make noise.</>");
			this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
		})
		.on('cmd:refund', async name => {
			const player = await this.omegga.getPlayer(name);
			let pos = await player.getPosition();
			let rot = await this.getrotation(player.controller);
			let brs = await this.omegga.getSaveData({center: pos, extent: [100,100,100]});
			if(brs == null) {return;}
			pos = {x: pos[0], y: pos[1], z: pos[2]};
			rot = {pitch: rot[0], yaw: rot[1], roll: rot[2]};
			const yaw = Number(rot.yaw);
			const pitch = Number(rot.pitch);
			const deg2rad = Math.PI / 180;
			let ray1 = {x: pos.x, y: pos.y, z: pos.z};
			let hitbrick = [];
			for(var B in brs.bricks) {
				
				let ray2 = {
				x: Number(pos.x) + Math.sin((-yaw + 90) * deg2rad) * projrange * Math.cos(pitch * deg2rad),
				y: Number(pos.y) + Math.cos((-yaw + 90) * deg2rad) * projrange * Math.cos(pitch * deg2rad),
				z: Number(pos.z) + projrange * Math.sin(pitch * deg2rad)
				};
				
				let brick = brs.bricks[B];
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
				let invn = await this.store.get(player.id);
				for(var mcn in machinesbrs) {
					if(machinesbrs[mcn].position[0] === brc.p[0] && machinesbrs[mcn].position[1] === brc.p[1] && machinesbrs[mcn].position[2] === brc.p[2]) {
						moneymcn = machinesbrs[mcn];
						const data = moneymcn.components.BCD_Interact.ConsoleTag.split(' ');
						let pname = '';
						if(data.includes('Printer') && !data.includes('Manual')) {
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
						machinesbrs.splice(mcn,1);
						this.omegga.whisper(name,clr.ylw +'<b>Machine refunded succesfully.</>');
						}
						else {
							this.omegga.whisper(name,clr.red + '<b>This machine belongs to ' + pname + '.</>');
						}
					}
				}
			}
		})
		.on('cmd:buy', async (name, ...args) => {
			switch(args[0]) {
				case 'weapon':
					const weapon = args.splice(1,args.length).join(' ');
					const shopweapon = shoplist.filter(wpn => wpn.weapon === weapon);
					if(shopweapon.length > 0) {
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
					else {
						this.omegga.whisper(name, clr.red + '<b>That weapon doesn\'t exist.</>');
					}
					break;
				case 'machine':
					const machine = args.splice(1,args.length).join(' ');
					if(machine == 'manual printer') {
						this.omegga.whisper(name,clr.ylw+'<i><b>The machine is free lmao.</>');
						break;
					}
					const isvalid = machines.filter(mcn => mcn.name === machine);
					if(isvalid.length === 0) {
						this.omegga.whisper(name,clr.red+'<b>That machine doesn\'t exist,</>');
						break;
					}
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
					break;
				default:
					this.omegga.whisper(name,clr.red+'<b>You have to input weapon/machine before typing in what you want to buy.</>');
					break;
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
				this.store.set(player.id,{inv: ['pistol','impact grenade','rocket jumper'], money: 0, base: [], selected: ['pistol','impact grenade'], machines: [], charm: ''});
				this.omegga.whisper(player.name,clr.grn+'<b>You\'re new so you recieved basic guns. Please use /basewars for basic info.</>')
			}
			const invn = await this.store.get(player.id);
			online.push(player.name);
			if(enablechecker) {
				this.omegga.getPlayer(player.id).setTeam(1);
				this.omegga.getPlayer(player.id).giveItem(weapons[invn.selected[0]]);
				this.omegga.getPlayer(player.id).giveItem(weapons[invn.selected[1]]);
			}
			else {
				this.omegga.getPlayer(player.id).setTeam(0);
			}
			if(invn.base.length > 0) {
				const joinedpos = (invn.base).join(' ');
				this.omegga.writeln('Chat.Command /TP '+player.name+' ' +joinedpos+' 0');
			}
		})
		.on('cmd:setspawn', async name => {
			const haskey = await this.store.keys();
			const player = await this.omegga.getPlayer(name);
			if(haskey.includes(player.id)) {
				let invnt = await this.store.get(player.id);
				const pos = await this.omegga.getPlayer(name).getPosition();
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
			switch (args[0])
			{
				case 'weapons':
					this.omegga.whisper(name, "<b>Weapons --------------" + clr.end);
					for(var w in shoplist) {
						this.omegga.whisper(name,'<b>' + clr.orn + shoplist[w].weapon + '</color>: ' + clr.ylw + '$' + clr.dgrn + shoplist[w].price + '</>');
					}
					this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
					break;
				case 'machines':
					this.omegga.whisper(name, "<b>Machines --------------" + clr.end);
					for(var mcn in machines) {
						const data = machines[mcn].data.ConsoleTag.split(' ');
						if(!data.includes('Manual')) {
							switch(data[0]) {
								case 'Printer':
									this.omegga.whisper(name, '<b>' + clr.dgrn + machines[mcn].name + '</color>: ' + clr.ylw + '$' + clr.dgrn + data[3] + clr.slv + ' uses: ' + clr.cyn + data[5] + 'Eu ' + clr.slv + 'produces: ' + clr.ylw + '$' + clr.dgrn + data[4] + '</>');
									break;
								case 'Gen':
									this.omegga.whisper(name, '<b>' + clr.orn + machines[mcn].name + '</color>: ' + clr.ylw + '$' + clr.dgrn + data[3] + clr.slv + ' produces: ' + clr.cyn + data[4] + 'Eu</>');
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
		})
		.on('cmd:loadout', async (name, ...args) => {
			const haskey = await this.store.keys();
			const player = await this.omegga.getPlayer(name);
			if(haskey.includes(player.id)) {
				const slot = args[0];
				if(slot > 2) {
					this.omegga.whisper(name,clr.red + '<b>You have only 2 slots.</>');
					return;
				}
				if(slot < 1) {
					this.omegga.whisper(name,clr.red + '<b>There is no zero or negative slots.</>');
					return;
				}
				args.splice(0,1);
				const weapon = args.join(' ');
				let inv = await this.store.get(player.id);
				if(inv.inv.includes(weapon)) {
					this.omegga.getPlayer(player.id).takeItem(weapons[inv.selected[0]]);
					this.omegga.getPlayer(player.id).takeItem(weapons[inv.selected[1]]);
					inv.selected[slot - 1] = weapon;
					if(enablechecker) {
						this.omegga.getPlayer(player.id).giveItem(weapons[inv.selected[0]]);
						this.omegga.getPlayer(player.id).giveItem(weapons[inv.selected[1]]);
					}
					this.store.set(player.id,inv);
					if(todie.includes(name) && !inv.selected.includes(weapon)) {
						todie.splice(todie.indexOf(name), 1);
					}
					this.omegga.whisper(name,'<b>Slot '+clr.ylw+slot+'</color> has been set to '+clr.orn+weapon+'</color>.</>');
				}
				else {
					this.omegga.whisper(name, clr.red+'<b>You don\'t have that weapon.</>')
				}
			}
		})
		.on('cmd:basewars', async (name, ...args) => {
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
					this.omegga.whisper(name, '<b>' + clr.grn + '/listshop (machines/weapons)</color> list machines/weapons.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/loadout (1 - 2) (weapon)</color> set your weapon slot.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/buy (machine/weapon) (machine/weapon name)</color> buy a machine/weapon.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/setspawn</color> set your base spawn.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/clearspawn</color> clears your base spawn.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/place (machine name)</color> place down a machine.</>');
					this.omegga.whisper(name, '<b>' + clr.grn + '/refund </color>removes a machine that you are looking at. Refunded machines return 80% of their original price.</>');
					break;
				case 'machines':
					this.omegga.whisper(name, '<size="30"><b>Machines.</>');
					this.omegga.whisper(name, '<b>There are 2 types of machines. Printers generate money. Generators generate energy for the printers.</>');
					this.omegga.whisper(name, '<b>Generators can only work within a radius of 50 studs from printers.</>');
					this.omegga.whisper(name, '<b>Upon being destroyed machines drop 60% of their original price as a money brick.</>');
					this.omegga.whisper(name, '<b>Machines can ONLY generate money during fight mode and when you are online on the server.</>');
					break;
			}
			this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
		})
		.on('cmd:viewinv', async name => {
			const player = await this.omegga.getPlayer(name);
			const keys = await this.store.keys();
			if(keys.includes(player.id)) {
				const inv = await this.store.get(player.id);
				const inventory = inv.inv;
				const machines = inv.machines;
				const loadout = inv.selected;
				this.omegga.whisper(name, "<b>Your inventory --------------" + clr.end);
				this.omegga.whisper(name,'<b>' + clr.ylw + inventory.join('</color>,</>\n<b>' + clr.ylw) + '</>');
				this.omegga.whisper(name,"<b>Money: " + clr.ylw + '$'  + clr.dgrn + inv.money + clr.end);
				this.omegga.whisper(name, "<b>" + clr.slv +"Current loadout: "  + clr.orn + '<b>' + loadout.join(', ') + clr.end);
				this.omegga.whisper(name,"<b>Machines:" + clr.end);
				this.omegga.whisper(name,'<b>' + clr.dgrn + machines.join('</color>,</>\n<b>' + clr.dgrn) + '</>');
				this.omegga.whisper(name, clr.ylw + "<b>PGup n PGdn to scroll." + clr.end);
			}
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
		ProjectileCheckInterval = setInterval(() => this.CheckProjectiles(enablechecker),delay);
		CountDownInterval = setInterval(() => this.decrement(true),60000);
		return { registeredCommands: ['wipeall','loadout','viewinv','setspawn','clearspawn','place','buy','listshop','basewars','refund','pay','changelog'] };
	}
	async pluginEvent(event, from, ...args) {
		if(event === 'spawn') {
			const player = args[0].player;
			const invn = await this.store.get(player.id);
			if(invn.base.length > 0) {
				const joinedpos = (invn.base).join(' ');
				this.omegga.writeln('Chat.Command /TP '+player.name+' ' +joinedpos+' 0');
			}
			if(enablechecker) {
				this.omegga.getPlayer(player.id).giveItem(weapons[invn.selected[0]]);
				this.omegga.getPlayer(player.id).giveItem(weapons[invn.selected[1]]);
			}
		}
		if(event === 'death') {
			if(!enablechecker) {
				return;
			}
			const player = args[0].player;
			//if(!todie.includes(player.name)) {
				//todie.push(player.name);
				//return;
			//}
			const invn = await this.store.get(player.id);
			for(var invwep in invn.selected) {
				const weps = shoplist.filter(wep => wep.weapon === invn.selected[invwep] && wep.price > 2000);
				if(weps.length > 0) {
					const deletewep = weps[0]
					invn.selected[invn.selected.indexOf(deletewep.weapon)] = 'pistol';
					invn.inv.splice(invn.inv.indexOf(deletewep.weapon), 1);
					this.store.set(player.id, invn);
					this.omegga.whisper(player.name, clr.red + "<b>You have lost your " + deletewep.weapon + ".</>");
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
		clearInterval(CountDownInterval);
	}
}
module.exports = Base_wars;
