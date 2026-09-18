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

import { useCallback, useEffect, useRef } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isTransientNetworkError, logger } from '@perawallet/wallet-core-shared'
import { updateSwapStatus } from '../api/swaps/endpoints'
import {
    useSwapStatusReportStore,
    type PendingSwapStatusReport,
} from '../store/swapStatusReportStore'

const reportAttemptKey = (report: PendingSwapStatusReport): string =>
    `${report.swapId}|${report.data.status}|${report.queuedAt}`

/**
 * Drains the persisted swap-status report queue whenever the network is up.
 *
 * Runs outside any component's render intent — the queue may hold reports
 * for swaps no screen is currently showing — so it calls `updateSwapStatus`
 * directly rather than going through `useUpdateSwapStatusMutation`.
 */
export const useSwapStatusReportFlush = (): void => {
    const { network } = useNetwork()
    const isFlushingRef = useRef(false)

    const flush = useCallback(async () => {
        // onlineManager.isOnline is a method, not a property.
        if (isFlushingRef.current || !onlineManager.isOnline()) return
        isFlushingRef.current = true
        try {
            // Re-read the store on every iteration (not a single frozen
            // snapshot) so a report enqueued mid-flush is delivered in this
            // same pass rather than waiting for the next online edge. Each
            // entry is attempted at most once per pass — tracked by identity
            // (swapId+status+queuedAt) — so a send that fails this pass isn't
            // retried until the pass loops back around via another trigger.
            const attempted = new Set<string>()
            for (;;) {
                const report = useSwapStatusReportStore
                    .getState()
                    .reports.find(
                        candidate =>
                            !attempted.has(reportAttemptKey(candidate)),
                    )
                if (!report) break
                attempted.add(reportAttemptKey(report))

                try {
                    await updateSwapStatus(report.swapId, report.data, network)
                } catch (error) {
                    if (isTransientNetworkError(error)) {
                        // A transport failure keeps the report queued; the
                        // next online edge retries it.
                        logger.warn('swap status report flush failed', {
                            error,
                        })
                        continue
                    }
                    // Non-transient (e.g. a 4xx): the backend will never
                    // accept this payload, so retrying it forever would just
                    // make it a permanent no-op. Drop it.
                    logger.warn('swap status report dropped (non-retryable)', {
                        error,
                    })
                    useSwapStatusReportStore
                        .getState()
                        .removeReport(
                            report.swapId,
                            report.data.status,
                            report.queuedAt,
                        )
                    continue
                }
                useSwapStatusReportStore
                    .getState()
                    .removeReport(
                        report.swapId,
                        report.data.status,
                        report.queuedAt,
                    )
            }
        } finally {
            isFlushingRef.current = false
        }
    }, [network])

    useEffect(() => {
        void flush()
        const unsubscribeOnline = onlineManager.subscribe(isOnline => {
            if (isOnline) void flush()
        })
        const unsubscribeQueue = useSwapStatusReportStore.subscribe(
            (state, previous) => {
                // Only a growing queue is a new enqueue; the flush's own
                // removals shrink it, so this cannot recurse through them.
                if (state.reports.length > previous.reports.length) void flush()
            },
        )
        return () => {
            unsubscribeOnline()
            unsubscribeQueue()
        }
    }, [flush])
}
