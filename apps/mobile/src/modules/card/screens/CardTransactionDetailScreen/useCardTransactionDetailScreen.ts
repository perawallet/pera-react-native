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

import { useCallback, useEffect, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    type CardTransaction,
    useCardTransactionsQuery,
} from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { trackEvent, CardEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useSendEmail } from '@hooks/useSendEmail'
import type { PeraCardAccountStackParamList } from '../../routes/types'
import { formatCardTransactionDateTime } from '../../utils/cardTransactions'

type UseCardTransactionDetailScreenResult = {
    transaction: CardTransaction | undefined
    /** True while any fetch that could still surface the row is in flight. */
    isLoading: boolean
    isError: boolean
    handleRetry: () => void
    /** Opens the mail composer prefilled for the Baanx support inbox. */
    onReportTransaction: () => void
}

export const useCardTransactionDetailScreen =
    (): UseCardTransactionDetailScreenResult => {
        const route =
            useRoute<
                RouteProp<
                    PeraCardAccountStackParamList,
                    'CardTransactionDetail'
                >
            >()
        // Guarded: a params-less navigate should land on the not-found state,
        // not crash on the destructure.
        const id = route.params?.id
        const { t } = useLanguage()
        const { sendEmail } = useSendEmail()

        // Baanx has no detail endpoint; the row comes from the cached list
        // query (same unfiltered key the list and overview use). The screen
        // only reads the cache, so skip the stale-mount refetch — it would
        // replay every loaded page for no new data.
        const {
            transactions,
            isError,
            isFetching,
            hasNextPage,
            fetchNextPage,
            refetch,
        } = useCardTransactionsQuery(undefined, { refetchOnMount: false })

        const transaction = useMemo(
            () => transactions.find(item => item.id === id),
            [transactions, id],
        )

        // On a cold cache the query holds page 0 only; keep paginating until
        // the row appears or the pages run out, so "not found" is a real
        // answer rather than an artifact of how far the list had scrolled.
        useEffect(() => {
            if (transaction || !hasNextPage || isFetching || isError) return
            void fetchNextPage()
        }, [transaction, hasNextPage, isFetching, isError, fetchNextPage])

        const handleRetry = useCallback(() => {
            void refetch()
        }, [refetch])

        const onReportTransaction = useCallback(() => {
            if (!transaction) return
            trackEvent(CardEvent.TransactionsReportTx)

            // Support needs the processor reference; fall back to our row id.
            const reportedId = transaction.transactionId || transaction.id
            sendEmail({
                to: config.cardSupportEmail,
                subject: t('peraCard.transactions.report_email_subject', {
                    transactionId: reportedId,
                }),
                body: t('peraCard.transactions.report_email_body', {
                    transactionId: reportedId,
                    processedOn: formatCardTransactionDateTime(
                        transaction.dateTime,
                    ),
                    merchantName: transaction.merchantName?.trim() || '-',
                }),
            })
        }, [t, transaction, sendEmail])

        return {
            transaction,
            // Any in-flight fetch (initial load, retry, auto-pagination) can
            // still produce the row — show loading, not a premature verdict.
            isLoading: !transaction && isFetching,
            isError,
            handleRetry,
            onReportTransaction,
        }
    }
