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
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBalanceValidation } from '../useBalanceValidation'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

const mockAccountInformation = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useAlgorandClient: () => ({
            client: {
                algod: {
                    // algosdk's builder shape: accountInformation(addr).do()
                    accountInformation: (addr: string) => ({
                        do: () => mockAccountInformation(addr),
                    }),
                },
            },
        }),
        getAccountInformationQueryKey: (addr: string) => ['account-info', addr],
    }
})

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

const makeTx = (
    overrides: Partial<PeraDisplayableTransaction> = {},
): PeraDisplayableTransaction =>
    ({
        sender: 'ADDR_A',
        fee: 1000n,
        ...overrides,
    }) as unknown as PeraDisplayableTransaction

describe('useBalanceValidation', () => {
    beforeEach(() => {
        mockAccountInformation.mockReset()
    })

    test('returns isLoading=true initially and null validation', () => {
        mockAccountInformation.mockImplementation(
            () =>
                new Promise(() => {
                    /* never resolves */
                }),
        )

        const { result } = renderHook(
            () =>
                useBalanceValidation({
                    transactions: [],
                    signableAddresses: new Set(['ADDR_A']),
                }),
            { wrapper },
        )

        expect(result.current.isLoading).toBe(true)
        expect(result.current.validation).toBeNull()
    })

    test('validates balances once account info loads', async () => {
        mockAccountInformation.mockResolvedValue({
            address: { toString: () => 'ADDR_A' },
            amount: 10_000_000n,
            minBalance: 100_000n,
            assets: [],
        })

        const { result } = renderHook(
            () =>
                useBalanceValidation({
                    transactions: [],
                    signableAddresses: new Set(['ADDR_A']),
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.validation).not.toBeNull()
        expect(result.current.validation?.isValid).toBe(true)
    })

    test('handles empty addresses set with no queries', async () => {
        const { result } = renderHook(
            () =>
                useBalanceValidation({
                    transactions: [],
                    signableAddresses: new Set<string>(),
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.validation?.isValid).toBe(true)
        expect(mockAccountInformation).not.toHaveBeenCalled()
    })

    test('recomputes validation when includeMBR toggles', async () => {
        // amount sits between (fee + payment) and (fee + payment + minBalance):
        //   required without MBR = 1_000 + 850_000           =   851_000  (<= 900_000, valid)
        //   required with MBR    = 1_000 + 850_000 + 100_000  =   951_000  (>  900_000, invalid)
        mockAccountInformation.mockResolvedValue({
            address: { toString: () => 'ADDR_A' },
            amount: 900_000n,
            minBalance: 100_000n,
            assets: [],
        })

        const transactions = [
            makeTx({
                fee: 1000n,
                paymentTransaction: {
                    amount: 850_000n,
                    receiver: 'RECEIVER',
                } as any,
            }),
        ]
        const signableAddresses = new Set(['ADDR_A'])

        const { result, rerender } = renderHook(
            ({ includeMBR }: { includeMBR: boolean }) =>
                useBalanceValidation({
                    transactions,
                    signableAddresses,
                    includeMBR,
                }),
            { wrapper, initialProps: { includeMBR: true } },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        // MBR included → required exceeds available → invalid
        expect(result.current.validation?.isValid).toBe(false)

        rerender({ includeMBR: false })
        // MBR excluded → required is below available → valid
        // Fails before the dependency-array fix (stale memo keeps returning invalid)
        expect(result.current.validation?.isValid).toBe(true)
    })
})
