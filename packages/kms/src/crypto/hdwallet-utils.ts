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

import { pbkdf2 } from 'crypto'
import * as bip39 from 'bip39'
import { WORDLIST } from '../crypto/wordlist'

const HD_MNEMONIC_LENGTH = 256

// BIP39 §"From mnemonic to seed":
// PBKDF2(NFKD(mnemonic), "mnemonic" + NFKD(passphrase), 2048, 64, SHA-512).
const BIP39_PBKDF2_ITERATIONS = 2048
const BIP39_SEED_LENGTH = 64
const BIP39_PBKDF2_DIGEST = 'sha512'
const BIP39_SALT_PREFIX = 'mnemonic'

const deriveBip39Seed = (mnemonic: string): Promise<Buffer> => {
    const normalizedMnemonic = mnemonic.normalize('NFKD')
    const salt = BIP39_SALT_PREFIX.normalize('NFKD')
    return new Promise<Buffer>((resolve, reject) => {
        pbkdf2(
            Buffer.from(normalizedMnemonic, 'utf8'),
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

export const entropyToMnemonic = (entropy: Buffer) => {
    return bip39.entropyToMnemonic(entropy)
}

/**
 * Routes the BIP39 seed derivation through Node's `crypto.pbkdf2`. On React
 * Native this is rewritten by Metro to `react-native-quick-crypto`, which
 * runs PBKDF2 natively via JSI — orders of magnitude faster than the pure-JS
 * path inside `bip39.mnemonicToSeed` (HMAC-SHA512 × 2048 iterations on the JS
 * thread). Output is byte-identical to `bip39.mnemonicToSeed`; see
 * `__tests__/hdwallet-utils.test.ts` for the equivalence guard.
 */
export const generateHDMasterKey = async (mnemonic?: string) => {
    const storableMnemonic =
        mnemonic ??
        bip39.generateMnemonic(HD_MNEMONIC_LENGTH, undefined, WORDLIST)
    const seed = await deriveBip39Seed(storableMnemonic)
    const entropy = bip39.mnemonicToEntropy(storableMnemonic, WORDLIST)
    return {
        seed,
        entropy,
        mnemonic: storableMnemonic,
    }
}
