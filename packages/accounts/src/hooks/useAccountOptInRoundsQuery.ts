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

import { useQuery } from '@tanstack/react-query'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { fetchAccountAssetOptInRounds } from './endpoints'
import { getAccountOptInRoundsQueryKey } from './querykeys'

// Opt-in rounds only change when holdings change, and every sync tick already
// invalidates this key; the window just bounds redundant refetches in between.
const OPT_IN_ROUNDS_STALE_TIME_MS = 60_000

// Shared fallback so a loading/disabled result keeps a stable reference and
// doesn't churn consumers' memos.
const EMPTY_OPT_IN_ROUNDS: ReadonlyMap<string, number> = new Map()

export type UseAccountOptInRoundsQueryResult = {
    /** Opt-in round per held asset, keyed by decimal asset-id string. */
    optInRounds: ReadonlyMap<string, number>
    isPending: boolean
}

export const useAccountOptInRoundsQuery = (
    address: string | undefined,
    enabled = true,
): UseAccountOptInRoundsQueryResult => {
    const { network } = useNetwork()
    const algokit = useAlgorandClient()

    const { data, isPending, isFetching } = useQuery({
        queryKey: getAccountOptInRoundsQueryKey(address ?? '', network),
        queryFn: () => fetchAccountAssetOptInRounds(algokit, address ?? ''),
        enabled: !!address && enabled,
        staleTime: OPT_IN_ROUNDS_STALE_TIME_MS,
    })

    return {
        optInRounds: data ?? EMPTY_OPT_IN_ROUNDS,
        // A disabled query stays 'pending' forever in React Query v5; gate on
        // isFetching so this is only true during a live load.
        isPending: isPending && isFetching,
    }
}
