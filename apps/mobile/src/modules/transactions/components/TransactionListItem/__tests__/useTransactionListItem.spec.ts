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
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useTransactionListItem } from '../useTransactionListItem'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import type { UseQueryResult } from '@tanstack/react-query'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
    }
})

vi.mock('@hooks/useResolvedAddress', () => ({
    useResolvedAddress: vi.fn(() => ({
        displayName: '',
        isNfd: false,
        isResolving: false,
    })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
        currentLanguage: 'en',
        changeLanguage: vi.fn(),
    }),
}))

const USER_ADDRESS = 'USER_ADDRESS'
const OTHER_ADDRESS = 'OTHER_ADDRESS'

const createPaymentTx = (
    overrides: Partial<TransactionHistoryItem> = {},
): TransactionHistoryItem =>
    ({
        id: 'tx1',
        txType: 'pay',
        sender: USER_ADDRESS,
        receiver: OTHER_ADDRESS,
        amount: new Decimal('500000'),
        fee: new Decimal('1000'),
        confirmedRound: 100,
        roundTime: 1700000000,
        asset: null,
        swapGroupDetail: null,
        interpretedMeaning: null,
        applicationId: null,
        innerTransactionCount: null,
        groupId: null,
        closeTo: null,
        ...overrides,
    }) as TransactionHistoryItem

const createAssetTransferTx = (
    overrides: Partial<TransactionHistoryItem> = {},
): TransactionHistoryItem =>
    ({
        id: 'tx2',
        txType: 'axfer',
        sender: USER_ADDRESS,
        receiver: OTHER_ADDRESS,
        amount: new Decimal('1000000'),
        fee: new Decimal('1000'),
        confirmedRound: 100,
        roundTime: 1700000000,
        asset: {
            assetId: 31566704,
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
        },
        swapGroupDetail: null,
        interpretedMeaning: null,
        applicationId: null,
        innerTransactionCount: null,
        groupId: null,
        closeTo: null,
        ...overrides,
    }) as TransactionHistoryItem

describe('useTransactionListItem', () => {
    beforeEach(() => {
        vi.mocked(useSelectedAccount).mockReturnValue({
            address: USER_ADDRESS,
        } as ReturnType<typeof useSelectedAccount>)
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: undefined,
        } as UseQueryResult<PeraAsset, Error>)
    })

    describe('title', () => {
        it('returns send key for outgoing payment', () => {
            const tx = createPaymentTx({ sender: USER_ADDRESS })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.title).toBe('transactions.list_item.send')
        })

        it('returns receive key for incoming payment', () => {
            const tx = createPaymentTx({ sender: OTHER_ADDRESS })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.title).toBe('transactions.list_item.receive')
        })

        it('returns send key for outgoing asset transfer', () => {
            const tx = createAssetTransferTx({ sender: USER_ADDRESS })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.title).toBe('transactions.list_item.send')
        })

        it('returns receive key for incoming asset transfer', () => {
            const tx = createAssetTransferTx({ sender: OTHER_ADDRESS })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.title).toBe('transactions.list_item.receive')
        })

        it('returns opt_in key for self-transfer with zero amount', () => {
            const tx = createAssetTransferTx({
                sender: USER_ADDRESS,
                receiver: USER_ADDRESS,
                amount: new Decimal(0),
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.title).toBe('transactions.list_item.opt_in')
        })

        it('returns opt_out key for axfer with closeTo (close-out)', () => {
            const tx = createAssetTransferTx({
                sender: USER_ADDRESS,
                receiver: OTHER_ADDRESS,
                closeTo: OTHER_ADDRESS,
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.title).toBe('transactions.list_item.opt_out')
        })

        it('uses interpretedMeaning title when available', () => {
            const tx = createPaymentTx({
                interpretedMeaning: {
                    title: 'Custom Title',
                    description: '',
                },
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.title).toBe('Custom Title')
        })
    })

    describe('iconType', () => {
        it('returns "send" for outgoing payment', () => {
            const tx = createPaymentTx({ sender: USER_ADDRESS })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.iconType).toBe('send')
        })

        it('returns "receive" for incoming payment', () => {
            const tx = createPaymentTx({ sender: OTHER_ADDRESS })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.iconType).toBe('receive')
        })

        it('returns "send" for outgoing asset transfer', () => {
            const tx = createAssetTransferTx({ sender: USER_ADDRESS })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.iconType).toBe('send')
        })

        it('returns "receive" for incoming asset transfer', () => {
            const tx = createAssetTransferTx({ sender: OTHER_ADDRESS })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.iconType).toBe('receive')
        })

        it('returns "swap" for swap transaction', () => {
            const tx = createPaymentTx({
                swapGroupDetail: {
                    assetInId: 0,
                    assetInUnitName: 'ALGO',
                    assetOutId: 31566704,
                    assetOutUnitName: 'USDC',
                    amountIn: new Decimal('1000000'),
                    amountOut: new Decimal('500000'),
                },
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.iconType).toBe('swap')
        })

        it('returns "asset-opt-in" for asset opt-in', () => {
            const tx = createAssetTransferTx({
                sender: USER_ADDRESS,
                receiver: USER_ADDRESS,
                amount: new Decimal(0),
                closeTo: null,
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.iconType).toBe('asset-opt-in')
        })

        it('returns "asset-opt-out" for asset opt-out', () => {
            const tx = createAssetTransferTx({
                sender: USER_ADDRESS,
                receiver: OTHER_ADDRESS,
                closeTo: OTHER_ADDRESS,
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.iconType).toBe('asset-opt-out')
        })

        it('returns "app-call" for application call', () => {
            const tx = createPaymentTx({
                txType: 'appl',
                applicationId: '123',
            } as Partial<TransactionHistoryItem>)
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.iconType).toBe('app-call')
        })
    })

    describe('amounts', () => {
        it('uses asset decimals from query when available', () => {
            vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
                data: {
                    assetId: '31566704',
                    decimals: 6,
                    unitName: 'USDC',
                },
            } as UseQueryResult<PeraAsset, Error>)

            const tx = createAssetTransferTx({
                amount: new Decimal('1000000'),
                asset: {
                    assetId: 31566704,
                    name: 'USD Coin',
                    unitName: 'USDC',
                    decimals: 0,
                },
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            expect(result.current.amounts[0].value.toNumber()).toBe(1)
            expect(result.current.amounts[0].precision).toBe(6)
        })

        it('falls back to transaction asset decimals when query has no data', () => {
            vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
                data: undefined,
            } as UseQueryResult<PeraAsset, Error>)

            const tx = createAssetTransferTx({
                amount: new Decimal('1000000'),
                asset: {
                    assetId: 31566704,
                    name: 'USD Coin',
                    unitName: 'USDC',
                    decimals: 6,
                },
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            expect(result.current.amounts[0].value.toNumber()).toBe(1)
            expect(result.current.amounts[0].precision).toBe(6)
        })

        it('shows negative prefix for outgoing transactions', () => {
            const tx = createPaymentTx({
                sender: USER_ADDRESS,
                amount: new Decimal('500000'),
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.amounts[0].prefix).toBe('-')
        })

        it('shows positive prefix for incoming transactions', () => {
            const tx = createPaymentTx({
                sender: OTHER_ADDRESS,
                amount: new Decimal('500000'),
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )
            expect(result.current.amounts[0].prefix).toBe('+')
        })
    })
})
