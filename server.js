// Przechowywanie czołgów innych graczy
const remoteTanks = {};

// Tworzenie czołgu dla nowego gracza z pokoju
function spawnRemotePlayer(clientId) {
    // Stwórz nowy czołg (np. w kolorze czerwonym/zielonym)
    const tankObj = createTank(0xef4444, false); 
    remoteTanks[clientId] = tankObj;
}

// Odbieranie danych pozycji przez WebRTC i aktualizacja pozycji 3D
function updateRemotePlayerPosition(clientId, data) {
    if (!remoteTanks[clientId]) {
        spawnRemotePlayer(clientId);
    }
    
    const tank = remoteTanks[clientId];
    tank.mesh.position.set(data.x, data.y, data.z);
    tank.mesh.rotation.y = data.rotation;
    tank.turretPivot.rotation.y = data.turretRotation;
}

// Wysyłanie swojej pozycji do wszystkich w pokoju (wstaw do pętli animate())
function broadcastMyPosition() {
    if (!playerTank || playerTank.isDestroyed) return;

    const payload = JSON.stringify({
        x: playerTank.mesh.position.x,
        y: playerTank.mesh.position.y,
        z: playerTank.mesh.position.z,
        rotation: playerTank.mesh.rotation.y,
        turretRotation: playerTank.turretPivot.rotation.y
    });

    // Wysyłanie danych do każdego połączonego gracza w pokoju
    Object.keys(peerConnections).forEach(id => {
        const pc = peerConnections[id];
        if (pc.dataChannel && pc.dataChannel.readyState === 'open') {
            pc.dataChannel.send(payload);
        }
    });
}
