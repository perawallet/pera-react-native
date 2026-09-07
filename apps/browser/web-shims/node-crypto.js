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
//
// On web (Chrome extension) all operations use @noble/hashes (synchronous) and
// the browser's SubtleCrypto (async PBKDF2). This shim replaces react-native-quick-crypto
// which bundles react-native-worklets and throws __fbBatchedBridgeConfig on eval.

import { sha256, sha512, sha512_256 } from '@noble/hashes/sha2.js'
import { hmac } from '@noble/hashes/hmac.js'

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
