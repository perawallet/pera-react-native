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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useRemoveAssetsScreen } from '../useRemoveAssetsScreen'
import type { Nullable } from '@perawallet/wallet-core-shared'

const mockAccount = { address: 'test-address', name: 'Test' }

const mockAssetBalances = [
    {
        assetId: '0',
        amount: new Decimal('1000'),
        algoValue: new Decimal('1000'),
    },
    { assetId: '123', amount: new Decimal(0), algoValue: new Decimal(0) },
    { assetId: '456', amount: new Decimal(0), algoValue: new Decimal(0) },
    {
        assetId: '789',
        amount: new Decimal('500'),
        algoValue: new Decimal('500'),
    },
]

const { mockGetSelectedAccount } = vi.hoisted(() => ({
    mockGetSelectedAccount: vi.fn(
        () => mockAccount as Nullable<typeof mockAccount>,
    ),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountsStore: vi.fn((selector: (state: unknown) => unknown) =>
            selector({ getSelectedAccount: mockGetSelectedAccount }),
        ),
        useAccountBalancesQuery: vi.fn(() => ({
            accountBalances: new Map([
                ['test-address', { assetBalances: mockAssetBalances }],
            ]),
        })),
    }
})

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: '0',
    useAssetsQuery: vi.fn(() => ({ data: new Map() })),
}))

const { mockOptOut } = vi.hoisted(() => ({
    mockOptOut: vi.fn().mockResolvedValue({ txIds: ['tx1'] }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptOutMutation: () => ({
        optOut: mockOptOut,
        isLoading: false,
        isError: false,
        error: null,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

describe('useRemoveAssetsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetSelectedAccount.mockReturnValue(mockAccount)
    })

    it('filters out ALGO and non-zero balance assets', () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        expect(result.current.removableAssets).toHaveLength(2)
        expect(result.current.removableAssets[0].assetId).toBe('123')
        expect(result.current.removableAssets[1].assetId).toBe('456')
    })

    it('initially has no assets selected', () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        expect(result.current.selectedAssetIds.size).toBe(0)
    })

    it('has isAllSelected as false initially', () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        expect(result.current.isAllSelected).toBe(false)
    })

    it('adds an asset to selection via handleToggleSelect', () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelect('123')
        })

        expect(result.current.selectedAssetIds.has('123')).toBe(true)
        expect(result.current.selectedAssetIds.size).toBe(1)
    })

    it('removes an already-selected asset via handleToggleSelect', () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelect('123')
        })
        act(() => {
            result.current.handleToggleSelect('123')
        })

        expect(result.current.selectedAssetIds.has('123')).toBe(false)
        expect(result.current.selectedAssetIds.size).toBe(0)
    })

    it('selects all removable assets via handleToggleSelectAll', () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelectAll()
        })

        expect(result.current.selectedAssetIds.size).toBe(2)
        expect(result.current.selectedAssetIds.has('123')).toBe(true)
        expect(result.current.selectedAssetIds.has('456')).toBe(true)
        expect(result.current.isAllSelected).toBe(true)
    })

    it('deselects all when all are selected via handleToggleSelectAll', () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelectAll()
        })
        expect(result.current.isAllSelected).toBe(true)

        act(() => {
            result.current.handleToggleSelectAll()
        })

        expect(result.current.selectedAssetIds.size).toBe(0)
        expect(result.current.isAllSelected).toBe(false)
    })

    it('returns empty removableAssets when no account is selected', () => {
        mockGetSelectedAccount.mockReturnValue(null)

        const { result } = renderHook(() => useRemoveAssetsScreen())

        expect(result.current.removableAssets).toHaveLength(0)
    })

    it('calls optOut with correct params when handleRemoveSelected is invoked', async () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelect('123')
        })

        await act(async () => {
            await result.current.handleRemoveSelected()
        })

        expect(mockOptOut).toHaveBeenCalledWith([
            {
                sender: 'test-address',
                assetId: BigInt('123'),
                creator: undefined,
            },
        ])
    })

    it('clears selection after successful opt-out', async () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelect('123')
            result.current.handleToggleSelect('456')
        })
        expect(result.current.selectedAssetIds.size).toBe(2)

        await act(async () => {
            await result.current.handleRemoveSelected()
        })

        expect(result.current.selectedAssetIds.size).toBe(0)
    })

    it('does not call optOut when no assets are selected', async () => {
        const { result } = renderHook(() => useRemoveAssetsScreen())

        await act(async () => {
            await result.current.handleRemoveSelected()
        })

        expect(mockOptOut).not.toHaveBeenCalled()
    })

    it('does not call optOut when no account is selected', async () => {
        mockGetSelectedAccount.mockReturnValue(null)
        const { result } = renderHook(() => useRemoveAssetsScreen())

        await act(async () => {
            await result.current.handleRemoveSelected()
        })

        expect(mockOptOut).not.toHaveBeenCalled()
    })

    it('passes creator address when asset metadata is available', async () => {
        const { useAssetsQuery } =
            await import('@perawallet/wallet-core-assets')
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map([['123', { creator: { address: 'CREATOR_ADDR' } }]]),
        } as ReturnType<typeof useAssetsQuery>)

        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelect('123')
        })

        await act(async () => {
            await result.current.handleRemoveSelected()
        })

        expect(mockOptOut).toHaveBeenCalledWith([
            {
                sender: 'test-address',
                assetId: BigInt('123'),
                creator: 'CREATOR_ADDR',
            },
        ])
    })

    it('filters out assets owned by the creator', async () => {
        const { useAssetsQuery } = vi.mocked(
            await import('@perawallet/wallet-core-assets'),
        )
        useAssetsQuery.mockReturnValue({
            data: new Map([
                ['123', { creator: { address: 'test-address' } }],
                ['456', { creator: { address: 'other-creator' } }],
            ]),
        } as unknown as ReturnType<typeof useAssetsQuery>)

        const { result } = renderHook(() => useRemoveAssetsScreen())

        expect(result.current.removableAssets).toHaveLength(1)
        expect(result.current.removableAssets[0].assetId).toBe('456')
    })

    it('sets removeError when optOut rejects', async () => {
        mockOptOut.mockRejectedValueOnce(new Error('Rate limited'))

        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelect('123')
        })

        await act(async () => {
            await result.current.handleRemoveSelected()
        })

        expect(result.current.removeError?.message).toBe('Rate limited')
    })
})
