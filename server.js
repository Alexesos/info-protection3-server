// ======= Global Variables =======
let GLOBAL_P = 0;
let GLOBAL_Q = 0;
let GLOBAL_M = 0;
let LAST_SEQUENCE_SIZE = 0;

const express = require('express');
const cors = require('cors');
const iconv = require('iconv-lite');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ======= Utilities =======
const isPrime = (n) => {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    const sqrt = Math.floor(Math.sqrt(n));
    for (let i = 3; i <= sqrt; i += 2) {
        if (n % i === 0) return false;
    }
    return true;
};

const gcd = (a, b) => {
    while (b !== 0) {
        const t = b;
        b = a % b;
        a = t;
    }
    return a;
};

const pqGen = () => {
    const min = 10000;
    const max = 100000;
    while (true) {
        const candidate = Math.floor(Math.random() * (max - min + 1)) + min;
        if (candidate % 4 === 3 && isPrime(candidate)) return candidate;
    }
};

const genCoprime = (m) => {
    const min = 2;
    const max = m - 1;
    while (true) {
        const candidate = Math.floor(Math.random() * (max - min + 1)) + min;
        if (gcd(candidate, m) === 1) return candidate;
    }
};

const xor = (...args) => {
    return args.reduce((a, b) => a ^ b);
};

const extendKey = (keyBits, targetLength) => {
    const repeated = keyBits.repeat(Math.ceil(targetLength / keyBits.length));
    return repeated.slice(0, targetLength);
}

const extendKeyHex = (keyBuffer, targetLength) => {
    const extended = Buffer.alloc(targetLength);
    for (let i = 0; i < targetLength; i++) {
        extended[i] = keyBuffer[i % keyBuffer.length];
    }
    return extended;
}

// ======= API: XOR Encoding =======
app.post('/api/encode/xor2', (req, res) => {
    console.log('Api XOR2 encode called');
    const { request, key } = req.body;

    let extendedKey = key.repeat(Math.ceil(request.length / key.length)).slice(0, request.length);

    console.log(`Text length: ${request.length}`);
    console.log(`Key length: ${extendedKey.length}`);
    // if (request.length !== key.length) return res.status(400).send('Request and key must be equal length');

    const resBinArray = [];
    for (let i = 0; i < request.length; i++) {
        const buf1 = iconv.encode(request[i], 'win1251');
        const buf2 = iconv.encode(extendedKey[i], 'win1251');
        for (let j = 0; j < buf1.length; j++) {
            const xorByte = buf1[j] ^ buf2[j];
            resBinArray.push(xorByte.toString(2).padStart(8, '0'));
        }
    }

    res.json({ result: resBinArray.join('') });
});

// ======= API: XOR Encoding ver2 =======
app.post('/api/encode/xor2v2', (req, res) => {
    const { request, key } = req.body;

    const dataBuffer = iconv.encode(request, 'win1251');

    const keyBuffer = Buffer.from([parseInt(key, 2)]);

    const extendedKey = Buffer.alloc(dataBuffer.length);
    for (let i = 0; i < dataBuffer.length; i++) {
        extendedKey[i] = keyBuffer[i % keyBuffer.length];
    }

    const encryptedBuffer = dataBuffer.map((byte, i) => byte ^ extendedKey[i]);

    const encryptedBits = Array.from(encryptedBuffer)
        .map(b => b.toString(2).padStart(8, '0'))
        .join('');

    res.json({ result: encryptedBits });
});

// ======= API: XOR Encoding HEX =======
app.post('/api/encode/xor2hex', (req, res) => {
    const { request, key } = req.body;

    const dataBuffer = iconv.encode(request, 'win1251');
    const keyBuffer = Buffer.from(key, 'hex');

    if (keyBuffer.length === 0 && key !== '') {
        throw new Error('Invalid HEX key');
    }

    const extendedKey = extendKeyHex(keyBuffer, dataBuffer.length);

    const resultBuffer = dataBuffer.map((byte, i) => byte ^ extendedKey[i]);
    const hexResult = resultBuffer.toString('hex');

    res.json({ result: hexResult });
});

