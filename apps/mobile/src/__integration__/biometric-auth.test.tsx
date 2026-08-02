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

// The biometric enable / authenticate / disable lifecycle, end-to-end through
// the security package against the in-memory keystore and the driver's
// always-approve biometrics stub.
//
// A PIN must exist first: biometrics shadows it by storing the PIN bytes under
// a biometric-protected keystore entry, so enableBiometrics short-circuits
// without one. PIN lifecycle itself is covered by `pin-lifecycle.test.tsx`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

import { type Optional } from '@perawallet/wallet-core-shared'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useBiometrics,
    usePinCode,
    type EnableBiometricsResult,
} from '@perawallet/wallet-core-security'

const SLOW_TEST_TIMEOUT_MS = 30_000

// The unit-test setup mocks `@perawallet/wallet-extension-platform-driver`
// with vi.fn() bodies that resolve `false` by default — fine for unit
// suites that don't exercise biometrics. The integration setup unmocks
// the higher-level `@perawallet/wallet-extension-provider` but leaves
// the platform driver mocked, so `getProvider().biometrics` still has
// the no-op vi.fn() implementations. This test rewires those vi.fn()
// bodies per-scenario instead of swapping the whole module so the
// existing provider singleton stays intact.
const wireBiometricsService = (config: {
    available: boolean
    authenticate: boolean
}) => {
    const biometrics = getProvider().biometrics as unknown as {
        checkBiometricsAvailable: ReturnType<typeof vi.fn>
        authenticate: ReturnType<typeof vi.fn>
        getSecurityLevel: ReturnType<typeof vi.fn>
        getSupportedBiometricType: ReturnType<typeof vi.fn>
    }
    biometrics.checkBiometricsAvailable.mockResolvedValue(config.available)
    biometrics.authenticate.mockResolvedValue(config.authenticate)
    // enableBiometrics only binds to a strong (class-3) authenticator; the
    // default scenario presents one so the enable path reaches the prompt.
    biometrics.getSecurityLevel.mockResolvedValue('strong')
}

describe('Flow: Biometric authentication lifecycle', () => {
    beforeEach(() => {
        resetTestKeystore()
        vi.clearAllMocks()
        // Default scenario: device supports biometrics and the prompt
        // returns success. Tests that need a different combination
        // call wireBiometricsService(...) explicitly.
        wireBiometricsService({ available: true, authenticate: true })
    })

    afterEach(() => {
        resetTestKeystore()
    })

    it(
        'Given no PIN is set, when enableBiometrics runs, then it returns false because there is no PIN record to wrap',
        async () => {
            const { result } = renderHook(() => useBiometrics())

            // checkBiometricsAvailable is hardcoded to true in the test
            // platform driver — the failure here must come from the
            // missing PIN record, not from a missing platform.
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            expect(result.current.isEnabled).toBe(false)

            // No PIN → withTypedSecret(PIN_RECORD_KEY_ID, ...) yields
            // undefined → enableBiometrics reports the no-pin reason.
            let enabled: Optional<EnableBiometricsResult>
            await act(async () => {
                enabled = await result.current.enableBiometrics()
            })
            expect(enabled).toEqual({ ok: false, reason: 'no-pin' })
            expect(result.current.isEnabled).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a PIN is configured, when the user enables biometrics, then the biometric blob is stored, isEnabled flips on, and authenticateWithBiometrics resolves true',
        async () => {
            const pin = renderHook(() => usePinCode())
            await act(async () => {
                await pin.result.current.savePin('123456')
            })

            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })

            // Drive the enable path. The test biometricsService
            // approves authenticate() with `true`, so the PIN bytes
            // get copied under BIOMETRIC_BLOB_KEY_ID and isEnabled
            // flips to true.
            let enabled: Optional<EnableBiometricsResult>
            await act(async () => {
                enabled = await result.current.enableBiometrics()
            })
            expect(enabled).toEqual({ ok: true })
            expect(result.current.isEnabled).toBe(true)

            // checkBiometricsEnabled reads the keystore — it should
            // also report enabled now.
            await act(async () => {
                expect(await result.current.checkBiometricsEnabled()).toBe(true)
            })

            // Authentication resolves true via the stub.
            let authResult: Optional<boolean>
            await act(async () => {
                authResult = await result.current.authenticateWithBiometrics()
            })
            expect(authResult).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics is enabled, when the user disables it, then the keystore record is removed and authenticateWithBiometrics returns false',
        async () => {
            const pin = renderHook(() => usePinCode())
            await act(async () => {
                await pin.result.current.savePin('654321')
            })
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            await act(async () => {
                await result.current.enableBiometrics()
            })
            expect(result.current.isEnabled).toBe(true)

            // Disable: removes the typed-secret record. Subsequent
            // authentication attempts skip the platform prompt entirely
            // and resolve false (the consumer sees this as "biometrics
            // not enabled").
            await act(async () => {
                await result.current.disableBiometrics()
            })
            expect(result.current.isEnabled).toBe(false)

            let authResult: Optional<boolean>
            await act(async () => {
                authResult = await result.current.authenticateWithBiometrics()
            })
            // The hook short-circuits when checkBiometricsEnabled is
            // false — the platform's authenticate() doesn't even get a
            // chance to run.
            expect(authResult).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics is enabled but the device prompt is denied, when authenticateWithBiometrics is called, then it returns false (the consumer should fall back to PIN)',
        async () => {
            const pin = renderHook(() => usePinCode())
            await act(async () => {
                await pin.result.current.savePin('111111')
            })
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            await act(async () => {
                await result.current.enableBiometrics()
            })
            expect(result.current.isEnabled).toBe(true)

            // Re-wire the platform stub: the device prompt now resolves
            // false (user cancelled FaceID, presented wrong finger, etc).
            // The blob is still in the keystore, so consumers should
            // see "biometrics enabled, last prompt failed".
            wireBiometricsService({ available: true, authenticate: false })

            let authResult: Optional<boolean>
            await act(async () => {
                authResult = await result.current.authenticateWithBiometrics()
            })
            expect(authResult).toBe(false)
            // The keystore record is untouched — the user can retry.
            expect(result.current.isEnabled).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given biometrics has not been enabled, when authenticateWithBiometrics is called, then it returns false without invoking the platform authenticate prompt',
        async () => {
            const { result } = renderHook(() => useBiometrics())
            await waitFor(() => {
                expect(result.current.isAvailable).toBe(true)
            })
            expect(result.current.isEnabled).toBe(false)

            let authResult: Optional<boolean>
            await act(async () => {
                authResult = await result.current.authenticateWithBiometrics()
            })
            expect(authResult).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
