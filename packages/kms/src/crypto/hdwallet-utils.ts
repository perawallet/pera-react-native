/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { pbkdf2, createHash, randomBytes } from 'crypto'
import { entropyToMnemonic as entropyToMnemonicLib } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import {
    BITS_PER_BYTE,
    BITS_PER_MNEMONIC_WORD,
    MNEMONIC_WORD_INDEX_MASK,
    indicesToUtf8Bytes,
} from './mnemonic-indices'
import { zeroBytes } from './secure-memory'

const HD_MNEMONIC_STRENGTH = 256

// BIP39 entropy is 128–256 bits in 32-bit steps, with one checksum bit appended
// per 32 entropy bits.
const MIN_ENTROPY_BITS = 128
const MAX_ENTROPY_BITS = 256
const ENTROPY_BITS_PER_CHECKSUM_BIT = 32

// BIP39 §"From mnemonic to seed":
// PBKDF2(NFKD(mnemonic), "mnemonic" + NFKD(passphrase), 2048, 64, SHA-512).
const BIP39_PBKDF2_ITERATIONS = 2048
const BIP39_SEED_LENGTH = 64
const BIP39_PBKDF2_DIGEST = 'sha512'
const BIP39_SALT_PREFIX = 'mnemonic'

// Takes the mnemonic as UTF-8 bytes (`indicesToUtf8Bytes`) so the phrase never
// exists as a string here. BIP39 mandates NFKD over the mnemonic, but the
// English wordlist is pure ASCII, where NFKD is the identity — the bytes ARE
// the normalized form. The Buffer wraps the caller's memory (no copy), so the
// caller's zeroing wipes what PBKDF2 read.
const deriveBip39Seed = (mnemonicBytes: Uint8Array): Promise<Buffer> => {
    const salt = BIP39_SALT_PREFIX.normalize('NFKD')
    return new Promise<Buffer>((resolve, reject) => {
        pbkdf2(
            Buffer.from(
                mnemonicBytes.buffer,
                mnemonicBytes.byteOffset,
                mnemonicBytes.byteLength,
            ),
            Buffer.from(salt, 'utf8'),
            BIP39_PBKDF2_ITERATIONS,
            BIP39_SEED_LENGTH,
            BIP39_PBKDF2_DIGEST,
            (err, derivedKey) => {
                if (err) reject(err)
                else resolve(derivedKey)
            },
        )
    })
}

// Byte-identical to `@algorandfoundation/dp256`'s `genDerivedMainKeyWithBIP39`
// (equivalence guard in `__tests__/hdwallet-utils.test.ts`).
const LIQUID_AUTH_PBKDF2_ITERATIONS = 210_000
const LIQUID_AUTH_MAIN_KEY_LENGTH = 64
const LIQUID_AUTH_PBKDF2_DIGEST = 'sha512'
const LIQUID_AUTH_SALT = 'liquid'

/**
 * Derives the DeterministicP256 (Liquid Auth) main key (the root for passkey
 * keypairs) from a BIP39 mnemonic. Uses `crypto.pbkdf2` — native/off-thread via
 * quick-crypto — NOT dp256's synchronous `genDerivedMainKeyWithBIP39`, which
 * freezes the JS thread. Mnemonic encoded as-is (no NFKD) to stay byte-identical.
 */
export const deriveLiquidAuthMainKey = (
    mnemonic: string,
): Promise<Uint8Array> =>
    new Promise<Uint8Array>((resolve, reject) => {
        pbkdf2(
            Buffer.from(mnemonic, 'utf8'),
            Buffer.from(LIQUID_AUTH_SALT, 'utf8'),
            LIQUID_AUTH_PBKDF2_ITERATIONS,
            LIQUID_AUTH_MAIN_KEY_LENGTH,
            LIQUID_AUTH_PBKDF2_DIGEST,
            (err, derivedKey) => {
                if (err) reject(err)
                else resolve(new Uint8Array(derivedKey))
            },
        )
    })

export const entropyToMnemonic = (entropy: Uint8Array): string => {
    return entropyToMnemonicLib(entropy, wordlist)
}

/**
 * Converts BIP39 entropy directly to wordlist indices, with no intermediate
 * mnemonic string. Mirrors `@scure/bip39`'s entropy→mnemonic encoding — the
 * entropy bits followed by the top CS checksum bits of SHA-256(entropy), read
 * in 11-bit groups — but stops at the indices instead of mapping to words, so
 * the phrase never becomes a `string` on the heap. Byte-identical to
 * `mnemonicWordsToIndices(entropyToMnemonic(entropy).split(' '))` (equivalence
 * guard in `__tests__/hdwallet-utils.test.ts`).
 */
