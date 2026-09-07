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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Dimensions, Platform, type EmitterSubscription } from 'react-native'
import {
    lockAsync,
    unlockAsync,
    OrientationLock,
} from 'expo-screen-orientation'
import { useOrientationPolicy } from '../useOrientationPolicy'

vi.mock('expo-screen-orientation', () => ({
    lockAsync: vi.fn().mockResolvedValue(undefined),
    unlockAsync: vi.fn().mockResolvedValue(undefined),
    OrientationLock: { PORTRAIT_UP: 'PORTRAIT_UP' },
}))

const removeListener = vi.fn()
let dimensionsListener: (() => void) | undefined

const mockScreen = (width: number, height: number) => {
    vi.spyOn(Dimensions, 'get').mockReturnValue({
        width,
        height,
        scale: 1,
        fontScale: 1,
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    dimensionsListener = undefined
    Platform.OS = 'android'
    vi.spyOn(Dimensions, 'addEventListener').mockImplementation(
        (_type, handler) => {
            dimensionsListener = handler as () => void
            return { remove: removeListener } as unknown as EmitterSubscription
        },
    )
})

describe('useOrientationPolicy', () => {
    it('locks phones to portrait', () => {
        mockScreen(393, 852)

        renderHook(() => useOrientationPolicy())

        expect(lockAsync).toHaveBeenCalledWith(OrientationLock.PORTRAIT_UP)
        expect(unlockAsync).not.toHaveBeenCalled()
    })

    it('unlocks large screens', () => {
        mockScreen(800, 1280)

        renderHook(() => useOrientationPolicy())

        expect(unlockAsync).toHaveBeenCalled()
        expect(lockAsync).not.toHaveBeenCalled()
    })

    it('classifies by the smallest side, so a rotated tablet stays unlocked', () => {
        mockScreen(1280, 800)

        renderHook(() => useOrientationPolicy())

        expect(unlockAsync).toHaveBeenCalled()
    })

    it('re-decides when unfolding crosses the large-screen boundary', () => {
        mockScreen(393, 852)
        renderHook(() => useOrientationPolicy())
        expect(lockAsync).toHaveBeenCalledTimes(1)

        mockScreen(720, 852)
        dimensionsListener?.()

        expect(unlockAsync).toHaveBeenCalledTimes(1)
    })

    it('does not re-apply an unchanged decision on rotation events', () => {
        mockScreen(800, 1280)
        renderHook(() => useOrientationPolicy())

        mockScreen(1280, 800)
        dimensionsListener?.()

        expect(unlockAsync).toHaveBeenCalledTimes(1)
    })

    it('removes the dimensions listener on unmount', () => {
        mockScreen(393, 852)

        const { unmount } = renderHook(() => useOrientationPolicy())
        unmount()

        expect(removeListener).toHaveBeenCalled()
    })

    it('does nothing on iOS, where the per-idiom plist governs', () => {
        Platform.OS = 'ios'
        mockScreen(393, 852)

        renderHook(() => useOrientationPolicy())

        expect(lockAsync).not.toHaveBeenCalled()
        expect(unlockAsync).not.toHaveBeenCalled()
        expect(Dimensions.addEventListener).not.toHaveBeenCalled()
    })
})
