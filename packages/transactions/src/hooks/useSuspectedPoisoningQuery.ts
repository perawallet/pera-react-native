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
import { useQuery } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import {
    detectSuspectedPoisoning,
    findImitatedAddress,
    type KnownAddress,
    type SuspectableEntry,
    type SuspectedPoisoning,
} from '../address-safety'
import { transactionQueryKeys } from './querykeys'

const SUSPECTED_POISONING_STALE_TIME_MS = 10 * 60_000

export type UseSuspectedPoisoningQueryResult = {
    /** Keyed by transaction id. */
    data: ReadonlyMap<string, SuspectedPoisoning>
}

const EMPTY: ReadonlyMap<string, SuspectedPoisoning> = new Map()

export const useSuspectedPoisoningQuery = ({
    entries,
    accountAddress,
    scope,
    knownAddresses,
    isEnabled = true,
}: {
    entries: readonly SuspectableEntry[]
    accountAddress: Optional<string>
    scope: ChainScope
    knownAddresses: readonly KnownAddress[]
    isEnabled?: boolean
}): UseSuspectedPoisoningQueryResult => {
    // Resemblance needs no lookups, so only the few look-alikes reach the
    // query, and its key changes when the known set does.
    const { candidates, candidateKeys } = useMemo(() => {
        if (!accountAddress || !isEnabled || knownAddresses.length === 0) {
            return { candidates: [], candidateKeys: [] }
        }
        const pairs = entries.flatMap(entry => {
            const imitates = findImitatedAddress({
                entry,
                accountAddress,
                chainId: scope.chainId,
                knownAddresses,
            })
            return imitates
                ? [{ entry, key: `${entry.id}:${imitates.address}` }]
                : []
        })
        return {
            candidates: pairs.map(({ entry }) => entry),
            candidateKeys: pairs.map(({ key }) => key).sort(),
        }
    }, [entries, accountAddress, scope.chainId, knownAddresses, isEnabled])

    const { data } = useQuery({
        queryKey: transactionQueryKeys.suspectedPoisoning(
            accountAddress ?? '',
            scope,
            candidateKeys,
        ),
        // Rethrown, not returned as `[]`: a cached clean result would hide every
        // marker for the whole stale time, whereas an error keeps the last good data.
        queryFn: async () => {
            try {
                return await detectSuspectedPoisoning({
                    entries: candidates,
                    accountAddress: accountAddress ?? '',
                    scope,
                    knownAddresses,
                })
            } catch (error) {
                logger.warn('Could not check history for address poisoning', {
                    error,
                })
                throw error
            }
        },
        enabled: candidates.length > 0,
        staleTime: SUSPECTED_POISONING_STALE_TIME_MS,
        retry: false,
    })

    // The query holds an array: persisted query data can't carry a Map.
    const byId = useMemo(
        () =>
            data && data.length > 0
                ? new Map(data.map(entry => [entry.transactionId, entry]))
                : EMPTY,
        [data],
    )

    return { data: candidates.length > 0 ? byId : EMPTY }
}
