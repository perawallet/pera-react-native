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

// Web shim for 'crypto' and 'node:crypto'.
//
// Consumers in this codebase:
//   @algorandfoundation/keystore   — { randomBytes, subtle }
//   packages/kms/hdwallet-utils    — { pbkdf2, createHash }  (sha256, sha512)
//   packages/kms/algo25-utils      — { createHash }          (sha512-256)
//   packages/kms/falcon-utils      — { createHash }          (sha512-256)
//   @algorandfoundation/xhd-wallet-api — { createHash, createHmac } (sha512, sha256)
//   packages/kms/argon2id          — { argon2 }                  (quick-crypto's signature)
//   packages/kms/aesGcm            — { createCipheriv, createDecipheriv } (aes-256-gcm)
//
// On web (Chrome extension) all operations use @noble/hashes and @noble/ciphers
// (synchronous) and the browser's SubtleCrypto (async PBKDF2). This shim replaces react-native-quick-crypto
// which bundles react-native-worklets and throws __fbBatchedBridgeConfig on eval.
//
// Metro does not fail on a named import this file lacks; the consumer just gets
// `undefined` at call time. Add every primitive a consumer above imports.

import { sha256, sha512, sha512_256 } from '@noble/hashes/sha2.js'
import { hmac } from '@noble/hashes/hmac.js'
import { argon2idAsync } from '@noble/hashes/argon2.js'
import { gcm } from '@noble/ciphers/aes.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toUint8(data) {
    if (data instanceof Uint8Array) return data
    if (typeof data === 'string') return new TextEncoder().encode(data)
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    if (data instanceof ArrayBuffer) return new Uint8Array(data)
    throw new TypeError('Unsupported data type for crypto operation')
}

