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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '../models'
import { useAccountsStore } from '../store'
import { chainAccountOf } from '../credentials/accessors'
import { otherRegisteredChainIds } from './accountChainEntries'

/**
 * What accounts are ranked and summed by: `native` while every account values
 * in `homeChainId`'s native asset, `fiat` once one also values in another
 * registered chain's, since amounts of two native assets don't compare.
 */
export type AccountValueBasis = 'native' | 'fiat'

export const accountValueBasisOf = (
    accounts: readonly WalletAccount[],
    homeChainId: ChainId,
): AccountValueBasis => {
    const others = otherRegisteredChainIds(homeChainId)
    const isOnOtherChain = accounts.some(account =>
        others.some(chainId => chainAccountOf(account, chainId) !== undefined),
    )
    return isOnOtherChain ? 'fiat' : 'native'
}

/**
 * Wallet-wide rather than per list, so every list and the portfolio header
 * agree. Registration is fixed at bootstrap, so only the accounts can change
 * the answer.
 */
export const useAccountValueBasis = (
    homeChainId: ChainId,
): AccountValueBasis => {
    const accounts = useAccountsStore(state => state.accounts)
    return useMemo(
        () => accountValueBasisOf(accounts, homeChainId),
        [accounts, homeChainId],
    )
}
