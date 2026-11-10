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
import {
    useSigningRequest,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import {
    LONG_ADDRESS_LENGTH,
    truncateAlgorandAddress,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import type { ReviewWarningItem } from '../../components/ReviewWarningsBanner'

export type UseTransactionReviewLayoutResult = {
    warningItems: ReviewWarningItem[]
}

/** The chain's own warnings, behind the one that says the request replaces an earlier transaction. */
export const useTransactionReviewLayout = (
    warnings?: readonly ReviewWarningItem[],
): UseTransactionReviewLayoutResult => {
    const { t } = useLanguage()
    const { currentRequest } = useSigningRequest()
    const replacesTxId = (currentRequest as Optional<TransactionSignRequest>)
        ?.replacesTxId

    const warningItems = useMemo(() => {
        const items = [...(warnings ?? [])]
        if (!replacesTxId) return items
        return [
            {
                id: 'signing_replaces_notice',
                message: t('transactions.replacement.review_notice', {
                    txId: truncateAlgorandAddress(
                        replacesTxId,
                        LONG_ADDRESS_LENGTH,
                    ),
                }),
                isHighRisk: false,
            },
            ...items,
        ]
    }, [warnings, replacesTxId, t])

    return { warningItems }
}
