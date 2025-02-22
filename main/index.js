const cache = {
	players_in_lobby: [],
	last_result_update: 0
};

let stage_data, team_data, raid_data, mappool_data, settings;
let stage;
(async () => {
	$.ajaxSetup({ cache: false });
	team_data = await $.getJSON('../_data/teams.json');
	raid_data = await $.getJSON('../_data/raids.json');
	stage_data = await $.getJSON('../_data/stages.json');
	mappool_data = await $.getJSON('../_data/beatmaps.json');

	const stage_name = mappool_data?.abbreviation || 'RO32';
	stage = stage_data.find(e => e.abbreviation === stage_name);

	setup_params(stage);
	cache.ready_for_setup = true;
})();

const animation = {
	p1_score: new CountUp('p1_score', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.' }),
	p2_score: new CountUp('p2_score', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.' }),
	p3_score: new CountUp('p3_score', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.' }),
	p4_score: new CountUp('p4_score', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.' }),
	red_score: new CountUp('red_score', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.' }),
	blue_score: new CountUp('blue_score', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.' }),
}

const socket = new ReconnectingWebSocket('ws://' + location.host + '/websocket/v2');
// const socket = new ReconnectingWebSocket('ws://127.0.0.1:24051/'); // for debug

socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

const players = {
	red: [],
	blue: []
};

const BONUSES = {
	red: {
		raid: 1,
		tagRemaining: 0,
		shield: false
	},
	blue: {
		raid: 1,
		tagRemaining: 0,
		shield: false
	}
};

const HEALTH = {
	red: 0,
	blue: 0
};

const PLAYER_COUNT = 4;
let MAX_HEALTH = 2000000;

const setup_params = (stage) => {
	MAX_HEALTH = stage.health;
};

socket.onmessage = async event => {
	const data = JSON.parse(event.data);
	const now = new Date();

	if (cache.state !== data.tourney.ipcState) {
		if (!cache.state) cache.state = data.tourney.ipcState;
		else {
			cache.state = data.tourney.ipcState;

			if (cache.state === 4) { // results screen
				setTimeout(() => { cache.update_results = true }, 2000);
			}
		}
	}

	if (cache.update_results) {
		cache.update_results = false;
		cache.last_result_update = now;
		console.log('updating results...');
		const scoreDiff = Math.abs(cache.scoreRed - cache.scoreBlue);
		const losing_team = cache.scoreRed > cache.scoreBlue ? 'blue' : 'red';
		let multiplier = 1;

		const bonuses_before = JSON.parse(JSON.stringify(BONUSES));
		if (BONUSES[losing_team].shield) {
			multiplier = 0.7;
			toggle_shield(losing_team, false);
		}
		const damage = scoreDiff * multiplier;

		console.log({
			red_score: cache.scoreRed,
			blue_score: cache.scoreBlue,
			damage,
			hp_before: HEALTH[losing_team],
			bonuses: bonuses_before
		});

		set_health(losing_team, Math.max(0, HEALTH[losing_team] - damage));

		BONUSES.red.tagRemaining = Math.max(0, BONUSES.red.tagRemaining - 1);
		BONUSES.blue.tagRemaining = Math.max(0, BONUSES.blue.tagRemaining - 1);
		localStorage.setItem('red-tag', BONUSES.red.tagRemaining);
		localStorage.setItem('blue-tag', BONUSES.blue.tagRemaining);

		for (let i = 0; i < PLAYER_COUNT; i++) {
			const client = data.tourney.clients[i];
			const team = i < PLAYER_COUNT / 2 ? 'red' : 'blue';
			const player = players[team].find(p => p.id === client.user.id);

			if (player?.role === 'tagger') {
				BONUSES[team].tagRemaining = 2;
				localStorage.setItem(`${team}-tag`, 2);
			}
		}
		update_bonuses();
	}

	if (cache.scoreVisible !== data.tourney.scoreVisible) {
		cache.scoreVisible = data.tourney.scoreVisible;
	}

	if (data.tourney.team.left && cache.nameRed !== data.tourney.team.left && cache.ready_for_setup) {
		cache.nameRed = data.tourney.team.left;
		create_team('red', cache.nameRed);
		get_health('red');
		update_bonuses(true);
	}

	if (data.tourney.team.right && cache.nameBlue !== data.tourney.team.right && cache.ready_for_setup) {
		cache.nameBlue = data.tourney.team.right;
		create_team('blue', cache.nameBlue);
		get_health('blue');
		update_bonuses(true);
		cache.players_ready = true;
	}

	if (cache.bestOf !== data.tourney.bestOF) {
		const newmax = Math.ceil(data.tourney.bestOF / 2);
		if (cache.bestOf === undefined) {
			for (let i = 1; i <= newmax; i++) {
				$('#points_red').append($('<div></div>').attr('id', `red${i}`).addClass('team-point inactive'));
				$('#points_blue').append($('<div></div>').attr('id', `blue${i}`).addClass('team-point inactive'));
			}
		}
		else if (cache.bestOf < data.tourney.bestOF) {
			for (let i = cache.firstTo + 1; i <= newmax; i++) {
				$('#points_red').append($('<div></div>').attr('id', `red${i}`).addClass('team-point inactive'));
				$('#points_blue').append($('<div></div>').attr('id', `blue${i}`).addClass('team-point inactive'));
			}
		}
		else {
			for (let i = cache.firstTo; i > newmax; i--) {
				$(`#red${i}`).remove();
				$(`#blue${i}`).remove();
			}
		}
		cache.bestOf = data.tourney.bestOF;
		cache.firstTo = newmax;
	}

	if (cache.starsRed !== data.tourney.points.left) {
		cache.starsRed = data.tourney.points.left;
		for (let i = 1; i <= cache.starsRed; i++) { $(`#red${i}`).removeClass('inactive'); }
		for (let i = cache.starsRed + 1; i <= cache.firstTo; i++) { $(`#red${i}`).addClass('inactive'); }
	}

	if (cache.starsBlue !== data.tourney.points.right) {
		cache.starsBlue = data.tourney.points.right;
		for (let i = 1; i <= cache.starsBlue; i++) { $(`#blue${i}`).removeClass('inactive'); }
		for (let i = cache.starsBlue + 1; i <= cache.firstTo; i++) { $(`#blue${i}`).addClass('inactive'); }
	}

	if (cache.image !== data.directPath.beatmapBackground) {
		cache.image = data.directPath.beatmapBackground;
		const fixed_image = cache.image.replace(/#/g, '%23').replace(/%/g, '%25').replace(/\\/g, '/').replace(/'/g, `\\'`);
		$('#map_image').css('background-image', `url('http://${location.host}/Songs/${fixed_image}')`);
	}

	const players_in_lobby = data.tourney.clients.map(c => c.user.id);
	if (cache.players_in_lobby.length === 0 || JSON.stringify(cache.players_in_lobby) !== JSON.stringify(players_in_lobby)) {
		cache.players_in_lobby = players_in_lobby;
		$('.player-icon').removeClass('active');

		// timeout because otherwise the line above will overwrite all of them
		setTimeout(() => {
			for (const player of players_in_lobby) {
				$(`#picon_${player}`).addClass('active');
			}
		}, 500);
	}

	if (cache.md5 !== data.beatmap.checksum || (mappool_data && !cache.first_update)) {
		cache.md5 = data.beatmap.checksum;
		cache.first_update = true;
		setTimeout(() => { cache.update_stats = true }, 250);
	}

	if (cache.update_stats) {
		cache.update_stats = false;
		cache.mapid = data.beatmap.id;
		cache.map = mappool_data ? mappool_data?.beatmaps.find(m => m.beatmap_id === cache.mapid || m.md5 === cache.md5) ?? { id: cache.mapid, mods: 'NM', identifier: null } : { id: null, mods: 'NM', identifier: null };
		const mods = cache.map?.mods ?? 'NM';
		const stats = getModStats(data.beatmap.stats.cs.original, data.beatmap.stats.ar.original, data.beatmap.stats.od.original, data.beatmap.stats.bpm.common, mods);
		const len_ = data.beatmap.time.lastObject - data.beatmap.time.firstObject;

		$('#cs').text(stats.cs);
		$('#ar').text(stats.ar);
		$('#od').text(stats.od);
		$('#bpm').text(cache.map?.bpm ?? stats.bpm);
		$('#len').text(`${Math.trunc((len_ / stats.speed) / 1000 / 60)}:${Math.trunc((len_ / stats.speed) / 1000 % 60).toString().padStart(2, '0')}`);
		$('#sr').html(`${cache.map?.sr ?? data.beatmap.stats.stars.total}`);

		$('#title').text(`${data.beatmap.title} [${data.beatmap.version}]`);
		$('#artist').text(data.beatmap.artist);
		$('#mapper').text(data.beatmap.mapper);

		$('#map_slot').text(cache.map.identifier || '?');
	}

	if (cache.fullTime !== data.beatmap.time.lastObject) cache.fullTime = data.beatmap.time.lastObject;
	if (cache.seek !== data.beatmap.time.live && cache.fullTime && now - (cache.last_progress_update || 0) > 300) {
		cache.last_progress_update = now;
		cache.seek = data.beatmap.time.live;
		const width = cache.seek / cache.fullTime;
		if (cache.state === 3 && cache.scoreRed !== 0 && cache.scoreBlue !== 0) $('#progress_fill').css('width', `${width * 100}%`);
	}

	if (cache.scoreVisible && now - (cache.last_result_update || 0) > (20 * 1000)) {
		cache.lastScoreUpdate = now;

		const scores = [];
		for (let i = 0; i < PLAYER_COUNT; i++) {
			const client = data.tourney.clients[i];
			const team = i < 2 ? 'red' : 'blue';
			const player = players[team].find(p => p.id === client.user.id);
			let multiplier = 1;

			// apply shield if missing
			if (player?.role === 'support' && !BONUSES[team].shield && cache.state === 3) {
				toggle_shield(team, true);
				update_bonuses();
			}

			// score bonuses
			if (player?.role === 'fighter') multiplier += 0.25;
			if (player?.role !== 'support' && BONUSES[team].shield) multiplier += 0.05;

			const score = client.play.score * multiplier;
			scores.push({ id: i, score });
			animation[`p${i + 1}_score`].update(score);
		}

		const tb = cache.map.identifier === 'TB';
		const redTag = BONUSES.red.tagRemaining > 0 ? (tb ? 1.1 : 1.2) : 1
		const blueTag = BONUSES.blue.tagRemaining > 0 ? (tb ? 1.1 : 1.2) : 1

		cache.scoreRed = scores.filter(s => [0, 1].includes(s.id)).map(s => s.score).reduce((a, b) => a + b) * BONUSES.red.raid * redTag;
		cache.scoreBlue = scores.filter(s => [2, 3].includes(s.id)).map(s => s.score).reduce((a, b) => a + b) * BONUSES.blue.raid * blueTag;

		animation.red_score.update(cache.scoreRed);
		animation.blue_score.update(cache.scoreBlue);

		if (cache.scoreRed > cache.scoreBlue) {
			$('#red_score').addClass('winning');
			$('#blue_score').removeClass('winning');
		}
		else if (cache.scoreBlue > cache.scoreRed) {
			$('#red_score').removeClass('winning');
			$('#blue_score').addClass('winning');
		}
		else {
			$('#red_score').removeClass('winning');
			$('#blue_score').removeClass('winning');
		}
	}

	if (cache.chatLen !== data.tourney.chat.length && cache.players_ready) {
		const current_chat_len = data.tourney.chat.length;
		if (cache.chatLen === 0 || (cache.chatLen > 0 && cache.chatLen > current_chat_len)) { $('#chat').html(''); cache.chatLen = 0; }

		// console.log(data.tourney.chat);

		for (let i = cache.chatLen || 0; i < current_chat_len; i++) {
			const chat = data.tourney.chat[i];
			const body = chat.message;
			if (body.toLowerCase().startsWith('!mp')) continue;

			const player = chat.name;
			if (player === 'BanchoBot' && body.startsWith('Match history')) continue;

			const real_team = players.red.map(e => e.username).includes(chat.name) ? 'red' : players.blue.map(e => e.username).includes(chat.name) ? 'blue' : 'unknown';
			const team = real_team === 'unknown' ? (chat.team === 'left' ? 'red' : chat.team === 'right' ? 'blue' : chat.team) : real_team;

			const chatParent = $('<div></div>').addClass(`chat-message ${team}`);

			chatParent.append($('<div></div>').addClass('chat-name').text(player));
			chatParent.append($('<div></div>').addClass('chat-body').text(body));
			$('#chat').prepend(chatParent);
		}

		cache.chatLen = data.tourney.chat.length;
	}
}

const get_health = (team) => {
	const hp = localStorage.getItem(`${team}-health`);
	if (hp) HEALTH[team] = Number(hp);
	else {
		HEALTH[team] = MAX_HEALTH;
		localStorage.setItem(`${team}-health`, MAX_HEALTH);
	}
	set_health(team, HEALTH[team]);
};

const set_health = (team, health) => {
	HEALTH[team] = health;
	$(`#health_text_stroke_${team}`).text(Math.round(health).toLocaleString());
	$(`#health_text_base_${team}`).text(Math.round(health).toLocaleString());
	$(`#health_progress_${team}`).css('width', `${(health / MAX_HEALTH) * 100}%`);
	localStorage.setItem(`${team}-health`, health);
};

const manualHealth = (team) => {
	const value = $(`#hp_input_${team}`).val() || 0;
	set_health(team, value);
};

const resetHealth = () => {
	localStorage.setItem('red-health', MAX_HEALTH);
	localStorage.setItem('blue-health', MAX_HEALTH);
	get_health('red');
	get_health('blue');
};

const toggleTag = team => {
	const current = BONUSES[team].tagRemaining;
	if (current === 0) BONUSES[team].tagRemaining = 2;
	else BONUSES[team].tagRemaining = current - 1;
	update_bonuses();
};

const getModStats = (cs_raw, ar_raw, od_raw, bpm_raw, mods) => {
	mods = mods.replace('NC', 'DT');

	let speed = mods.includes('DT') ? 1.5 : mods.includes('HT') ? 0.75 : 1;
	let ar = mods.includes('HR') ? ar_raw * 1.4 : mods.includes('EZ') ? ar_raw * 0.5 : ar_raw;

	let ar_ms = Math.max(Math.min(ar <= 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5), 1800), 450) / speed;
	ar = ar < 5 ? (1800 - ar_ms) / 120 : 5 + (1200 - ar_ms) / 150;

	let cs = Math.round(Math.min(mods.includes('HR') ? cs_raw * 1.3 : mods.includes('EZ') ? cs_raw * 0.5 : cs_raw, 10) * 10) / 10;

	let od = mods.includes('HR') ? od_raw * 1.4 : mods.includes('EZ') ? od_raw * 0.5 : od_raw;
	od = Math.round(Math.min((79.5 - Math.min(79.5, Math.max(19.5, 79.5 - Math.ceil(6 * od))) / speed) / 6, 11) * 10) / 10;

	return {
		cs: Math.round(cs * 10) / 10,
		ar: Math.round(ar * 10) / 10,
		od: Math.round(od * 10) / 10,
		bpm: Math.round(bpm_raw * speed * 10) / 10,
		speed
	}
};

const create_element = classes => $('<div></div>').addClass(classes);

const create_player = (player, team) => {
	const parent = create_element('player');

	// parent.append(create_element(`player-icon ${team}`).css('background-image', `url('../_shared/assets/players/cookie_${player.username.toLowerCase()}.png')`));
	parent.append(create_element(`player-icon ${team}`).attr('id', `picon_${player.user_id}`).css('background-image', `url('../_shared/assets/players/${player.user_id}.png')`));
	const stats = create_element('player-stats');
	stats.append(create_element('player-name').text(player.username));
	const tags = create_element('player-tags').attr('id', `${player.user_id}_tags`);
	const rarity_tag = create_element(`player-tag rarity ${get_rarity(player.rarity).toLowerCase().replace(/ /, '-')}`);
	rarity_tag.append(create_element('tag-text rarity double-text').append(create_element('text-stroke').text(get_rarity(player.rarity))).append(create_element('text-base').text(get_rarity(player.rarity))));
	tags.append(rarity_tag);
	tags.append(create_element('player-tag').append(create_element(`tag-icon icon-${player.role}`)).append(create_element('tag-text').text(player.role.toUpperCase())));
	tags.append(create_element(`player-tag tag-shield hidden shield-${team}`).append(create_element('tag-icon icon-shield')));
	if (player.role === 'tagger') tags.append(create_element('player-tag active hidden').attr('id', `${team}_tagger`).append(create_element('tag-text').text('TAGGED!')));
	stats.append(tags);
	parent.append(stats);

	return parent;
};

const create_team = (team, name) => {
	const parent = $(`#${team}_players`);
	parent.html('');

	const team_obj = team_data.find(t => t.name === name);
	if (team_obj) {
		$(`#icon_${team}`).css('background-image', `url('../_shared/assets/teams/${name}.png')`)

		$(`#name_${team}`).text(team_obj.name);
		localStorage.setItem(`${team}_team`, team_obj.name);

		for (const player of team_obj.players) {
			parent.append(create_player(player, team));
		}

		const raid = raid_data.find(r => r.team === team_obj.name);
		if (raid) BONUSES[team].raid = raid.raid_bonus;

		document.querySelector(':root').style.setProperty(`--${team}`, team_obj.color);

		const raid_percent = (BONUSES[team].raid - 1) * 100;
		$(`#raid_${team}`).text(`+${Math.round(raid_percent * 10) / 10}%`);

		players[team] = team_obj.players.map(p => ({ id: p.user_id, username: p.username, role: p.role }));
	}
};

const update_bonuses = (initial = false) => {
	if (initial) {
		BONUSES.red.tagRemaining = localStorage.getItem('red-tag');
		BONUSES.blue.tagRemaining = localStorage.getItem('blue-tag');
		BONUSES.red.shield = localStorage.getItem('red-shield') === 'true';
		BONUSES.blue.shield = localStorage.getItem('blue-shield') === 'true';
	}

	if (BONUSES.red.tagRemaining > 0) {
		$('#tag_red').addClass('active');
		$('#red_tagger').removeClass('left1 left2 hidden').addClass(`left${BONUSES.red.tagRemaining}`);
	}
	else {
		$('#tag_red').removeClass('active');
		$('#red_tagger').removeClass('left1 left2').addClass('hidden');
	}

	if (BONUSES.blue.tagRemaining > 0) {
		$('#tag_blue').addClass('active');
		$('#blue_tagger').removeClass('left1 left2 hidden').addClass(`left${BONUSES.blue.tagRemaining}`);
	}
	else {
		$('#tag_blue').removeClass('active');
		$('#blue_tagger').removeClass('left1 left2').addClass('hidden');
	}

	if (BONUSES.red.shield) $('.shield-red').removeClass('hidden');
	else $('.shield-red').addClass('hidden');

	if (BONUSES.blue.shield) $('.shield-blue').removeClass('hidden');
	else $('.shield-blue').addClass('hidden');

	$('#red_tag_button').text(BONUSES.red.tagRemaining);
	$('#blue_tag_button').text(BONUSES.blue.tagRemaining);
};

const reset_bonuses = () => {
	localStorage.setItem('red-tag', 0);
	localStorage.setItem('blue-tag', 0);
	localStorage.setItem('red-shield', false);
	localStorage.setItem('blue-shield', false);
	update_bonuses(true);
}

const toggle_shield = (team, state) => {
	const shields = $(`.shield-${team}`);
	if (state) {
		BONUSES[team].shield = true;
		localStorage.setItem(`${team}-shield`, true);
		shields.addClass('hidden');
	}
	else {
		BONUSES[team].shield = false;
		localStorage.setItem(`${team}-shield`, false);
		shields.removeClass('hidden');
	}
};

const toggleChat = () => {
	if ($('#chat_container').hasClass('hidden')) $('#chat_container').removeClass('hidden');
	else $('#chat_container').addClass('hidden');
};
