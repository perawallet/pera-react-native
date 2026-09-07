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
import { CardStatus, useCardStatusQuery } from '@perawallet/wallet-core-card'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { CardFreezeOutcome } from './useCardFreezeAction'
import { BeforeWeContinueSheet } from '../components/BeforeWeContinueSheet'
import { ReportSuspiciousActivitySheet } from '../components/ReportSuspiciousActivitySheet'
import { ReportTransactionsSheet } from '../components/ReportTransactionsSheet'

type UseReportSuspiciousFlowResult = {
    /** Opens the three-step report-suspicious flow. */
    start: () => void
}

/**
 * Chains the report-suspicious sheets: freeze intro → "before we continue" →
 * transaction selection. Only a live (ACTIVE) card gets the freeze intro; an
 * already-frozen or BLOCKED card jumps straight to "before we continue" so it's
 * never pushed through a freeze it can't take. Each step's request resolves
 * when its sheet closes, so a dismiss at any step abandons the flow. The
 * success toast fires only when the freeze step actually froze the card.
 */
export const useReportSuspiciousFlow = (): UseReportSuspiciousFlowResult => {
    const { t } = useLanguage()
    const { request } = useBottomSheet()
    const { successToast } = useToast()
    const { data: card } = useCardStatusQuery()
    const canFreeze = card?.status === CardStatus.Active

    const run = useCallback(async () => {
        // Only a live card is frozen first; a frozen/blocked card jumps
        // straight to the report.
        if (canFreeze) {
            // Pan-down / backdrop close are disabled so the sheet can't be
            // dismissed mid-freeze (which would abandon the flow while the
            // freeze still commits); the Close button drives an explicit cancel.
            const outcome = await request<CardFreezeOutcome>({
                contents: <ReportSuspiciousActivitySheet />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                },
            })
            if (!outcome) return
            // Toast only when this step actually froze the card.
            if (outcome === 'frozen') {
                successToast(
                    t('peraCard.account.report_suspicious_frozen_toast_title'),
                    '',
                )
            }
        }

        const proceed = await request<'continue'>({
            contents: <BeforeWeContinueSheet />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (proceed !== 'continue') return

        await request({
            contents: <ReportTransactionsSheet />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [canFreeze, request, successToast, t])

    const start = useCallback(() => {
        void run()
    }, [run])

    return { start }
}
