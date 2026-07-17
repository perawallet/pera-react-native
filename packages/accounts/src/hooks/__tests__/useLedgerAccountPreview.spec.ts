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
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { useLedgerAccountPreview } from '../useLedgerAccountPreview'

const mocks = vi.hoisted(() => ({
    useOnChainAccountInformationQuery: vi.fn(),
    useRekeyedAddressesQuery: vi.fn(),
    useAssetsQuery: vi.fn(),
    useAssetPricesQuery: vi.fn(),
    useCurrency: vi.fn(),
}))

vi.mock('../useOnChainAccountInformationQuery', () => ({
    useOnChainAccountInformationQuery: mocks.useOnChainAccountInformationQuery,
}))
vi.mock('../useRekeyedAddressesQuery', () => ({
    useRekeyedAddressesQuery: mocks.useRekeyedAddressesQuery,
}))
vi.mock('@perawallet/wallet-core-assets', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-assets')
    >('@perawallet/wallet-core-assets')
    return {
        ...actual,
        useAssetsQuery: mocks.useAssetsQuery,
        useAssetPricesQuery: mocks.useAssetPricesQuery,
    }
})
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: mocks.useCurrency,
}))

beforeEach(() => {
    vi.clearAllMocks()
    mocks.useCurrency.mockReturnValue({
        usdToPreferred: (usd: Decimal) => usd, // 1:1 USD for tests
    })
    mocks.useAssetsQuery.mockReturnValue({ data: new Map(), isPending: false })
    mocks.useAssetPricesQuery.mockReturnValue({
        data: new Map([
            [
                ALGO_ASSET_ID,
                { assetId: ALGO_ASSET_ID, usdPrice: new Decimal(2) },
            ],
        ]),
        isPending: false,
    })
    mocks.useRekeyedAddressesQuery.mockReturnValue({
        rekeyedAddresses: [],
        isLoading: false,
        isError: false,
    })
})

