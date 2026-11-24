# Playing Global Strike with Friends

This guide shows you how to deploy a free signaling server so you can play CS 1.6 in the browser with your friends.

## Quick Start (5 minutes)

### Option 1: Deploy to Render.com (Free, Easiest)

1. **Fork/Clone this repo** to your GitHub account
2. Go to [render.com](https://render.com) and sign up (free)
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repo
5. Configure:
   - **Name**: `cs16-signaling` (or whatever you like)
   - **Runtime**: `Docker`
   - Render auto-detects the `Dockerfile` at repo root
   - **Plan**: `Free`
6. Click **"Create Web Service"**
7. Wait for deploy (2-3 minutes)
8. Copy your URL: `https://cs16-signaling.onrender.com`

### Option 2: Deploy to Railway (Free Tier)

1. Go to [railway.app](https://railway.app) and sign up
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your forked repo
4. Railway auto-detects Node.js
5. Wait for deploy
6. Copy your URL: `https://your-app.up.railway.app`

### Option 3: Deploy to Fly.io (Free Allowance)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login and launch
fly auth login
fly launch --name cs16-signaling --region iad --no-deploy
fly deploy
```

## Configure Your Server

Once deployed, update `servers.json` with your signaling URL:

```json
{
  "id": "my-server",
  "name": "My Private Server",
  "map": "de_dust2",
  "slots": 16,
  "region": "Your Region",
  "tags": ["Private", "Friends only"],
  "signal": "wss://YOUR-APP.onrender.com/ws/your-room-name",
  "probe": "https://YOUR-APP.onrender.com/health",
  "status": "https://YOUR-APP.onrender.com/health"
}
```

**Important**: Use `wss://` (secure WebSocket) for the signal URL, and pick a unique room name (e.g., `ws/johns-server`).

## Play with Friends

1. **Host**: Open the game, select your custom server, enter name, click **Play**
2. **Share**: Send friends the game URL + tell them to select your custom server
3. **Join**: Friends select the same server, enter names, click **Play**
4. **Play**: You're now in the same match!

## Local Development

```bash
cd signaling-server
npm install
npm start
# Server runs at ws://localhost:3000/ws/your-room
```

Or with Docker:
```bash
cd signaling-server
docker-compose up
```

## How It Works

- **WebRTC**: Direct peer-to-peer connections between browsers (low latency)
- **Signaling Server**: Only handles initial connection setup (exchange offers/answers/ICE candidates)
- **No Game Traffic**: The signaling server doesn't relay game data - it's pure P2P after connection

## Free Tier Limits

| Platform | Free Tier | Notes |
|----------|-----------|-------|
| Render | 750 hrs/mo | Spins down after 15 min inactivity |
| Railway | $5 credit/mo | ~500 hrs, no spin-down |
| Fly.io | 3 shared VMs | 160GB-mo free allowance |

## Troubleshooting

**Can't connect?**
- Check browser console for errors
- Ensure you're using `wss://` (not `ws://`) on HTTPS pages
- Verify the `/health` endpoint returns 200 OK

**High latency?**
- Choose a region close to all players
- WebRTC uses STUN/TURN for NAT traversal (built-in)

**Friends can't see each other?**
- Make sure everyone uses the **exact same room name** in the signal URL
- Room name is the last part: `/ws/THIS-IS-ROOM-NAME`

## Customizing

Edit `signaling-server/server.js` to add:
- Password protection
- Max players per room
- Admin commands
- Map voting

## Security Notes

- The free signaling server is public - anyone with the URL can join
- For private games, use a unique room name (like a password)
- Consider adding authentication for production use