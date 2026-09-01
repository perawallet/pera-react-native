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

import { createHash } from 'crypto'
import { ALGO25_SEED_LENGTH } from '../constants'
import {
    BITS_PER_BYTE,
    BITS_PER_MNEMONIC_WORD,
    MNEMONIC_WORD_INDEX_MASK,
} from './mnemonic-indices'
import { zeroBytes } from './secure-memory'

// Algorand derives the algo25 mnemonic's checksum word from SHA-512/256 of the
// seed.
const ALGO25_CHECKSUM_HASH = 'sha512-256'

// 24 data words + 1 checksum word.
const ALGO25_MNEMONIC_WORD_COUNT = 25

export const algo25SecretKeyToIndices = (
    secretKey: Uint8Array,
): Uint16Array => {
    const seed =
        secretKey.length >= ALGO25_SEED_LENGTH
            ? secretKey.slice(0, ALGO25_SEED_LENGTH)
            : secretKey
    try {
        return algo25SeedToIndices(seed)
    } finally {
        seed.fill(0)
    }
}

// Little-endian 8→11 bit repacking, identical to algokit-utils' `toUint11Array`
// (the algo25 mnemonic is packed LSB-first, unlike BIP39's MSB-first).
const toUint11Array = (bytes: Uint8Array): number[] => {
    const out: number[] = []
    let acc = 0
    let accBits = 0
    for (let i = 0; i < bytes.length; i++) {
        acc |= bytes[i] << accBits
        accBits += BITS_PER_BYTE
        if (accBits >= BITS_PER_MNEMONIC_WORD) {
            out.push(acc & MNEMONIC_WORD_INDEX_MASK)
            acc >>>= BITS_PER_MNEMONIC_WORD
            accBits -= BITS_PER_MNEMONIC_WORD
        }
    }
    if (accBits) out.push(acc)
    return out
}

/**
 * Converts a 32-byte Algo25 seed directly to its 25 wordlist indices, with no
 * intermediate mnemonic string — the index-native counterpart to
 * `algokit-utils`' `mnemonicFromSeed`. Reproduces that encoding exactly: 24
 * words from the little-endian-packed seed plus a 25th checksum word taken from
 * the first 11-bit group of `SHA-512/256(seed)`. Byte-identical to
 * `mnemonicWordsToIndices(mnemonicFromSeed(seed).split(' '))` — equivalence
 * guard in `__tests__/algo25-indices.test.ts`.
 */
export const algo25SeedToIndices = (seed: Uint8Array): Uint16Array => {
    if (seed.length !== ALGO25_SEED_LENGTH) {
        throw new RangeError(`Seed length must be ${ALGO25_SEED_LENGTH}`)
    }
    const words = toUint11Array(seed) // 24 groups
    const checksum = createHash(ALGO25_CHECKSUM_HASH).update(seed).digest()
    return Uint16Array.from([...words, toUint11Array(checksum)[0]])
}

/**
 * Inverse of `algo25SeedToIndices`: recovers the 32-byte seed from 25 wordlist
 * indices, verifying the 25th checksum word. The index-native counterpart to
 * algosdk's `seedFromMnemonic` (equivalence guard in
 * `__tests__/algo25-indices.test.ts`), so the phrase never has to exist as a
 * string to be turned back into key material.
 *
 * Throws on a checksum mismatch or unpackable indices; every intermediate
 * buffer (and, on failure, the partially built seed) is zeroed before the
 * throw. The caller owns zeroing the returned seed AND the input indices.
 */
export const indicesToAlgo25Seed = (indices: Uint16Array): Uint8Array => {
    if (indices.length !== ALGO25_MNEMONIC_WORD_COUNT) {
        throw new RangeError(
            `Mnemonic must be ${ALGO25_MNEMONIC_WORD_COUNT} words`,
        )
    }

    // 24 × 11 = 264 bits unpack little-endian into 33 bytes; a valid encoding
    // leaves the 33rd byte zero (the 8 spill bits past the 256-bit seed).
    const packed = new Uint8Array(ALGO25_SEED_LENGTH + 1)
    let acc = 0
    let accBits = 0
    let out = 0
    for (let i = 0; i < ALGO25_MNEMONIC_WORD_COUNT - 1; i++) {
        if (indices[i] > MNEMONIC_WORD_INDEX_MASK) {
            zeroBytes(packed)
            throw new RangeError(`Mnemonic index ${indices[i]} out of range`)
        }
        acc |= indices[i] << accBits
        accBits += BITS_PER_MNEMONIC_WORD
        while (accBits >= BITS_PER_BYTE) {
            packed[out++] = acc & 0xff
            acc >>>= BITS_PER_BYTE
            accBits -= BITS_PER_BYTE
        }
    }

    const seed = packed.slice(0, ALGO25_SEED_LENGTH)
    const spill = packed[ALGO25_SEED_LENGTH]
    zeroBytes(packed)
    if (spill !== 0) {
        zeroBytes(seed)
        throw new Error('Invalid algo25 mnemonic encoding')
    }

    const checksum = createHash(ALGO25_CHECKSUM_HASH).update(seed).digest()
    const expected = toUint11Array(checksum)[0]
    zeroBytes(checksum)
    if (indices[ALGO25_MNEMONIC_WORD_COUNT - 1] !== expected) {
        zeroBytes(seed)
        throw new Error('Invalid algo25 mnemonic checksum')
    }
    return seed
}
