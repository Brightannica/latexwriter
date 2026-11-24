const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws/test-room');
ws.on('open', () => { console.log('Connected!'); ws.close(); process.exit(0); });
ws.on('error', (e) => { console.log('Error:', e.message); process.exit(1); });
ws.on('close', (code, reason) => { console.log('Close:', code, reason.toString()); });
setTimeout(() => { console.log('Timeout'); process.exit(1); }, 5000);