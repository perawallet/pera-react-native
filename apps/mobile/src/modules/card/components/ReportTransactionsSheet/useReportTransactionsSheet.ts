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

import { useCallback, useState } from 'react'
import {
    useCardTransactionsQuery,
    type CardTransaction,
} from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { trackEvent, CardEvent } from '@analytics'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useSendEmail } from '@hooks/useSendEmail'

type UseReportTransactionsSheetResult = {
    transactions: CardTransaction[]
    isLoading: boolean
    isSelected: (id: string) => boolean
    onToggle: (id: string) => void
    /** True once at least one transaction is picked. */
    canReport: boolean
    onReport: () => void
    onClose: () => void
}

/**
 * Multi-select over the recent transactions; reporting opens one support
 * email listing the chosen processor transaction ids.
 */
export const useReportTransactionsSheet =
    (): UseReportTransactionsSheetResult => {
        const { t } = useLanguage()
        const { resolve, dismiss } = useBottomSheetResult<'reported'>()
        const { transactions, isLoading } = useCardTransactionsQuery()
        const { sendEmail } = useSendEmail()

        const [selectedIds, setSelectedIds] = useState<Set<string>>(
            () => new Set(),
        )

        const isSelected = useCallback(
            (id: string) => selectedIds.has(id),
            [selectedIds],
        )

        const onToggle = useCallback(
            (id: string) => {
                // Selections only — deselecting is not a tracked action.
                if (!selectedIds.has(id)) {
                    trackEvent(CardEvent.ReportSusReportTx)
                }
                setSelectedIds(previous => {
                    const next = new Set(previous)
                    if (next.has(id)) {
                        next.delete(id)
                    } else {
                        next.add(id)
                    }
                    return next
                })
            },
            [selectedIds],
        )

        const onReport = useCallback(() => {
            if (selectedIds.size === 0) return
            trackEvent(CardEvent.ReportSusCreateTicket)
            // Support needs the processor reference; fall back to our row id
            // (same rule as the single-transaction report).
            const transactionIds = transactions
                .filter(transaction => selectedIds.has(transaction.id))
                .map(transaction => transaction.transactionId || transaction.id)
            sendEmail({
                to: config.cardSupportEmail,
                subject: t(
                    'peraCard.transactions.report_transactions_email_subject',
                ),
                body: t(
                    'peraCard.transactions.report_transactions_email_body',
                    { transactionIds: transactionIds.join('\n') },
                ),
            })
            resolve('reported')
        }, [selectedIds, transactions, sendEmail, resolve, t])

        return {
            transactions,
            isLoading,
            isSelected,
            onToggle,
            canReport: selectedIds.size > 0,
            onReport,
            onClose: dismiss,
        }
    }
