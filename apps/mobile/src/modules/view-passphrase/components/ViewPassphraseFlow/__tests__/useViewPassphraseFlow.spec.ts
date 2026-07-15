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
import { renderHook, act } from '@test-utils/render'

const { mockRequirePinVerification } = vi.hoisted(() => ({
    mockRequirePinVerification: vi.fn(),
}))

// The PIN gate is extracted into useRequirePinVerification (unit-tested
// separately); mock it so these tests focus on the flow's orchestration.
vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: mockRequirePinVerification,
    }),
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
        mockRequirePinVerification.mockResolvedValue(true)
    })

    it('aborts before any sheet when the PIN gate is not passed', async () => {
        mockRequirePinVerification.mockResolvedValue(false)

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            await result.current.openViewPassphraseFlow('ADDR')
        })

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('opens the acknowledge sheet once the PIN gate passes', async () => {
        // Acknowledge sheet pending so only that call is observed.
        mockRequestBottomSheet.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            void result.current.openViewPassphraseFlow('ADDR')
        })

        expect(mockRequirePinVerification).toHaveBeenCalled()
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it("opens the display sheet after the acknowledge sheet resolves with 'confirm'", async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            void result.current.openViewPassphraseFlow('ADDR')
        })

        // First call: acknowledge. Second call: display.
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(2)
    })

    it('aborts the flow when the acknowledge sheet does not resolve with confirm', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            await result.current.openViewPassphraseFlow('ADDR')
        })

        // Acknowledge only — the display sheet never opened.
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })
})
