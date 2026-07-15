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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const kmsMocks = vi.hoisted(() => ({
    pinBytes: null as Uint8Array | null,
    duressPinBytes: null as Uint8Array | null,
    biometricBytes: null as Uint8Array | null,
    commitSecret: vi.fn(),
    withSecret: vi.fn(),
    hasSecret: vi.fn(),
    removeSecret: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMSService: () => ({
        commitSecret: kmsMocks.commitSecret,
        withSecret: kmsMocks.withSecret,
        hasSecret: kmsMocks.hasSecret,
        removeSecret: kmsMocks.removeSecret,
    }),
    zeroBytes: (...buffers: Array<Uint8Array | undefined | null>) => {
        for (const buf of buffers) if (buf) buf.fill(0)
    },
}))

import { usePinCode } from '../usePinCode'
import { useSecurityStore } from '../../store'
import { PIN_RECORD_KEY_ID, DURESS_PIN_RECORD_KEY_ID } from '../../constants'

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

vi.mock('../useBiometrics', () => ({
    useBiometrics: vi.fn(() => ({
        checkBiometricsEnabled: vi.fn().mockResolvedValue(false),
        disableBiometrics: vi.fn(),
        refreshBiometricsBinding: vi.fn(),
    })),
}))

const wireBlobMocks = () => {
    kmsMocks.commitSecret.mockImplementation(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            const copy = new Uint8Array(bytes)
            if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = copy
            else if (id === DURESS_PIN_RECORD_KEY_ID)
                kmsMocks.duressPinBytes = copy
            else kmsMocks.biometricBytes = copy
        },
    )
    kmsMocks.withSecret.mockImplementation(
        async (id: string, handler: (bytes: Uint8Array) => unknown) => {
            const stash =
                id === PIN_RECORD_KEY_ID
                    ? kmsMocks.pinBytes
                    : id === DURESS_PIN_RECORD_KEY_ID
                      ? kmsMocks.duressPinBytes
                      : kmsMocks.biometricBytes
            if (!stash) return null
            const bytes = new Uint8Array(stash)
            try {
                return await handler(bytes)
            } finally {
                bytes.fill(0)
            }
        },
    )
    kmsMocks.hasSecret.mockImplementation((id: string) =>
        id === PIN_RECORD_KEY_ID
            ? kmsMocks.pinBytes !== null
            : id === DURESS_PIN_RECORD_KEY_ID
              ? kmsMocks.duressPinBytes !== null
              : kmsMocks.biometricBytes !== null,
    )
    kmsMocks.removeSecret.mockImplementation(async (id: string) => {
        if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = null
        else if (id === DURESS_PIN_RECORD_KEY_ID) kmsMocks.duressPinBytes = null
        else kmsMocks.biometricBytes = null
    })
}

describe('usePinCode — duress branch', () => {
    const mockSetFailedAttempts = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
    const mockSetAutoLockStartedAt = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        kmsMocks.pinBytes = null
        kmsMocks.duressPinBytes = null
        kmsMocks.biometricBytes = null
        wireBlobMocks()
        // Default store wiring — overridable per test.
        ;(
            useSecurityStore as unknown as ReturnType<typeof vi.fn>
        ).mockImplementation(
            (selector: (state: Record<string, unknown>) => unknown) =>
                selector({
                    failedAttempts: 0,
                    lockoutEndTime: null,
                    autoLockStartedAt: null,
                    setFailedAttempts: mockSetFailedAttempts,
                    resetFailedAttempts: mockResetFailedAttempts,
                    setLockoutEndTime: mockSetLockoutEndTime,
                    setAutoLockStartedAt: mockSetAutoLockStartedAt,
                }),
        )
    })

    test('saveDuressPin writes only to the duress key, not the regular key', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.saveDuressPin('111111')
        })
        expect(kmsMocks.duressPinBytes).not.toBeNull()
        expect(kmsMocks.pinBytes).toBeNull()
    }, 30_000)

    test('checkDuressPinEnabled reflects whether the duress record exists', async () => {
        const { result } = renderHook(() => usePinCode())
        expect(await result.current.checkDuressPinEnabled()).toBe(false)

        await act(async () => {
            await result.current.saveDuressPin('111111')
        })
        expect(await result.current.checkDuressPinEnabled()).toBe(true)

        await act(async () => {
            await result.current.saveDuressPin(null)
        })
        expect(await result.current.checkDuressPinEnabled()).toBe(false)
    }, 60_000)

    test('savePin(null) clears the duress record so it cannot be orphaned', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })
        expect(await result.current.checkDuressPinEnabled()).toBe(true)

        await act(async () => {
            await result.current.savePin(null)
        })

        expect(kmsMocks.duressPinBytes).toBeNull()
        expect(await result.current.checkDuressPinEnabled()).toBe(false)
    }, 60_000)

    test('verifyPin returns `ok` for the regular PIN even when duress is set', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('123456')
        })
        expect(outcome).toEqual({ kind: 'ok' })
    }, 60_000)

    test('verifyPin returns `duress` when the entered PIN matches the duress record', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('111111')
        })
        expect(outcome).toEqual({ kind: 'duress' })
    }, 60_000)

    test('verifyPin returns `fail` when neither record matches', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('999999')
        })
        expect(outcome).toEqual({ kind: 'fail' })
    }, 60_000)

    test('duress comparison bypasses the lockout gate (still returns `duress` when locked out)', async () => {
        // Lockout end time is in the future — but the duress path must
        // still return `duress`, because otherwise an attacker could lock
        // the user out and demand the regular PIN with no escape hatch.
        ;(
            useSecurityStore as unknown as ReturnType<typeof vi.fn>
        ).mockImplementation(
            (selector: (state: Record<string, unknown>) => unknown) =>
                selector({
                    failedAttempts: 5,
                    lockoutEndTime: Date.now() + 60_000,
                    autoLockStartedAt: null,
                    setFailedAttempts: mockSetFailedAttempts,
                    resetFailedAttempts: mockResetFailedAttempts,
                    setLockoutEndTime: mockSetLockoutEndTime,
                    setAutoLockStartedAt: mockSetAutoLockStartedAt,
                }),
        )

        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('111111')
        })
        expect(outcome).toEqual({ kind: 'duress' })
    }, 60_000)
})
