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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SignAndSubmitGroupParams } from '@perawallet/wallet-core-signing'

const mocks = vi.hoisted(() => ({
    submit: vi.fn(),
    waitForTransactionConfirmation: vi.fn(),
    algod: { tag: 'algod' },
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mocks.submit }),
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({ client: { algod: mocks.algod } }),
    waitForTransactionConfirmation: mocks.waitForTransactionConfirmation,
}))

import { useSubmitAndConfirmMutation } from '../useSubmitAndConfirmMutation'

const PARAMS = {
    unsignedTxs: [],
    source: { name: 'test', description: 'test' },
} as unknown as SignAndSubmitGroupParams

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
        {children}
    </QueryClientProvider>
)

const renderMutation = () =>
    renderHook(() => useSubmitAndConfirmMutation(), { wrapper })

describe('useSubmitAndConfirmMutation', () => {
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
        const { result } = renderMutation()

        let submitted: unknown
        await act(async () => {
            submitted = await result.current.mutateAsync(PARAMS)
        })

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
        const { result } = renderMutation()

        await act(async () => {
            await result.current.mutateAsync(PARAMS)
        })

        expect(mocks.waitForTransactionConfirmation).not.toHaveBeenCalled()
    })

    it('propagates a submit failure without waiting or retrying', async () => {
        mocks.submit.mockRejectedValue(new Error('rejected'))
        const { result } = renderMutation()

        await act(async () => {
            await expect(result.current.mutateAsync(PARAMS)).rejects.toThrow(
                'rejected',
            )
        })
        expect(mocks.submit).toHaveBeenCalledTimes(1)
        expect(mocks.waitForTransactionConfirmation).not.toHaveBeenCalled()
    })
})
