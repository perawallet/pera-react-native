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

const mockRequireVaultPassword = vi.fn()
vi.mock('@modules/vault', () => ({
    useRequireVaultPassword: () => ({
        requireVaultPassword: mockRequireVaultPassword,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/PinEditContent', () => ({
    PinEditContent: () => null,
}))

// Import the exact web filename — vitest has no Metro platform resolution, so
// a bare specifier would load the native module instead.
import { useRequirePinVerification } from '../useRequirePinVerification.web'

describe('useRequirePinVerification.web', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // The native hook returns true here. On the extension a PIN is optional
    // and off by default, so that branch made the gate a no-op and left the
    // recovery passphrase reachable with no factor checked at all.
    describe('when no PIN is configured (the extension default)', () => {
        beforeEach(() => {
            mockCheckPinEnabled.mockResolvedValue(false)
        })

        it('falls back to the vault password instead of passing', async () => {
            mockRequireVaultPassword.mockResolvedValue(true)

            const { result } = renderHook(() => useRequirePinVerification())
            const ok = await result.current.requirePinVerification()

            expect(ok).toBe(true)
            expect(mockRequireVaultPassword).toHaveBeenCalled()
            expect(mockRequest).not.toHaveBeenCalled()
        })

        it('resolves false when the password prompt is dismissed', async () => {
            mockRequireVaultPassword.mockResolvedValue(false)

            const { result } = renderHook(() => useRequirePinVerification())

            expect(await result.current.requirePinVerification()).toBe(false)
        })
    })

    describe('when a PIN is configured', () => {
        beforeEach(() => {
            mockCheckPinEnabled.mockResolvedValue(true)
        })

        it('uses the PIN sheet and never asks for the vault password', async () => {
            mockRequest.mockResolvedValue(true)

            const { result } = renderHook(() => useRequirePinVerification())
            const ok = await result.current.requirePinVerification()

            expect(ok).toBe(true)
            expect(mockRequest).toHaveBeenCalledTimes(1)
            expect(mockRequireVaultPassword).not.toHaveBeenCalled()
        })

        it('resolves false when the PIN sheet is dismissed', async () => {
            mockRequest.mockResolvedValue(undefined)

            const { result } = renderHook(() => useRequirePinVerification())

            expect(await result.current.requirePinVerification()).toBe(false)
        })
    })
})
