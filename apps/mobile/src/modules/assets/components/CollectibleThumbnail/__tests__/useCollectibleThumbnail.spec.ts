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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCollectibleThumbnail } from '../useCollectibleThumbnail'

describe('useCollectibleThumbnail', () => {
    it('returns the url untouched when no image width is given', () => {
        const { result } = renderHook(() =>
            useCollectibleThumbnail({
                thumbnailUrl: 'https://example.com/nft.png',
            }),
        )

        expect(result.current.imageUrl).toBe('https://example.com/nft.png')
        expect(result.current.showPlaceholder).toBe(false)
    })

    it('appends prism resize params when an image width is given', () => {
        const { result } = renderHook(() =>
            useCollectibleThumbnail({
                thumbnailUrl: 'https://example.com/nft.png',
                imageWidth: 600,
            }),
        )

        expect(result.current.imageUrl).toBe(
            'https://example.com/nft.png?width=600&quality=70',
        )
    })

    it('shows the placeholder when there is no url', () => {
        const { result } = renderHook(() =>
            useCollectibleThumbnail({ thumbnailUrl: undefined }),
        )

        expect(result.current.imageUrl).toBeUndefined()
        expect(result.current.showPlaceholder).toBe(true)
    })

    it('shows the placeholder after the image fails to load', () => {
        const { result } = renderHook(() =>
            useCollectibleThumbnail({
                thumbnailUrl: 'https://example.com/nft.png',
            }),
        )

        act(() => result.current.handleImageError())

        expect(result.current.showPlaceholder).toBe(true)
    })

    it('retries the image when the url changes after a failure', () => {
        const { result, rerender } = renderHook(useCollectibleThumbnail, {
            initialProps: {
                thumbnailUrl: 'https://example.com/broken.png' as
                    | string
                    | undefined,
            },
        })

        act(() => result.current.handleImageError())
        expect(result.current.showPlaceholder).toBe(true)

        rerender({ thumbnailUrl: 'https://example.com/fresh.png' })

        expect(result.current.showPlaceholder).toBe(false)
        expect(result.current.imageUrl).toBe('https://example.com/fresh.png')
    })
})
