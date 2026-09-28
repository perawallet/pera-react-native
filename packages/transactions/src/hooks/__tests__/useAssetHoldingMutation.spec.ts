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

import { createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    useAssetHoldingMutation,
    type AssetHoldingMutationContext,
    type AssetHoldingMutationOutcome,
} from '../useAssetHoldingMutation'

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient() }, children)

const mockSubmit = vi.fn()
const mockBuild = vi.fn()
const mockAddAssetOptIn = vi.fn()
const mockNewGroup = vi.fn(() => ({
    addAssetOptIn: mockAddAssetOptIn,
    build: mockBuild,
}))
const mockAssignFeeToGroup = vi.fn()
const mockInvalidate = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
    useMinimumFeeCalculator: () => ({
        assignFeeToGroup: mockAssignFeeToGroup,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    invalidateAccountQueriesForAddresses: (...args: unknown[]) =>
        mockInvalidate(...args),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
    useAlgorandClient: () => ({ newGroup: mockNewGroup }),
}))

const SOURCE = { name: 'test-source', description: 'Test source' }

type Run = (
    params: string,
    context: AssetHoldingMutationContext,
) => Promise<AssetHoldingMutationOutcome>

const renderCore = (run: Run) =>
    renderHook(() => useAssetHoldingMutation<string>({ source: SOURCE, run }), {
        wrapper,
    })

describe('useAssetHoldingMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockBuild.mockResolvedValue({
            transactions: [{ txn: { sender: 'SENDER', fee: 1000n } }],
        })
        mockAssignFeeToGroup.mockResolvedValue({
            transactions: [{ sender: 'SENDER', fee: 3000n }],
            adjustments: [],
        })
        mockSubmit.mockResolvedValue({ txIds: ['tx1'] })
    })

    it('builds through the fee calculator and submits with the source', async () => {
        const run: Run = async (_params, { buildGroup, submit }) => {
            const unsignedTxs = await buildGroup(composer => {
                composer.addAssetOptIn({ sender: 'SENDER', assetId: 1n })
            })
            const { txIds } = await submit(unsignedTxs)
            return { txIds, sender: 'SENDER' }
        }
        const { result } = renderCore(run)

        let response: { txIds: string[] } | undefined
        await act(async () => {
            response = await result.current.mutateAsync('params')
        })

        expect(response).toEqual({ txIds: ['tx1'] })
        expect(mockAddAssetOptIn).toHaveBeenCalledWith({
            sender: 'SENDER',
            assetId: 1n,
        })
        expect(mockAssignFeeToGroup).toHaveBeenCalledWith({
            transactions: [{ sender: 'SENDER', fee: 1000n }],
        })
        expect(mockSubmit).toHaveBeenCalledWith({
            unsignedTxs: [{ sender: 'SENDER', fee: 3000n }],
            source: SOURCE,
        })
    })

    it('passes the network and invalidates the returned sender after run resolves', async () => {
        const order: string[] = []
        mockInvalidate.mockImplementation(() => order.push('invalidate'))
        const run = vi.fn<Run>(async (_params, { network }) => {
            order.push(`run:${network}`)
            return { txIds: [], sender: 'OTHER' }
        })
        const { result } = renderCore(run)

        await act(async () => {
            await result.current.mutateAsync('params')
        })

        expect(run).toHaveBeenCalledWith('params', expect.anything())
        expect(order).toEqual(['run:testnet', 'invalidate'])
        expect(mockInvalidate).toHaveBeenCalledWith(expect.anything(), [
            'OTHER',
        ])
    })

    it('reports isLoading while the run is in flight', async () => {
        let finish: (outcome: AssetHoldingMutationOutcome) => void = () => {}
        const run: Run = () =>
            new Promise(resolve => {
                finish = resolve
            })
        const { result } = renderCore(run)

        expect(result.current.isLoading).toBe(false)
        let pending: Promise<unknown> | undefined
        act(() => {
            pending = result.current.mutateAsync('params')
        })
        await waitFor(() => expect(result.current.isLoading).toBe(true))

        await act(async () => {
            finish({ txIds: [], sender: 'SENDER' })
            await pending
        })
        await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('surfaces a failure as error state, without retrying or invalidating', async () => {
        const failure = new Error('boom')
        const run = vi.fn<Run>().mockRejectedValue(failure)
        const { result } = renderCore(run)

        await act(async () => {
            await expect(result.current.mutateAsync('params')).rejects.toBe(
                failure,
            )
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBe(failure)
        expect(result.current.isLoading).toBe(false)
        expect(run).toHaveBeenCalledTimes(1)
        expect(mockInvalidate).not.toHaveBeenCalled()
    })

    it('normalises a non-Error rejection to an Error', async () => {
        const run: Run = () => Promise.reject('plain string')
        const { result } = renderCore(run)

        await act(async () => {
            await expect(
                result.current.mutateAsync('params'),
            ).rejects.toBeInstanceOf(Error)
        })
    })

    it('clears the previous error when a new run starts', async () => {
        const run = vi
            .fn<Run>()
            .mockRejectedValueOnce(new Error('first'))
            .mockResolvedValueOnce({ txIds: ['tx2'], sender: 'SENDER' })
        const { result } = renderCore(run)

        await act(async () => {
            await expect(result.current.mutateAsync('a')).rejects.toThrow(
                'first',
            )
        })
        await waitFor(() => expect(result.current.isError).toBe(true))

        await act(async () => {
            await result.current.mutateAsync('b')
        })

        await waitFor(() => expect(result.current.isError).toBe(false))
        expect(result.current.error).toBeNull()
    })
})
