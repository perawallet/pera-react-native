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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    preventScreenCaptureAsync,
    allowScreenCaptureAsync,
} from 'expo-screen-capture'
import {
    usePreventScreenCapture,
    SECURE_SCREEN_CAPTURE_TAG,
} from '../usePreventScreenCapture'

// Mutable so each test can flip the build-time flag the hook reads.
const { mockConfig } = vi.hoisted(() => ({
    mockConfig: { disableScreenCapturePrevention: false },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: mockConfig,
}))

describe('usePreventScreenCapture', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockConfig.disableScreenCapturePrevention = false
    })

    test('prevents screen capture on mount and re-allows on unmount', () => {
        const { unmount } = renderHook(() =>
            usePreventScreenCapture('mnemonic'),
        )

        expect(preventScreenCaptureAsync).toHaveBeenCalledWith(
            SECURE_SCREEN_CAPTURE_TAG,
        )
        expect(allowScreenCaptureAsync).not.toHaveBeenCalled()

        unmount()

        expect(allowScreenCaptureAsync).toHaveBeenCalledWith(
            SECURE_SCREEN_CAPTURE_TAG,
        )
    })

    test('collapses concurrent secure screens onto a single native lock', () => {
        // Two secure screens mounted at once with DIFFERENT tags — the exact
        // backup mnemonic + verification overlap. iOS `preventScreenshots()` is
        // not idempotent, so a second native prevent re-parents the key-window
        // layer under a second secure text field and blacks out the screen. The
        // hook must therefore issue exactly ONE native prevent across holders.
        const first = renderHook(() =>
            usePreventScreenCapture('backup-mnemonic'),
        )
        const second = renderHook(() =>
            usePreventScreenCapture('backup-verification'),
        )

        expect(preventScreenCaptureAsync).toHaveBeenCalledTimes(1)
        expect(preventScreenCaptureAsync).toHaveBeenCalledWith(
            SECURE_SCREEN_CAPTURE_TAG,
        )

        // Releasing the first holder must NOT drop protection while the second
        // secure screen is still mounted.
        first.unmount()
        expect(allowScreenCaptureAsync).not.toHaveBeenCalled()

        // Protection is released only once the last holder unmounts.
        second.unmount()
        expect(allowScreenCaptureAsync).toHaveBeenCalledTimes(1)
        expect(allowScreenCaptureAsync).toHaveBeenCalledWith(
            SECURE_SCREEN_CAPTURE_TAG,
        )
    })

    test('does nothing while enabled is false', () => {
        renderHook(() => usePreventScreenCapture('mnemonic', false))

        expect(preventScreenCaptureAsync).not.toHaveBeenCalled()
    })

    test('skips prevention when the build-time flag disables it', () => {
        mockConfig.disableScreenCapturePrevention = true

        const { unmount } = renderHook(() =>
            usePreventScreenCapture('mnemonic'),
        )

        expect(preventScreenCaptureAsync).not.toHaveBeenCalled()

        unmount()

        expect(allowScreenCaptureAsync).not.toHaveBeenCalled()
    })
})
