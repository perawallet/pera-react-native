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

import { fromSeed } from '@algorandfoundation/xhd-wallet-api'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { generateHDMasterKey } from './hdwallet-utils'
import { zeroBytes } from './secure-memory'

export type PreparedHDMasterKey = {
    keyId: string
    rootKey: Uint8Array
    entropy: Uint8Array
}

/**
 * Pure in-memory HD master-key derivation. Computes the BIP39 seed, the
 * XHD root key (96 bytes: kL || kR || chainCode), and the BIP39 entropy.
 * Nothing is written to the keystore — caller decides when to persist.
 *
 * The mnemonic is index-native end to end: it arrives as wordlist indices
 * (`mnemonicWordsToIndices`) and is never returned — JS strings can't be
 * zeroed, so exposing the phrase here would leave it reachable on the heap
 * for the lifetime of the returned object. Callers that need the words can
 * rebuild them from `entropy` via `entropyToIndices` at the call site.
 */
export const prepareHDMasterKey = async (params?: {
    id?: string
    mnemonicIndices?: Uint16Array
}): Promise<PreparedHDMasterKey> => {
    const keyId = params?.id ?? generateOrderedUniqueId()
    const masterKey = await generateHDMasterKey(params?.mnemonicIndices)

    let rootKey: Uint8Array
    try {
        rootKey = fromSeed(masterKey.seed)
    } finally {
        // Wipe the BIP39 seed unconditionally — if `fromSeed` throws, the seed
        // would otherwise stay resident on the heap until GC.
        zeroBytes(masterKey.seed)
    }

    return {
        keyId,
        rootKey,
        entropy: masterKey.entropy,
    }
}