function normaliseAlgorithm(algorithm) {
    return algorithm.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getHashFn(algorithm) {
    const norm = normaliseAlgorithm(algorithm)
    if (norm === 'sha256') return sha256
    if (norm === 'sha512') return sha512
    if (norm === 'sha512256') return sha512_256
    throw new Error('node-crypto shim: unsupported hash algorithm "' + algorithm + '"')
}

// Node.js Hash-like object (returned by createHash)
function makeHashObject(hashFn, initialChunks) {
    // Clone so callers that copy() then continue updating don't corrupt each other.
    const chunks = initialChunks ? initialChunks.map(c => c.slice()) : []
    return {
        update(data, encoding) {
            if (encoding !== undefined && encoding !== 'utf8' && encoding !== 'binary') {
                throw new Error(`node-crypto shim: update() encoding '${encoding}' not supported`)
            }
            chunks.push(toUint8(data))
            return this
        },
        digest(encoding) {
            const total = chunks.reduce((n, c) => n + c.length, 0)
            const buf = new Uint8Array(total)
            let offset = 0
            for (const c of chunks) { buf.set(c, offset); offset += c.length }
            const result = hashFn(buf)
            if (!encoding || encoding === 'buffer') return result
            if (encoding === 'hex') return Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('')
            throw new Error(`node-crypto shim: digest() encoding '${encoding}' not supported`)
        },
        // True state clone: new object with accumulated chunks copied.
        copy() { return makeHashObject(hashFn, chunks) },
    }
}

// Node.js Hmac-like object (returned by createHmac)
function makeHmacObject(hashFn, key) {
    const chunks = []
    const keyBytes = toUint8(key)
    return {
        update(data, encoding) {
            if (encoding !== undefined && encoding !== 'utf8' && encoding !== 'binary') {
                throw new Error(`node-crypto shim: update() encoding '${encoding}' not supported`)
            }
            chunks.push(toUint8(data))
            return this
        },
        digest(encoding) {
            const total = chunks.reduce((n, c) => n + c.length, 0)
            const buf = new Uint8Array(total)
            let offset = 0
            for (const c of chunks) { buf.set(c, offset); offset += c.length }
            const result = hmac(hashFn, keyBytes, buf)
            if (!encoding || encoding === 'buffer') return result
            if (encoding === 'hex') return Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('')
            throw new Error(`node-crypto shim: digest() encoding '${encoding}' not supported`)
        },
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const subtle = globalThis.crypto.subtle

export const webcrypto = globalThis.crypto

// Note: randomBytes returns Uint8Array, not Node's Buffer subclass.
// Callers needing Buffer semantics (string coercion, .toString()) must wrap.
// getRandomValues is capped at 65536 bytes per call (spec); loop for larger sizes.
export function randomBytes(size) {
    const buf = new Uint8Array(size)
    const CHUNK = 65_536
    for (let offset = 0; offset < size; offset += CHUNK) {
        globalThis.crypto.getRandomValues(buf.subarray(offset, offset + CHUNK))
    }
    return buf
}

// Synchronous Node.js-style hash builder.
// Supports 'sha256', 'sha512', 'sha512-256' (SHA-512/256 truncated).
export function createHash(algorithm) {
    return makeHashObject(getHashFn(algorithm))
}

// Synchronous Node.js-style HMAC builder.
// key can be string or Uint8Array; algorithm matches createHash's set.
export function createHmac(algorithm, key) {
    return makeHmacObject(getHashFn(algorithm), key)
}

// Async PBKDF2 matching Node.js callback API.
// Uses Web Crypto SubtleCrypto.deriveBits which is native-fast in Chrome.
// digest may be 'sha512' (mnemonic seed derivation) or 'sha256' (keystore).
export function pbkdf2(password, salt, iterations, keylen, digest, callback) {
    const pwBytes = toUint8(password)
    const saltBytes = toUint8(salt)
    const hashName = normaliseAlgorithm(digest)
    const subtleDigest = hashName === 'sha512' ? 'SHA-512' : hashName === 'sha256' ? 'SHA-256' : null
    if (!subtleDigest) {
        callback(new Error('node-crypto pbkdf2 shim: unsupported digest "' + digest + '"'), null)
        return
    }
    globalThis.crypto.subtle.importKey(
        'raw', pwBytes, { name: 'PBKDF2' }, false, ['deriveBits'],
    ).then(key =>
        globalThis.crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: saltBytes, iterations, hash: subtleDigest },
            key,
            keylen * 8,
        )
    ).then(bits => {
        callback(null, new Uint8Array(bits))
    }).catch(err => {
        callback(err, null)
    })
}

// Served next to the extension pages by scripts/build.mjs, which bundles
// extensions/keystore-chrome/src/vault/argon2-worker.ts to this name. That
// worker always derives 32 bytes at Argon2 v0x13; anything else runs inline.
const ARGON2_WORKER_URL = 'argon2-worker.js'
const ARGON2_WORKER_OUTPUT_LENGTH = 32
const ARGON2_VERSION_13 = 0x13

function deriveArgon2idInWorker(message, nonce, opts) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(ARGON2_WORKER_URL, { type: 'module' })
        worker.onmessage = event => {
            worker.terminate()
            resolve(event.data)
        }
        worker.onerror = event => {
            worker.terminate()
            reject(new Error(event.message || 'argon2 worker failed'))
        }
        worker.postMessage({ password: message, salt: nonce, m: opts.m, t: opts.t, p: opts.p })
    })
}

// react-native-quick-crypto's callback API. `memory` is in KiB, as noble's `m`.
// Cloud backup derives at 256 MiB, which freezes the page for seconds on the
// main thread, so the worker is preferred and the async variant is the fallback.
export function argon2(algorithm, params, callback) {
    if (algorithm !== 'argon2id') {
        callback(new Error('node-crypto argon2 shim: unsupported algorithm "' + algorithm + '"'), null)
        return
    }
    // A Uint8Array message is the caller's to wipe (kms zeroes it once this
    // settles); only a copy made here from a string is ours.
    const isOwnCopy = typeof params.message === 'string'
    const message = toUint8(params.message)
    const nonce = toUint8(params.nonce)
    const version = params.version ?? ARGON2_VERSION_13
    const opts = { t: params.passes, m: params.memory, p: params.parallelism, dkLen: params.tagLength, version }
    const deriveInline = () => argon2idAsync(message, nonce, opts)
    const canUseWorker =
        typeof Worker !== 'undefined' &&
        opts.dkLen === ARGON2_WORKER_OUTPUT_LENGTH &&
        version === ARGON2_VERSION_13
    const derivation = canUseWorker
        ? deriveArgon2idInWorker(message, nonce, opts).catch(deriveInline)
        : deriveInline()
    derivation
        .finally(() => {
            if (isOwnCopy) message.fill(0)
        })
        .then(
            result => callback(null, result),
            error => callback(error, null),
        )
}

