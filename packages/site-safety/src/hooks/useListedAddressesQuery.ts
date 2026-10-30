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

import { useCallback, useMemo } from 'react'
import { useQuery, type Query } from '@tanstack/react-query'
import type { Optional } from '@perawallet/wallet-core-shared'
import { toListedAddressKey } from '../addresses'
import { findPhishingListedAddresses } from '../listedAddresses'
import { selectActiveGenerations, usePhishingListStore } from '../store/store'
import { siteSafetyQueryKeys } from './querykeys'

export type UseListedAddressesQueryParams = {
    addresses: readonly string[]
    isEnabled?: boolean
}

export type UseListedAddressesQueryResult = {
    isListed: (address: string) => boolean
    isChecking: boolean
}

const NONE: readonly string[] = []

type ListedAddressesKey = ReturnType<typeof siteSafetyQueryKeys.listedAddresses>

// A new copy of the lists re-checks the same addresses in milliseconds; keeping
// the last answer meanwhile stops an open review's warning and slider flickering.
// Other addresses never inherit it, or a new request could read as unlisted.
const keepAnswerForSameAddresses =
    (keys: readonly string[]) =>
    (
        previous: Optional<string[]>,
        previousQuery: Optional<
            Query<string[], Error, string[], ListedAddressesKey>
        >,
    ): Optional<string[]> =>
        previousQuery?.queryKey[2].keys.join('\n') === keys.join('\n')
            ? previous
            : undefined

export const useListedAddressesQuery = ({
    addresses,
    isEnabled = true,
}: UseListedAddressesQueryParams): UseListedAddressesQueryResult => {
    const sources = usePhishingListStore(state => state.sources)
    const generations = useMemo(
        () => selectActiveGenerations({ sources }),
        [sources],
    )
    // Keyed on the joined text: callers pass a fresh array every render.
    const addressesKey = addresses.join('\n')
    const keys = useMemo(
        () =>
            [
                ...new Set(
                    addressesKey
                        .split('\n')
                        .filter(address => address.length > 0)
                        .map(toListedAddressKey),
                ),
            ].sort(),
        [addressesKey],
    )
    const isQueryEnabled = isEnabled && keys.length > 0

    const query = useQuery({
        queryKey: siteSafetyQueryKeys.listedAddresses(keys, generations),
        queryFn: () => findPhishingListedAddresses(keys),
        enabled: isQueryEnabled,
        placeholderData: keepAnswerForSameAddresses(keys),
        // Local only: it must answer offline, where the default mode pauses.
        networkMode: 'always',
    })

    const listed = useMemo(() => new Set(query.data ?? NONE), [query.data])
    const isListed = useCallback(
        (address: string) => listed.has(toListedAddressKey(address)),
        [listed],
    )

    return {
        isListed,
        isChecking: isQueryEnabled && query.isPending,
    }
}
