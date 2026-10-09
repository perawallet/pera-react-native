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
    isQuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { resolvePQSigningInfo } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { deriveQuantumAddress } from '../blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { quantumNative, storedQuantumPublicKey } from './quantum'

/**
 * Records the public key on a quantum account minted before it was stored, so
 * the extension's offscreen document, which can't open the keystore, can read
 * it from the synced accounts store. Algorand's `backfillRecord`.
 */
export const withStoredQuantumPublicKey = (
    account: WalletAccount,
): WalletAccount => {
    if (!isQuantumAccount(account) || storedQuantumPublicKey(account)) {
        return account
    }
    const entry = chainAccountOf(account, ALGORAND_CHAIN_ID)
    if (!entry) return account
    try {
        const info = resolvePQSigningInfo(
            getKeystoreStore().state.keys,
            account.keyPairId,
        )
        if (
            !info ||
            deriveQuantumAddress(info.publicKey, info.schemeId) !==
                entry.address
        ) {
            return account
        }
        return {
            ...account,
            chains: {
                ...account.chains,
                [ALGORAND_CHAIN_ID]: {
                    ...entry,
                    native: quantumNative(info.publicKey, entry.native),
                },
            },
        }
    } catch (error) {
        logger.warn('Could not store a quantum account public key', { error })
        return account
    }
}
