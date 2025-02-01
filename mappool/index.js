$.ajaxSetup({ cache: false });
window.addEventListener('contextmenu', (e) => e.preventDefault());

const cache = {
    MAP_COORDINATES: [],
    MAP_ROTATIONS: []
};

let team_data, stage_data, mappool_data;
(async () => {
    team_data = await $.getJSON('../_data/teams.json');
    stage_data = await $.getJSON('../_data/stages.json');
    mappool_data = await $.getJSON('../_data/beatmaps.json');

    const stage = stage_data.find(e => e.abbreviation === mappool_data.abbreviation);
    cache.MAP_COORDINATES = stage.coordinates.position;
    cache.MAP_ROTATIONS = stage.coordinates.angle;
    cache.MAP_OPEN_BOTTOM = stage.coordinates.openBottom;

    $('#main_container').css('background-image', `url('../_shared/assets/mappool/${stage.abbreviation.toLowerCase()}.png')`);

    document.querySelector(':root').style.setProperty('--track-path', `path('${stage.track}')`);
    cache.teamsLoaded = true;
    generateMaps();
})();

const CURRENT_COORDINATES = {
    red: 0,
    blue: 0,
};

let ACTIVE_MAPS = [];

const socket = new ReconnectingWebSocket('ws://' + location.host + '/websocket/v2');
// const socket = new ReconnectingWebSocket('ws://127.0.0.1:24051/'); // for debug
socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

socket.onmessage = async event => {
    const data = JSON.parse(event.data);

    if (data.tourney.team.left && cache.nameRed !== data.tourney.team.left && cache.teamsLoaded) {
        cache.nameRed = data.tourney.team.left;

        const team_obj = team_data.find(t => t.name === cache.nameRed);
        if (team_obj) {
            $('#name_red').text(team_obj.name);
            $('#icon_red').css('background-image', `url('../_shared/assets/teams/${team_obj.name}.png')`);
            document.querySelector(':root').style.setProperty('--red', team_obj.color);
        }
    }

    if (data.tourney.team.right && cache.nameBlue !== data.tourney.team.right && cache.teamsLoaded) {
        cache.nameBlue = data.tourney.team.right;

        const team_obj = team_data.find(t => t.name === cache.nameBlue);
        if (team_obj) {
            $('#name_blue').text(team_obj.name);
            $('#icon_blue').css('background-image', `url('../_shared/assets/teams/${team_obj.name}.png')`);
            document.querySelector(':root').style.setProperty('--blue', team_obj.color);
        }
    }

    if (cache.chatLen !== data.tourney.chat.length) {
        const current_chat_len = data.tourney.chat.length;
        if (cache.chatLen === 0 || (cache.chatLen > 0 && cache.chatLen > current_chat_len)) { $('#chat').html(''); cache.chatLen = 0; }

        for (let i = cache.chatLen || 0; i < current_chat_len; i++) {
            const chat = data.tourney.chat[i];
            const body = chat.message;
            if (body.toLowerCase().startsWith('!mp')) continue;

            const player = chat.name;
            if (player === 'BanchoBot' && body.startsWith('Match history')) continue;

            const team = chat.team === 'left' ? 'red' : chat.team === 'right' ? 'blue' : chat.team;

            const chatParent = $('<div></div>').addClass(`chat-message ${team}`);

            chatParent.append($('<div></div>').addClass('chat-name').text(player));
            chatParent.append($('<div></div>').addClass('chat-body').text(body));
            $('#chat').prepend(chatParent);
        }

        cache.chatLen = data.tourney.chat.length;
    }
};

const advance = (team, amount, pos) => {
    clearAllMaps();
    CURRENT_COORDINATES[team] = Math.min(cache.MAP_COORDINATES.length - 1, Math.max(0, pos || CURRENT_COORDINATES[team] + amount));
    $(`#track_team_${team}`).css('offset-distance', `${cache.MAP_COORDINATES[CURRENT_COORDINATES[team]] + 1.8}%`);
    const tempIndex = CURRENT_COORDINATES[team];

    setTimeout(() => { displayMap(tempIndex, team); }, 1000);
};

