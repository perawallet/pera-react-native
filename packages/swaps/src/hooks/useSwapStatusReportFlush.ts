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
import { logger } from '@perawallet/wallet-core-shared'
import { updateSwapStatus } from '../api/swaps/endpoints'
import { useSwapStatusReportStore } from '../store/swapStatusReportStore'

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
            for (const report of useSwapStatusReportStore.getState().reports) {
                try {
                    await updateSwapStatus(report.swapId, report.data, network)
                } catch (error) {
                    // A transport failure keeps the report queued; the next
                    // online edge retries it.
                    logger.warn('swap status report flush failed', { error })
                    continue
                }
                useSwapStatusReportStore
                    .getState()
                    .removeReport(report.swapId, report.data.status)
            }
        } finally {
            isFlushingRef.current = false
        }
    }, [network])

    useEffect(() => {
        void flush()
        return onlineManager.subscribe(isOnline => {
            if (isOnline) void flush()
        })
    }, [flush])
}
