#!/bin/bash
cd /workspace/app/signaling-server
node server.js > server.log 2>&1 &
sleep 2
node test-ws.js