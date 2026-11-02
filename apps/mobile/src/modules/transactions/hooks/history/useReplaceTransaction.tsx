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
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import {
    useBlockingGapQuery,
    useFillNonceGapMutation,
    useReplaceableTransactionQuery,
    useReplaceTransactionMutation,
} from '@perawallet/wallet-core-transactions'
import { useErrorToast } from '@hooks/useErrorToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    ReplaceTransactionContent,
    type ReplaceTransactionResult,
} from '../../components/ReplaceTransactionContent'

export type UseReplaceTransactionResult = {
    /** The record is a pending transaction this wallet can speed up or cancel. */
    canReplace: boolean
    /** The record waits on an earlier transaction that never reached the network. */
    isBlocked: boolean
    /** Asks speed up, cancel or (when blocked) unblock, then queues the pick for review. */
    handleReplace: () => Promise<void>
}

export const useReplaceTransaction = (
    record?: TransactionRecord,
): UseReplaceTransactionResult => {
    const { showError } = useErrorToast()
    const { request: requestBottomSheet } = useBottomSheet()
    const { isReplaceable } = useReplaceableTransactionQuery(record)
    const { replace } = useReplaceTransactionMutation()
    const { isBlocked } = useBlockingGapQuery(record)
    const { fill } = useFillNonceGapMutation()

    const handleReplace = useCallback(async () => {
        if (!record) return
        const result = await requestBottomSheet<ReplaceTransactionResult>({
            contents: <ReplaceTransactionContent isBlocked={isBlocked} />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!result) return
        const { scope, id: txId } = record
        try {
            await (result.kind === 'unblock'
                ? fill({ scope, txId })
                : replace({ scope, txId, kind: result.kind }))
        } catch (error) {
            showError(error)
        }
    }, [fill, isBlocked, record, replace, requestBottomSheet, showError])

    return { canReplace: isReplaceable, isBlocked, handleReplace }
}
