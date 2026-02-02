/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { renderHook, act } from '@testing-library/react'
import { useSigningNavigation } from '../useSigningNavigation'
import type {
    TransactionSignRequest,
    PeraTransaction,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'

// Mock the mapToDisplayableTransaction function
vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        mapToDisplayableTransaction: (
            tx: PeraTransaction,
        ): PeraDisplayableTransaction => {
            // Return a displayable transaction based on the input
            const txAny = tx as { txType?: string; fee?: bigint }
            return {
                txType: txAny.txType ?? 'pay',
                sender: 'test-sender',
                fee: txAny.fee ?? 1000n,
            } as PeraDisplayableTransaction
        },
    }
})

describe('useSigningNavigation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const mockPaymentTx = {
        txType: 'pay',
        sender: 'test-sender',
        fee: 1000n,
    } as unknown as PeraTransaction

    const mockAppCallTx = {
        txType: 'appl',
        sender: 'test-sender',
        fee: 2000n,
    } as unknown as PeraTransaction

    const createRequest = (
        txGroups: PeraTransaction[][],
    ): TransactionSignRequest => ({
        id: 'test',
        type: 'transactions',
        transport: 'callback',
        txs: txGroups,
        approve: async () => {},
        reject: async () => {},
    })

    describe('single transaction', () => {
        it('returns single-summary as root view type', () => {
            const request = createRequest([[mockPaymentTx]])
            const { result } = renderHook(() =>
                useSigningNavigation({ request }),
            )

            expect(result.current.rootViewType).toBe('single-summary')
            expect(result.current.isSingleTransaction).toBe(true)
            expect(result.current.isSingleGroup).toBe(false)
            expect(result.current.isMultipleGroups).toBe(false)
        })

        it('navigates to details and back', () => {
            const request = createRequest([[mockPaymentTx]])
            const { result } = renderHook(() =>
                useSigningNavigation({ request }),
            )

            expect(result.current.canGoBack).toBe(false)

            act(() => {
                result.current.navigateToDetails()
            })

            expect(result.current.canGoBack).toBe(true)
            expect(result.current.currentView.viewType).toBe('single-details')

            act(() => {
                result.current.navigateBack()
            })

            expect(result.current.canGoBack).toBe(false)
            expect(result.current.currentView.viewType).toBe('single-summary')
        })
    })

    describe('single group', () => {
        it('returns group-list as root view type', () => {
            const request = createRequest([[mockPaymentTx, mockAppCallTx]])
            const { result } = renderHook(() =>
                useSigningNavigation({ request }),
            )

            expect(result.current.rootViewType).toBe('group-list')
            expect(result.current.isSingleTransaction).toBe(false)
            expect(result.current.isSingleGroup).toBe(true)
            expect(result.current.isMultipleGroups).toBe(false)
        })

        it('navigates to transaction details', () => {
            const request = createRequest([[mockPaymentTx, mockAppCallTx]])
            const { result } = renderHook(() =>
                useSigningNavigation({ request }),
            )

            act(() => {
                result.current.navigateToTransaction(1)
            })

            expect(result.current.canGoBack).toBe(true)
            expect(result.current.currentView.viewType).toBe(
                'transaction-details',
            )
            expect(result.current.currentView.transactionIndex).toBe(1)
        })
    })

    describe('multiple groups', () => {
        it('returns multi-group-list as root view type', () => {
            const request = createRequest([[mockPaymentTx], [mockAppCallTx]])
            const { result } = renderHook(() =>
                useSigningNavigation({ request }),
            )

            expect(result.current.rootViewType).toBe('multi-group-list')
            expect(result.current.isSingleTransaction).toBe(false)
            expect(result.current.isSingleGroup).toBe(false)
            expect(result.current.isMultipleGroups).toBe(true)
        })

        it('navigates to group and transaction', () => {
            const request = createRequest([
                [mockPaymentTx],
                [mockAppCallTx, mockPaymentTx],
            ])
            const { result } = renderHook(() =>
                useSigningNavigation({ request }),
            )

            // Navigate to group
            act(() => {
                result.current.navigateToGroup(1)
            })

            expect(result.current.currentView.viewType).toBe('group-list')
            expect(result.current.currentView.groupIndex).toBe(1)

            // Navigate to transaction within group
            act(() => {
                result.current.navigateToTransaction(0, 1)
            })

            expect(result.current.currentView.viewType).toBe(
                'transaction-details',
            )

            // Navigate back to group
            act(() => {
                result.current.navigateBack()
            })

            expect(result.current.currentView.viewType).toBe('group-list')

            // Navigate back to root
            act(() => {
                result.current.navigateBack()
            })

            expect(result.current.currentView.viewType).toBe('multi-group-list')
        })
    })

    describe('navigation', () => {
        it('supports recursive inner transaction navigation', () => {
            const request = createRequest([[mockPaymentTx]])
            const { result } = renderHook(() =>
                useSigningNavigation({ request }),
            )

            // Navigate to details
            act(() => {
                result.current.navigateToDetails()
            })

            // Navigate to inner transaction
            const mockInnerTx = {
                txType: 'pay',
                sender: 'test-sender',
            }
            act(() => {
                result.current.navigateToInnerTransaction(mockInnerTx as never)
            })

            expect(result.current.navigationStack).toHaveLength(3)
            expect(result.current.currentView.viewType).toBe(
                'transaction-details',
            )

            // Navigate back twice to return to root
            act(() => {
                result.current.navigateBack()
            })
            act(() => {
                result.current.navigateBack()
            })

            expect(result.current.navigationStack).toHaveLength(1)
            expect(result.current.canGoBack).toBe(false)
        })
    })
})
