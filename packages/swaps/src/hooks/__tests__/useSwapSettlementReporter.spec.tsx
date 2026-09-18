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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSwapSettlementReporter } from '../useSwapSettlementReporter'

const mocks = vi.hoisted(() => ({
    setSubmissionSettledHandler: vi.fn(),
    getSubmissionAttemptsByTxIds: vi.fn(),
    enqueueReport: vi.fn(),
    loggerWarn: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    setSubmissionSettledHandler: mocks.setSubmissionSettledHandler,
    getSubmissionAttemptsByTxIds: mocks.getSubmissionAttemptsByTxIds,
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: mocks.loggerWarn },
}))
vi.mock('../../store/swapStatusReportStore', () => ({
    useSwapStatusReportStore: {
        getState: () => ({ enqueueReport: mocks.enqueueReport }),
    },
}))

const render = () => renderHook(() => useSwapSettlementReporter())

describe('swaps/useSwapSettlementReporter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getSubmissionAttemptsByTxIds.mockResolvedValue([])
    })

    it('registers a swap settle handler on mount and clears it on unmount', () => {
        const view = render()

        expect(mocks.setSubmissionSettledHandler).toHaveBeenCalledWith(
            'swap',
            expect.any(Function),
        )

        view.unmount()

        expect(mocks.setSubmissionSettledHandler).toHaveBeenLastCalledWith(
            'swap',
            null,
        )
    })

    it('enqueues exactly one failed/blockchain_error report for the row swap id on a failed settlement', async () => {
        mocks.getSubmissionAttemptsByTxIds.mockResolvedValue([
            {
                id: 'row-1',
                intentKey: { kind: 'swap', swapId: 'swap-1' },
            },
        ])

        render()
        const handler = mocks.setSubmissionSettledHandler.mock.calls[0][1]

        await handler(['txid-1'], 'mainnet', 'failed')

        expect(mocks.getSubmissionAttemptsByTxIds).toHaveBeenCalledWith({
            txIds: ['txid-1'],
        })
        expect(mocks.enqueueReport).toHaveBeenCalledTimes(1)
        expect(mocks.enqueueReport).toHaveBeenCalledWith({
            swapId: 'swap-1',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
    })

    it('enqueues nothing on a confirmed settlement', async () => {
        mocks.getSubmissionAttemptsByTxIds.mockResolvedValue([
            {
                id: 'row-1',
                intentKey: { kind: 'swap', swapId: 'swap-1' },
            },
        ])

        render()
        const handler = mocks.setSubmissionSettledHandler.mock.calls[0][1]

        await handler(['txid-1'], 'mainnet', 'confirmed')

        expect(mocks.enqueueReport).not.toHaveBeenCalled()
    })

    it('enqueues nothing when no row matches the settled txIds', async () => {
        mocks.getSubmissionAttemptsByTxIds.mockResolvedValue([])

        render()
        const handler = mocks.setSubmissionSettledHandler.mock.calls[0][1]

        await handler(['txid-1'], 'mainnet', 'failed')

        expect(mocks.enqueueReport).not.toHaveBeenCalled()
    })

    it('enqueues nothing when the matching row carries a non-swap intent key', async () => {
        mocks.getSubmissionAttemptsByTxIds.mockResolvedValue([
            {
                id: 'row-1',
                intentKey: { kind: 'cosign', signRequestId: 'req-1' },
            },
        ])

        render()
        const handler = mocks.setSubmissionSettledHandler.mock.calls[0][1]

        await handler(['txid-1'], 'mainnet', 'failed')

        expect(mocks.enqueueReport).not.toHaveBeenCalled()
    })

    it('does not throw when the repository lookup rejects, and enqueues nothing', async () => {
        mocks.getSubmissionAttemptsByTxIds.mockRejectedValue(
            new Error('db unavailable'),
        )

        render()
        const handler = mocks.setSubmissionSettledHandler.mock.calls[0][1]

        await expect(
            handler(['txid-1'], 'mainnet', 'failed'),
        ).resolves.not.toThrow()
        expect(mocks.enqueueReport).not.toHaveBeenCalled()
    })
})
