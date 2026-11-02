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

import { useCallback } from 'react'
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import type {
    ChainScope,
    FeeEstimate,
    TransferIntent,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { transferChainAdapters } from '../transfer-adapter'
import { MODULE_PREFIX, transactionQueryKeys } from './querykeys'

// The build re-reads gas prices, so the estimate only has to be close; this
// keeps the remounting send screens from refetching it back-to-back.
const FEE_ESTIMATE_STALE_TIME_MS = 15_000

export type TransferFeeEstimateInput = {
    intent: TransferIntent
    scope: ChainScope
}

export type UseTransferFeeEstimateQueryResult = {
    /** Every preset is priced, so switching preset never refetches. */
    data: Optional<FeeEstimate>
    isPending: boolean
    /** No estimate is held: a later poll that fails behind a held one is not an error. */
    isError: boolean
    /** Re-reads now; a no-op while there is no input. */
    refresh: () => void
}

/**
 * `isLive` re-reads every 15 s while mounted, for a screen whose quote caps the send. Leave it off
 * where a fee that moved under an amount already chosen would shrink what is allowed.
 */
export const useTransferFeeEstimateQuery = (
    input: Optional<TransferFeeEstimateInput>,
    { isLive = false }: { isLive?: boolean } = {},
): UseTransferFeeEstimateQueryResult => {
    const query = useQuery({
        queryKey: input
            ? transactionQueryKeys.transferFeeEstimate(
                  input.intent.from,
                  input.intent.to,
                  input.intent.assetRef,
                  input.scope,
                  input.intent.amount,
              )
            : [MODULE_PREFIX, 'transfer-fee-estimate'],
        queryFn: input
            ? () =>
                  transferChainAdapters
                      .get(input.scope.chainId)
                      .getFeeEstimate(input.intent, { scope: input.scope })
            : skipToken,
        staleTime: FEE_ESTIMATE_STALE_TIME_MS,
        refetchInterval: isLive ? FEE_ESTIMATE_STALE_TIME_MS : false,
        // A new amount re-keys the query; keep the last price meanwhile.
        placeholderData: keepPreviousData,
    })

    const { refetch } = query
    const refresh = useCallback(() => {
        void refetch()
    }, [refetch])

    return {
        data: query.data,
        // TanStack reports a skipped query as pending.
        isPending: !!input && query.isPending,
        isError: query.isLoadingError,
        refresh,
    }
}
