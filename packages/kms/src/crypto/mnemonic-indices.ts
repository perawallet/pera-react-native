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

import { zeroBytes } from './secure-memory'
import { WORDLIST } from './wordlist'

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
 * Inverse of {@link mnemonicWordsToIndices}: maps each wordlist index back to
 * its word.
 */
export const indicesToMnemonicWords = (indices: Uint16Array): string[] => {
    const words: string[] = new Array(indices.length)
    for (let i = 0; i < indices.length; i++) {
        const index = indices[i]
        if (index >= WORDLIST.length) {
            throw new RangeError(
                `Mnemonic index ${index} is out of range (wordlist has ${WORDLIST.length} entries).`,
            )
        }
        words[i] = WORDLIST[index]
    }
    return words
}
