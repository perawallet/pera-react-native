import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Decimal from 'decimal.js'
import { useRemoveAssetsScreen } from '../useRemoveAssetsScreen'
import {
    useAccountsStore,
    useAccountBalancesQuery,
} from '@perawallet/wallet-core-accounts'

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

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountsStore: vi.fn((selector: Function) =>
            selector({ getSelectedAccount: () => mockAccount }),
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

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

describe('useRemoveAssetsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(useAccountsStore).mockImplementation((selector: Function) =>
            selector({ getSelectedAccount: () => mockAccount }),
        )

        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            accountBalances: new Map([
                [
                    'test-address',
                    { assetBalances: mockAssetBalances },
                ],
            ]),
        } as ReturnType<typeof useAccountBalancesQuery>)
    })

    it('filters out ALGO and non-zero balance assets', () => {
        // Arrange & Act
        const { result } = renderHook(() => useRemoveAssetsScreen())

        // Assert
        expect(result.current.removableAssets).toHaveLength(2)
        expect(result.current.removableAssets[0].assetId).toBe('123')
        expect(result.current.removableAssets[1].assetId).toBe('456')
    })

    it('initially has no assets selected', () => {
        // Arrange & Act
        const { result } = renderHook(() => useRemoveAssetsScreen())

        // Assert
        expect(result.current.selectedAssetIds.size).toBe(0)
    })

    it('has isAllSelected as false initially', () => {
        // Arrange & Act
        const { result } = renderHook(() => useRemoveAssetsScreen())

        // Assert
        expect(result.current.isAllSelected).toBe(false)
    })

    it('adds an asset to selection via handleToggleSelect', () => {
        // Arrange
        const { result } = renderHook(() => useRemoveAssetsScreen())

        // Act
        act(() => {
            result.current.handleToggleSelect('123')
        })

        // Assert
        expect(result.current.selectedAssetIds.has('123')).toBe(true)
        expect(result.current.selectedAssetIds.size).toBe(1)
    })

    it('removes an already-selected asset via handleToggleSelect', () => {
        // Arrange
        const { result } = renderHook(() => useRemoveAssetsScreen())

        // Act
        act(() => {
            result.current.handleToggleSelect('123')
        })
        act(() => {
            result.current.handleToggleSelect('123')
        })

        // Assert
        expect(result.current.selectedAssetIds.has('123')).toBe(false)
        expect(result.current.selectedAssetIds.size).toBe(0)
    })

    it('selects all removable assets via handleToggleSelectAll', () => {
        // Arrange
        const { result } = renderHook(() => useRemoveAssetsScreen())

        // Act
        act(() => {
            result.current.handleToggleSelectAll()
        })

        // Assert
        expect(result.current.selectedAssetIds.size).toBe(2)
        expect(result.current.selectedAssetIds.has('123')).toBe(true)
        expect(result.current.selectedAssetIds.has('456')).toBe(true)
        expect(result.current.isAllSelected).toBe(true)
    })

    it('deselects all when all are selected via handleToggleSelectAll', () => {
        // Arrange
        const { result } = renderHook(() => useRemoveAssetsScreen())

        act(() => {
            result.current.handleToggleSelectAll()
        })
        expect(result.current.isAllSelected).toBe(true)

        // Act
        act(() => {
            result.current.handleToggleSelectAll()
        })

        // Assert
        expect(result.current.selectedAssetIds.size).toBe(0)
        expect(result.current.isAllSelected).toBe(false)
    })

    it('returns empty removableAssets when no account is selected', () => {
        // Arrange
        vi.mocked(useAccountsStore).mockImplementation((selector: Function) =>
            selector({ getSelectedAccount: () => null }),
        )

        // Act
        const { result } = renderHook(() => useRemoveAssetsScreen())

        // Assert
        expect(result.current.removableAssets).toHaveLength(0)
    })
})