describe('useLedgerAccountPreview', () => {
    it('composes ALGO balance and total fiat value', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 3_000_000n,
                minBalance: 100_000n,
                status: 'Offline',
                rewards: 0n,
                assets: [],
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))

        expect(result.current.isLoading).toBe(false)
        expect(result.current.preview?.algoBalance.toString()).toBe('3')
        expect(result.current.preview?.totalFiatValue.toString()).toBe('6')
        expect(result.current.preview?.assets).toHaveLength(1)
        expect(result.current.preview?.assets[0].isAlgo).toBe(true)
        expect(result.current.preview?.assets[0].unitName).toBe('ALGO')
        expect(result.current.preview?.assets[0].decimals).toBe(6)
        expect(result.current.preview?.assets[0].usdPrice.toString()).toBe('2')
    })

    it('includes ASA holdings with metadata, fiat value and verification tier', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 0n,
                minBalance: 0n,
                status: 'Offline',
                rewards: 0n,
                assets: [
                    { assetId: 31566704n, amount: 1_500_000n, isFrozen: false },
                ],
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })
        mocks.useAssetsQuery.mockReturnValue({
            data: new Map([
                [
                    '31566704',
                    {
                        assetId: '31566704',
                        name: 'USDC',
                        unitName: 'USDC',
                        decimals: 6,
                        peraMetadata: {
                            verificationTier: 'verified',
                            logo: 'https://logo',
                        },
                    },
                ],
            ]),
            isPending: false,
        })
        mocks.useAssetPricesQuery.mockReturnValue({
            data: new Map([
                ['0', { assetId: '0', usdPrice: new Decimal(0) }],
                ['31566704', { assetId: '31566704', usdPrice: new Decimal(1) }],
            ]),
            isPending: false,
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))

        const usdc = result.current.preview?.assets.find(
            a => a.assetId === '31566704',
        )
        expect(usdc?.amount.toString()).toBe('1.5')
        expect(usdc?.fiatValue.toString()).toBe('1.5')
        expect(usdc?.verificationTier).toBe('verified')
        expect(usdc?.name).toBe('USDC')
        expect(usdc?.decimals).toBe(6)
        expect(usdc?.usdPrice.toString()).toBe('1')
    })

    it('flags holdings with missing asset metadata instead of pretending decimals=0', () => {
        // Arrange
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 0n,
                minBalance: 0n,
                status: 'Offline',
                rewards: 0n,
                assets: [{ assetId: 99999999n, amount: 42n, isFrozen: false }],
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })
        // useAssetsQuery returns an empty Map (beforeEach default) — no metadata for 99999999

        // Act
        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))

        // Assert
        const asa = result.current.preview?.assets.find(
            a => a.assetId === '99999999',
        )
        expect(asa?.name).toBe('99999999')
        expect(asa?.unitName).toBe('')
        expect(asa?.verificationTier).toBe('unverified')
        expect(asa?.hasKnownDecimals).toBe(false)
        expect(asa?.fiatValue.toString()).toBe('0')
        expect(asa?.isAlgo).toBe(false)
    })

    it('excludes unknown-decimals holdings from fiat totals even when a price exists', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 0n,
                minBalance: 0n,
                status: 'Offline',
                rewards: 0n,
                assets: [{ assetId: 99999999n, amount: 42n, isFrozen: false }],
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })
        mocks.useAssetPricesQuery.mockReturnValue({
            data: new Map([
                ['0', { assetId: '0', usdPrice: new Decimal(2) }],
                ['99999999', { assetId: '99999999', usdPrice: new Decimal(1) }],
            ]),
            isPending: false,
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))

        // A price times a base-unit amount would be garbage — the holding
        // must contribute nothing to fiat until its decimals are known.
        const asa = result.current.preview?.assets.find(
            a => a.assetId === '99999999',
        )
        expect(asa?.fiatValue.toString()).toBe('0')
        expect(result.current.preview?.totalFiatValue.toString()).toBe('0')
    })

    it('marks ALGO and metadata-backed holdings as having known decimals', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 1_000_000n,
                minBalance: 0n,
                status: 'Offline',
                rewards: 0n,
                assets: [
                    { assetId: 31566704n, amount: 1_500_000n, isFrozen: false },
                ],
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })
        mocks.useAssetsQuery.mockReturnValue({
            data: new Map([
                [
                    '31566704',
                    {
                        assetId: '31566704',
                        name: 'USDC',
                        unitName: 'USDC',
                        decimals: 6,
                    },
                ],
            ]),
            isPending: false,
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))

        expect(
            result.current.preview?.assets.map(a => a.hasKnownDecimals),
        ).toEqual([true, true])
    })

    it('reports rekeyedTo when the account is rekeyed', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 0n,
                minBalance: 0n,
                status: 'Offline',
                rewards: 0n,
                assets: [],
                authAddress: 'AUTHADDR',
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })
        mocks.useRekeyedAddressesQuery.mockReturnValue({
            rekeyedAddresses: ['SOMEONE'],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))

        expect(result.current.preview?.rekey).toEqual({
            kind: 'rekeyedTo',
            authAddress: 'AUTHADDR',
        })
    })

    it('reports canSignFor when accounts are rekeyed to it and it is not rekeyed', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 0n,
                minBalance: 0n,
                status: 'Offline',
                rewards: 0n,
                assets: [],
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })
        mocks.useRekeyedAddressesQuery.mockReturnValue({
            rekeyedAddresses: ['R1', 'R2'],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))

        expect(result.current.preview?.rekey).toEqual({
            kind: 'canSignFor',
            addresses: ['R1', 'R2'],
        })
    })

    it('reports rekey none when neither applies', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 0n,
                minBalance: 0n,
                status: 'Offline',
                rewards: 0n,
                assets: [],
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))

        expect(result.current.preview?.rekey).toEqual({ kind: 'none' })
    })

    it('surfaces loading and error from the on-chain query', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))
        expect(result.current.isLoading).toBe(true)
        expect(result.current.preview).toBeUndefined()

        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            refetch: vi.fn(),
        })
        const { result: errResult } = renderHook(() =>
            useLedgerAccountPreview('ADDR'),
        )
        expect(errResult.current.isError).toBe(true)
    })

    it('degrades rekey to none when the rekeyed-addresses query errors', () => {
        mocks.useOnChainAccountInformationQuery.mockReturnValue({
            data: {
                address: 'ADDR',
                amount: 0n,
                minBalance: 0n,
                status: 'Offline',
                rewards: 0n,
                assets: [],
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })
        mocks.useRekeyedAddressesQuery.mockReturnValue({
            rekeyedAddresses: undefined,
            isLoading: false,
            isError: true,
        })

        const { result } = renderHook(() => useLedgerAccountPreview('ADDR'))
        expect(result.current.preview?.rekey).toEqual({ kind: 'none' })
    })
})
