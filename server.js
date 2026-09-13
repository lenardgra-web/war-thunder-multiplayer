const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();

// Prosty endpoint HTTP, aby Render wiedział, że aplikacja żyje
app.get('/', (req, res) => {
    res.send('Serwer gry działa poprawnie!');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

function getPublicRoomsList() {
    const list = [];
    Object.keys(rooms).forEach(roomId => {
        const r = rooms[roomId];
        list.push({
            id: roomId,
            name: r.roomName,
            count: r.players.size,
            max: r.maxPlayers
        });
    });
    return list;
}

function broadcastRoomsList() {
    const data = JSON.stringify({ type: 'roomList', rooms: getPublicRoomsList() });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

wss.on('connection', (ws) => {
    let currentRoom = null;
    let clientId = 'usr_' + Math.random().toString(36).substr(2, 7);

    ws.send(JSON.stringify({ type: 'roomList', rooms: getPublicRoomsList() }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'createRoom') {
                const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
                const roomName = data.roomName || `Pokój ${clientId}`;
                
                rooms[roomId] = {
                    host: ws,
                    hostId: clientId,
                    roomName: roomName,
                    maxPlayers: 20,
                    players: new Map([[clientId, ws]])
                };
                
                currentRoom = roomId;
                ws.send(JSON.stringify({ type: 'roomCreated', roomId, clientId, isHost: true }));
                broadcastRoomsList();
            }

            if (data.type === 'joinRoom') {
                const room = rooms[data.roomId];
                
                if (!room) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Pokój nie istnieje!' }));
                    return;
                }
                if (room.players.size >= room.maxPlayers) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Pokój jest pełny!' }));
                    return;
                }

                currentRoom = data.roomId;
                room.players.set(clientId, ws);
                
                ws.send(JSON.stringify({ type: 'roomJoined', roomId: data.roomId, clientId, isHost: false }));
                room.host.send(JSON.stringify({ type: 'playerJoinedRoom', newClientId: clientId }));
                
                broadcastRoomsList();
            }

            if (data.type === 'signal' && currentRoom && rooms[currentRoom]) {
                const room = rooms[currentRoom];
                const targetWs = room.players.get(data.targetId);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: 'signal',
                        senderId: clientId,
                        signalData: data.signalData
                    }));
                }
            }
        } catch (err) {
            console.error("Błąd przetwarzania wiadomości:", err);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            const room = rooms[currentRoom];
            room.players.delete(clientId);

            if (room.hostId === clientId) {
                room.players.forEach(client => {
                    if (client !== ws) client.send(JSON.stringify({ type: 'roomClosed' }));
                });
                delete rooms[currentRoom];
            } else {
                room.host.send(JSON.stringify({ type: 'playerLeftRoom', clientId }));
            }
            broadcastRoomsList();
        }
    });
});

// Render automatycznie przypisuje port w zmiennej process.env.PORT (zwykle 10000)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer uruchomiony na porcie ${PORT}`);
});
