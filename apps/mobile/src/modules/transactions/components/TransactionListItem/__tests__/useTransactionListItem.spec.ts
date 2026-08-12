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

const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

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
        roundTime: 1_700_000_000,
        asset: null,
        swapGroupDetail: null,
        interpretedMeaning: null,
        applicationId: null,
        innerTransactionCount: null,
        groupId: null,
        closeTo: null,
        balanceImpacts: [],
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
        roundTime: 1_700_000_000,
        asset: {
            assetId: '31566704',
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
        balanceImpacts: [],
        ...overrides,
    }) as TransactionHistoryItem

const createAppCallTx = (
    overrides: Partial<TransactionHistoryItem> = {},
): TransactionHistoryItem =>
    ({
        id: 'tx3',
        txType: 'appl',
        sender: USER_ADDRESS,
        receiver: null,
        amount: null,
        fee: new Decimal('1000'),
        confirmedRound: 100,
        roundTime: 1_700_000_000,
        asset: null,
        swapGroupDetail: null,
        interpretedMeaning: null,
        applicationId: '123',
        innerTransactionCount: 2,
        groupId: null,
        closeTo: null,
        balanceImpacts: [],
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
                    assetInId: '0',
                    assetInUnitName: 'ALGO',
                    assetOutId: '31566704',
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
                    assetId: '31566704',
                    name: 'USD Coin',
                    unitName: 'USDC',
                    decimals: 0,
                },
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            expect(result.current.amounts[0].value.toNumber()).toBe(1)
        })

        it('falls back to transaction asset decimals when query has no data', () => {
            vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
                data: undefined,
            } as UseQueryResult<PeraAsset, Error>)

            const tx = createAssetTransferTx({
                amount: new Decimal('1000000'),
                asset: {
                    assetId: '31566704',
                    name: 'USD Coin',
                    unitName: 'USDC',
                    decimals: 6,
                },
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            expect(result.current.amounts[0].value.toNumber()).toBe(1)
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

    describe('handleLongPress', () => {
        it('copies the transaction id', () => {
            mockCopyToClipboard.mockClear()
            const tx = createPaymentTx({ id: 'TXID123' })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            result.current.handleLongPress()

            expect(mockCopyToClipboard).toHaveBeenCalledWith('TXID123')
        })
    })

    describe('app call balance impacts', () => {
        it('stacks each balance impact with sign-derived direction', () => {
            const tx = createAppCallTx({
                balanceImpacts: [
                    {
                        assetId: '0',
                        unitName: 'ALGO',
                        fractionDecimals: 6,
                        amount: new Decimal('-1500000'),
                    },
                    {
                        assetId: '31566704',
                        unitName: 'USDC',
                        fractionDecimals: 6,
                        amount: new Decimal('2000000'),
                    },
                ],
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            expect(result.current.amounts).toHaveLength(2)
            expect(result.current.amounts[0]).toMatchObject({
                currency: 'ALGO',
                prefix: '-',
            })
            expect(result.current.amounts[0].value.toNumber()).toBe(1.5)
            expect(result.current.amounts[1]).toMatchObject({
                currency: 'USDC',
                prefix: '+',
            })
            expect(result.current.amounts[1].value.toNumber()).toBe(2)
            expect(result.current.amountsOverflowCount).toBe(0)
        })

        it('shows a negative ALGO amount for a fee-only app call', () => {
            const tx = createAppCallTx({
                balanceImpacts: [
                    {
                        assetId: '0',
                        unitName: 'ALGO',
                        fractionDecimals: 6,
                        amount: new Decimal('-1000'),
                    },
                ],
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            expect(result.current.amounts).toHaveLength(1)
            expect(result.current.amounts[0]).toMatchObject({
                currency: 'ALGO',
                prefix: '-',
            })
            expect(result.current.amounts[0].value.toNumber()).toBe(0.001)
        })

        it('caps stacked amounts at two and reports the overflow count', () => {
            const tx = createAppCallTx({
                balanceImpacts: [
                    {
                        assetId: '0',
                        unitName: 'ALGO',
                        fractionDecimals: 6,
                        amount: new Decimal('-1000000'),
                    },
                    {
                        assetId: '1',
                        unitName: 'USDC',
                        fractionDecimals: 6,
                        amount: new Decimal('2000000'),
                    },
                    {
                        assetId: '2',
                        unitName: 'USDT',
                        fractionDecimals: 6,
                        amount: new Decimal('3000000'),
                    },
                    {
                        assetId: '3',
                        unitName: 'GORA',
                        fractionDecimals: 6,
                        amount: new Decimal('4000000'),
                    },
                ],
            })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            expect(result.current.amounts).toHaveLength(2)
            expect(result.current.amountsOverflowCount).toBe(2)
        })

        it('shows no amounts when an app call has no balance impacts', () => {
            const tx = createAppCallTx({ balanceImpacts: [] })
            const { result } = renderHook(() =>
                useTransactionListItem({ transaction: tx }),
            )

            expect(result.current.amounts).toEqual([])
            expect(result.current.amountsOverflowCount).toBe(0)
        })
    })
})
