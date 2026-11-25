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

import { queryOptions, useQueries, useQueryClient } from '@tanstack/react-query'
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

/** The longest Confirm can wait for the sender's history. */
export const TRUSTED_COUNTERPARTIES_DEADLINE_MS = 10_000

export type UseTrustedCounterpartiesQueryResult = {
    data: TrustedCounterparty[]
    /** Only the sender's history; the other accounts' arrive when they do. */
    isPending: boolean
    /** False when the sender's history failed, timed out or waits offline. */
    hasSenderHistory: boolean
}

type TrustedCounterpartyRead = {
    counterparties: TrustedCounterparty[]
    isTimedOut: boolean
}

// History only grows, so a timed-out refetch must not forget a payee an
// earlier, fuller read found.
const unionCounterparties = (
    previous: TrustedCounterparty[],
    partial: TrustedCounterparty[],
): TrustedCounterparty[] => {
    const hasBeenPaid = new Map(previous.map(c => [c.address, c.hasBeenPaid]))
    for (const { address, hasBeenPaid: paid } of partial) {
        hasBeenPaid.set(address, (hasBeenPaid.get(address) ?? false) || paid)
    }
    return [...hasBeenPaid].map(([address, paid]) => ({
        address,
        hasBeenPaid: paid,
    }))
}

// The race releases Confirm even while page valuation is still in flight.
const withDeadline = async (
    read: (
        signal: AbortSignal,
        onPage: (counterparties: TrustedCounterparty[]) => void,
    ) => Promise<TrustedCounterparty[]>,
    querySignal: AbortSignal,
    previous: TrustedCounterparty[],
): Promise<TrustedCounterpartyRead> => {
    querySignal.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort()
    querySignal.addEventListener('abort', abort)
    let partial: Optional<TrustedCounterparty[]>
    let timer: Optional<ReturnType<typeof setTimeout>>
    const deadline = new Promise<TrustedCounterpartyRead>((resolve, reject) => {
        timer = setTimeout(() => {
            if (partial === undefined) {
                reject(new Error('Trusted counterparty lookup timed out'))
            } else {
                resolve({
                    counterparties: unionCounterparties(previous, partial),
                    isTimedOut: true,
                })
            }
            controller.abort()
        }, TRUSTED_COUNTERPARTIES_DEADLINE_MS)
    })
    try {
        const result = read(controller.signal, counterparties => {
            partial = counterparties
        }).then(counterparties => ({ counterparties, isTimedOut: false }))
        return await Promise.race([result, deadline])
    } finally {
        clearTimeout(timer)
        querySignal.removeEventListener('abort', abort)
    }
}

export const useTrustedCounterpartiesQuery = ({
    senderAddress,
    accountAddresses,
    scope,
    isEnabled = true,
}: {
    senderAddress: Optional<string>
    accountAddresses: readonly string[]
    /** Undefined reads no history. */
    scope: Optional<ChainScope>
    isEnabled?: boolean
}): UseTrustedCounterpartiesQueryResult => {
    const queryClient = useQueryClient()
    const codec =
        scope && addressCodecs.has(scope.chainId)
            ? addressCodecs.get(scope.chainId)
            : undefined
    const isSender = (address: string) =>
        !!senderAddress && !!codec?.areEqual(address, senderAddress)

    const readAddresses = scope ? accountAddresses : []
    const queries = scope
        ? readAddresses.map(accountAddress => {
              const queryKey = transactionQueryKeys.trustedCounterparties(
                  accountAddress,
                  scope,
              )
              return queryOptions({
                  queryKey,
                  queryFn: ({ signal }: { signal: AbortSignal }) =>
                      withDeadline(
                          (deadlineSignal, onPage) =>
                              fetchTrustedCounterparties({
                                  accountAddress,
                                  scope,
                                  signal: deadlineSignal,
                                  onPage,
                              }),
                          signal,
                          queryClient.getQueryData<TrustedCounterpartyRead>(
                              queryKey,
                          )?.counterparties ?? [],
                      ),
                  staleTime: query =>
                      query.state.data?.isTimedOut
                          ? 0
                          : TRUSTED_COUNTERPARTIES_STALE_TIME_MS,
                  enabled: isEnabled,
                  retry: false,
              })
          })
        : []

    return useQueries({
        queries,
        // Only the sender's own history holds Confirm. A partial read can
        // identify known payees without claiming their history finished.
        combine: results => {
            const sender = results.find((_, index) =>
                isSender(readAddresses[index]),
            )
            return {
                data: results.flatMap(
                    result => result.data?.counterparties ?? [],
                ),
                isPending:
                    isEnabled &&
                    !!sender &&
                    sender.isPending &&
                    !sender.isPaused,
                hasSenderHistory:
                    !!sender?.isSuccess && !sender.data.isTimedOut,
            }
        },
    })
}
