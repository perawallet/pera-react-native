/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { fetchNfdSearch } from '../api'
import { nfdQueryKeys } from './querykeys'
import type { NfdSearchResult } from '../models'

export const useNfdSearchQuery = (
    name: string,
    options?: { enabled?: boolean },
): UseQueryResult<NfdSearchResult[]> => {
    const { network } = useNetwork()
    // NFD names are case-insensitive; normalize so "BruNo.aLgo" matches "bruno.algo".
    const normalizedName = name.toLowerCase()
    const enabled = (options?.enabled ?? true) && normalizedName.length > 0

    return useQuery({
        queryKey: nfdQueryKeys.search(normalizedName, network),
        queryFn: ({ signal }) =>
            fetchNfdSearch({ name: normalizedName, network, signal }),
        enabled,
    })
}
