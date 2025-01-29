# crtoa-stream-overlay

Tosu-based osu! tournament livestream overlay for [CookieRhyme: Tour of Awesomeness](https://osu.ppy.sh/community/forums/topics/2017591?n=1).

## Requirements

- [tosu](https://github.com/tosuapp/tosu) >=4.2.0

## Help

### Setup for `names`

URL format:

```url
http://127.0.0.1:24050/crtoa-stream-overlay/names/?id=0&color=red&fontSize=36&placeholder=Waiting%20for%20P1...&flashBackground=true&align=left&debug=false
```

where:

- `id`: the number of the osu! client (starting from `0`)
- `color`: team (`red`/`blue`)
- `fontSize`: font size in px
- `placeholder`: text to display when no player connected on this client
- `flashBackground`: enable red flash on miss (`true`/`false`)
- `align`: align text to `left` or `right` side of the window
- `debug`: fill background with red to help with manual alignment (`true`/`false`)

### Setup for `scores`

URL format:

```url
http://127.0.0.1:24050/crtoa-stream-overlay/scores/?id=3&fontSize=24&debug=false
```

where:

- `id`: the number of the osu! client (starting from `0`)
- `fontSize`: font size in px
- `debug`: fill background with red to help with manual alignment

Alignment is automatic based on `id`.

### `_data` folder structure

- `beatmaps.json`: mappool of the current stage
- `raids.json`: raid bonuses for each team
- `stages.json`: stage information
- `teams.json`: team information

`raids.json` should be updated before each match to account for new bonuses. `beatmaps.json` and `stages.json` are updated weekly for each new stage.
