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

import { useQueries } from '@tanstack/react-query'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    fetchTrustedCounterparties,
    type TrustedCounterparty,
} from '../address-safety'
import { transactionQueryKeys } from './querykeys'

// Long enough to cover a whole send flow, which reopens its confirmation step.
const TRUSTED_COUNTERPARTIES_STALE_TIME_MS = 10 * 60_000

export type UseTrustedCounterpartiesQueryResult = {
    data: TrustedCounterparty[]
    /** Only the sender's history; the other accounts' arrive when they do. */
    isPending: boolean
}

export const useTrustedCounterpartiesQuery = ({
    senderAddress,
    accountAddresses,
    scope,
    isEnabled = true,
}: {
    senderAddress: Optional<string>
    accountAddresses: readonly string[]
    scope: ChainScope
    isEnabled?: boolean
}): UseTrustedCounterpartiesQueryResult => {
    const codec = addressCodecs.has(scope.chainId)
        ? addressCodecs.get(scope.chainId)
        : undefined
    const isSender = (address: string) =>
        !!senderAddress && !!codec?.areEqual(address, senderAddress)

    return useQueries({
        queries: accountAddresses.map(accountAddress => ({
            queryKey: transactionQueryKeys.trustedCounterparties(
                accountAddress,
                scope,
            ),
            queryFn: ({ signal }: { signal: AbortSignal }) =>
                fetchTrustedCounterparties({ accountAddress, scope, signal }),
            staleTime: TRUSTED_COUNTERPARTIES_STALE_TIME_MS,
            enabled: isEnabled,
            retry: false,
        })),
        // Only the sender's own history holds Confirm. An errored or
        // offline-paused read counts as settled with no history, and another
        // account's read can only add what it finds once it lands.
        combine: results => ({
            data: results.flatMap(result => result.data ?? []),
            isPending:
                isEnabled &&
                results.some(
                    (result, index) =>
                        isSender(accountAddresses[index]) &&
                        result.isPending &&
                        !result.isPaused,
                ),
        }),
    })
}
