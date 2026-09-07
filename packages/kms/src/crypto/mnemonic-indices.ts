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

import { zeroBytes } from './secure-memory'
import { WORDLIST } from './wordlist'

/**
 * Mnemonic encoding. Both BIP39 and algo25 pack the wordlist into 11-bit groups
 * (the wordlist has 2^11 = 2048 entries), repacked from raw 8-bit bytes by the
 * `entropy → indices` (hdwallet-utils) and `seed → indices` (algo25-utils)
 * codecs.
 */
export const BITS_PER_MNEMONIC_WORD = 11
export const MNEMONIC_WORD_INDEX_MASK = (1 << BITS_PER_MNEMONIC_WORD) - 1 // 2047
export const BITS_PER_BYTE = 8

/**
 * Maps a mnemonic word to its position in the 2048-entry BIP39 English
 * wordlist — the same wordlist Algorand's 25-word mnemonic uses. Built once.
 */
const WORD_TO_INDEX: Map<string, number> = new Map(
    WORDLIST.map((word, index) => [word, index]),
)

/**
 * Converts mnemonic words to a `Uint16Array` of wordlist indices.
 *
 * A `Uint16Array` (the wordlist is 11-bit, 2048 entries) is preferred over the
 * words themselves for any secret a store must *retain*: it is zeroable via
 * `zeroBytes`, and at rest it holds opaque numbers rather than the dictionary
 * words a memory scanner could grep for.
 *
 * Returns `null` if any token is not a wordlist word, so callers handling
 * unvalidated input (e.g. a scanned, possibly-typo'd phrase) can fall back to a
 * raw byte representation rather than losing the value.
 */
export const mnemonicWordsToIndices = (words: string[]): Uint16Array | null => {
    const indices = new Uint16Array(words.length)
    for (let i = 0; i < words.length; i++) {
        const index = WORD_TO_INDEX.get(words[i])
        if (index === undefined) {
            // Zero the partial buffer (it already holds valid indices for the
            // words processed so far) rather than leaving it to GC.
            zeroBytes(indices)
            return null
        }
        indices[i] = index
    }
    return indices
}

/**
 * Inverse of the word→index lookup: maps a single wordlist index back to its
 * word. Callers convert individual indices to words only at display time, so the
 * full phrase is never materialized as a `string[]` for storage — the only
 * retained representation stays the zeroable index buffer.
 */
export const mnemonicIndexToWord = (index: number): string => {
    if (index < 0 || index >= WORDLIST.length) {
        throw new RangeError(
            `Mnemonic index ${index} is out of range (wordlist has ${WORDLIST.length} entries).`,
        )
    }
    return WORDLIST[index]
}

/**
 * Encodes wordlist indices as the UTF-8 bytes of the space-joined phrase,
 * without ever materializing the phrase as a string — for KDFs defined over
 * the mnemonic's bytes (BIP39 PBKDF2). The wordlist is pure ASCII, so NFKD
 * normalization is the identity and byte-building is a plain char-code copy.
 * The returned buffer is zeroable; the caller owns wiping it after use.
 */
export const indicesToUtf8Bytes = (indices: Uint16Array): Uint8Array => {
    let length = indices.length > 0 ? indices.length - 1 : 0
    for (const index of indices) {
        length += mnemonicIndexToWord(index).length
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (let i = 0; i < indices.length; i++) {
        if (i > 0) bytes[offset++] = 0x20 // ' '
        const word = WORDLIST[indices[i]]
        for (let j = 0; j < word.length; j++) {
            bytes[offset++] = word.charCodeAt(j)
        }
    }
    return bytes
}
