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

export type HDDerivationParams = {
    account: number
    keyIndex: number
    derivationType: number
}

export type MnemonicWordAtPosition = {
    index: number
    word: string
}

export type KMSAlgo25Session = {
    signTransaction: (encodedTx: Uint8Array) => Promise<Uint8Array>
    signData: (data: Uint8Array) => Promise<Uint8Array>
    getPublicKey: () => Uint8Array
    /**
     * Returns the mnemonic as UTF-8 bytes. Callers should zero the array with
     * `.fill(0)` as soon as they're done with it. JS strings are immutable so
     * we expose bytes instead of a `string`, letting consumers purge the
     * mnemonic from memory eagerly instead of waiting on GC.
     */
    getMnemonic: () => Promise<Uint8Array>
    /**
     * Returns `count` distinct {index, word} pairs sampled uniformly from the
     * mnemonic. The full mnemonic never crosses the session boundary, so
     * consumers that only need a handful of words (e.g. a verification quiz)
     * don't need to receive — or store — the rest.
     */
    getRandomMnemonicWords: (count: number) => Promise<MnemonicWordAtPosition[]>
}

export type KMSHDWalletSession = {
    getPublicKey: (params: HDDerivationParams) => Promise<Uint8Array>
    signTransaction: (
        params: HDDerivationParams,
        encodedTx: Uint8Array,
    ) => Promise<Uint8Array>
    signData: (
        params: HDDerivationParams,
        data: Uint8Array,
    ) => Promise<Uint8Array>
    getMnemonic: () => Promise<Uint8Array>
    getRandomMnemonicWords: (count: number) => Promise<MnemonicWordAtPosition[]>
}
