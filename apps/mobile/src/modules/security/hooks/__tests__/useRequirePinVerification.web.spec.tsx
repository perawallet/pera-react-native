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

const mockRequireVaultPassword = vi.fn()
vi.mock('@modules/vault', () => ({
    useRequireVaultPassword: () => ({
        requireVaultPassword: mockRequireVaultPassword,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const mockCheckPinEnabled = vi.fn()
vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled: mockCheckPinEnabled }),
}))

// Import the exact web filename — vitest has no Metro platform resolution, so
// a bare specifier would load the native module instead.
import { useRequirePinVerification } from '../useRequirePinVerification.web'

describe('useRequirePinVerification.web', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('asks for the vault password', async () => {
        mockRequireVaultPassword.mockResolvedValue(true)

        const { result } = renderHook(() => useRequirePinVerification())
        const ok = await result.current.requirePinVerification()

        expect(ok).toBe(true)
        expect(mockRequireVaultPassword).toHaveBeenCalledWith(
            'vault.reauth.confirm_description',
        )
    })

    it('resolves false when the password prompt is dismissed', async () => {
        mockRequireVaultPassword.mockResolvedValue(false)

        const { result } = renderHook(() => useRequirePinVerification())

        expect(await result.current.requirePinVerification()).toBe(false)
    })

    // Web cannot manage or remove a PIN, so one left by an older build must not
    // take over the gate.
    it('ignores a PIN written by an older build', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequireVaultPassword.mockResolvedValue(true)

        const { result } = renderHook(() => useRequirePinVerification())
        await result.current.requirePinVerification()

        expect(mockCheckPinEnabled).not.toHaveBeenCalled()
        expect(mockRequireVaultPassword).toHaveBeenCalled()
    })
})
