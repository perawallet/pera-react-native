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
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import { useAssetItemView } from '../useAssetItemView'

const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

const make = (overrides: Partial<DisplayableAsset> = {}): DisplayableAsset => ({
    assetId: '123',
    name: 'Test Asset',
    unitName: 'TST',
    ...overrides,
})

describe('useAssetItemView', () => {
    it('derives a standard asset row', () => {
        const { result } = renderHook(() => useAssetItemView(make()))
        expect(result.current.isCollectible).toBe(false)
        expect(result.current.displayName).toBe('Test Asset')
        expect(result.current.secondaryText).toBe('TST - 123')
        expect(result.current.iconShape).toBe('circle')
    })

    it('falls back to "Asset #<id>" when unnamed', () => {
        const { result } = renderHook(() =>
            useAssetItemView(make({ name: undefined })),
        )
        expect(result.current.displayName).toBe('Asset #123')
    })

    it('falls back to "Asset #<id>" when the name is an empty string', () => {
        const { result } = renderHook(() =>
            useAssetItemView(make({ name: '' })),
        )
        expect(result.current.displayName).toBe('Asset #123')
    })

    it('renders the verified verification icon from the tier', () => {
        const { result } = renderHook(() =>
            useAssetItemView(
                make({ peraMetadata: { verificationTier: 'verified' } }),
            ),
        )
        expect(result.current.verificationIcon).toBe('assets/verified')
    })

    it('marks suspicious assets', () => {
        const { result } = renderHook(() =>
            useAssetItemView(
                make({ peraMetadata: { verificationTier: 'suspicious' } }),
            ),
        )
        expect(result.current.isSuspicious).toBe(true)
        expect(result.current.verificationIcon).toBe('assets/suspicious')
    })

    it('treats ALGO specially', () => {
        const { result } = renderHook(() =>
            useAssetItemView(
                make({ assetId: '0', name: 'Algo', unitName: 'ALGO' }),
            ),
        )
        expect(result.current.isAlgo).toBe(true)
        expect(result.current.displayName).toBe('Algo')
        expect(result.current.verificationIcon).toBe('assets/trusted')
        expect(result.current.secondaryText).toBe('ALGO')
    })

    it('derives a collectible row (square icon, collection subtitle)', () => {
        const { result } = renderHook(() =>
            useAssetItemView(
                make({
                    name: undefined,
                    peraMetadata: {
                        type: 'collectible',
                        verificationTier: 'unverified',
                        collectible: {
                            title: 'Penguin #42',
                            collection: { name: 'Penguins' },
                        },
                    },
                }),
            ),
        )
        expect(result.current.isCollectible).toBe(true)
        expect(result.current.displayName).toBe('Penguin #42')
        expect(result.current.secondaryText).toBe('Penguins - 123')
        expect(result.current.iconShape).toBe('square')
    })

    it('exposes the deleted flag', () => {
        const { result } = renderHook(() =>
            useAssetItemView(make({ peraMetadata: { isDeleted: true } })),
        )
        expect(result.current.isDeleted).toBe(true)
    })

    describe('onCopyAssetId', () => {
        beforeEach(() => {
            mockCopyToClipboard.mockClear()
        })

        it('copies the asset id when copyableAssetId is on', () => {
            const { result } = renderHook(() =>
                useAssetItemView(make(), { copyableAssetId: true }),
            )

            result.current.onCopyAssetId?.()

            expect(result.current.onCopyAssetId).toBeDefined()
            expect(mockCopyToClipboard).toHaveBeenCalledWith('123')
        })

        it('is undefined when copyableAssetId is off', () => {
            const { result } = renderHook(() => useAssetItemView(make()))
            expect(result.current.onCopyAssetId).toBeUndefined()
        })

        it('is undefined for ALGO even when copyableAssetId is on', () => {
            const { result } = renderHook(() =>
                useAssetItemView(
                    make({ assetId: '0', name: 'Algo', unitName: 'ALGO' }),
                    { copyableAssetId: true },
                ),
            )
            expect(result.current.onCopyAssetId).toBeUndefined()
        })
    })
})
