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
import { AccountTypes } from '@perawallet/wallet-core-accounts'
import { useLedgerAccountInfoContent } from '../useLedgerAccountInfoContent'

const mocks = vi.hoisted(() => ({
    useLedgerAccountPreview: vi.fn(),
    t: vi.fn((k: string, _opts?: Record<string, unknown>) => k),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useLedgerAccountPreview: mocks.useLedgerAccountPreview,
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
    },
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mocks.t }),
}))

const baseAsset = {
    assetId: '0',
    name: 'Algo',
    unitName: 'ALGO',
    decimals: 6,
    hasKnownDecimals: true,
    amount: new Decimal(5),
    fiatValue: new Decimal(10),
    usdPrice: new Decimal(2),
    verificationTier: 'verified' as const,
    isAlgo: true,
}

const asaAsset = {
    assetId: '12345',
    name: 'USDC',
    unitName: 'USDC',
    decimals: 6,
    hasKnownDecimals: true,
    amount: new Decimal(100),
    fiatValue: new Decimal(100),
    usdPrice: new Decimal(1),
    verificationTier: 'trusted' as const,
    isAlgo: false,
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useLedgerAccountInfoContent', () => {
    it('builds the title from the ledger account index', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 0),
        )

        expect(result.current.title).toBe('ledger.account_info.default_title')
        expect(mocks.t).toHaveBeenCalledWith(
            'ledger.account_info.default_title',
            { index: 0 },
        )
        expect(result.current.isLoading).toBe(true)
        expect(result.current.items).toEqual([])
    })

    it('emits account-details and asset rows, no rekey section when none', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal(5),
                totalFiatValue: new Decimal(10),
                assets: [baseAsset],
                rekey: { kind: 'none' },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 3),
        )

        const kinds = result.current.items.map(i => i.kind)
        expect(kinds).toEqual([
            'sectionHeader',
            'account',
            'sectionHeader',
            'asset',
        ])
        expect(result.current.title).toBe('ledger.account_info.default_title')
        expect(mocks.t).toHaveBeenCalledWith(
            'ledger.account_info.default_title',
            { index: 3 },
        )
    })

    it('emits a "can be signed by" rekey section when rekeyedTo', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal(0),
                totalFiatValue: new Decimal(0),
                assets: [baseAsset],
                rekey: { kind: 'rekeyedTo', authAddress: 'AUTH' },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 1),
        )

        const rekeyAddressItems = result.current.items.filter(
            i => i.kind === 'rekeyAddress',
        )
        expect(rekeyAddressItems).toHaveLength(1)
        expect(rekeyAddressItems[0]).toMatchObject({
            kind: 'rekeyAddress',
        })
        if (rekeyAddressItems[0].kind === 'rekeyAddress') {
            expect(rekeyAddressItems[0].account.address).toBe('AUTH')
            // synth is hardware → base icon is the Ledger icon, no override.
            expect(rekeyAddressItems[0].displayStateOverride).toBeUndefined()
        }
    })

    it('emits a "can sign for these" rekey section when canSignFor', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal(0),
                totalFiatValue: new Decimal(0),
                assets: [baseAsset],
                rekey: { kind: 'canSignFor', addresses: ['R1', 'R2'] },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 1),
        )

        const rekeyAddressItems = result.current.items.filter(
            i => i.kind === 'rekeyAddress',
        )
        const rekeyAddresses = rekeyAddressItems.map(i =>
            i.kind === 'rekeyAddress' ? i.account.address : '',
        )
        expect(rekeyAddresses).toEqual(['R1', 'R2'])
        rekeyAddressItems.forEach(i => {
            if (i.kind === 'rekeyAddress') {
                expect(i.displayStateOverride).toBe('rekeyedSignable')
            }
        })
    })

    it('uses the title override when provided, ignoring the index', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 7, 'Rekeyed account'),
        )

        expect(result.current.title).toBe('Rekeyed account')
    })

    it('carries Decimal instances for algoBalance and algoUsdPrice on the account item', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal('408.2'),
                totalFiatValue: new Decimal('48.45'),
                assets: [{ ...baseAsset, usdPrice: new Decimal('0.6') }],
                rekey: { kind: 'none' },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 2),
        )

        const acct = result.current.items.find(i => i.kind === 'account')
        expect(acct?.kind).toBe('account')
        if (acct?.kind === 'account') {
            expect(acct.algoBalance).toBeInstanceOf(Decimal)
            expect(acct.algoBalance.toString()).toBe('408.2')
            expect(acct.algoUsdPrice).toBeInstanceOf(Decimal)
            expect(acct.algoUsdPrice.toString()).toBe('0.6')
        }
    })

    it('builds a hardware synth account on the account item when no rekey', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'MYADDR',
                algoBalance: new Decimal(1),
                totalFiatValue: new Decimal(0),
                assets: [baseAsset],
                rekey: { kind: 'none' },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('MYADDR', 2),
        )

        const acct = result.current.items.find(i => i.kind === 'account')
        if (acct?.kind === 'account') {
            expect(acct.account.type).toBe(AccountTypes.hardware)
            expect(acct.account.address).toBe('MYADDR')
            if (acct.account.type === AccountTypes.hardware) {
                expect(acct.account.hardwareDetails.accountIndex).toBe(2)
                expect(acct.account.hardwareDetails.manufacturer).toBe('ledger')
            }
            // synth is hardware → base icon resolves correctly, no override.
            expect(acct.displayStateOverride).toBeUndefined()
        }
    })

    it('builds a watch+rekeyAddress synth account on the account item when rekeyedTo', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'WATCH_ADDR',
                algoBalance: new Decimal(0),
                totalFiatValue: new Decimal(0),
                assets: [baseAsset],
                rekey: { kind: 'rekeyedTo', authAddress: 'AUTH_ADDR' },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('WATCH_ADDR', 0),
        )

        const acct = result.current.items.find(i => i.kind === 'account')
        if (acct?.kind === 'account') {
            expect(acct.account.type).toBe(AccountTypes.watch)
            expect(acct.account.address).toBe('WATCH_ADDR')
            expect(acct.account.rekeyAddress).toBe('AUTH_ADDR')
            expect(acct.displayStateOverride).toBe('rekeyedSignable')
        }
    })

    it('adapts LedgerAccountPreviewAsset to AssetWithAccountBalance shape on asset items', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal(5),
                totalFiatValue: new Decimal(105),
                assets: [baseAsset, asaAsset],
                rekey: { kind: 'none' },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 0),
        )

        const assetItems = result.current.items.filter(i => i.kind === 'asset')
        expect(assetItems).toHaveLength(2)

        if (assetItems[0].kind === 'asset') {
            expect(assetItems[0].accountBalance.assetId).toBe('0')
            expect(assetItems[0].accountBalance.amount).toBeInstanceOf(Decimal)
            expect(assetItems[0].accountBalance.amount.toString()).toBe('5')
            expect(assetItems[0].usdPrice).toBeInstanceOf(Decimal)
            expect(assetItems[0].usdPrice.toString()).toBe('2')
            // ALGO holding: its ALGO value is the amount itself (5 * 2 / 2).
            expect(assetItems[0].accountBalance.algoValue.toString()).toBe('5')
        }

        if (assetItems[1].kind === 'asset') {
            expect(assetItems[1].accountBalance.assetId).toBe('12345')
            expect(assetItems[1].usdPrice.toString()).toBe('1')
            // USDC holding value in ALGO = amount * usdPrice / algoUsdPrice
            //                            = 100 * 1 / 2 = 50.
            expect(assetItems[1].accountBalance.algoValue.toString()).toBe('50')
        }
    })

    it('flags asset items whose decimals are unknown so the row renders no balance', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal(0),
                totalFiatValue: new Decimal(0),
                assets: [
                    baseAsset,
                    {
                        ...asaAsset,
                        hasKnownDecimals: false,
                        usdPrice: new Decimal(0),
                    },
                ],
                rekey: { kind: 'none' },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 0),
        )

        const assetItems = result.current.items.filter(i => i.kind === 'asset')
        if (assetItems[0].kind === 'asset') {
            expect(assetItems[0].hasKnownDecimals).toBe(true)
        }
        if (assetItems[1].kind === 'asset') {
            expect(assetItems[1].hasKnownDecimals).toBe(false)
        }
    })

    it('falls back to a zero algoValue when the ALGO USD price is unknown', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal(5),
                totalFiatValue: new Decimal(0),
                assets: [{ ...baseAsset, usdPrice: new Decimal(0) }, asaAsset],
                rekey: { kind: 'none' },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 0),
        )

        const assetItems = result.current.items.filter(i => i.kind === 'asset')
        if (assetItems[1].kind === 'asset') {
            expect(assetItems[1].accountBalance.algoValue.toString()).toBe('0')
        }
    })

    it('section ordering: account_details → account → assets → asset(s) → rekey header + rekey rows', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal(1),
                totalFiatValue: new Decimal(1),
                assets: [baseAsset, asaAsset],
                rekey: { kind: 'canSignFor', addresses: ['R1'] },
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLedgerAccountInfoContent('ADDR', 0),
        )

        const kinds = result.current.items.map(i => i.kind)
        expect(kinds).toEqual([
            'sectionHeader', // account_details
            'account',
            'sectionHeader', // assets
            'asset', // ALGO
            'asset', // USDC
            'sectionHeader', // can_sign_for
            'rekeyAddress',
        ])

        const headers = result.current.items
            .filter(i => i.kind === 'sectionHeader')
            .map(i => (i.kind === 'sectionHeader' ? i.title : ''))
        expect(headers[0]).toBe('ledger.account_info.account_details')
        expect(headers[1]).toBe('ledger.account_info.assets')
        expect(headers[2]).toBe('ledger.account_info.can_sign_for')
    })
})
