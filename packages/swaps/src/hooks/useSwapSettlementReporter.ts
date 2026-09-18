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
import { logger } from '@perawallet/wallet-core-shared'
import {
    getSubmissionAttemptsByTxIds,
    setSubmissionSettledHandler,
} from '@perawallet/wallet-core-signing'
import { useSwapStatusReportStore } from '../store/swapStatusReportStore'

/**
 * Reports a terminal `failed` swap status once the submission ledger's
 * reconciler settles an attempt it couldn't verify at submit time.
 *
 * The inline swap flow queues `in_progress` at submit time (never a
 * definitive verdict — see the cosign resolver's analogous handler for why).
 * `confirmed` needs no action: that `in_progress` report already told the
 * backend the swap is proceeding. `failed` needs a follow-up so the swap
 * doesn't sit `in_progress` forever.
 *
 * The handler must never throw: the reconciler notifies it *before*
 * resolving the row, so a throw leaves that row open forever and wedges a
 * swap the reconciler would otherwise be able to settle.
 */
export const useSwapSettlementReporter = (): void => {
    useEffect(() => {
        setSubmissionSettledHandler('swap', async (txIds, _network, status) => {
            if (status !== 'failed') return
            try {
                const rows = await getSubmissionAttemptsByTxIds({ txIds })
                const intentKey = rows.find(
                    row => row.intentKey?.kind === 'swap',
                )?.intentKey

                if (!intentKey || intentKey.kind !== 'swap') return

                useSwapStatusReportStore.getState().enqueueReport({
                    swapId: intentKey.swapId,
                    data: {
                        status: 'failed',
                        reason: 'blockchain_error',
                        swap_version: 'v2',
                    },
                })
            } catch (error) {
                logger.warn('swap settlement reporter: lookup failed', {
                    error,
                })
            }
        })
        return () => setSubmissionSettledHandler('swap', null)
    }, [])
}
