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

// The biometric enable / unlock / disable lifecycle, end-to-end through the
// security package against the in-memory keystore and the driver's
// always-approve biometrics stub.
//
// Enabling no longer needs a PIN: the opt-in wraps a random token under an
// OS-bound key, and unlock compares the token the OS releases against the
// hash stored alongside the blob — it never touches the PIN record. PIN
// lifecycle itself is covered by `pin-lifecycle.test.tsx`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createHash } from 'crypto'

import { bytesToHex, type Optional } from '@perawallet/wallet-core-shared'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { commitSecret, hasSecret } from '@perawallet/wallet-core-kms'
import {
    BIOMETRIC_BLOB_KEY_ID,
    LEGACY_BIOMETRIC_BLOB_KEY_ID,
    useBiometrics,
    usePinCode,
    type BiometricUnlockOutcome,
    type EnableBiometricsResult,
} from '@perawallet/wallet-core-security'

const SLOW_TEST_TIMEOUT_MS = 30_000
const PROMPT = { title: 'Unlock', cancelLabel: 'Cancel' }
const TEST_PIN = '123456'

// The unit-test setup mocks `@perawallet/wallet-extension-platform-driver`
// with vi.fn() bodies that resolve `false` by default — fine for unit
// suites that don't exercise biometrics. The integration setup unmocks
// the higher-level `@perawallet/wallet-extension-provider` but leaves
// the platform driver mocked, so `getProvider().biometrics` still has
// the no-op vi.fn() implementations. This test rewires those vi.fn()
// bodies per-scenario instead of swapping the whole module so the
// existing provider singleton stays intact.
const mockedBiometrics = () =>
    getProvider().biometrics as unknown as {
        checkBiometricsAvailable: ReturnType<typeof vi.fn>
        armBiometricBinding: ReturnType<typeof vi.fn>
        unwrapBiometricToken: ReturnType<
            typeof vi.fn<
                (
                    ...args: unknown[]
                ) => Promise<
                    | { success: true; token: Uint8Array }
                    | { success: false; reason: string }
                >
            >
        >
        getSecurityLevel: ReturnType<typeof vi.fn>
        getSupportedBiometricType: ReturnType<typeof vi.fn>
        checkEnrollmentBinding: ReturnType<typeof vi.fn>
    }

const TEST_TOKEN = new Uint8Array([1, 2, 3, 4])

const sha256Hex = (bytes: Uint8Array): string =>
    bytesToHex(new Uint8Array(createHash('sha256').update(bytes).digest()))

const wireBiometricsService = (config: {
    available: boolean
    // Whether the OS releases the token. A false here is a declined or
    // cancelled ceremony, which must never destroy the opt-in.
    unwrap: boolean
    // Whether a key pair can be created at all.
    canArm?: boolean
}) => {
    const biometrics = mockedBiometrics()
    biometrics.checkBiometricsAvailable.mockResolvedValue(config.available)
    biometrics.armBiometricBinding.mockResolvedValue(
        config.canArm === false
            ? null
            : { blob: 'test-ciphertext', tokenHash: sha256Hex(TEST_TOKEN) },
    )
    // mockResolvedValue would freeze one token object for every call; a
    // test that unlocks twice under the same wiring (enable, then unlock)
    // would get back the array `useBiometrics` already zeroed after the
    // first call. mockImplementation mints a fresh copy per invocation.
    biometrics.unwrapBiometricToken.mockImplementation(async () =>
        config.unwrap
            ? { success: true, token: Uint8Array.from(TEST_TOKEN) }
            : { success: false, reason: 'user-cancel' },
    )
    // enableBiometrics only binds to a strong (class-3) authenticator; the
    // default scenario presents one so the enable path reaches the prompt.
    biometrics.getSecurityLevel.mockResolvedValue('strong')
    biometrics.checkEnrollmentBinding.mockResolvedValue('valid')
}

const wireEnrollmentBinding = (
    status: 'valid' | 'changed' | 'absent' | 'unavailable',
) => {
    mockedBiometrics().checkEnrollmentBinding.mockResolvedValue(status)
}

