/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useQRCameraScanner } from '../useQRCameraScanner'

vi.mock('@utils/platform', () => ({
    isAndroid: () => true,
}))

describe('useQRCameraScanner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('focuses the centre of the measured preview', () => {
        const focusTo = vi.fn().mockResolvedValue(undefined)
        const { result } = renderHook(() => useQRCameraScanner())
        result.current.cameraRef.current = { focusTo } as never

        act(() =>
            result.current.handleLayout({
                nativeEvent: { layout: { width: 100, height: 200 } },
            } as never),
        )
        act(() => result.current.focusCenter())

        expect(focusTo).toHaveBeenCalledWith(
            { x: 50, y: 100 },
            expect.objectContaining({ adaptiveness: 'continuous' }),
        )
    })

    it('does not focus before the preview has been measured', () => {
        const focusTo = vi.fn().mockResolvedValue(undefined)
        const { result } = renderHook(() => useQRCameraScanner())
        result.current.cameraRef.current = { focusTo } as never

        act(() => result.current.focusCenter())

        expect(focusTo).not.toHaveBeenCalled()
    })
})