// ======= API: XOR Decoding =======
app.post('/api/decode/xor2', (req, res) => {
    console.log('Api XOR2 decode called');
    const { request, key } = req.body;

    const binaryRequest = [];
    for (let i = 0; i < request.length; i += 8) {
        binaryRequest.push(request.slice(i, i + 8));
    }

    const binaryKey = [];

    for (let i = 0; binaryKey.length < binaryRequest.length; i++) {
        const buf = iconv.encode(key[i], 'win1251');
        for (let byte of buf) {
            binaryKey.push(byte.toString(2).padStart(8, '0'));
        }
    }

    const decodedBytes = binaryRequest.map((bin, i) => {
        const cipherByte = parseInt(bin, 2);
        const keyByte = parseInt(binaryKey[i], 2);
        return cipherByte ^ keyByte;
    });

    const buffer = Buffer.from(decodedBytes);
    const decodedText = iconv.decode(buffer, 'win1251');
    return res.send({ result: decodedText });
});

// ======= API: XOR Decoding ver2 =======
app.post('/api/decode/xor2v2', (req, res) => {
    const { request, key } = req.body;

    const bytes = [];
    for (let i = 0; i < request.length; i += 8) {
        const byteStr = request.slice(i, i + 8).padEnd(8, '0');
        bytes.push(parseInt(byteStr, 2));
    }

    const dataBuffer = Buffer.from(bytes);
    const keyBuffer = Buffer.from([parseInt(key, 2)]);

    const extendedKey = Buffer.alloc(dataBuffer.length);
    for (let i = 0; i < dataBuffer.length; i++) {
        extendedKey[i] = keyBuffer[i % keyBuffer.length];
    }

    const decryptedBuffer = dataBuffer.map((byte, i) => byte ^ extendedKey[i]);

    const decryptedText = iconv.decode(decryptedBuffer, 'win1251');

    res.json({ result: decryptedText });
});

// ======= API: XOR Decoding HEX =======
app.post('/api/decode/xor2hex', (req, res) => {
    const { request, key } = req.body;

    if (!/^[0-9a-fA-F]*$/.test(request)) {
        throw new Error('Invalid HEX input');
    }
    if (request.length % 2 !== 0) {
        throw new Error('HEX string must have even length');
    }

    const dataBuffer = Buffer.from(request, 'hex');
    const keyBuffer = Buffer.from(key, 'hex');

    const extendedKey = extendKeyHex(keyBuffer, dataBuffer.length);

    const resultBuffer = dataBuffer.map((byte, i) => byte ^ extendedKey[i]);
    const textResult = iconv.decode(resultBuffer, 'win1251');

    res.json({ result: textResult });
});

// ======= API: BBS Encoding =======
app.post('/api/encode/bbs', (req, res) => {
    console.log('BBS called');
    const { sequenceSize } = req.body;

    if (sequenceSize !== LAST_SEQUENCE_SIZE) {
        do {
            GLOBAL_P = pqGen();
            GLOBAL_Q = pqGen();
        } while (GLOBAL_P === GLOBAL_Q);
        GLOBAL_M = GLOBAL_P * GLOBAL_Q;
        LAST_SEQUENCE_SIZE = sequenceSize;
    }

    const x = [];
    const x0 = genCoprime(GLOBAL_M);
    x.push(x0);

    for (let i = 0; i < sequenceSize - 1; i++) {
        const nextX = Math.pow(x[i], 2) % GLOBAL_M;
        x.push(nextX);
    }

    const smaller2Bits = x.map(val => val.toString(2).padStart(8, '0').slice(-2));
    res.json({ result: smaller2Bits });
});

// ======= API: Gama Shuffling =======
app.post('/api/gammashuffle', (req, res) => {
    console.log('Api Gammashuffle called');
    let key = req.body.key.split('');
    let gamma = '';

    for (let i = 0; i < key.length; i++) {
        const b0 = key[key.length - 1];
        const b7 = xor(key[3], key[4], key[5], key[7]);
        gamma += b0;
        console.log(`B7: ${b7}`);
        console.log(`Key iteration: ${key}`);
        console.log(`Gamma iteration: ${gamma}`);

        for (let j = key.length - 1; j > 0; j--) {
            const buf = key[j];
            key[j] = key[j - 1];
            key[j - 1] = buf;
        }

        key[0] = b7;
    }

    const cleanGamma = gamma.replace(/[\r\n]/g, '');
    const hexResult = cleanGamma
        .match(/.{1,8}/g)
        .map(b => parseInt(b, 2).toString(16).padStart(2, '0'))
        .join('');

    res.json({
        rawGamma: cleanGamma,
        hexResult: hexResult
    });
});

app.listen(PORT, () => {
    console.log(`Express-сервер на http://localhost:${PORT}`);
});