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

import { sha256 } from '@noble/hashes/sha2.js'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { InvalidKeyDataError } from '@algorandfoundation/keystore-core'

const BITS_PER_BYTE = 8
const BITS_PER_WORD = 11
const WORD_INDEX_MASK = (1 << BITS_PER_WORD) - 1
const ENTROPY_BITS_PER_CHECKSUM_BIT = 32
const MIN_ENTROPY_BYTES = 16
const MAX_ENTROPY_BYTES = 32

// BIP39 §"From mnemonic to seed": PBKDF2-HMAC-SHA512, 2048 rounds, 64 bytes,
// salt "mnemonic" + passphrase. Pera's HD wallets carry no passphrase.
const PBKDF2_ITERATIONS = 2048
const SEED_BITS = 512
const SALT = new TextEncoder().encode('mnemonic')

const entropyToIndices = (entropy: Uint8Array): Uint16Array => {
    const entropyBits = entropy.length * BITS_PER_BYTE
    const checksumBits = entropyBits / ENTROPY_BITS_PER_CHECKSUM_BIT
    const checksum = sha256(entropy)[0] >> (BITS_PER_BYTE - checksumBits)
    const indices = new Uint16Array(
        (entropyBits + checksumBits) / BITS_PER_WORD,
    )
    let acc = 0
    let bits = 0
    let out = 0
    for (const byte of entropy) {
        acc = (acc << BITS_PER_BYTE) | byte
        bits += BITS_PER_BYTE
        if (bits >= BITS_PER_WORD) {
            bits -= BITS_PER_WORD
            indices[out++] = (acc >>> bits) & WORD_INDEX_MASK
        }
    }
    acc = (acc << checksumBits) | checksum
    indices[out] = acc & WORD_INDEX_MASK
    return indices
}

// The English wordlist is ASCII, so NFKD is the identity and the phrase's UTF-8
// bytes are a char-code copy: the mnemonic never exists as an unzeroable string.
const indicesToUtf8Bytes = (indices: Uint16Array): Uint8Array<ArrayBuffer> => {
    let length = Math.max(indices.length - 1, 0)
    for (const index of indices) length += wordlist[index].length
    const bytes = new Uint8Array(length)
    let offset = 0
    indices.forEach((index, i) => {
        if (i > 0) bytes[offset++] = 0x20
        const word = wordlist[index]
        for (let j = 0; j < word.length; j++) {
            bytes[offset++] = word.charCodeAt(j)
        }
    })
    return bytes
}

/**
 * The 64-byte BIP39 seed for stored entropy, computed with the host's native
 * PBKDF2. Leaves `entropy` untouched; the caller zeroes the result.
 */
export const bip39SeedFromEntropy = async (
    subtle: SubtleCrypto,
    entropy: Uint8Array,
): Promise<Uint8Array> => {
    if (
        entropy.length < MIN_ENTROPY_BYTES ||
        entropy.length > MAX_ENTROPY_BYTES ||
        entropy.length % 4 !== 0
    ) {
        throw new InvalidKeyDataError(
            `invalid BIP39 entropy length: ${entropy.length} bytes`,
        )
    }
    const indices = entropyToIndices(entropy)
    let mnemonic: Uint8Array<ArrayBuffer> | undefined
    try {
        mnemonic = indicesToUtf8Bytes(indices)
        const key = await subtle.importKey('raw', mnemonic, 'PBKDF2', false, [
            'deriveBits',
        ])
        const seed = await subtle.deriveBits(
            {
                name: 'PBKDF2',
                hash: 'SHA-512',
                salt: SALT,
                iterations: PBKDF2_ITERATIONS,
            },
            key,
            SEED_BITS,
        )
        return new Uint8Array(seed)
    } finally {
        indices.fill(0)
        mnemonic?.fill(0)
    }
}
