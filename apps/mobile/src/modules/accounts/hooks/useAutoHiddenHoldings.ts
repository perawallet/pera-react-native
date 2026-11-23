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
    receivesUnaskedAssets,
    useAccountAssetsQuery,
    useAccountHoldingSources,
    type AccountHoldingsLiteRow,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { useSelectedNetworkSource } from './useSelectedNetworkSource'

const AUTO_HIDDEN = {
    sortMode: 'alphabeticalAsc',
    filters: { hideNfts: true, onlyAutoHidden: true },
} as const

export type UseAutoHiddenHoldingsResult = {
    holdings: AccountHoldingsLiteRow[]
    isPending: boolean
    /** More than one network is read, so each row draws its network. */
    showsNetwork: boolean
}

/** The suspicious tokens the asset list leaves out, on the network it shows. */
export const useAutoHiddenHoldings = (
    account: Maybe<WalletAccount>,
): UseAutoHiddenHoldingsResult => {
    const accountSources = useAccountHoldingSources(account)
    const selected = useSelectedNetworkSource(accountSources)
    const sources = useMemo(
        () =>
            (selected ? [selected] : accountSources).filter(({ scope }) =>
                receivesUnaskedAssets(scope.chainId),
            ),
        [accountSources, selected],
    )
    const { holdings, isPending } = useAccountAssetsQuery(sources, AUTO_HIDDEN)
    return { holdings, isPending, showsNetwork: sources.length > 1 }
}
