/* eslint-disable no-restricted-syntax, no-await-in-loop, no-constant-condition, no-continue */
// Raw InfluxDB 1.x HTTP I/O: a streaming chunked read (for backpressure) and a
// batched line-protocol write. No client library — the chunked /query endpoint
// streams newline-delimited JSON, and an http response is async-iterable, so we
// get backpressure to the source socket for free.
// for-await-of, sequential awaits and the for(;;) retry loop are intentional.

const http = require('node:http');
const https = require('node:https');
const {URL} = require('node:url');

const {flattenInfluxResult} = require('./lib');

function authHeaders(auth) {
    if (!auth || !auth.user) return {};
    const token = Buffer.from(`${auth.user}:${auth.pass || ''}`).toString('base64');
    return {Authorization: `Basic ${token}`};
}

function clientFor(url) {
    return url.protocol === 'https:' ? https : http;
}

// Resolves to the live response stream once a 200 header is seen; rejects (with
// the body) otherwise.
function openStream(url, auth) {
    return new Promise((resolve, reject) => {
        const req = clientFor(url).get(url, {headers: authHeaders(auth)}, (res) => {
            if (res.statusCode === 200) {
                resolve(res);
                return;
            }
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (d) => { body += d; });
            res.on('end', () => reject(new Error(`query failed (${res.statusCode}): ${body}`)));
        });
        req.on('error', reject);
    });
}

// Streams rows for an InfluxQL query, parsing the chunked NDJSON response as it
// arrives. Iterating slowly applies TCP backpressure to InfluxDB.
async function* queryRows({
    baseUrl, db, q, chunkSize = 10000, auth
}) {
    const url = new URL('/query', baseUrl);
    url.searchParams.set('db', db);
    url.searchParams.set('q', q);
    url.searchParams.set('epoch', 'ms');
    url.searchParams.set('chunked', 'true');
    url.searchParams.set('chunk_size', String(chunkSize));

    const res = await openStream(url, auth);
    res.setEncoding('utf8');

    let buffer = '';
    for await (const chunk of res) {
        buffer += chunk;
        let nl = buffer.indexOf('\n');
        while (nl >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) yield* flattenInfluxResult(JSON.parse(line));
            nl = buffer.indexOf('\n');
        }
    }
    const tail = buffer.trim();
    if (tail) yield* flattenInfluxResult(JSON.parse(tail));
}

function post(url, body, auth) {
    return new Promise((resolve, reject) => {
        const req = clientFor(url).request(
            url,
            {method: 'POST', headers: {...authHeaders(auth), 'Content-Type': 'text/plain'}},
            (res) => {
                let resBody = '';
                res.setEncoding('utf8');
                res.on('data', (d) => { resBody += d; });
                res.on('end', () => resolve({status: res.statusCode, body: resBody}));
            }
        );
        req.on('error', reject);
        req.end(body);
    });
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Writes a batch of line-protocol strings. Idempotent on the server (identical
// point overwrites), so 5xx/network failures are retried with backoff; a 4xx
// (malformed data) fails fast.
async function writeLines({
    baseUrl, db, auth, retries = 4
}, lines) {
    const url = new URL('/write', baseUrl);
    url.searchParams.set('db', db);
    url.searchParams.set('precision', 'ms');
    const body = lines.join('\n');

    let attempt = 0;
    for (;;) {
        let result;
        try {
            result = await post(url, body, auth);
        } catch (err) {
            if (attempt >= retries) throw err;
            await sleep(2 ** attempt * 250);
            attempt += 1;
            continue;
        }
        if (result.status === 204) return;
        if (result.status < 500) {
            throw new Error(`write rejected (${result.status}): ${result.body}`);
        }
        if (attempt >= retries) {
            throw new Error(`write failed after ${retries} retries (${result.status}): ${result.body}`);
        }
        await sleep(2 ** attempt * 250);
        attempt += 1;
    }
}

// Executes a non-streaming InfluxQL statement (e.g. DROP MEASUREMENT) via POST.
function execute({baseUrl, db, auth}, statement) {
    const url = new URL('/query', baseUrl);
    url.searchParams.set('db', db);
    url.searchParams.set('q', statement);
    return new Promise((resolve, reject) => {
        const req = clientFor(url).request(url, {method: 'POST', headers: authHeaders(auth)}, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (d) => { body += d; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`statement failed (${res.statusCode}): ${body}`));
                    return;
                }
                resolve(body);
            });
        });
        req.on('error', reject);
        req.end();
    });
}

module.exports = {queryRows, writeLines, execute};
