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
    resetFailedAttempts: vi.fn(),
    isLockedOut: false,
    checkBiometricsEnabled: vi.fn(),
    isBiometricsEnabled: true,
    unlockWithBiometrics: vi.fn(),
    showError: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({
        savePin: mocks.savePin,
        verifyPin: mocks.verifyPin,
        resetFailedAttempts: mocks.resetFailedAttempts,
        isLockedOut: mocks.isLockedOut,
    }),
    useBiometrics: () => ({
        checkBiometricsEnabled: mocks.checkBiometricsEnabled,
        isEnabled: mocks.isBiometricsEnabled,
        unlockWithBiometrics: mocks.unlockWithBiometrics,
    }),
}))

vi.mock('@hooks/useLanguage')

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
        mocks.isBiometricsEnabled = true
    })

    it('auto-prompts without waiting on a separate enabled check', async () => {
        // Never resolves: a revert to awaiting a reconcile here would hang.
        mocks.checkBiometricsEnabled.mockReturnValue(new Promise(() => {}))
        mocks.unlockWithBiometrics.mockResolvedValue({ kind: 'ok' })

        const onSuccess = vi.fn()
        renderHook(() => usePinEditView({ mode: 'verify', onSuccess }))

        await flush()

        expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it('does not prompt when biometrics are not enabled', async () => {
        mocks.isBiometricsEnabled = false
        mocks.checkBiometricsEnabled.mockResolvedValue(true)
        mocks.unlockWithBiometrics.mockResolvedValue({ kind: 'ok' })

        const onSuccess = vi.fn()
        renderHook(() => usePinEditView({ mode: 'verify', onSuccess }))

        await flush()

        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('prompts once the enabled flag turns true after the sheet opened', async () => {
        mocks.isBiometricsEnabled = false
        mocks.unlockWithBiometrics.mockResolvedValue({ kind: 'mismatch' })

        const { rerender } = renderHook(() =>
            usePinEditView({ mode: 'verify', onSuccess: vi.fn() }),
        )
        await flush()
        expect(mocks.unlockWithBiometrics).not.toHaveBeenCalled()

        mocks.isBiometricsEnabled = true
        rerender()
        await flush()

        expect(mocks.unlockWithBiometrics).toHaveBeenCalledTimes(1)
    })

    it('keeps an in-flight success when the enabled flag flickers', async () => {
        let resolveAuth: (value: BiometricUnlockOutcome) => void = () => {}
        mocks.unlockWithBiometrics.mockReturnValue(
            new Promise<BiometricUnlockOutcome>(resolve => {
                resolveAuth = resolve
            }),
        )

        const onSuccess = vi.fn()
        const { rerender } = renderHook(() =>
            usePinEditView({ mode: 'verify', onSuccess }),
        )
        await flush()

        mocks.isBiometricsEnabled = false
        rerender()
        mocks.isBiometricsEnabled = true
        rerender()
        await act(async () => {
            resolveAuth({ kind: 'ok' })
            await Promise.resolve()
        })

        expect(mocks.unlockWithBiometrics).toHaveBeenCalledTimes(1)
        expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it('completes on biometric success even when re-rendered mid-prompt', async () => {
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

    it('disables the pad between a passed fingerprint and the outcome', async () => {
        let settle: (outcome: { kind: string }) => void = () => undefined
        mocks.unlockWithBiometrics.mockImplementation(
            (_prompt, options?: { onAuthenticated?: () => void }) => {
                options?.onAuthenticated?.()
                return new Promise(resolve => {
                    settle = resolve
                })
            },
        )

        const { result } = renderHook(() =>
            usePinEditView({ mode: 'verify', onSuccess: vi.fn() }),
        )
        await flush()
        expect(result.current.isDisabled).toBe(true)
        expect(result.current.isBiometricUnlockInProgress).toBe(true)

        await act(async () => settle({ kind: 'mismatch' }))

        expect(result.current.isDisabled).toBe(false)
        expect(result.current.isBiometricUnlockInProgress).toBe(false)
    })

    it('does not call onSuccess when the token unwrap does not succeed', async () => {
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
        mocks.isBiometricsEnabled = false

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
