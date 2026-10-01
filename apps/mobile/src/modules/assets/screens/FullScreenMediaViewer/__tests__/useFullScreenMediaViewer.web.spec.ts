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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFullScreenMediaViewer } from '../useFullScreenMediaViewer.web'
import type { FullScreenMediaItem } from '../FullScreenMediaViewer'

const { mockOpenValidatedBrowserUrl } = vi.hoisted(() => ({
    mockOpenValidatedBrowserUrl: vi.fn(),
}))

vi.mock('@modules/webview', () => ({
    openValidatedBrowserUrl: mockOpenValidatedBrowserUrl,
}))

const media: FullScreenMediaItem[] = [
    { uri: 'https://example.com/a.png', type: 'image' },
    { uri: 'https://example.com/b.mp4', type: 'video' },
    { uri: 'https://example.com/c.png', type: 'image' },
]

const pressKey = (key: string) =>
    act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key }))
    })

describe('useFullScreenMediaViewer (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('starts on the requested item', () => {
        const { result } = renderHook(() => useFullScreenMediaViewer(media, 1))

        expect(result.current.activeItem).toEqual(media[1])
        expect(result.current.hasPrevious).toBe(true)
        expect(result.current.hasNext).toBe(true)
    })

    it('clamps an out-of-range initial index to the last item', () => {
        const { result } = renderHook(() => useFullScreenMediaViewer(media, 9))

        expect(result.current.activeIndex).toBe(2)
        expect(result.current.hasNext).toBe(false)
    })

    it('steps through items and stops at both ends', () => {
        const { result } = renderHook(() => useFullScreenMediaViewer(media, 0))

        act(() => result.current.handlePrevious())
        expect(result.current.activeIndex).toBe(0)

        act(() => result.current.handleNext())
        act(() => result.current.handleNext())
        act(() => result.current.handleNext())
        expect(result.current.activeIndex).toBe(2)
    })

    it('navigates with the arrow keys', () => {
        const { result } = renderHook(() => useFullScreenMediaViewer(media, 0))

        pressKey('ArrowRight')
        expect(result.current.activeIndex).toBe(1)

        pressKey('ArrowLeft')
        expect(result.current.activeIndex).toBe(0)
    })

    it('stops listening for arrow keys after unmount', () => {
        const { result, unmount } = renderHook(() =>
            useFullScreenMediaViewer(media, 0),
        )
        unmount()

        pressKey('ArrowRight')

        expect(result.current.activeIndex).toBe(0)
    })

    it('opens the active item original through the URL validator', () => {
        const { result } = renderHook(() => useFullScreenMediaViewer(media, 0))

        act(() => result.current.handleNext())
        act(() => result.current.handleOpenOriginal())

        expect(mockOpenValidatedBrowserUrl).toHaveBeenCalledWith(
            'https://example.com/b.mp4',
        )
    })

    it('has nothing to open when there is no media', () => {
        const { result } = renderHook(() => useFullScreenMediaViewer([], 0))

        act(() => result.current.handleOpenOriginal())

        expect(result.current.activeItem).toBeUndefined()
        expect(mockOpenValidatedBrowserUrl).not.toHaveBeenCalled()
    })
})
