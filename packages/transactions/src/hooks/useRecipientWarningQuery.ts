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

import { skipToken, useQuery } from '@tanstack/react-query'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    transferChainAdapters,
    type ChainNotice,
    type RecipientWarningInput,
} from '../transfer-adapter'
import { MODULE_PREFIX, transactionQueryKeys } from './querykeys'

// Matches the on-chain account-state window: the send flow remounts the
// confirmation screen several times back-to-back.
const RECIPIENT_WARNING_STALE_TIME_MS = 15_000

export type UseRecipientWarningQueryResult = {
    data: Optional<ChainNotice>
    isPending: boolean
}

export const useRecipientWarningQuery = (
    input: Optional<RecipientWarningInput>,
): UseRecipientWarningQueryResult => {
    const adapter =
        input && transferChainAdapters.has(input.scope.chainId)
            ? transferChainAdapters.get(input.scope.chainId)
            : undefined
    const isEnabled = !!input && !!adapter?.recipientWarning

    const query = useQuery({
        queryKey: input
            ? transactionQueryKeys.recipientWarning(
                  input.recipient,
                  input.asset,
                  input.scope,
                  input.amount,
              )
            : [MODULE_PREFIX, 'recipient-warning'],
        // TanStack rejects `undefined` data, so "no warning" travels as null.
        queryFn:
            input && adapter?.recipientWarning
                ? async () => (await adapter.recipientWarning?.(input)) ?? null
                : skipToken,
        staleTime: RECIPIENT_WARNING_STALE_TIME_MS,
    })

    return {
        data: query.data ?? undefined,
        // TanStack reports a skipped query as pending.
        isPending: isEnabled && query.isPending,
    }
}
