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

import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js'
import { mod } from '@noble/curves/abstract/modular.js'
import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { bytesToNumberLE, numberToBytesLE } from '@noble/curves/utils.js'
import { blake2b } from '@noble/hashes/blake2.js'
import { sha512 } from '@noble/hashes/sha2.js'

// ===========================
// Libsodium Type Definitions
// ===========================

export interface KeyPair {
    publicKey: Uint8Array
    secretKey: Uint8Array
    keyType: string
}

export interface CryptoKX {
    sharedRx: Uint8Array
    sharedTx: Uint8Array
}

// ===========================
// Libsodium Constants
// ===========================

const crypto_sign_SECRETKEYBYTES = 64
const crypto_scalarmult_ed25519_SCALARBYTES = 32
const crypto_scalarmult_x25519_SCALARBYTES = 32
const crypto_scalarmult_x25519_PKBYTES = 32
const crypto_generichash_BYTES_MIN = 16
const crypto_generichash_BYTES_MAX = 64
const crypto_generichash_blake2b_BYTES_MAX = 64
const crypto_core_ed25519_NONREDUCEDSCALARBYTES = 64
const crypto_kx_SESSIONKEYBYTES = 32
const crypto_kx_PUBLICKEYBYTES = 32

// ===========================
// Ed25519 Signature Functions
// ===========================

/**
 * Verify a detached signature
 */
export function crypto_sign_verify_detached(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array,
): boolean {
    try {
        return ed25519.verify(signature, message, publicKey)
    } catch (error) {
        return false
    }
}

/**
 * Generate an Ed25519 keypair
 * @param seed 32-byte seed which to use to generate public key. Optional, generates random value if not provided.
 */
export function crypto_sign_keypair(seed?: Uint8Array): KeyPair {
    seed ??= ed25519.utils.randomSecretKey() // Use random 32-byte seed if not provided
    const publicKey = ed25519.getPublicKey(seed) // 32-byte public key

    // Create 64-byte secret key: seed (32 bytes) + public key (32 bytes)
    // "secretKey" in Noble terminology is equivalent to "seed" in LibSodium.
    // "secretKey" in LibSodium terminology refers to the concatenation of seed || publicKey.
    const secretKey = new Uint8Array(crypto_sign_SECRETKEYBYTES)
    secretKey.set(seed, 0) // First 32 bytes: seed
    secretKey.set(publicKey, 32) // Last 32 bytes: public key

    return {
        publicKey: new Uint8Array(publicKey),
        secretKey: secretKey,
        keyType: 'ed25519',
    }
}

// ===========================
// Ed25519 Point Operations
// ===========================

/**
 * Scalar multiplication with base point (no clamping)
 */
export function crypto_scalarmult_ed25519_base_noclamp(
    scalar: Uint8Array,
): Uint8Array {
    // Input validation - only validate length
    if (scalar.length !== crypto_scalarmult_ed25519_SCALARBYTES) {
        throw new Error(
            `scalar must be ${crypto_scalarmult_ed25519_SCALARBYTES} bytes`,
        )
    }

    // Convert scalar bytes to bigint (little-endian)
    const scalarBigint = bytesToNumberLE(scalar)

    // Always clear top bit and call reduce modulo curve order, for constant time.
    // This maintains compatibility with libsodium's noclamp behavior

    // Clear top bit from scalar using bitwise AND with bitmask:
    // 1n << 255n creates a bigint with only bit 255 set
    // Subtracting 1n gives you all bits 0-254 set (0x7FFF...FFFF)
    // Bitwise & operation with the resulting mask clears bit 255
    const clearedTopBitScalar = scalarBigint & ((1n << 255n) - 1n)
    const reducedScalar = mod(clearedTopBitScalar, ed25519.Point.Fn.ORDER)

    // Reject zero scalars to match libsodium behavior
    if (reducedScalar === 0n) {
        throw new Error('scalar is 0')
    }

    // Perform scalar multiplication with base point
    const point = ed25519.Point.BASE.multiply(reducedScalar)
    return point.toBytes()
}

