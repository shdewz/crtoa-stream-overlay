let socket = new ReconnectingWebSocket('ws://' + location.host + '/ws');

socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const placeholder = params.get('placeholder');
const fontSize = params.get('fontSize');
const color = params.get('color');
const radius = params.get('radius');
const bgFlash = params.get('flashBackground');
const debug = params.get('debug');
const align = params.get('align');

console.log(params);

let team_data;
let nameTemp = placeholder || '';
let combo = 0;
let comboThreshold = 10;
let nameText = document.getElementById('name');
let nameStroke = document.getElementById('name-stroke');
let background = document.getElementById('full-overlay');

(async () => {
	team_data = await $.getJSON('../_data/teams.json');

	if (fontSize) {
		nameText.style.fontSize = `${fontSize}px`
		nameStroke.style.fontSize = `${fontSize}px`
	}

	if (debug == 'true') {
		background.style.backgroundColor = `rgba(255, 87, 87, 1)`;
	}

	if (color) {
		nameText.style.color = color == 'red' ? 'var(--red)' : 'var(--blue)';
	}

	if (align == 'left') {
		nameText.style.right = 'unset';
		nameText.style.left = '18px';
		nameStroke.style.right = 'unset';
		nameStroke.style.left = '18px';
	}
})();

const cache = {};

socket.onmessage = async event => {
	let data = JSON.parse(event.data);
	let client = data.tourney.ipcClients[id];

	if (team_data && data.tourney.manager.teamName.left && cache.nameRed !== data.tourney.manager.teamName.left) {
		cache.nameRed = data.tourney.manager.teamName.left;
		document.querySelector(':root').style.setProperty('--red', team_data.find(t => t.name == cache.nameRed).color);
	}

	if (team_data && data.tourney.manager.teamName.right && cache.nameBlue !== data.tourney.manager.teamName.right) {
		cache.nameBlue = data.tourney.manager.teamName.right;
		document.querySelector(':root').style.setProperty('--blue', team_data.find(t => t.name == cache.nameBlue).color);
	}

	if (nameTemp !== client.spectating.name) {
		nameTemp = client.spectating.name;
		nameText.innerHTML = nameTemp == '' ? placeholder : nameTemp;
		nameStroke.innerHTML = nameTemp == '' ? placeholder : nameTemp;
	}

	if (data.tourney.manager.bools.scoreVisible && combo >= 10 && client.gameplay.combo.current < combo) {
		if (bgFlash) {
			background.style.transition = 'background-color 100ms cubic-bezier(0, 1, 0.4, 1)';
			background.style.backgroundColor = 'rgba(255, 87, 87, 0.2)';
		}

		nameText.style.transition = 'transform 100ms cubic-bezier(0, 1, 0.4, 1)';
		nameText.style.transform = 'scale(1.2)';
		nameStroke.style.transition = 'transform 100ms cubic-bezier(0, 1, 0.4, 1)';
		nameStroke.style.transform = 'scale(1.2)';

		setTimeout(() => {
			if (bgFlash) {
				background.style.transition = 'background-color 800ms cubic-bezier(0.42, 0.04, 0.49, 0.97)';
				background.style.backgroundColor = 'rgba(255, 87, 87, 0)';
			}

			nameText.style.transition = 'transform 500ms cubic-bezier(0.42, 0.04, 0.49, 0.97)';
			nameText.style.transform = 'scale(1.0)';
			nameStroke.style.transition = 'transform 500ms cubic-bezier(0.42, 0.04, 0.49, 0.97)';
			nameStroke.style.transform = 'scale(1.0)';
		}, 150);
	}
	combo = client.gameplay.combo.current;
}
