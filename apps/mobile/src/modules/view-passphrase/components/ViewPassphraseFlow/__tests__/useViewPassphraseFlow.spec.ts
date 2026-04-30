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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@test-utils/render'

const { mockCheckPinEnabled } = vi.hoisted(() => ({
    mockCheckPinEnabled: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled: mockCheckPinEnabled }),
}))

import { useViewPassphraseFlow } from '../useViewPassphraseFlow'

describe('useViewPassphraseFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('starts with a null step when not visible', () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({ isVisible: false, onClose: vi.fn() }),
        )
        expect(result.current.step).toBeNull()
    })

    it("enters the 'pin' step when visible and a PIN is set", async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({ isVisible: true, onClose: vi.fn() }),
        )
        await waitFor(() => expect(result.current.step).toBe('pin'))
    })

    it("skips the PIN and enters 'acknowledge' when no PIN is set", async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({ isVisible: true, onClose: vi.fn() }),
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))
    })

    it("advances to 'acknowledge' on PIN success", async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({ isVisible: true, onClose: vi.fn() }),
        )
        await waitFor(() => expect(result.current.step).toBe('pin'))

        act(() => result.current.handlePinSuccess())

        expect(result.current.step).toBe('acknowledge')
    })

    it("advances to 'display' on acknowledge confirmation", async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({ isVisible: true, onClose: vi.fn() }),
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))

        act(() => result.current.handleAcknowledgeConfirm())

        expect(result.current.step).toBe('display')
    })

    it('swallows the dismissal that fires when transitioning acknowledge → display', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useViewPassphraseFlow({ isVisible: true, onClose }),
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))

        act(() => result.current.handleAcknowledgeConfirm())
        // The outgoing acknowledge sheet's dismiss callback fires after the
        // step has already advanced — it must not bubble out as onClose.
        act(() => result.current.handleAcknowledgeClose())

        expect(onClose).not.toHaveBeenCalled()
        expect(result.current.step).toBe('display')
    })

    it('calls onClose when acknowledge is closed by the user (not via confirmation)', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useViewPassphraseFlow({ isVisible: true, onClose }),
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))

        act(() => result.current.handleAcknowledgeClose())

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('resets the step to null when isVisible flips to false', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        const { result, rerender } = renderHook(
            ({ isVisible }: { isVisible: boolean }) =>
                useViewPassphraseFlow({ isVisible, onClose: vi.fn() }),
            { initialProps: { isVisible: true } },
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))

        rerender({ isVisible: false })

        expect(result.current.step).toBeNull()
    })

    it('only consumes the skip flag once — a later acknowledge close still calls onClose', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useViewPassphraseFlow({ isVisible: true, onClose }),
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))

        act(() => result.current.handleAcknowledgeConfirm())
        act(() => result.current.handleAcknowledgeClose())
        expect(onClose).not.toHaveBeenCalled()

        act(() => result.current.handleAcknowledgeClose())
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
