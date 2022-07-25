module.exports = {
	async turrethandler(omegga, online, machinesbrs,store,clr) {
		this.omegga = omegga;
		this.store = store;
		//less lag = better so i am resorting to doing it this way
		async function turretdamageplayer(player, damage) {
			player.damage(damage);
		}
		const turrets = machinesbrs.filter(smcn => smcn.components.BCD_Interact.ConsoleTag.indexOf('Str') !== -1)
		for(var pl in online) {
			let usedgenerators = [];
			const player = await this.omegga.getPlayer(online[pl]);
			const ppos = await player.getPosition();
			const inrange = [];
			let prevdist = 100000;
			for(var turt in turrets) {
				const smcn = turrets[turt];
				const data = smcn.components.BCD_Interact.ConsoleTag.split(' ');
				const townr = data.splice(7,data.length - 7).join(' ');
				const dist = Math.sqrt(
				(ppos[0] - smcn.position[0]) * (ppos[0] - smcn.position[0]) +
				(ppos[1] - smcn.position[1]) * (ppos[1] - smcn.position[1]) +
				(ppos[2] - smcn.position[2]) * (ppos[2] - smcn.position[2])
				);
				if(dist < Number(data[5]) * 10 && dist < prevdist&& townr != online[pl]) {
					//inrange[0] = smcn;
					//prevdist = dist;
					inrange.push(smcn);
				}
				
			}
			const isdead = await player.isDead();
			if(inrange.length > 0 && !isdead) {
				for(var ir in inrange) {
					const data = inrange[ir].components.BCD_Interact.ConsoleTag.split(' ');
					const townr = data.splice(7,data.length - 7).join(' ');
					const inrp = inrange[ir].position;
					const generators = machinesbrs.filter(gmcn => gmcn.components.BCD_Interact.ConsoleTag.split(' ')[0] === 'Gen' && Math.sqrt(
					(inrp[0] - gmcn.position[0]) * (inrp[0] - gmcn.position[0]) +
					(inrp[1] - gmcn.position[1]) * (inrp[1] - gmcn.position[1]) +
					(inrp[2] - gmcn.position[2]) * (inrp[2] - gmcn.position[2])
					) < 500 && !usedgenerators.includes(gmcn.position));
					let energy = 0;
					const trust = await this.store.get("Trusted");
					let notdamage = false;
					for(var gen=0;gen<generators.length;gen++) {
						const gdata = generators[gen].components.BCD_Interact.ConsoleTag.split(' ');
						const gpname = gdata.splice(5,data.length - 5).join(' ');
						if(townr === gpname && energy < Number(data[6])) {
							energy += Number(gdata[4]);
							usedgenerators.push(generators[gen].position);
						}
						if(energy >= Number(data[6])) {
							gen = generators.length;
						}
					}
					if(energy >= Number(data[6])) {
						const damage = Number(data[4]);
						const bps = Number(data[2]);
						for(var trs in trust) {
							const trusted = trust[trs];
							if(trusted.player === townr && trusted.trusts === online[pl]) {
								notdamage = true;
							}
						}
						const disttopl = Math.sqrt(
						(ppos[0] - inrp[0]) * (ppos[0] - inrp[0]) +
						(ppos[1] - inrp[1]) * (ppos[1] - inrp[1]) +
						(ppos[2] - inrp[2]) * (ppos[2] - inrp[2])
						);
						if(!notdamage) {
							//if(canshoot) {
								const interval = setInterval(() => turretdamageplayer(player,damage), Math.floor(1000 / bps));
								this.omegga.middlePrint(player.name, clr.red + "<b>You are being shot by a turret!</>");
								setTimeout(() => clearInterval(interval), 1999);
							//}
						}
					}
				}
			}
		}
	}
	
}