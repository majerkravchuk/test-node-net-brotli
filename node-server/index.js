import { createServer } from 'node:net';
import { brotliCompressSync, constants, createBrotliCompress } from 'node:zlib';

const SERVER_PORT = 7690;
const NEGOTIATION_HEADER = 0x2A;
const NEGOTIATION_HEADER_LENGTH = 4;
const NEGOTIATION_PAYLOAD_LENGTH = 4;
const NEGOTIATION_LENGTH = NEGOTIATION_HEADER_LENGTH + NEGOTIATION_PAYLOAD_LENGTH;

const USE_COMPRESSION_FLAG = 0x01;

const RESPONSE = "Earth is the third planet from the Sun and the only astronomical object known to harbor life. This is enabled by Earth being an ocean world, the only one in the Solar System sustaining liquid surface water. Almost all of Earth's water is contained in its global ocean, covering 70.8% of Earth's crust. The remaining 29.2% of Earth's crust is land, most of which is located in the form of continental landmasses within Earth's land hemisphere. Most of Earth's land is at least somewhat humid and covered by vegetation, while large sheets of ice at Earth's polar deserts retain more water than Earth's groundwater, lakes, rivers, and atmospheric water combined. Earth's crust consists of slowly moving tectonic plates, which interact to produce mountain ranges, volcanoes, and earthquakes. Earth has a liquid outer core that generates a magnetosphere capable of deflecting most of the destructive solar winds and cosmic radiation."

const sendStringMessage = (socket, message) => {
    const header = Buffer.alloc(4);
    header.writeInt32BE(message.length);
    socket.writeCompressed(Buffer.concat([header, Buffer.from(message)]));
};

/**
 * @param {import('node:net').Socket} socket
*/
const negotiateIfNotYet = (socket) => {
    if (socket.isNegotiationDone) return true;
    if (socket.readableLength < NEGOTIATION_LENGTH) return false;

    const negotiationHeader = socket.read(NEGOTIATION_HEADER_LENGTH);
    if (negotiationHeader.readInt32BE() === NEGOTIATION_HEADER) {
        const response = Buffer.alloc(8, 0);
        response.writeInt32BE(NEGOTIATION_HEADER, 0);
        const negotiationPayload = socket.read(NEGOTIATION_PAYLOAD_LENGTH);
        if ((negotiationPayload.readInt32BE() & USE_COMPRESSION_FLAG) === USE_COMPRESSION_FLAG) {
            socket.useCompression = true;
            response.writeInt32BE(USE_COMPRESSION_FLAG, 4);
            console.log('switch to compression mode');
        } else {
            console.log('continue without compression');
        }
        socket.write(response);
        socket.isNegotiationDone = true;

        const compression = createBrotliCompress({
            flush: constants.BROTLI_OPERATION_FLUSH,
            finishFlush: constants.BROTLI_OPERATION_FINISH,
        });
        compression.pipe(socket);
        socket.writeCompressed = (message) => {
            compression.write(message, 'binary', (err) => {
                if (err) {
                    console.log('write error: ', err);
                    return;
                }

                compression.flush(constants.BROTLI_OPERATION_FLUSH, (flushErr) => {
                    if (err) {
                        console.log('flush error: ', err);
                        return;
                    }
                });
            });
        }

        return true;
    } else {
        console.log('wrong negotiation header', negotiationHeader);
        socket.destroy();
        return false;
    }
}

/**
 * @param {import('node:net').Socket} socket
*/
export const onSocketReadeble = (socket) => {
    if (!negotiateIfNotYet(socket)) return;

    let message;
    while ((message = socket.read(4)) !== null) {
        console.log('from client:', message);
        if (message.readInt32BE() === 0xF) {
            sendStringMessage(socket, RESPONSE);
        }
    }
};

const server = createServer((socket) => {
    console.log('client connected');
    socket.on('readable', () => onSocketReadeble(socket));
    socket.on('end', () => {
        console.log('client disconnected');
    });
});
server.on('error', (err) => {
    throw err;
});
server.listen(SERVER_PORT, () => {
    console.log('server bound');
});
