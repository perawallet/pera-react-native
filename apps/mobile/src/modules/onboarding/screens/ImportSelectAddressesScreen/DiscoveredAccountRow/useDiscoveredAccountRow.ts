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
    getAccountDisplayName,
    accountChainIdOf,
    chainAccountOf,
    ownAddressOf,
    useAccountHoldingSources,
    useAccountValueTotalsQuery,
    useFailedFirstReadChainIds,
    useRegisteredChainIds,
    type LocalAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    crossChainTotalOf,
    type CrossChainTotal,
} from '@components/AccountWithBalance'

export type DiscoveredAddressLine = {
    address: string
    displayAddress: string
    /** The chains holding `address`, in registry order. */
    chainIds: ChainId[]
}

export type UseDiscoveredAccountRowResult = {
    title: string
    addressLines: DiscoveredAddressLine[]
    total: CrossChainTotal
    testAddress: string
}

export const useDiscoveredAccountRow = (
    account: LocalAccount,
): UseDiscoveredAccountRowResult => {
    const registeredChainIds = useRegisteredChainIds()
    const chainId = accountChainIdOf(account, registeredChainIds)
    const scope = useSelectedScope(chainId)
    const { usdToPreferred } = useCurrency(scope)
    const sources = useAccountHoldingSources(account)
    const failedFirstReadChainIds = useFailedFirstReadChainIds(sources)
    const { accountValueTotals } = useAccountValueTotalsQuery(
        [account],
        scope,
        sources.length > 0,
    )

    const addressLines = useMemo(() => {
        const lines: DiscoveredAddressLine[] = []
        for (const id of registeredChainIds) {
            const address = chainAccountOf(account, id)?.address
            if (!address) continue
            const line = lines.find(held => held.address === address)
            if (line) {
                line.chainIds.push(id)
            } else {
                lines.push({
                    address,
                    displayAddress: addressCodecs.has(id)
                        ? addressCodecs.get(id).truncate(address)
                        : address,
                    chainIds: [id],
                })
            }
        }
        return lines
    }, [account, registeredChainIds])

    const total = useMemo(
        () =>
            crossChainTotalOf(
                sources,
                accountValueTotals,
                usdToPreferred,
                failedFirstReadChainIds,
            ),
        [sources, accountValueTotals, usdToPreferred, failedFirstReadChainIds],
    )

    return {
        title: getAccountDisplayName(account, chainId),
        addressLines,
        total,
        testAddress: ownAddressOf(account) ?? account.id,
    }
}