/**
 * Add two Ed25519 points
 */
export function crypto_core_ed25519_add(
    pointA: Uint8Array,
    pointB: Uint8Array,
): Uint8Array {
    try {
        const a = ed25519.Point.fromBytes(pointA)
        const b = ed25519.Point.fromBytes(pointB)
        const result = a.add(b)
        return result.toBytes()
    } catch (error) {
        throw new Error('invalid point')
    }
}

// ===========================
// Ed25519 Scalar Operations
// ===========================

/**
 * Add two scalars modulo the curve order
 */
export function crypto_core_ed25519_scalar_add(
    scalarA: Uint8Array,
    scalarB: Uint8Array,
): Uint8Array {
    // Input validation - ensure both scalars are correct length
    if (
        scalarA.length !== crypto_scalarmult_ed25519_SCALARBYTES ||
        scalarB.length !== crypto_scalarmult_ed25519_SCALARBYTES
    ) {
        throw new Error(
            `scalars must be ${crypto_scalarmult_ed25519_SCALARBYTES} bytes`,
        )
    }

    // Convert little-endian bytes to bigint
    const a = bytesToNumberLE(scalarA)
    const b = bytesToNumberLE(scalarB)
    const sum = a + b

    // Safety check: ensure sum fits into 64 bytes maximum. If
    // bytesToNumberLE ever misbehaves and returns something larger,
    // this will catch it before we try to serialize.
    if (sum < 0n || sum > (1n << (64n * 8n)) - 1n) {
        throw new Error('resulting sum scalar is invalid')
    }

    const reduced = mod(sum, ed25519.Point.Fn.ORDER)
    const result = numberToBytesLE(
        reduced,
        crypto_scalarmult_ed25519_SCALARBYTES,
    )

    // Final length check
    if (result.length !== crypto_scalarmult_ed25519_SCALARBYTES) {
        throw new Error('resulting scalar has invalid length')
    }

    return result
}

/**
 * Multiply two scalars modulo the curve order
 */
export function crypto_core_ed25519_scalar_mul(
    scalarA: Uint8Array,
    scalarB: Uint8Array,
): Uint8Array {
    // Input validation - ensure both scalars are correct length
    if (
        scalarA.length !== crypto_scalarmult_ed25519_SCALARBYTES ||
        scalarB.length !== crypto_scalarmult_ed25519_SCALARBYTES
    ) {
        throw new Error(
            `scalars must be ${crypto_scalarmult_ed25519_SCALARBYTES} bytes`,
        )
    }

    const a = bytesToNumberLE(scalarA)
    const b = bytesToNumberLE(scalarB)
    const reduced = mod(a * b, ed25519.Point.Fn.ORDER)
    const result = numberToBytesLE(
        reduced,
        crypto_scalarmult_ed25519_SCALARBYTES,
    )

    // Final length check
    if (result.length !== crypto_scalarmult_ed25519_SCALARBYTES) {
        throw new Error('resulting scalar has invalid length')
    }

    return result
}

/**
 * Reduce a scalar modulo the curve order
 */
export function crypto_core_ed25519_scalar_reduce(
    scalar: Uint8Array,
): Uint8Array {
    if (scalar.length > crypto_core_ed25519_NONREDUCEDSCALARBYTES) {
        throw new Error(
            `scalar must be at most ${crypto_core_ed25519_NONREDUCEDSCALARBYTES} bytes`,
        )
    }

    const scalarNum = bytesToNumberLE(scalar)
    const reduced = mod(scalarNum, ed25519.Point.Fn.ORDER)

    const result = numberToBytesLE(
        reduced,
        crypto_scalarmult_ed25519_SCALARBYTES,
    )

    // Final length check
    if (result.length !== crypto_scalarmult_ed25519_SCALARBYTES) {
        throw new Error('resulting scalar has invalid length')
    }

    return result
}

