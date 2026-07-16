/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Verifies that every pinned API host serves a TLS chain containing at least
 * one certificate whose SPKI SHA-256 hash is in the app's pin set
 * (extensions/platform-react-native/src/services/ssl-pinning/pins.ts).
 *
 * Run before every release (and in CI): a failure here means the app's SSL
 * pinning would block real users — most likely because Cloudflare moved to a
 * CA outside the pinned set — and the pin set must be updated BEFORE the flag
 * stays enabled.
 *
 *   node tools/check-pinned-chains.mjs [host ...]
 */

import { readFileSync } from 'node:fs'
import { createHash, X509Certificate } from 'node:crypto'
import { connect } from 'node:tls'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_HOSTS = [
    // Pera backend (enable_ssl_pinning_pera_api)
    'mainnet.api.perawallet.app',
    'testnet.api.perawallet.app',
    'mainnet.staging.api.perawallet.app',
    'testnet.staging.api.perawallet.app',
    // Algorand node/indexer (enable_ssl_pinning_algod) — the Nodely-backed
    // hosts that CI-built apps are configured with (MAINNET/TESTNET_ALGOD_URL,
    // MAINNET/TESTNET_INDEXER_URL env vars).
    'node-mainnet.chain.perawallet.app',
    'node-testnet.chain.perawallet.app',
    'indexer-mainnet.chain.perawallet.app',
    'indexer-testnet.chain.perawallet.app',
]

const PINS_FILE = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'extensions/platform-react-native/src/services/ssl-pinning/pins.ts',
)

const loadPinnedHashes = () => {
    const source = readFileSync(PINS_FILE, 'utf8')
    const arrayBlock = source.match(
        /PINNED_ROOT_SPKI_HASHES[\s\S]*?=\s*\[([\s\S]*?)\n\]/,
    )?.[1]
    const hashes = [...(arrayBlock ?? '').matchAll(/'([A-Za-z0-9+/]{43}=)'/g)].map(
        match => match[1],
    )
    if (hashes.length === 0) {
        throw new Error(`Could not extract pin hashes from ${PINS_FILE}`)
    }
    return new Set(hashes)
}

/**
 * Base64 SHA-256 of the certificate's full SubjectPublicKeyInfo DER — the
 * exact input OkHttp/TrustKit hash for `sha256/...` pins. (`cert.pubkey` from
 * getPeerCertificate is only the raw key material and hashes differently.)
 */
const spkiSha256 = rawCertDer =>
    createHash('sha256')
        .update(
            new X509Certificate(rawCertDer).publicKey.export({
                type: 'spki',
                format: 'der',
            }),
        )
        .digest('base64')

/** Collects `{ subject, spki }` for each certificate in the served chain. */
const fetchChain = host =>
    new Promise((resolve, reject) => {
        const socket = connect(
            { host, port: 443, servername: host, timeout: 15_000 },
            () => {
                const chain = []
                let cert = socket.getPeerCertificate(true)
                const seen = new Set()
                while (cert && cert.fingerprint256 && !seen.has(cert.fingerprint256)) {
                    seen.add(cert.fingerprint256)
                    chain.push({
                        subject: cert.subject?.CN ?? '(unknown)',
                        spki: spkiSha256(cert.raw),
                    })
                    cert = cert.issuerCertificate
                }
                socket.end()
                resolve(chain)
            },
        )
        socket.on('error', reject)
        socket.on('timeout', () => {
            socket.destroy()
            reject(new Error('TLS connection timed out'))
        })
    })

const main = async () => {
    const hosts = process.argv.slice(2).length
        ? process.argv.slice(2)
        : DEFAULT_HOSTS
    const pins = loadPinnedHashes()
    console.log(`Loaded ${pins.size} pinned SPKI hashes from pins.ts\n`)

    let failed = false
    for (const host of hosts) {
        try {
            const chain = await fetchChain(host)
            const matched = chain.find(cert => pins.has(cert.spki))
            if (matched) {
                console.log(
                    `PASS ${host} — pinned key found: ${matched.subject} (${matched.spki})`,
                )
            } else {
                failed = true
                console.error(`FAIL ${host} — no pinned key in served chain:`)
                for (const cert of chain) {
                    console.error(`       ${cert.subject}: ${cert.spki}`)
                }
            }
        } catch (error) {
            failed = true
            console.error(`FAIL ${host} — ${error.message}`)
        }
    }

    if (failed) {
        console.error(
            '\nPin set and served chains have diverged. Update pins.ts (and keep',
        )
        console.error(
            'the ssl-pinning remote-config flags OFF until this passes).',
        )
        process.exit(1)
    }
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
