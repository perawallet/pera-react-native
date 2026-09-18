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

const mocks = vi.hoisted(() => ({
    submit: vi.fn(),
    waitForTransactionConfirmation: vi.fn(),
    algod: { tag: 'algod' },
}))

vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useSignAndSubmitGroup: () => ({ submit: mocks.submit }),
}))
vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useAlgorandClient: () => ({ client: { algod: mocks.algod } }),
    waitForTransactionConfirmation: mocks.waitForTransactionConfirmation,
}))

import { useSubmitAndConfirm } from '../useSubmitAndConfirm'

const PARAMS = {
    unsignedTxs: [],
    source: { name: 'test', description: 'test' },
} as unknown as Parameters<ReturnType<typeof useSubmitAndConfirm>>[0]

describe('useSubmitAndConfirm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.waitForTransactionConfirmation.mockResolvedValue(undefined)
    })

    it('submits, then waits for the first transaction to land before resolving', async () => {
        const order: string[] = []
        mocks.submit.mockImplementation(async () => {
            order.push('submit')
            return { txIds: ['TX1', 'TX2'] }
        })
        mocks.waitForTransactionConfirmation.mockImplementation(async () => {
            order.push('confirm')
        })
        const { result } = renderHook(() => useSubmitAndConfirm())

        const submitted = await result.current(PARAMS)

        expect(mocks.submit).toHaveBeenCalledWith(PARAMS)
        expect(mocks.waitForTransactionConfirmation).toHaveBeenCalledWith(
            mocks.algod,
            'TX1',
        )
        expect(order).toEqual(['submit', 'confirm'])
        expect(submitted).toEqual({ txIds: ['TX1', 'TX2'] })
    })

    it('skips the wait when nothing was submitted', async () => {
        mocks.submit.mockResolvedValue({ txIds: [] })
        const { result } = renderHook(() => useSubmitAndConfirm())

        await result.current(PARAMS)

        expect(mocks.waitForTransactionConfirmation).not.toHaveBeenCalled()
    })

    it('propagates a submit failure without waiting', async () => {
        mocks.submit.mockRejectedValue(new Error('rejected'))
        const { result } = renderHook(() => useSubmitAndConfirm())

        await expect(result.current(PARAMS)).rejects.toThrow('rejected')
        expect(mocks.waitForTransactionConfirmation).not.toHaveBeenCalled()
    })
})