// ===========================
// X25519 ECDH Operations
// ===========================

/**
 * X25519 scalar multiplication
 */
export function crypto_scalarmult(
    privateKey: Uint8Array,
    publicKey: Uint8Array,
): Uint8Array {
    if (
        privateKey.length !== crypto_scalarmult_x25519_SCALARBYTES ||
        publicKey.length !== crypto_scalarmult_x25519_PKBYTES
    ) {
        throw new Error('x25519 private and public keys must be 32 bytes each')
    }

    // Clamp the private key as per X25519 specification
    const clampedKey = new Uint8Array(privateKey)
    clampedKey[0] &= 248
    clampedKey[31] &= 127
    clampedKey[31] |= 64

    return x25519.getSharedSecret(clampedKey, publicKey)
}

/**
 * Convert Ed25519 public key to X25519 public key
 */
export function crypto_sign_ed25519_pk_to_curve25519(
    edPubKey: Uint8Array,
): Uint8Array {
    return ed25519.utils.toMontgomery(edPubKey)
}

/**
 * Convert Ed25519 secret key to X25519 secret key
 */
export function crypto_sign_ed25519_sk_to_curve25519(
    edSecretKey: Uint8Array,
): Uint8Array {
    // Extract just the seed (first 32 bytes) since edwardsToMontgomeryPriv expects 32 bytes
    const seed = edSecretKey.slice(0, crypto_scalarmult_ed25519_SCALARBYTES)
    return ed25519.utils.toMontgomerySecret(seed)
}

// ===========================
// Hash Functions
// ===========================

/**
 * SHA-512 hash function
 */
export function crypto_hash_sha512(message: Uint8Array): Uint8Array {
    return sha512(message)
}

/**
 * BLAKE2b hash function (generic hash)
 * Matches libsodium signature: crypto_generichash(outputLength, message, key?)
 */
export function crypto_generichash(
    outputLength: number,
    message: Uint8Array,
    key: Uint8Array | null = null,
): Uint8Array {
    // Input validation
    if (
        outputLength < crypto_generichash_BYTES_MIN ||
        outputLength > crypto_generichash_BYTES_MAX
    ) {
        throw new Error(
            `output length must be between ${crypto_generichash_BYTES_MIN} and ${crypto_generichash_BYTES_MAX} bytes`,
        )
    }

    if (key) {
        return blake2b(message, { key, dkLen: outputLength })
    }
    return blake2b(message, { dkLen: outputLength })
}

// ===========================
// Key Exchange Functions
// ===========================

/**
 * Generate client session keys for key exchange
 */
export function crypto_kx_client_session_keys(
    clientPub: Uint8Array,
    clientPriv: Uint8Array,
    serverPub: Uint8Array,
): CryptoKX {
    // Step 1: Perform X25519 ECDH to get shared secret
    // Calling crypto_scalarmult rather than x25519.getSharedSecret to match facade function naming
    // as crypto_scalarmult handles clamping
    const sharedSecret = crypto_scalarmult(clientPriv, serverPub)

    if (sharedSecret.length !== crypto_kx_SESSIONKEYBYTES) {
        throw new Error(
            `shared secret must be ${crypto_kx_SESSIONKEYBYTES} bytes`,
        )
    }

    // Step 2: Create key material = shared_secret + client_pk + server_pk (96 bytes)
    // This matches libsodium's exact concatenation order
    const keyMaterial = new Uint8Array(
        crypto_kx_SESSIONKEYBYTES + 2 * crypto_kx_PUBLICKEYBYTES,
    )
    keyMaterial.set(sharedSecret, 0) // shared_secret (32 bytes)
    keyMaterial.set(clientPub, crypto_kx_PUBLICKEYBYTES) // client_pk (32 bytes)
    keyMaterial.set(serverPub, 2 * crypto_kx_PUBLICKEYBYTES) // server_pk (32 bytes)

    // Step 3: BLAKE2B-512 hash to get 64-byte result
    const hash = crypto_generichash(
        crypto_generichash_blake2b_BYTES_MAX,
        keyMaterial,
    )

    // Step 4: Split into rx (first 32 bytes) and tx (last 32 bytes) for client
    const sharedRx = hash.slice(0, crypto_kx_SESSIONKEYBYTES)
    const sharedTx = hash.slice(
        crypto_kx_SESSIONKEYBYTES,
        2 * crypto_kx_SESSIONKEYBYTES,
    )

    return {
        sharedRx: sharedRx,
        sharedTx: sharedTx,
    }
}

