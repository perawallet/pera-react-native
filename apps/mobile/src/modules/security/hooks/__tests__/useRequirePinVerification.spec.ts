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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockRequest = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))

const mockCheckPinEnabled = vi.fn()
vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled: mockCheckPinEnabled }),
}))

vi.mock('../../components/PinEditContent', () => ({
    PinEditContent: () => null,
}))

import { useRequirePinVerification } from '../useRequirePinVerification'

describe('useRequirePinVerification', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('resolves true without a sheet when no PIN is set', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)

        const { result } = renderHook(() => useRequirePinVerification())
        const ok = await result.current.requirePinVerification()

        expect(ok).toBe(true)
        expect(mockRequest).not.toHaveBeenCalled()
    })

    it('opens the verify sheet and resolves true when verified', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequest.mockResolvedValue(true)

        const { result } = renderHook(() => useRequirePinVerification())
        const ok = await result.current.requirePinVerification()

        expect(ok).toBe(true)
        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('resolves false when the PIN sheet is dismissed or fails', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequest.mockResolvedValue(undefined)

        const { result } = renderHook(() => useRequirePinVerification())
        const ok = await result.current.requirePinVerification()

        expect(ok).toBe(false)
    })
})