const AES_GCM_ALGORITHM = 'aes-256-gcm'
const AES_256_KEY_LENGTH = 32
const AES_GCM_TAG_LENGTH = 16

function concatChunks(chunks) {
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const buf = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) { buf.set(c, offset); offset += c.length }
    return buf
}

function assertAesGcm(algorithm, key) {
    if (algorithm.toLowerCase() !== AES_GCM_ALGORITHM) {
        throw new Error('node-crypto cipher shim: unsupported algorithm "' + algorithm + '"')
    }
    if (toUint8(key).length !== AES_256_KEY_LENGTH) {
        throw new Error('node-crypto cipher shim: aes-256-gcm needs a 32-byte key')
    }
}

// noble refuses a second encrypt() per instance, but final() builds a fresh one,
// so reuse after final() must be refused here: a second plaintext under the
// same key and IV leaks the GCM auth key. Node's Cipher refuses it too.
function assertNotFinished(isFinished) {
    if (isFinished) throw new Error('node-crypto cipher shim: cipher already finalized')
}

// noble's GCM is one-shot, so update() only buffers and final() returns the
// whole output. Callers must concatenate update() and final(), as kms does;
// one that streams update() output alone would see nothing.
export function createCipheriv(algorithm, key, iv) {
    assertAesGcm(algorithm, key)
    const chunks = []
    let aad
    let tag = null
    let isFinished = false
    return {
        setAAD(data) { assertNotFinished(isFinished); aad = toUint8(data); return this },
        update(data) { assertNotFinished(isFinished); chunks.push(toUint8(data)); return new Uint8Array(0) },
        final() {
            assertNotFinished(isFinished)
            // Set before encrypting, so even a throw can't leave the IV reusable.
            isFinished = true
            const plaintext = concatChunks(chunks)
            try {
                const sealed = gcm(toUint8(key), toUint8(iv), aad).encrypt(plaintext)
                tag = sealed.slice(sealed.length - AES_GCM_TAG_LENGTH)
                return sealed.slice(0, sealed.length - AES_GCM_TAG_LENGTH)
            } finally {
                plaintext.fill(0)
            }
        },
        getAuthTag() {
            if (!tag) throw new Error('node-crypto cipher shim: getAuthTag() before final()')
            return tag
        },
    }
}

export function createDecipheriv(algorithm, key, iv) {
    assertAesGcm(algorithm, key)
    const chunks = []
    let aad
    let tag = null
    let isFinished = false
    return {
        setAAD(data) { assertNotFinished(isFinished); aad = toUint8(data); return this },
        // Node accepts a truncated tag; a short one would weaken the forgery bound.
        setAuthTag(data) {
            assertNotFinished(isFinished)
            const bytes = toUint8(data)
            if (bytes.length !== AES_GCM_TAG_LENGTH) {
                throw new Error('node-crypto cipher shim: aes-256-gcm needs a 16-byte auth tag')
            }
            tag = bytes
            return this
        },
        update(data) { assertNotFinished(isFinished); chunks.push(toUint8(data)); return new Uint8Array(0) },
        // Throws on a wrong key, wrong AAD or tampered bytes, as Node's does.
        final() {
            assertNotFinished(isFinished)
            if (!tag) throw new Error('node-crypto cipher shim: final() before setAuthTag()')
            isFinished = true
            return gcm(toUint8(key), toUint8(iv), aad).decrypt(concatChunks([...chunks, tag]))
        },
    }
}
