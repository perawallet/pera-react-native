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
import { type Optional } from '@perawallet/wallet-core-shared'

const { mockCheckPinEnabled } = vi.hoisted(() => ({
    mockCheckPinEnabled: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled: mockCheckPinEnabled }),
}))

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../../PassphraseAcknowledgeContent', () => ({
    PassphraseAcknowledgeContent: () => null,
}))

vi.mock('../../ViewPassphraseContent', () => ({
    ViewPassphraseContent: () => null,
}))

import { useViewPassphraseFlow } from '../useViewPassphraseFlow'

describe('useViewPassphraseFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default: hold any sheet open so step transitions are observable.
        mockRequestBottomSheet.mockReturnValue(new Promise(() => {}))
    })

    it('starts with a null step when not visible', () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({
                isVisible: false,
                address: 'ADDR',
                onClose: vi.fn(),
            }),
        )
        expect(result.current.step).toBeNull()
    })

    it("enters the 'pin' step when visible and a PIN is set", async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({
                isVisible: true,
                address: 'ADDR',
                onClose: vi.fn(),
            }),
        )
        await waitFor(() => expect(result.current.step).toBe('pin'))
    })

    it("skips the PIN and enters 'acknowledge' when no PIN is set", async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({
                isVisible: true,
                address: 'ADDR',
                onClose: vi.fn(),
            }),
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))
    })

    it("advances to 'acknowledge' on PIN success", async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        const { result } = renderHook(() =>
            useViewPassphraseFlow({
                isVisible: true,
                address: 'ADDR',
                onClose: vi.fn(),
            }),
        )
        await waitFor(() => expect(result.current.step).toBe('pin'))

        act(() => result.current.handlePinSuccess())

        expect(result.current.step).toBe('acknowledge')
    })

    it("advances to 'display' when the acknowledge sheet resolves with 'confirm'", async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        let resolveAcknowledge: (value: Optional<'confirm'>) => void = () => {}
        mockRequestBottomSheet.mockImplementationOnce(
            () =>
                new Promise<Optional<'confirm'>>(resolve => {
                    resolveAcknowledge = resolve
                }),
        )
        // Hold the display sheet open so the step is observable.
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))

        const { result } = renderHook(() =>
            useViewPassphraseFlow({
                isVisible: true,
                address: 'ADDR',
                onClose: vi.fn(),
            }),
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))

        await act(async () => {
            resolveAcknowledge('confirm')
        })

        await waitFor(() => expect(result.current.step).toBe('display'))
    })

    it('resets the step to null when isVisible flips to false', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        const { result, rerender } = renderHook(
            ({ isVisible }: { isVisible: boolean }) =>
                useViewPassphraseFlow({
                    isVisible,
                    address: 'ADDR',
                    onClose: vi.fn(),
                }),
            { initialProps: { isVisible: true } },
        )
        await waitFor(() => expect(result.current.step).toBe('acknowledge'))

        rerender({ isVisible: false })

        expect(result.current.step).toBeNull()
    })
})
