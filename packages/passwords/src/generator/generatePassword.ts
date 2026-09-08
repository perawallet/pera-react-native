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

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
// No whitespace, quotes, backtick or backslash: they survive a keystore round
// trip fine but get mangled by sign-up forms and copy-paste often enough to
// lock a person out of the account they just created.
const SYMBOLS = '!@#$%^&*()-_=+[]{}:;,.?'

const CHARACTER_CLASSES = [LOWERCASE, UPPERCASE, DIGITS, SYMBOLS]
const ALPHABET = CHARACTER_CLASSES.join('')

export const DEFAULT_PASSWORD_LENGTH = 20

export type GeneratePasswordOptions = {
    length?: number
}

// Rejection-sampled uniform integer in [0, max) from the platform CSPRNG, the
// same construction as kms's uniformIntBelow. Not imported from there: kms's
// entry point pulls react-native-mmkv into this package's vitest module graph,
// which cannot load it, and a password generator must never fall back to
// Math.random.
const uniformIntBelow = (max: number): number => {
    const limit = Math.floor(0x1_00_00_00_00 / max) * max
    const buffer = new Uint32Array(1)
    let value: number
    do {
        crypto.getRandomValues(buffer)
        value = buffer[0]
    } while (value >= limit)
    return value % max
}

const pick = (characters: string): string =>
    characters[uniformIntBelow(characters.length)]

/**
 * Random password containing at least one character of every class, drawn
 * from the platform CSPRNG. `length` must be at least the number of classes.
 */
export const generatePassword = ({
    length = DEFAULT_PASSWORD_LENGTH,
}: GeneratePasswordOptions = {}): string => {
    if (!Number.isInteger(length) || length < CHARACTER_CLASSES.length) {
        throw new RangeError(
            `Password length must be an integer of at least ${CHARACTER_CLASSES.length}`,
        )
    }

    const characters = CHARACTER_CLASSES.map(pick)
    while (characters.length < length) {
        characters.push(pick(ALPHABET))
    }

    // Fisher–Yates, so the one-per-class guarantees don't sit at fixed
    // positions and leak the construction.
    for (let i = characters.length - 1; i > 0; i--) {
        const j = uniformIntBelow(i + 1)
        ;[characters[i], characters[j]] = [characters[j], characters[i]]
    }

    return characters.join('')
}
