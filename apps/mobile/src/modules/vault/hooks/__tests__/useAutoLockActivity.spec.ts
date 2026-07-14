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

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { armAutoLock } = vi.hoisted(() => ({ armAutoLock: vi.fn() }))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    armAutoLock,
}))

import { useAutoLockActivity } from '../useAutoLockActivity'

const fireActivity = (
    type: 'pointerdown' | 'keydown' = 'pointerdown',
): void => {
    globalThis.dispatchEvent(new Event(type))
}

describe('useAutoLockActivity', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        armAutoLock.mockClear()
        armAutoLock.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('does not re-arm on activity while locked', () => {
        renderHook(() => useAutoLockActivity(false))
        fireActivity()
        expect(armAutoLock).not.toHaveBeenCalled()
    })

    it('re-arms on the first activity event while unlocked', () => {
        renderHook(() => useAutoLockActivity(true))
        fireActivity()
        expect(armAutoLock).toHaveBeenCalledTimes(1)
    })

    it('re-arms only once for a burst of events within the throttle window', () => {
        renderHook(() => useAutoLockActivity(true))
        fireActivity('pointerdown')
        fireActivity('keydown')
        fireActivity('pointerdown')
        expect(armAutoLock).toHaveBeenCalledTimes(1)
    })

    it('re-arms again after the throttle window elapses', () => {
        renderHook(() => useAutoLockActivity(true))
        fireActivity()
        expect(armAutoLock).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(60_000)
        fireActivity()
        expect(armAutoLock).toHaveBeenCalledTimes(2)
    })

    it('removes its listeners on unmount', () => {
        const { unmount } = renderHook(() => useAutoLockActivity(true))
        unmount()
        fireActivity()
        expect(armAutoLock).not.toHaveBeenCalled()
    })
})