describe('Flow: Biometric authentication lifecycle', () => {
    beforeEach(() => {
        resetTestKeystore()
        vi.clearAllMocks()
        // Default scenario: device supports biometrics and the OS releases
        // the token. Tests that need a different combination call
        // wireBiometricsService(...) explicitly.
        wireBiometricsService({ available: true, unwrap: true })
    })

    afterEach(() => {
        resetTestKeystore()
    })

    it(
        'Given the device supports biometrics, when the user enables it, then the blob is stored, isEnabled flips on, and unlockWithBiometrics succeeds',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })

            // Drive the enable path. The confirmation ceremony IS the
            // unwrap: the test stub releases TEST_TOKEN, its hash matches
            // the tokenHash armBiometricBinding returned, so the blob gets
            // written under BIOMETRIC_BLOB_KEY_ID and isEnabled flips true.
            let enabled: Optional<EnableBiometricsResult>
            await act(async () => {
                enabled = await result.current.enableBiometrics(PROMPT)
            })
            expect(enabled).toEqual({ ok: true })
            expect(result.current.isEnabled).toBe(true)

            // checkBiometricsEnabled reads the keystore — it should
            // also report enabled now.
            await act(async () => {
                expect(await result.current.checkBiometricsEnabled()).toBe(true)
            })

            // Unlock succeeds via the stub.
            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            expect(outcome).toEqual({ kind: 'ok' })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a blob from before OS-bound keys existed, when the user unlocks with the PIN, then the binding is re-armed silently and biometric unlock works with no offer shown',
        async () => {
            const { result: pinHook } = renderHook(() => usePinCode())
            await act(async () => {
                await pinHook.current.savePin(TEST_PIN)
            })
            await commitSecret({
                id: LEGACY_BIOMETRIC_BLOB_KEY_ID,
                bytes: new TextEncoder().encode('{"legacy":true}'),
            })

            const { result } = renderHook(() => useBiometrics())
            // The reconcile sweeps the old record without a prompt or an
            // offer; the user is asked for nothing at the lock screen.
            await waitFor(() => {
                expect(hasSecret(LEGACY_BIOMETRIC_BLOB_KEY_ID)).toBe(false)
            })
            expect(result.current.disabledReason).toBeNull()
            expect(
                mockedBiometrics().armBiometricBinding,
            ).not.toHaveBeenCalled()

            await act(async () => {
                expect(await pinHook.current.verifyPin(TEST_PIN)).toEqual({
                    kind: 'ok',
                })
            })

            await waitFor(() => {
                expect(result.current.isEnabled).toBe(true)
            })
            expect(hasSecret(BIOMETRIC_BLOB_KEY_ID)).toBe(true)
            expect(
                mockedBiometrics().unwrapBiometricToken,
            ).not.toHaveBeenCalled()
            expect(result.current.disabledReason).toBeNull()

            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            expect(outcome).toEqual({ kind: 'ok' })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics is enabled, when the sensor is temporarily unavailable, then the keystore record survives and unlock recovers by itself',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            await act(async () => {
                await result.current.enableBiometrics(PROMPT)
            })
            expect(result.current.isEnabled).toBe(true)

            // Android folds a lockout (HW_UNAVAILABLE) in with "nothing
            // enrolled", so this is what a user who failed the fingerprint too
            // many times looks like from here.
            wireBiometricsService({ available: false, unwrap: true })
            await act(async () => {
                expect(await result.current.checkBiometricsEnabled()).toBe(
                    false,
                )
            })

            // The lockout expires. Nothing was destroyed, so the opt-in returns
            // without a trip to Settings.
            wireBiometricsService({ available: true, unwrap: true })
            await act(async () => {
                expect(await result.current.checkBiometricsEnabled()).toBe(true)
            })

            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            expect(outcome).toEqual({ kind: 'ok' })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics is enabled, when the enrolled biometric set changes, then the opt-in is dropped and cannot come back on its own',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            await act(async () => {
                await result.current.enableBiometrics(PROMPT)
            })
            expect(result.current.isEnabled).toBe(true)

            // The user deleted the enrolled fingerprint and added a different
            // one in device settings. Still enrolled, still strong: the binding
            // is the only signal that notices.
            wireEnrollmentBinding('changed')

            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            expect(outcome).toEqual({
                kind: 'failed',
                reason: 'unavailable',
            })
            expect(result.current.isEnabled).toBe(false)

            // The new binding now reads clean — the blob is gone, so unlock
            // stays off until the user opts in again.
            wireEnrollmentBinding('valid')
            await act(async () => {
                expect(await result.current.checkBiometricsEnabled()).toBe(
                    false,
                )
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics is enabled, when the user disables it, then the keystore record is removed and unlockWithBiometrics reports unavailable',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            await act(async () => {
                await result.current.enableBiometrics(PROMPT)
            })
            expect(result.current.isEnabled).toBe(true)

            // Disable: removes the typed-secret record. Subsequent unlock
            // attempts skip the platform prompt entirely and resolve
            // false (the consumer sees this as "biometrics not enabled").
            await act(async () => {
                await result.current.disableBiometrics()
            })
            expect(result.current.isEnabled).toBe(false)

            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            // The hook short-circuits when checkBiometricsEnabled is
            // false — the platform's unwrapBiometricToken() doesn't even
            // get a chance to run.
            expect(outcome).toEqual({
                kind: 'failed',
                reason: 'unavailable',
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics is enabled but the device prompt is denied, when unlockWithBiometrics is called, then it reports the user cancel (the consumer should fall back to PIN)',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            await act(async () => {
                await result.current.enableBiometrics(PROMPT)
            })
            expect(result.current.isEnabled).toBe(true)

            // Re-wire the platform stub: the device prompt now resolves
            // false (user cancelled FaceID, presented wrong finger, etc).
            // The blob is still in the keystore, so consumers should
            // see "biometrics enabled, last prompt failed".
            wireBiometricsService({ available: true, unwrap: false })

            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            expect(outcome).toEqual({
                kind: 'failed',
                reason: 'user-cancel',
            })
            // The keystore record is untouched — the user can retry.
            expect(result.current.isEnabled).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics has not been enabled, when unlockWithBiometrics is called, then it reports unavailable without invoking the platform unwrap prompt',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            expect(result.current.isEnabled).toBe(false)

            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            expect(outcome).toEqual({
                kind: 'failed',
                reason: 'unavailable',
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics is enabled, when the OS releases the token, then the app unlocks',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })

            await act(async () => {
                await result.current.enableBiometrics(PROMPT)
            })
            expect(result.current.isEnabled).toBe(true)

            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            expect(outcome).toEqual({ kind: 'ok' })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a blob from a build with no OS-bound key, when the reconcile runs, then it is dropped and re-opt-in is offered',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            await act(async () => {
                await result.current.enableBiometrics(PROMPT)
            })
            expect(result.current.isEnabled).toBe(true)

            // What every installed user looks like on first launch of this
            // build: the blob survived the upgrade, the key pair never
            // existed.
            wireEnrollmentBinding('absent')

            await act(async () => {
                expect(await result.current.checkBiometricsEnabled()).toBe(
                    false,
                )
            })
            expect(result.current.isEnabled).toBe(false)
            expect(result.current.disabledReason).toBe('rebind-required')

            // The offer is spent by re-enabling, not by the reconcile
            // running again: a dropped blob must not re-arm itself.
            wireEnrollmentBinding('valid')
            await act(async () => {
                expect(await result.current.checkBiometricsEnabled()).toBe(
                    false,
                )
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics is enabled, when the ceremony is cancelled, then the opt-in survives',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            await act(async () => {
                await result.current.enableBiometrics(PROMPT)
            })
            expect(result.current.isEnabled).toBe(true)

            wireBiometricsService({ available: true, unwrap: false })

            let outcome: Optional<BiometricUnlockOutcome>
            await act(async () => {
                outcome = await result.current.unlockWithBiometrics(PROMPT)
            })
            expect(outcome).toEqual({ kind: 'failed', reason: 'user-cancel' })
            // Nothing was destroyed: the next attempt still has a blob to
            // unwrap.
            expect(result.current.isEnabled).toBe(true)
            expect(result.current.disabledReason).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given no key pair can be created, when the user opts in, then nothing is stored',
        async () => {
            wireBiometricsService({
                available: true,
                unwrap: true,
                canArm: false,
            })

            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })

            let enabled: Optional<EnableBiometricsResult>
            await act(async () => {
                enabled = await result.current.enableBiometrics(PROMPT)
            })
            expect(enabled).toEqual({ ok: false, reason: 'error' })
            expect(result.current.isEnabled).toBe(false)
            await act(async () => {
                expect(await result.current.checkBiometricsEnabled()).toBe(
                    false,
                )
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
