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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFeeWarning } from '../useFeeWarning'
import { useAssetPricesQuery } from '@perawallet/wallet-core-assets'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import type { Optional } from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPricesQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
    RemoteConfigKeys: {
        fee_warning_standard_fee: 'fee_warning_standard_fee',
        fee_warning_usd_threshold: 'fee_warning_usd_threshold',
    },
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
}))

describe('useFeeWarning', () => {
    const mockGetNumberValue = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockGetNumberValue.mockImplementation((key: string) => {
            if (key === 'fee_warning_standard_fee') return 0.001
            if (key === 'fee_warning_usd_threshold') return 0.01
            return 0
        })
        ;(useRemoteConfig as Mock).mockReturnValue({
            getNumberValue: mockGetNumberValue,
        })
    })

    const setupAlgoPrice = (price: Optional<Decimal>) => {
        const priceMap = new Map()
        if (price) {
            priceMap.set('0', { assetId: '0', usdPrice: price })
        }
        ;(useAssetPricesQuery as Mock).mockReturnValue({
            data: priceMap,
        })
    }

    const setupSigningAnalysis = (
        totalFee: Decimal,
        transactions: { sender: string }[],
        signableAddresses: Set<string>,
    ) => {
        ;(useSigningPipeline as Mock).mockReturnValue({
            totalFee,
            allTransactions: transactions,
            signableAddresses,
        })
    }

    it('returns showWarning: false when fee equals standard fee per tx', () => {
        setupAlgoPrice(new Decimal(100))
        setupSigningAnalysis(
            new Decimal(0.001),
            [{ sender: 'addr1' }],
            new Set(['addr1']),
        )

        const { result } = renderHook(() => useFeeWarning())

        expect(result.current.showWarning).toBe(false)
    })

    it('returns showWarning: true when fee exceeds standard and USD value > threshold', () => {
        setupAlgoPrice(new Decimal(100))
        setupSigningAnalysis(
            new Decimal(0.01),
            [{ sender: 'addr1' }],
            new Set(['addr1']),
        )

        const { result } = renderHook(() => useFeeWarning())

        // fee 0.01 > standard 0.001, USD = 0.01 * 100 = 1.00 > 0.01
        expect(result.current.showWarning).toBe(true)
    })

    it('returns showWarning: false when fee exceeds standard but USD value <= threshold', () => {
        setupAlgoPrice(new Decimal(0.5))
        setupSigningAnalysis(
            new Decimal(0.002),
            [{ sender: 'addr1' }],
            new Set(['addr1']),
        )

        const { result } = renderHook(() => useFeeWarning())

        // fee 0.002 > standard 0.001, USD = 0.002 * 0.5 = 0.001 <= 0.01
        expect(result.current.showWarning).toBe(false)
    })

    it('returns showWarning: false when signableTransactionCount is 0', () => {
        setupAlgoPrice(new Decimal(100))
        setupSigningAnalysis(
            new Decimal(0.01),
            [{ sender: 'addr1' }],
            new Set(), // no signable addresses → 0 signable txs
        )

        const { result } = renderHook(() => useFeeWarning())

        expect(result.current.showWarning).toBe(false)
    })

    it('handles multiple transactions correctly', () => {
        setupAlgoPrice(new Decimal(100))
        setupSigningAnalysis(
            new Decimal(0.003),
            [{ sender: 'addr1' }, { sender: 'addr1' }, { sender: 'addr1' }],
            new Set(['addr1']),
        )

        const { result } = renderHook(() => useFeeWarning())

        // standard total = 3 * 0.001 = 0.003, fee 0.003 is NOT greater
        expect(result.current.showWarning).toBe(false)
    })

    it('returns showWarning: true for inflated multi-tx fees', () => {
        setupAlgoPrice(new Decimal(100))
        setupSigningAnalysis(
            new Decimal(0.01),
            [{ sender: 'addr1' }, { sender: 'addr1' }, { sender: 'addr1' }],
            new Set(['addr1']),
        )

        const { result } = renderHook(() => useFeeWarning())

        // standard total = 3 * 0.001 = 0.003, fee 0.01 > 0.003
        // USD = 0.01 * 100 = 1.00 > 0.01
        expect(result.current.showWarning).toBe(true)
    })

    it('returns showWarning: false when ALGO price is not loaded', () => {
        ;(useAssetPricesQuery as Mock).mockReturnValue({
            data: undefined,
        })
        setupSigningAnalysis(
            new Decimal(0.01),
            [{ sender: 'addr1' }],
            new Set(['addr1']),
        )

        const { result } = renderHook(() => useFeeWarning())

        expect(result.current.showWarning).toBe(false)
    })

    it('returns fee as a Decimal from the signing analysis', () => {
        setupAlgoPrice(new Decimal(100))
        setupSigningAnalysis(
            new Decimal(0.005),
            [{ sender: 'addr1' }],
            new Set(['addr1']),
        )

        const { result } = renderHook(() => useFeeWarning())

        expect(result.current.fee.eq(new Decimal(0.005))).toBe(true)
    })
})
