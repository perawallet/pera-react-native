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
import { renderHook, act } from '@test-utils/render'

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

vi.mock('@modules/security', () => ({
    PinEditContent: () => null,
}))

import { useViewPassphraseFlow } from '../useViewPassphraseFlow'

describe('useViewPassphraseFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('requests the PIN sheet first when a PIN is set', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        // Pending forever so we can assert only the PIN sheet was opened.
        mockRequestBottomSheet.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            void result.current.openViewPassphraseFlow('ADDR')
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('skips the PIN sheet and opens the acknowledge sheet when no PIN is set', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        mockRequestBottomSheet.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            void result.current.openViewPassphraseFlow('ADDR')
        })

        // Single call: acknowledge sheet only.
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('aborts the flow when the PIN sheet is dismissed', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            await result.current.openViewPassphraseFlow('ADDR')
        })

        // Only the PIN sheet was opened — acknowledge / display never fired.
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('opens the acknowledge sheet after PIN verification', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            void result.current.openViewPassphraseFlow('ADDR')
        })

        // First call: PIN. Second call: acknowledge.
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(2)
    })

    it("opens the display sheet after the acknowledge sheet resolves with 'confirm'", async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
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
        mockCheckPinEnabled.mockResolvedValue(false)
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useViewPassphraseFlow())
        await act(async () => {
            await result.current.openViewPassphraseFlow('ADDR')
        })

        // No display sheet was opened.
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })
})