/**
 * Generate server session keys for key exchange
 */
export function crypto_kx_server_session_keys(
    serverPub: Uint8Array,
    serverPriv: Uint8Array,
    clientPub: Uint8Array,
): CryptoKX {
    // Step 1: Perform X25519 ECDH to get shared secret
    // Calling crypto_scalarmult rather than x25519.getSharedSecret to match facade function naming
    // and as crypto_scalarmult handles clamping
    const sharedSecret = crypto_scalarmult(serverPriv, clientPub)

    // Step 2: Create key material = shared_secret + client_pk + server_pk (96 bytes)
    // Same concatenation order as client (libsodium specification)
    const keyMaterial = new Uint8Array(
        crypto_kx_SESSIONKEYBYTES + 2 * crypto_kx_PUBLICKEYBYTES,
    )
    keyMaterial.set(sharedSecret, 0) // shared_secret (32 bytes)
    keyMaterial.set(clientPub, crypto_kx_PUBLICKEYBYTES) // client_pk (32 bytes)
    keyMaterial.set(serverPub, 2 * crypto_kx_PUBLICKEYBYTES) // server_pk (32 bytes)

    // Step 3: BLAKE2B-512 hash to get 64-byte result
    const hash = crypto_generichash(
        crypto_generichash_blake2b_BYTES_MAX,
        keyMaterial,
    )

    // Step 5: Server swaps rx/tx (server rx = client tx, server tx = client rx)
    const sharedRx = hash.slice(
        crypto_kx_SESSIONKEYBYTES,
        2 * crypto_kx_SESSIONKEYBYTES,
    ) // Server rx = client tx (last 32 bytes)
    const sharedTx = hash.slice(0, crypto_kx_SESSIONKEYBYTES) // Server tx = client rx (first 32 bytes)

    return {
        sharedRx: sharedRx,
        sharedTx: sharedTx,
    }
}

// ===========================
// Symmetric Encryption (SecretBox)
// ===========================

/**
 * Encrypt a message using XSalsa20Poly1305
 */
export function crypto_secretbox_easy(
    message: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array,
): Uint8Array {
    // Encrypt the message using XSalsa20Poly1305
    // crypto_secretbox_MESSAGEBYTES_MAX is not enforced here, as noble-ciphers can handle larger messages
    const encrypted = xsalsa20poly1305(key, nonce).encrypt(message)

    return encrypted
}

/**
 * Decrypt a message using XSalsa20Poly1305
 */
export function crypto_secretbox_open_easy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array,
): Uint8Array {
    try {
        // Decrypt the message using XSalsa20Poly1305
        const decrypted = xsalsa20poly1305(key, nonce).decrypt(ciphertext)
        return decrypted
    } catch (error) {
        throw new Error('decryption failed')
    }
}

// ===========================
// Utility Functions
// ===========================

/**
 * Convert bytes or string to base64 string (without padding to match libsodium)
 */
export function to_base64(data: Uint8Array | string): string {
    let base64: string
    if (typeof data === 'string') {
        base64 = Buffer.from(data, 'utf8').toString('base64')
    } else {
        base64 = Buffer.from(data).toString('base64')
    }

    // Remove padding to match libsodium's to_base64 behavior
    return base64.replace(/=+$/, '')
}
