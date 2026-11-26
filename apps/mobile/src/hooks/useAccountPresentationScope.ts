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
    accountsChainAdapters,
    useAccountChainId,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { useHomeChainScope } from '@hooks/useHomeChainScope'

/**
 * The scope an account's type, icon and info are read on: its own chain. A
 * stored account can outlive its chain in this build, and no adapter reads
 * it then, so it falls back to the home chain.
 */
export const useAccountPresentationScope = (
    account: Maybe<WalletAccount>,
): ChainScope => {
    const homeChainId = useHomeChainScope().chainId
    const ownChainId = useAccountChainId(account, homeChainId)
    const hasAccountsAdapter = accountsChainAdapters.has(ownChainId)
    return useSelectedScope(hasAccountsAdapter ? ownChainId : homeChainId)
}
