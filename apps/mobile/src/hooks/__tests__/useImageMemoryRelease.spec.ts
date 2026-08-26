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

const {
    appStateListeners,
    mockRemove,
    mockClearMemoryCache,
    mockClearDiskCache,
} = vi.hoisted(() => ({
    appStateListeners: [] as ((state: string) => void)[],
    mockRemove: vi.fn(),
    mockClearMemoryCache: vi.fn(),
    mockClearDiskCache: vi.fn(),
}))

vi.mock('react-native', async importOriginal => ({
    ...(await importOriginal<typeof import('react-native')>()),
    AppState: {
        currentState: 'active',
        addEventListener: (_type: string, cb: (state: string) => void) => {
            appStateListeners.push(cb)
            return { remove: mockRemove }
        },
    },
}))

vi.mock('expo-image', () => ({
    Image: {
        clearMemoryCache: mockClearMemoryCache,
        clearDiskCache: mockClearDiskCache,
    },
}))

import { useImageMemoryRelease } from '../useImageMemoryRelease'

const emit = (state: string) => {
    for (const listener of appStateListeners) listener(state)
}

describe('useImageMemoryRelease', () => {
    beforeEach(() => {
        appStateListeners.length = 0
        vi.clearAllMocks()
    })

    it('clears the memory cache when the app leaves the foreground', () => {
        renderHook(() => useImageMemoryRelease())

        emit('background')

        expect(mockClearMemoryCache).toHaveBeenCalledTimes(1)
    })

    it('leaves the cache alone when returning to the foreground', () => {
        renderHook(() => useImageMemoryRelease())

        emit('background')
        mockClearMemoryCache.mockClear()
        emit('active')

        expect(mockClearMemoryCache).not.toHaveBeenCalled()
    })

    it('never clears the disk cache, so a resume reads locally', () => {
        renderHook(() => useImageMemoryRelease())

        emit('background')
        emit('active')
        emit('background')

        expect(mockClearDiskCache).not.toHaveBeenCalled()
    })

    it('removes the listener on unmount', () => {
        const { unmount } = renderHook(() => useImageMemoryRelease())

        unmount()

        expect(mockRemove).toHaveBeenCalledTimes(1)
    })
})