export const entropyToIndices = (entropy: Uint8Array): Uint16Array => {
    const entropyBits = entropy.length * BITS_PER_BYTE
    if (
        entropyBits < MIN_ENTROPY_BITS ||
        entropyBits > MAX_ENTROPY_BITS ||
        entropyBits % ENTROPY_BITS_PER_CHECKSUM_BIT !== 0
    ) {
        throw new RangeError(
            `Invalid BIP39 entropy length: ${entropy.length} bytes`,
        )
    }
    const checksumBitCount = entropyBits / ENTROPY_BITS_PER_CHECKSUM_BIT // 4..8
    const checksum =
        createHash('sha256').update(entropy).digest()[0] >>
        (BITS_PER_BYTE - checksumBitCount)

    const indices = new Uint16Array(
        (entropyBits + checksumBitCount) / BITS_PER_MNEMONIC_WORD,
    )
    let acc = 0
    let bits = 0
    let out = 0
    for (let i = 0; i < entropy.length; i++) {
        acc = (acc << BITS_PER_BYTE) | entropy[i]
        bits += BITS_PER_BYTE
        if (bits >= BITS_PER_MNEMONIC_WORD) {
            bits -= BITS_PER_MNEMONIC_WORD
            indices[out++] = (acc >>> bits) & MNEMONIC_WORD_INDEX_MASK
        }
    }
    // Leftover entropy bits + checksum bits sum to exactly one word — one final
    // group remains.
    acc = (acc << checksumBitCount) | checksum
    indices[out] = acc & MNEMONIC_WORD_INDEX_MASK
    return indices
}

/**
 * Inverse of `entropyToIndices`: recovers BIP39 entropy from wordlist indices,
 * verifying the checksum bits against SHA-256(entropy). The index-native
 * counterpart to `@scure/bip39`'s `mnemonicToEntropy` (equivalence guard in
 * `__tests__/hdwallet-utils.test.ts`), so the phrase never has to exist as a
 * string to be decoded. Supports every BIP39 size (12–24 words / 128–256 bits).
 *
 * Throws on an invalid word count, out-of-range index, or checksum mismatch,
 * zeroing the partially built entropy first. The caller owns zeroing the
 * returned buffer and the input indices.
 */
export const indicesToEntropy = (indices: Uint16Array): Uint8Array => {
    const totalBits = indices.length * BITS_PER_MNEMONIC_WORD
    // entropyBits + entropyBits/32 = totalBits, so entropyBits = totalBits·32/33.
    const entropyBits =
        (totalBits * ENTROPY_BITS_PER_CHECKSUM_BIT) /
        (ENTROPY_BITS_PER_CHECKSUM_BIT + 1)
    if (
        !Number.isInteger(entropyBits) ||
        entropyBits < MIN_ENTROPY_BITS ||
        entropyBits > MAX_ENTROPY_BITS ||
        entropyBits % ENTROPY_BITS_PER_CHECKSUM_BIT !== 0
    ) {
        throw new RangeError(`Invalid BIP39 word count: ${indices.length}`)
    }
    const checksumBitCount = entropyBits / ENTROPY_BITS_PER_CHECKSUM_BIT // 4..8

    const entropy = new Uint8Array(entropyBits / BITS_PER_BYTE)
    let acc = 0
    let bits = 0
    let out = 0
    for (let i = 0; i < indices.length; i++) {
        if (indices[i] > MNEMONIC_WORD_INDEX_MASK) {
            zeroBytes(entropy)
            throw new RangeError(`Mnemonic index ${indices[i]} out of range`)
        }
        acc = (acc << BITS_PER_MNEMONIC_WORD) | indices[i]
        bits += BITS_PER_MNEMONIC_WORD
        while (bits >= BITS_PER_BYTE && out < entropy.length) {
            bits -= BITS_PER_BYTE
            entropy[out++] = (acc >>> bits) & 0xff
        }
    }

    // The bits left in the accumulator are exactly the checksum.
    const expected =
        createHash('sha256').update(entropy).digest()[0] >>
        (BITS_PER_BYTE - checksumBitCount)
    if ((acc & ((1 << checksumBitCount) - 1)) !== expected) {
        zeroBytes(entropy)
        throw new Error('Invalid BIP39 mnemonic checksum')
    }
    return entropy
}

/**
 * Routes the BIP39 seed derivation through Node's `crypto.pbkdf2`. On React
 * Native this is rewritten by Metro to `react-native-quick-crypto`, which
 * runs PBKDF2 natively via JSI — orders of magnitude faster than the pure-JS
 * path inside `@scure/bip39`'s `mnemonicToSeed` (HMAC-SHA512 × 2048 iterations
 * on the JS thread). Output is byte-identical to scure's `mnemonicToSeed`;
 * see `__tests__/hdwallet-utils.test.ts` for the equivalence guard.
 */
export const generateHDMasterKey = async (mnemonicIndices?: Uint16Array) => {
    // Generate path: fresh entropy encoded to indices — same construction as
    // scure's `generateMnemonic` (entropyToMnemonic over CSPRNG bytes), minus
    // the string.
    let indices: Uint16Array
    if (mnemonicIndices) {
        indices = mnemonicIndices
    } else {
        const freshEntropy = randomBytes(HD_MNEMONIC_STRENGTH / BITS_PER_BYTE)
        try {
            indices = entropyToIndices(freshEntropy)
        } finally {
            zeroBytes(freshEntropy)
        }
    }

    const mnemonicBytes = indicesToUtf8Bytes(indices)
    try {
        const seed = await deriveBip39Seed(mnemonicBytes)
        const entropy = indicesToEntropy(indices)
        return { seed, entropy }
    } finally {
        zeroBytes(mnemonicBytes)
        // Generated indices are owned here; caller-supplied ones are the
        // caller's to zero.
        if (!mnemonicIndices) zeroBytes(indices)
    }
}
