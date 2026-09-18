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

import { describe, expect, it, beforeEach, vi } from 'vitest'

const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: registerStoreMock,
    }
})

import { useSwapStatusReportStore } from '../swapStatusReportStore'

describe('useSwapStatusReportStore', () => {
    beforeEach(() => {
        useSwapStatusReportStore.getState().resetState()
    })

    it('queues a report', () => {
        useSwapStatusReportStore.getState().enqueueReport({
            swapId: 'swap-1',
            data: { status: 'failed', reason: 'blockchain_error' },
        })

        expect(useSwapStatusReportStore.getState().reports).toMatchObject([
            { swapId: 'swap-1', data: { status: 'failed' } },
        ])
    })

    it('collapses a repeat of the same swap and status, keeping the newest data', () => {
        const { enqueueReport } = useSwapStatusReportStore.getState()
        enqueueReport({
            swapId: 'swap-1',
            data: { status: 'in_progress', submitted_transaction_ids: ['TX-1'] },
        })
        enqueueReport({
            swapId: 'swap-1',
            data: {
                status: 'in_progress',
                submitted_transaction_ids: ['TX-1', 'TX-2'],
            },
        })

        const { reports } = useSwapStatusReportStore.getState()
        expect(reports).toHaveLength(1)
        expect(reports[0]?.data.submitted_transaction_ids).toEqual([
            'TX-1',
            'TX-2',
        ])
    })

    it('keeps different statuses for the same swap separate', () => {
        const { enqueueReport } = useSwapStatusReportStore.getState()
        enqueueReport({ swapId: 'swap-1', data: { status: 'in_progress' } })
        enqueueReport({ swapId: 'swap-1', data: { status: 'failed' } })

        expect(useSwapStatusReportStore.getState().reports).toHaveLength(2)
    })

    it('removes a report by swap, status and queuedAt', () => {
        const { enqueueReport, removeReport } =
            useSwapStatusReportStore.getState()
        enqueueReport({ swapId: 'swap-1', data: { status: 'in_progress' } })
        enqueueReport({ swapId: 'swap-2', data: { status: 'in_progress' } })
        const [target] = useSwapStatusReportStore.getState().reports

        removeReport('swap-1', 'in_progress', target!.queuedAt)

        expect(useSwapStatusReportStore.getState().reports).toMatchObject([
            { swapId: 'swap-2' },
        ])
    })

    it('does not remove a report that was re-enqueued with newer data after the removal was requested', () => {
        // Simulates a flush in flight: it snapshots a report, the report is
        // superseded by a newer enqueue before the flush's removeReport call
        // for the old attempt lands. The old attempt must not delete the new.
        // Fake timers give deterministic, distinct `queuedAt` values instead
        // of relying on two Date.now() calls landing in different ms.
        vi.useFakeTimers()
        try {
            const { enqueueReport, removeReport } =
                useSwapStatusReportStore.getState()
            vi.setSystemTime(1_000)
            enqueueReport({ swapId: 'swap-1', data: { status: 'failed' } })
            const staleQueuedAt =
                useSwapStatusReportStore.getState().reports[0]!.queuedAt

            vi.setSystemTime(2_000)
            enqueueReport({
                swapId: 'swap-1',
                data: { status: 'failed', reason: 'blockchain_error' },
            })

            removeReport('swap-1', 'failed', staleQueuedAt)

            const { reports } = useSwapStatusReportStore.getState()
            expect(reports).toHaveLength(1)
            expect(reports[0]?.data.reason).toBe('blockchain_error')
        } finally {
            vi.useRealTimers()
        }
    })
})
