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

import { useEffect } from 'react'
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    getReplaceableSubmissionAttempt,
    subscribeToSubmissionLedger,
} from '@perawallet/wallet-core-signing'
import { transferChainAdapters } from '../transfer-adapter'
import { getBlockingGapQueryKey, MODULE_PREFIX } from './querykeys'

export type UseBlockingGapQueryResult = {
    /** The pending transaction waits on an earlier sequence number nothing holds. */
    isBlocked: boolean
}

export const useBlockingGapQuery = (
    record?: TransactionRecord,
): UseBlockingGapQueryResult => {
    const queryClient = useQueryClient()
    const isEnabled =
        record?.status === 'pending' &&
        getChainDescriptor(record.scope.chainId).protocol.supportsReplacement
    const queryKey = record
        ? getBlockingGapQueryKey(record.scope, record.id)
        : ([MODULE_PREFIX, 'blocking-gap'] as const)

    const query = useQuery({
        queryKey,
        queryFn:
            isEnabled && record
                ? async () => {
                      const attempt = await getReplaceableSubmissionAttempt({
                          scope: record.scope,
                          txId: record.id,
                      })
                      const { findBlockingGap } = transferChainAdapters.get(
                          record.scope.chainId,
                      )
                      if (!attempt || !findBlockingGap) return null
                      return findBlockingGap(
                          { rawTransaction: attempt.rawTransaction },
                          { scope: record.scope },
                      )
                  }
                : skipToken,
    })

    // The reconciler settling the earlier send failed is what opens the gap.
    const scope = record?.scope
    const txId = record?.id
    useEffect(() => {
        if (!isEnabled || !scope || txId === undefined) return
        return subscribeToSubmissionLedger(() => {
            void queryClient.invalidateQueries({
                queryKey: getBlockingGapQueryKey(scope, txId),
            })
        })
    }, [isEnabled, queryClient, scope, txId])

    return { isBlocked: isEnabled && query.data != null }
}
