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

import {
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainAccountNative } from '@perawallet/wallet-core-chain-contract'
import type { QuantumChainDerivation } from '@perawallet/wallet-core-kms'
import {
    decodeFromBase64,
    encodeToBase64,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { derivePQKeygenSeed, deriveQuantumAddress } from '../blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'

export const algorandQuantumDerivation: QuantumChainDerivation = {
    deriveKeygenSeed: entropy => derivePQKeygenSeed(entropy),
    addressFromPublicKey: publicKey => deriveQuantumAddress(publicKey),
}

/** The chain entry's `native` for a quantum account minted from `publicKey`. */
export const quantumNative = (
    publicKey: Uint8Array,
    existing?: ChainAccountNative,
): ChainAccountNative => ({
    ...existing,
    family: 'algorand',
    pq: { scheme: 'falcon-1024', publicKey: encodeToBase64(publicKey) },
})

/**
 * The account's stored post-quantum public key, or `null`. The record sits in
 * plaintext storage, so a key that doesn't derive the account's own address is
 * ignored rather than trusted.
 */
export const storedQuantumPublicKey = (
    account: WalletAccount,
): Nullable<Uint8Array> => {
    const entry = chainAccountOf(account, ALGORAND_CHAIN_ID)
    const stored = entry?.native?.pq
    if (!entry || !stored) return null
    try {
        const publicKey = decodeFromBase64(stored.publicKey)
        return deriveQuantumAddress(publicKey) === entry.address
            ? publicKey
            : null
    } catch {
        return null
    }
}
