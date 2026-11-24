# global strike

cs 1.6 in the browser with servers. made for ubg people

i only did this because proxying any good cs 1.6 multiplayer site is slow and takes forever to download the data

## ai disclaimer

yes this was made with ai. i dont care that it was because i did it in a rush to play any multiplayer shooter at school

## play with friends

Want to play with your friends on a private server? Deploy a free signaling server in 5 minutes:

👉 **[PLAY_WITH_FRIENDS.md](PLAY_WITH_FRIENDS.md)**

### Quick Summary

1. Deploy `signaling-server/` to **Render.com**, **Railway**, or **Fly.io** (all free)
2. Copy your `wss://` URL
3. Add it to `servers.json` as a custom server
4. Share the game link with friends - you all select the same custom server

The game uses **WebRTC P2P** - after initial connection, traffic goes directly between browsers (low latency, no server relay).

## project structure

- `index.html` - Main launcher (loads from `assets/`)
- `sf-gs.html` - Single-file version with embedded WASM
- `servers.json` - Server list (edit to add custom servers)
- `signaling-server/` - WebRTC signaling server for custom deployments
- `assets/` - Game WASM, JS, CSS bundles