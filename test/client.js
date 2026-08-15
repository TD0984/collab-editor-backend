import WebSocket from 'ws';

const docId = process.argv[2] || 'default';
const ws = new WebSocket('ws://localhost:8080');

let version = 0;
let lamportClock = 0;

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'join', docId }));
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'init') {
    version = msg.version;
    console.log(`[init] version=${version} content="${msg.content}"`);
  } else if (msg.type === 'op') {
    version = msg.version;
    console.log(`[op from ${msg.from}] version=${version}`, msg.op);
  } else if (msg.type === 'error') {
    console.error('[error]', msg.message);
  }
});

setTimeout(() => {
  lamportClock += 1;
  ws.send(JSON.stringify({
    type: 'op',
    op: { type: 'insert', pos: 0, text: 'hello ', baseVersion: version, lamportClock },
  }));
}, 3000);