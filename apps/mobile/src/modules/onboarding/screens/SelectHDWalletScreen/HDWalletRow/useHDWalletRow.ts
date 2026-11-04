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
import type { Decimal } from 'decimal.js'
import {
    chainAccountOf,
    useAccountValueTotalsQuery,
    useRegisteredChainIds,
    type HdSeedGroup,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { crossChainTotalOf } from '@components/AccountWithBalance'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useIsMultichain } from '@modules/accounts'

export type UseHDWalletRowResult = {
    /** Sum of the wallet's account totals across every network, in the preferred currency, test-network holdings left out. `undefined` while loading, `null` when any counted value or the rate is unknown; both render a placeholder, not 0. */
    fiatTotal: Maybe<Decimal>
    /** False when every holding is on a test network, which never counts as money: the row shows no value, as the account list does. */
    hasFiatTotal: boolean
    /** Registered chains, in registry order, that at least one of the wallet's accounts has an address on. */
    chainIds: ChainId[]
    /** More than one chain is registered; a single-chain build shows no network icons, as the wallet structure view does. */
    isMultichain: boolean
}

export const useHDWalletRow = (group: HdSeedGroup): UseHDWalletRowResult => {
    const homeScope = useHomeChainScope()
    const { usdToPreferred } = useCurrency(homeScope)
    const registeredChainIds = useRegisteredChainIds()
    const isMultichain = useIsMultichain()
    const { accountValueTotals, fiatTotalSources } = useAccountValueTotalsQuery(
        group.accounts,
        homeScope,
    )

    const total = useMemo(
        () =>
            crossChainTotalOf(
                fiatTotalSources,
                accountValueTotals,
                usdToPreferred,
            ),
        [fiatTotalSources, accountValueTotals, usdToPreferred],
    )

    const chainIds = useMemo(
        () =>
            registeredChainIds.filter(chainId =>
                group.accounts.some(account =>
                    chainAccountOf(account, chainId),
                ),
            ),
        [registeredChainIds, group.accounts],
    )

    return {
        fiatTotal: total.kind === 'fiat' ? total.value : undefined,
        hasFiatTotal: total.kind === 'fiat',
        chainIds,
        isMultichain,
    }
}
