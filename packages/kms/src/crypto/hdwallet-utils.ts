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

import * as bip39 from 'bip39'
import { WORDLIST } from '../crypto/wordlist'

const HD_MNEMONIC_LENGTH = 256

export const entropyToMnemonic = (entropy: Buffer) => {
    return bip39.entropyToMnemonic(entropy)
}

export const generateHDMasterKey = async (mnemonic?: string) => {
    const storableMnemonic =
        mnemonic ??
        bip39.generateMnemonic(HD_MNEMONIC_LENGTH, undefined, WORDLIST)
    const seed = await bip39.mnemonicToSeed(storableMnemonic)
    const entropy = await bip39.mnemonicToEntropy(storableMnemonic)
    return {
        seed,
        entropy,
        mnemonic: storableMnemonic,
    }
}
