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
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { WalletAccount } from '../models'

/**
 * What accounts are ranked and summed by: `native` while every account values
 * in ALGO, `fiat` once one values in another chain's native asset, since ALGO
 * and ETH amounts don't compare.
 */
export type AccountValueBasis = 'native' | 'fiat'

export const accountValueBasisOf = (
    accounts: readonly WalletAccount[],
): AccountValueBasis => {
    const { chains } = getProvider()
    if (chains.list().length < 2) return 'native'
    const hasOtherChain = accounts.some(account =>
        (Object.keys(account.chains) as ChainId[]).some(
            chainId => chainId !== LEGACY_CHAIN_ID && chains.has(chainId),
        ),
    )
    return hasOtherChain ? 'fiat' : 'native'
}

/** Registration is fixed at bootstrap, so only the accounts can change the answer. */
export const useAccountValueBasis = (
    accounts: readonly WalletAccount[],
): AccountValueBasis => useMemo(() => accountValueBasisOf(accounts), [accounts])
