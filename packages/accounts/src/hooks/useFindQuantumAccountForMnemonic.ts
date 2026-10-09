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

import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { accountsAdapterFor, requireSingleKeyAccounts } from '../chain-adapter'

/**
 * Before a standard 25-word import: the on-chain quantum account the same
 * words control, if the standard account has no footprint of its own. A
 * quantum passphrase is also 25 words, so without this the standard flow
 * silently mints an empty account from someone's quantum passphrase.
 */
export const useFindQuantumAccountForMnemonic = () => {
    const { network } = useNetwork()

    return async (
        /** Wordlist indices; the caller zeroes them. */
        mnemonicIndices: Uint16Array,
    ): Promise<Nullable<string>> =>
        requireSingleKeyAccounts(
            accountsAdapterFor(network),
        ).findQuantumAccountForMnemonic(
            mnemonicIndices,
            scopeForLegacyNetwork(network),
        )
}