const displayMap = (index, team) => {
    const openBottom = cache.MAP_OPEN_BOTTOM.includes(index);
    if (index !== CURRENT_COORDINATES[team]) return;
    ACTIVE_MAPS.push(index);
    $(`#map-${index}`).css('animation', `${openBottom ? 'openMapBottom' : 'openMapTop'} 500ms ease-in-out forwards`);
    $(`#mapicon-${index}`).addClass('active');
};

const clearAllMaps = () => {
    for (const map of ACTIVE_MAPS) {
        const openBottom = cache.MAP_OPEN_BOTTOM.includes(map);
        $(`#map-${map}`).css('animation', `${openBottom ? 'closeMapBottom' : 'closeMapTop'} 300ms ease forwards`);
        $(`#mapicon-${map}`).removeClass('active');
    }
    ACTIVE_MAPS = [];
};

const generateMaps = async () => {
    const map_data = (await $.getJSON('../_data/beatmaps.json'))?.beatmaps;

    if (!map_data) return console.error('No beatmaps found!');

    let index = 1;
    for (const beatmap of map_data) {
        $('#track_maps').append(generateMapIcon(beatmap, index));
        $('#mappool_cards').append(generateMapCard(beatmap, index));
        index++;
    }
};

const generateMapCard = (beatmap, index) => {
    const openBottom = cache.MAP_OPEN_BOTTOM.includes(index);
    const parent = $('<div></div>').addClass(`beatmap ${openBottom ? 'bottom' : 'top'}`).css('offset-distance', `${cache.MAP_COORDINATES[index]}%`).attr('id', `map-${index}`);
    const content = $('<div></div>').addClass('beatmap-content');
    const beatmapTitle = beatmap.title.match(/(.*) \[.*\]/)[1] || 'Undefined';
    content.append($('<div></div>').addClass('beatmap-title').text(beatmapTitle).css('color', `var(--mod-color-${beatmap.mods.toLowerCase()})`));
    content.append($('<div></div>').addClass('beatmap-background').css('background-image', `url('https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/list@2x.jpg')`));
    parent.append(content);
    return parent;
};

const generateMapIcon = (beatmap, index) => {
    const parent = $('<div></div>').addClass('beatmapicon').attr('id', `mapicon-${index}`).css({
        'offset-distance': `${cache.MAP_COORDINATES[index]}%`,
        '--base-color': `var(--mod-color-${beatmap.mods.toLowerCase()})`,
        '--shadow-color': `var(--mod-shadow-${beatmap.mods.toLowerCase()})`,
        'transform': `translateY(15px) rotate(${cache.MAP_ROTATIONS[index - 1] ?? 0}deg)`
    });
    const content = $('<div></div>').addClass('beatmapicon-content').append($('<div></div>').addClass('beatmapicon-text').text(`${beatmap.identifier}`));
    parent.append(content);

    const banLabel = $('<div></div>').addClass('beatmap-banned hidden').text('BANNED').attr('id', `ban-${index}`);
    banLabel.css('transform', `rotate(${20 - Math.floor(Math.random() * 40)}deg)`);
    parent.append(banLabel);

    const winLabel = $('<div></div>').addClass('beatmap-win hidden').text('WIN').attr('id', `win-${index}`);
    winLabel.css('transform', `rotate(${20 - Math.floor(Math.random() * 40)}deg)`);
    parent.append(winLabel);

    parent.on('click', event => {
        if (!event.originalEvent.shiftKey) event.originalEvent.ctrlKey ? banMap(index, 'red') : pickMap(index, 'red');
        else resetMap(index);
    });
    parent.on('contextmenu', event => {
        if (!event.originalEvent.shiftKey) event.originalEvent.ctrlKey ? banMap(index, 'blue') : pickMap(index, 'blue');
        else resetMap(index);
    });
    return parent;
};

const banMap = (index, team) => {
    $(`#ban-${index}`).removeClass('red blue hidden').addClass(team);
};

const pickMap = (index, team) => {
    $(`#win-${index}`).removeClass('red blue hidden').addClass(team);
};

const resetMap = (index) => {
    $(`#win-${index}`).removeClass('red blue').addClass('hidden');
    $(`#ban-${index}`).removeClass('red blue').addClass('hidden');
};
