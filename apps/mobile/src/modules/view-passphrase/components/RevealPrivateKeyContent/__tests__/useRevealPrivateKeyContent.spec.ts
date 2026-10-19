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
import { renderHook } from '@test-utils/render'
import { useRevealPrivateKeyContent } from '../useRevealPrivateKeyContent'

const mockPreventScreenCapture = vi.hoisted(() => vi.fn())
vi.mock('@hooks/usePreventScreenCapture', () => ({
    usePreventScreenCapture: mockPreventScreenCapture,
}))

describe('useRevealPrivateKeyContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('blocks screen capture while shown', () => {
        renderHook(() =>
            useRevealPrivateKeyContent({ privateKey: Uint8Array.of(1) }),
        )

        expect(mockPreventScreenCapture).toHaveBeenCalledWith(
            'reveal-private-key',
            true,
        )
    })

    it('zeroes the key on unmount', () => {
        const privateKey = Uint8Array.of(4, 5, 6)
        const { unmount } = renderHook(() =>
            useRevealPrivateKeyContent({ privateKey }),
        )

        expect(Array.from(privateKey)).toEqual([4, 5, 6])
        unmount()

        expect(Array.from(privateKey)).toEqual([0, 0, 0])
    })
})
