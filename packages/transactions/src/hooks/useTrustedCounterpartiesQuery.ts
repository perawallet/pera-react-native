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

/** Past this the read gives up and counts as failed, so Confirm never waits longer. */
export const TRUSTED_COUNTERPARTIES_DEADLINE_MS = 10_000

export type UseTrustedCounterpartiesQueryResult = {
    data: TrustedCounterparty[]
    /** Only the sender's history; the other accounts' arrive when they do. */
    isPending: boolean
    /** False when the sender's history failed, timed out or waits offline. */
    hasSenderHistory: boolean
}

// A history page has no abort of its own, so the deadline rejects at once and
// the abort stops any further pages.
const withDeadline = async <T>(
    read: (signal: AbortSignal) => Promise<T>,
    querySignal: AbortSignal,
): Promise<T> => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    querySignal.addEventListener('abort', abort)
    let timer: Optional<ReturnType<typeof setTimeout>>
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort()
            reject(new Error('Trusted counterparty lookup timed out'))
        }, TRUSTED_COUNTERPARTIES_DEADLINE_MS)
    })
    try {
        return await Promise.race([read(controller.signal), deadline])
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
    const codec =
        scope && addressCodecs.has(scope.chainId)
            ? addressCodecs.get(scope.chainId)
            : undefined
    const isSender = (address: string) =>
        !!senderAddress && !!codec?.areEqual(address, senderAddress)

    const readAddresses = scope ? accountAddresses : []
    const queries = scope
        ? readAddresses.map(accountAddress => ({
              queryKey: transactionQueryKeys.trustedCounterparties(
                  accountAddress,
                  scope,
              ),
              queryFn: ({ signal }: { signal: AbortSignal }) =>
                  withDeadline(
                      deadlineSignal =>
                          fetchTrustedCounterparties({
                              accountAddress,
                              scope,
                              signal: deadlineSignal,
                          }),
                      signal,
                  ),
              staleTime: TRUSTED_COUNTERPARTIES_STALE_TIME_MS,
              enabled: isEnabled,
              retry: false,
          }))
        : []

    return useQueries({
        queries,
        // Only the sender's own history holds Confirm. An errored, timed-out
        // or offline-paused read counts as settled with no history, and another
        // account's read can only add what it finds once it lands.
        combine: results => {
            const sender = results.find((_, index) =>
                isSender(readAddresses[index]),
            )
            return {
                data: results.flatMap(result => result.data ?? []),
                isPending:
                    isEnabled &&
                    !!sender &&
                    sender.isPending &&
                    !sender.isPaused,
                hasSenderHistory: !!sender?.isSuccess,
            }
        },
    })
}
