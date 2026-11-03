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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { LockOverlayState } from '@hooks/useIsLockOverlayVisible'
import { useQRScannerLockCheck } from '../useQRScannerLockCheck'

const lock = vi.hoisted(() => ({ state: 'none' as LockOverlayState }))

vi.mock('@hooks/useIsLockOverlayVisible', () => ({
    useLockOverlayState: () => lock.state,
}))

const renderLockCheck = (isVisible: boolean) =>
    renderHook(({ visible }) => useQRScannerLockCheck(visible), {
        initialProps: { visible: isVisible },
    })

describe('useQRScannerLockCheck', () => {
    beforeEach(() => {
        lock.state = 'none'
    })

    it('presents a requested scanner while nothing covers the app', () => {
        const { result } = renderLockCheck(true)

        expect(result.current).toEqual({
            isScannerRequested: true,
            isCoveredForLockCheck: false,
        })
    })

    // Dismissing and re-presenting the Modal read as the scanner closing.
    it('keeps an already open scanner presented but covered during the lock check', () => {
        const { result, rerender } = renderLockCheck(true)

        lock.state = 'checking'
        rerender({ visible: true })

        expect(result.current).toEqual({
            isScannerRequested: true,
            isCoveredForLockCheck: true,
        })
    })

    // A cold start must not flash a cover before the PIN screen.
    it('holds a scanner requested during the lock check until it ends', () => {
        const { result, rerender } = renderLockCheck(false)

        lock.state = 'checking'
        rerender({ visible: true })
        expect(result.current).toEqual({
            isScannerRequested: false,
            isCoveredForLockCheck: false,
        })

        lock.state = 'none'
        rerender({ visible: true })
        expect(result.current.isScannerRequested).toBe(true)
    })

    it('dismisses the scanner while the PIN screen shows', () => {
        const { result, rerender } = renderLockCheck(true)

        lock.state = 'locked'
        rerender({ visible: true })

        expect(result.current).toEqual({
            isScannerRequested: false,
            isCoveredForLockCheck: false,
        })
    })
})
