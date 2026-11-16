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

import { useMemo } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSwapSourceChainsResolver } from '@perawallet/wallet-core-swaps'

/** The chains `account` can pay a swap from. */
export const useSwapSourceChains = (
    account: Nullable<WalletAccount>,
): ChainId[] => {
    const sourceChainsOf = useSwapSourceChainsResolver()
    return useMemo(
        () => (account ? sourceChainsOf(account) : []),
        [account, sourceChainsOf],
    )
}
