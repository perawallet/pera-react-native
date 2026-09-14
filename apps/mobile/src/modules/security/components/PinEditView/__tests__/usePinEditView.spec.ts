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

import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BiometricUnlockOutcome } from '@perawallet/wallet-core-security'

const mocks = vi.hoisted(() => ({
    verifyPin: vi.fn(),
    savePin: vi.fn(),
    handleFailedAttempt: vi.fn(),
    resetFailedAttempts: vi.fn(),
    isLockedOut: false,
    checkBiometricsEnabled: vi.fn(),
    unlockWithBiometrics: vi.fn(),
    showError: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({
        savePin: mocks.savePin,
        verifyPin: mocks.verifyPin,
        handleFailedAttempt: mocks.handleFailedAttempt,
        resetFailedAttempts: mocks.resetFailedAttempts,
        isLockedOut: mocks.isLockedOut,
    }),
    useBiometrics: () => ({
        checkBiometricsEnabled: mocks.checkBiometricsEnabled,
        unlockWithBiometrics: mocks.unlockWithBiometrics,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

import { usePinEditView } from '../usePinEditView'

const flush = async () => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

describe('usePinEditView biometric auto-prompt (verify)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isLockedOut = false
    })

    it('completes on biometric success even when re-rendered mid-prompt', async () => {
        mocks.checkBiometricsEnabled.mockResolvedValue(true)
        let resolveAuth: (value: BiometricUnlockOutcome) => void = () => {}
        mocks.unlockWithBiometrics.mockReturnValue(
            new Promise<BiometricUnlockOutcome>(resolve => {
                resolveAuth = resolve
            }),
        )

        const onSuccessA = vi.fn()
        const onSuccessB = vi.fn()

        const { rerender } = renderHook(
            ({ onSuccess }: { onSuccess: () => void }) =>
                usePinEditView({ mode: 'verify', onSuccess }),
            { initialProps: { onSuccess: onSuccessA } },
        )

        // Let checkBiometricsEnabled resolve and the prompt start.
        await flush()
        expect(mocks.unlockWithBiometrics).toHaveBeenCalledTimes(1)

        // An unrelated re-render with a fresh onSuccess identity (as the bottom
        // sheet does) must not cancel the in-flight prompt or re-fire it.
        rerender({ onSuccess: onSuccessB })

        await act(async () => {
            resolveAuth({ kind: 'ok' })
            await Promise.resolve()
        })

        expect(mocks.unlockWithBiometrics).toHaveBeenCalledTimes(1)
        expect(onSuccessB).toHaveBeenCalledTimes(1)
        expect(mocks.resetFailedAttempts).toHaveBeenCalledTimes(1)
    })

    it('does not auto-prompt when biometrics is disabled', async () => {
        mocks.checkBiometricsEnabled.mockResolvedValue(false)

        const onSuccess = vi.fn()
        renderHook(() => usePinEditView({ mode: 'verify', onSuccess }))

        await flush()

        expect(mocks.unlockWithBiometrics).not.toHaveBeenCalled()
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('does not call onSuccess when the token unwrap does not succeed', async () => {
        mocks.checkBiometricsEnabled.mockResolvedValue(true)
        mocks.unlockWithBiometrics.mockResolvedValue({ kind: 'mismatch' })

        const onSuccess = vi.fn()
        renderHook(() => usePinEditView({ mode: 'verify', onSuccess }))

        await flush()

        expect(mocks.unlockWithBiometrics).toHaveBeenCalledTimes(1)
        expect(onSuccess).not.toHaveBeenCalled()
    })
})

describe('usePinEditView onPinConfirmed', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isLockedOut = false
    })

    it('never persists the pin when a handler is supplied', async () => {
        const onPinConfirmed = vi.fn().mockResolvedValue({ ok: true })
        const { result } = renderHook(() =>
            usePinEditView({ mode: 'setup', onPinConfirmed }),
        )

        act(() => result.current.handlePinComplete('123456'))
        await act(() => result.current.handlePinComplete('123456'))

        expect(onPinConfirmed).toHaveBeenCalledWith('123456')
        expect(mocks.savePin).not.toHaveBeenCalled()
    })
})

describe('usePinEditView titles', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isLockedOut = false
    })

    it('prefers the supplied titles over the mode defaults', () => {
        const { result } = renderHook(() =>
            usePinEditView({
                mode: 'setup',
                title: 'Choose a code',
                confirmTitle: 'Re-enter it',
            }),
        )

        expect(result.current.title).toBe('Choose a code')

        act(() => result.current.handlePinComplete('123456'))

        expect(result.current.title).toBe('Re-enter it')
    })

    it('falls back to the mode defaults when no override is supplied', () => {
        const { result } = renderHook(() => usePinEditView({ mode: 'setup' }))

        expect(result.current.title).toBe('security.pin.setup_title')

        act(() => result.current.handlePinComplete('123456'))

        expect(result.current.title).toBe('security.pin.confirm_title')
    })

    it('ignores the overrides in the verify modes', () => {
        mocks.checkBiometricsEnabled.mockResolvedValue(false)

        const { result } = renderHook(() =>
            usePinEditView({
                mode: 'verify',
                title: 'Choose a code',
                confirmTitle: 'Re-enter it',
            }),
        )

        expect(result.current.title).toBe('security.pin.verify_title')
    })
})
