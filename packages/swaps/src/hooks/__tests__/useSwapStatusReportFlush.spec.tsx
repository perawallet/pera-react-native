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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import { useSwapStatusReportStore } from '../../store/swapStatusReportStore'
import { useSwapStatusReportFlush } from '../useSwapStatusReportFlush'

const updateSwapStatus = vi.hoisted(() => vi.fn())

vi.mock('../../api/swaps/endpoints', () => ({ updateSwapStatus }))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

describe('useSwapStatusReportFlush', () => {
    beforeEach(() => {
        updateSwapStatus.mockReset()
        useSwapStatusReportStore.getState().resetState()
        onlineManager.setOnline(true)
    })

    it('sends a queued report on mount and drops it', async () => {
        updateSwapStatus.mockResolvedValue({ status: 'in_progress' })
        useSwapStatusReportStore
            .getState()
            .enqueueReport({ swapId: 'swap-1', data: { status: 'failed' } })

        renderHook(() => useSwapStatusReportFlush())

        await waitFor(() =>
            expect(useSwapStatusReportStore.getState().reports).toHaveLength(0),
        )
        expect(updateSwapStatus).toHaveBeenCalledWith(
            'swap-1',
            { status: 'failed' },
            'mainnet',
        )
    })

    it('keeps a report the network could not deliver', async () => {
        updateSwapStatus.mockRejectedValue(new Error('offline'))
        useSwapStatusReportStore
            .getState()
            .enqueueReport({ swapId: 'swap-1', data: { status: 'failed' } })

        renderHook(() => useSwapStatusReportFlush())

        await waitFor(() => expect(updateSwapStatus).toHaveBeenCalled())
        expect(useSwapStatusReportStore.getState().reports).toHaveLength(1)
    })

    it('flushes again when connectivity returns', async () => {
        updateSwapStatus.mockRejectedValueOnce(new Error('offline'))
        useSwapStatusReportStore
            .getState()
            .enqueueReport({ swapId: 'swap-1', data: { status: 'failed' } })

        renderHook(() => useSwapStatusReportFlush())
        await waitFor(() => expect(updateSwapStatus).toHaveBeenCalledTimes(1))

        updateSwapStatus.mockResolvedValue({ status: 'failed' })
        onlineManager.setOnline(false)
        onlineManager.setOnline(true)

        await waitFor(() =>
            expect(useSwapStatusReportStore.getState().reports).toHaveLength(0),
        )
    })

    it('does not flush while offline', async () => {
        onlineManager.setOnline(false)
        useSwapStatusReportStore
            .getState()
            .enqueueReport({ swapId: 'swap-1', data: { status: 'failed' } })

        renderHook(() => useSwapStatusReportFlush())

        await new Promise(resolve => setTimeout(resolve, 0))
        expect(updateSwapStatus).not.toHaveBeenCalled()
    })
})
