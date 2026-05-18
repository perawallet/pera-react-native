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
import { useLedgerAccountInfoContent } from '../useLedgerAccountInfoContent'

const mocks = vi.hoisted(() => ({ useLedgerAccountPreview: vi.fn() }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useLedgerAccountPreview: mocks.useLedgerAccountPreview,
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

const baseAsset = {
    assetId: '0',
    name: 'Algo',
    unitName: 'ALGO',
    amount: new Decimal(5),
    fiatValue: new Decimal(10),
    verificationTier: 'verified',
    isAlgo: true,
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

        expect(result.current.title).toBe('Ledger #0')
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
        expect(result.current.title).toBe('Ledger #3')
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
            address: 'AUTH',
        })
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

        const rekeyAddresses = result.current.items
            .filter(i => i.kind === 'rekeyAddress')
            .map(i => (i.kind === 'rekeyAddress' ? i.address : ''))
        expect(rekeyAddresses).toEqual(['R1', 'R2'])
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

    it('carries Decimal instances for algoBalance and fiatValue on the account item', () => {
        mocks.useLedgerAccountPreview.mockReturnValue({
            preview: {
                address: 'ADDR',
                algoBalance: new Decimal('408.2'),
                totalFiatValue: new Decimal('48.45'),
                assets: [baseAsset],
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
            expect(acct.fiatValue).toBeInstanceOf(Decimal)
            expect(acct.fiatValue.toString()).toBe('48.45')
        }
    })
})
