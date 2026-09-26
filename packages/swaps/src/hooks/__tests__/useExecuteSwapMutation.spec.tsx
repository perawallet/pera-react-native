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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { mutationDefaults } from '@perawallet/wallet-core-shared'
import type { SwapChainAdapter } from '../../chain-adapter'
import type { SwapQuote } from '../../models'
import { swapChainAdapters } from '../../chain-adapter'
import { registerFakeSwapAdapter } from '../../__tests__/fakeSwapAdapter'
import { useExecuteSwapMutation } from '../useExecuteSwapMutation'

const {
    mockAddSignRequest,
    mockPrepareTransactions,
    mockUpdateSwapStatus,
    mockRegisterHandoff,
} = vi.hoisted(() => ({
    mockAddSignRequest: vi.fn(),
    mockPrepareTransactions: vi.fn(),
    mockUpdateSwapStatus: vi.fn(),
    mockRegisterHandoff: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useMinimumFeeConfig: () => ({ assetMbr: 100_000n }),
    useNetwork: () => ({ network: 'testnet' }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'SELECTED' }),
    useSignerFor: (address: string) => ({ address: `signer-of-${address}` }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: (network: string) => `device-${network}`,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
}))

vi.mock('../../store', () => ({
    useSwapHandoffStore: (
        selector: (state: {
            registerHandoff: typeof mockRegisterHandoff
        }) => unknown,
    ) => selector({ registerHandoff: mockRegisterHandoff }),
}))

vi.mock('../usePrepareTransactionsMutation', () => ({
    usePrepareTransactionsMutation: () => ({
        mutateAsync: mockPrepareTransactions,
    }),
}))

vi.mock('../useUpdateSwapStatusMutation', () => ({
    useUpdateSwapStatusMutation: () => ({ mutateAsync: mockUpdateSwapStatus }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { ...mutationDefaults } },
    })
    return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
    )
}

const variables = {
    quote: { quoteIdStr: 'q' } as SwapQuote,
    isQuantumSwapEnabled: false,
    signingSource: { name: 'n', description: 'd' },
    onProgress: vi.fn(),
    isCancelled: () => false,
}

describe('useExecuteSwapMutation', () => {
    let executeSwap: SwapChainAdapter['executeSwap']

    beforeEach(() => {
        executeSwap = vi.fn()
        registerFakeSwapAdapter({ executeSwap })
    })

    test("hands the selected account, its signer and the wired context to the network's chain adapter", async () => {
        vi.mocked(executeSwap).mockResolvedValue({
            kind: 'success',
            txIds: ['T'],
        })
        const { result } = renderHook(() => useExecuteSwapMutation(), {
            wrapper,
        })

        let outcome: unknown
        await act(async () => {
            outcome = await result.current.mutateAsync(variables)
        })

        expect(outcome).toEqual({ kind: 'success', txIds: ['T'] })
        expect(executeSwap).toHaveBeenCalledWith(
            {
                ...variables,
                account: { address: 'SELECTED' },
                signer: { address: 'signer-of-SELECTED' },
            },
            {
                network: 'testnet',
                assetOptInMinBalance: 100_000n,
                deviceId: 'device-testnet',
                addSignRequest: mockAddSignRequest,
                prepareTransactions: mockPrepareTransactions,
                updateSwapStatus: mockUpdateSwapStatus,
                registerHandoff: mockRegisterHandoff,
            },
        )
    })

    test('never retries an execution that threw', async () => {
        vi.mocked(executeSwap).mockRejectedValue(new Error('decode failed'))
        const { result } = renderHook(() => useExecuteSwapMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(result.current.mutateAsync(variables)).rejects.toThrow(
                'decode failed',
            )
        })

        expect(executeSwap).toHaveBeenCalledTimes(1)
    })

    test('rejects without executing when no chain adapter is registered', async () => {
        swapChainAdapters.reset()
        const { result } = renderHook(() => useExecuteSwapMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(result.current.mutateAsync(variables)).rejects.toThrow(
                'No swap adapter is registered',
            )
        })

        expect(executeSwap).not.toHaveBeenCalled()
    })
})
