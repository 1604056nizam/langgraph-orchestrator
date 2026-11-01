import net from "net";

function isEndpointListening(port, host) {
    return new Promise((resolve) => {
        const socket = net.connect({ port, host });
        socket.setTimeout(200);
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("timeout", () => {
            socket.destroy();
            resolve(false);
        });
        socket.once("error", () => {
            socket.destroy();
            resolve(false);
        });
    });
}

function canBindPort(port) {
    return new Promise((resolve) => {
        const tester = net.createServer();
        tester.once("error", () => resolve(false));
        tester.listen(port, () => {
            tester.close(() => resolve(true));
        });
    });
}

export async function isPortAvailable(port) {
    const [v4Busy, v6Busy] = await Promise.all([
        isEndpointListening(port, "127.0.0.1"),
        isEndpointListening(port, "::1")
    ]);

    if (v4Busy || v6Busy) {
        return false;
    }

    return await canBindPort(port);
}

export async function findAvailablePort(startPort, maxAttempts = 20) {
    for (let offset = 0; offset < maxAttempts; offset++) {
        const candidatePort = startPort + offset;
        if (await isPortAvailable(candidatePort)) {
            return candidatePort;
        }
    }
    throw new Error(`No available port found between ${startPort} and ${startPort + maxAttempts - 1}`);
}