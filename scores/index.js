let socket = new ReconnectingWebSocket('ws://' + location.host + '/ws');

socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const fontSize = params.get('fontSize') || '24';
const debug = params.get('debug');
const align = params.get('align');

let team_data;
let background = document.getElementById('full-overlay');

const animation = {
	accBase: new CountUp('accBase', 100, 0, 2, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: '%' }),
	accStroke: new CountUp('accStroke', 100, 0, 2, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: '%' }),
	comboBase: new CountUp('comboBase', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: 'x' }),
	comboStroke: new CountUp('comboStroke', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: 'x' }),
	scoreBase: new CountUp('scoreBase', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.' }),
	scoreStroke: new CountUp('scoreStroke', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.' }),
};

(async () => {
	team_data = await $.getJSON('../_data/teams.json');

	if (fontSize) {
		document.getElementById('accBase').style.fontSize = `${fontSize}px`;
		document.getElementById('accStroke').style.fontSize = `${fontSize}px`;

		document.getElementById('comboBase').style.fontSize = `${Math.floor(fontSize * 0.875)}px`;
		document.getElementById('comboStroke').style.fontSize = `${Math.floor(fontSize * 0.875)}px`;

		document.getElementById('scoreBase').style.fontSize = `${fontSize}px`;
		document.getElementById('scoreStroke').style.fontSize = `${fontSize}px`;
	}

	if (debug == 'true') {
		background.style.backgroundColor = `rgba(255, 87, 87, 1)`;
	}

	if (id == 0) {
		$('#full-overlay').addClass('right');
		$('.score-group').addClass('right');
	}

	if (id == 2) {
		$('#full-overlay').addClass('right reverse');
		$('.score-group').addClass('right reverse');
	}

	if (id == 3) {
		$('#full-overlay').addClass('reverse');
		$('.score-group').addClass('reverse');
	}
})();

const cache = {};

socket.onmessage = async event => {
	let data = JSON.parse(event.data);
	let client = data.tourney.ipcClients[id];

	// if (cache.scoreVisible !== data.tourney.manager.bools.scoreVisible) {
	// 	cache.scoreVisible = data.tourney.manager.bools.scoreVisible;
	// 	if (cache.scoreVisible) $('#full-overlay').removeClass('hidden');
	// 	else $('#full-overlay').addClass('hidden');
	// }

	if (cache.score !== client.gameplay.score) {
		cache.score = client.gameplay.score;
		animation.scoreBase.update(cache.score);
		animation.scoreStroke.update(cache.score);
	}

	if (cache.accuracy !== client.gameplay.accuracy) {
		cache.accuracy = client.gameplay.accuracy;
		animation.accBase.update(cache.accuracy);
		animation.accStroke.update(cache.accuracy);
	}

	if (cache.combo !== client.gameplay.combo.current) {
		cache.combo = client.gameplay.combo.current;
		animation.comboBase.update(cache.combo);
		animation.comboStroke.update(cache.combo);
	}
}
