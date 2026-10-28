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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { mutationDefaults } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { SwapChainAdapter } from '../../chain-adapter'
import type { SwapQuote } from '../../models'
import {
    swapChainAdapters,
    SwapAccountUnsupportedError,
    SwapCosignUnsupportedError,
} from '../../chain-adapter'
import { updateSwapStatus } from '../../api'
import { prepareSwapTransactions } from '../usePrepareTransactionsMutation'
import { registerFakeSwapAdapter } from '../../__tests__/fakeSwapAdapter'
import { useExecuteSwapMutation } from '../useExecuteSwapMutation'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'testnet' }

const {
    mockAddSignRequest,
    mockPrepareTransactions,
    mockUpdateSwapStatus,
    mockRegisterHandoff,
    mockSelectedAccount,
    mockSwapScope,
} = vi.hoisted(() => ({
    mockAddSignRequest: vi.fn(),
    mockPrepareTransactions: vi.fn(),
    mockUpdateSwapStatus: vi.fn(),
    mockRegisterHandoff: vi.fn(),
    mockSelectedAccount: { current: null as WalletAccount | null },
    mockSwapScope: { current: null as ChainScope | null },
}))

const account = (
    address: string,
    custody: WalletAccount['custody'],
): WalletAccount => ({
    id: address,
    custody,
    chains: { algorand: { address } },
})

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useSelectedAccount: () => mockSelectedAccount.current,
    getSignerFor: (address: string, _accounts: unknown, chainId: string) => ({
        address: `signer-of-${address}-on-${chainId}`,
    }),
}))

vi.mock('../useSwapScope', () => ({
    useSwapScope: (selected: WalletAccount | null) =>
        selected === mockSelectedAccount.current ? mockSwapScope.current : null,
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceIdLookup: () => (deployment: string | null) =>
        `device-${deployment}`,
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
    prepareSwapTransactions: mockPrepareTransactions,
}))

vi.mock('../../api', () => ({
    updateSwapStatus: mockUpdateSwapStatus,
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
    signingSource: { name: 'n', description: 'd' },
    onProgress: vi.fn(),
    isCancelled: () => false,
}

describe('useExecuteSwapMutation', () => {
    let executeSwap: SwapChainAdapter['executeSwap']

    beforeEach(() => {
        mockSelectedAccount.current = account('SELECTED', {
            kind: 'local',
            seed: null,
        })
        mockSwapScope.current = SCOPE
        mockPrepareTransactions.mockReset()
        mockUpdateSwapStatus.mockReset()
        executeSwap = vi.fn()
        registerFakeSwapAdapter({ executeSwap })
    })

    test("hands the selected account, its signer and the wired context to its swap chain's adapter", async () => {
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
                account: mockSelectedAccount.current,
                signer: { address: 'signer-of-SELECTED-on-algorand' },
            },
            {
                scope: { chainId: 'algorand', networkId: 'testnet' },
                deviceId: 'device-developer',
                addSignRequest: mockAddSignRequest,
                prepareTransactions: expect.any(Function),
                updateSwapStatus: expect.any(Function),
                registerHandoff: mockRegisterHandoff,
            },
        )
    })

    test("sends the backend calls to the account's swap scope", async () => {
        vi.mocked(executeSwap).mockImplementation(async (_params, context) => {
            await context.prepareTransactions({ quote: 'q' })
            await context.updateSwapStatus({
                swapId: 'S',
                data: { status: 'completed' },
            })
            return { kind: 'success', txIds: [] }
        })
        const { result } = renderHook(() => useExecuteSwapMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.mutateAsync(variables)
        })

        expect(prepareSwapTransactions).toHaveBeenCalledWith(
            { quote: 'q' },
            SCOPE,
        )
        expect(updateSwapStatus).toHaveBeenCalledWith(
            'S',
            { status: 'completed' },
            SCOPE,
        )
    })

    test('refuses an account with no swap chain without executing', async () => {
        mockSwapScope.current = null
        const { result } = renderHook(() => useExecuteSwapMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.mutateAsync(variables),
            ).rejects.toBeInstanceOf(SwapAccountUnsupportedError)
        })

        expect(executeSwap).not.toHaveBeenCalled()
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

    test('refuses a shared-account swap on a chain without co-sign support', async () => {
        mockSelectedAccount.current = account('JOINT', { kind: 'multisig' })
        mockSwapScope.current = SCOPE
        registerFakeSwapAdapter({
            executeSwap,
            supportsCosignedSwaps: false,
        })
        const { result } = renderHook(() => useExecuteSwapMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.mutateAsync(variables),
            ).rejects.toBeInstanceOf(SwapCosignUnsupportedError)
        })

        expect(executeSwap).not.toHaveBeenCalled()
    })
})
