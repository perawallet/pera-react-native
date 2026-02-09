import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAssetTransferDisplay } from '../useAssetTransferDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { UseQueryResult } from '@tanstack/react-query'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        getAssetTransferType: vi.fn(() => 'transfer'),
    }
})

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: vi.fn(),
    }
})

describe('useAssetTransferDisplay', () => {
    const baseTx = {
        sender: 'SENDER',
        fee: 1000n,
        id: 'TX_ID',
        assetTransferTransaction: {
            receiver: 'RECEIVER',
            amount: 1000000n,
            assetId: 123n,
        },
    } as unknown as PeraDisplayableTransaction

    it('returns asset metadata as metadataHash when present', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: {
                assetId: '123',
                name: 'Test',
                decimals: 6,
                metadata: 'some-metadata-value',
            },
        } as UseQueryResult<NoInfer<PeraAsset>, unknown>)

        const { result } = renderHook(() => useAssetTransferDisplay(baseTx))

        expect(result.current.metadataHash).toBe('some-metadata-value')
    })

    it('returns undefined metadataHash when asset has no metadata', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: {
                assetId: '123',
                name: 'Test',
                decimals: 6,
            },
        } as UseQueryResult<NoInfer<PeraAsset>, unknown>)

        const { result } = renderHook(() => useAssetTransferDisplay(baseTx))

        expect(result.current.metadataHash).toBeUndefined()
    })

    it('manages modal state for metadata hash details', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: {
                assetId: '123',
                name: 'Test',
                decimals: 6,
                metadata: 'hash',
            },
        } as UseQueryResult<NoInfer<PeraAsset>, unknown>)

        const { result } = renderHook(() => useAssetTransferDisplay(baseTx))

        expect(result.current.isMetadataHashDetailsModalOpen).toBe(false)

        act(() => {
            result.current.openMetadataHashDetailsModal()
        })

        expect(result.current.isMetadataHashDetailsModalOpen).toBe(true)

        act(() => {
            result.current.closeMetadataHashDetailsModal()
        })

        expect(result.current.isMetadataHashDetailsModalOpen).toBe(false)
    })
})
