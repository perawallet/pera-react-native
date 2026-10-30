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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { fetchHoldingAcquisitionOrder } from '../chain-adapter'
import { getHoldingAcquisitionOrderQueryKey } from './querykeys'

// The order only changes when holdings change, and every sync tick already
// invalidates this key; the window just bounds redundant refetches in between.
const ACQUISITION_ORDER_STALE_TIME_MS = 60_000

// Shared fallback so a loading/disabled result keeps a stable reference and
// doesn't churn consumers' memos.
const EMPTY_ACQUISITION_ORDER: ReadonlyMap<string, number> = new Map()

export type UseHoldingAcquisitionOrderQueryResult = {
    /** When each held asset was acquired, keyed by asset id; higher means later. */
    acquisitionOrder: ReadonlyMap<string, number>
    isPending: boolean
}

export const useHoldingAcquisitionOrderQuery = (
    address: Optional<string>,
    scope: ChainScope,
    enabled = true,
): UseHoldingAcquisitionOrderQueryResult => {
    const canManageAssets = useChainCapability(scope.chainId, 'manageAssets')
    const { data, isPending, isFetching } = useQuery({
        queryKey: getHoldingAcquisitionOrderQueryKey(address ?? '', scope),
        queryFn: () => fetchHoldingAcquisitionOrder(address ?? '', scope),
        enabled: !!address && enabled && canManageAssets,
        staleTime: ACQUISITION_ORDER_STALE_TIME_MS,
    })

    return {
        acquisitionOrder: data ?? EMPTY_ACQUISITION_ORDER,
        // A disabled query stays 'pending' forever in React Query v5; gate on
        // isFetching so this is only true during a live load.
        isPending: isPending && isFetching,
    }
}
