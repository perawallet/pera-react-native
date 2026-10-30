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
import { act, renderHook } from '@testing-library/react'
import { useMediaCarousel } from '../useMediaCarousel'
import type { MediaItem } from '../resolveMediaImageUri'

vi.mock('@components/VideoPlayer', () => ({ VideoPlayer: () => null }))
vi.mock('@components/AudioPlayer', () => ({ AudioPlayer: () => null }))

const image = (id: string): MediaItem =>
    ({ id, type: 'image', previewUrl: `https://pera.example/${id}.png` }) as MediaItem

describe('useMediaCarousel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('lists one page per visual media item', () => {
        const { result } = renderHook(() =>
            useMediaCarousel({ media: [image('a'), image('b')] }),
        )

        expect(result.current.pages).toHaveLength(2)
        expect(result.current.hasMultiple).toBe(true)
    })

    it('follows the page the pager settles on', () => {
        const { result } = renderHook(() =>
            useMediaCarousel({ media: [image('a'), image('b')] }),
        )

        act(() => result.current.handlePageSelected(1))

        expect(result.current.activeIndex).toBe(1)
    })
})
