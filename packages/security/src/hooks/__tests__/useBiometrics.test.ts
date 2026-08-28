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
import { renderHook, act, waitFor } from '@testing-library/react'

const kmsMocks = vi.hoisted(() => ({
    pinBytes: null as Uint8Array | null,
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
}))

const mockCheckBiometricsAvailable = vi.fn()
const mockGetAvailability = vi.fn()
const mockAuthenticate = vi.fn()
const mockGetSecurityLevel = vi.fn()
const mockCreateEnrollmentBinding = vi.fn()
const mockCheckEnrollmentBinding = vi.fn()
const mockClearEnrollmentBinding = vi.fn()

const mockBiometricsService = {
    checkBiometricsAvailable: mockCheckBiometricsAvailable,
    getAvailability: mockGetAvailability,
    authenticate: mockAuthenticate,
    getSecurityLevel: mockGetSecurityLevel,
    getSupportedBiometricType: vi.fn(),
    createEnrollmentBinding: mockCreateEnrollmentBinding,
    checkEnrollmentBinding: mockCheckEnrollmentBinding,
    clearEnrollmentBinding: mockClearEnrollmentBinding,
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        biometrics: mockBiometricsService,
    }),
}))

import {
    useBiometrics,
    type BiometricsAuthenticateResult,
    type EnableBiometricsResult,
} from '../useBiometrics'
import { PIN_RECORD_KEY_ID, BIOMETRIC_BLOB_KEY_ID } from '../../constants'
import { useSecurityStore } from '../../store'

const wireBlobMocks = () => {
    kmsMocks.commitSecret.mockImplementation(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = bytes
            else kmsMocks.biometricBytes = bytes
        },
    )
    kmsMocks.withSecret.mockImplementation(
        async (id: string, handler: (bytes: Uint8Array) => unknown) => {
            const bytes =
                id === PIN_RECORD_KEY_ID
                    ? kmsMocks.pinBytes
                    : kmsMocks.biometricBytes
            if (!bytes) return null
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
            : kmsMocks.biometricBytes !== null,
    )
    kmsMocks.removeSecret.mockImplementation(async (id: string) => {
        if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = null
        else kmsMocks.biometricBytes = null
    })
}

/**
 * Helper to render the hook and flush the initial useEffect that reads
 * isEnabled / isAvailable from storage on mount.
 */
const renderAndSettle = async () => {
    const hook = renderHook(() => useBiometrics())
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })
    return hook
}

describe('useBiometrics', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        kmsMocks.pinBytes = null
        kmsMocks.biometricBytes = null
        wireBlobMocks()
        // isEnabled lives in the module-level store now, so it outlives a
        // render and would leak into the next test.
        useSecurityStore.getState().resetState()
        // Default to a device with a strong (class-3) biometric enrolled, still
        // matching the set bound at opt-in; tests covering unavailable / weak /
        // revoked / re-enrolled devices override these.
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetAvailability.mockResolvedValue('available')
        mockGetSecurityLevel.mockResolvedValue('strong')
        mockCheckEnrollmentBinding.mockResolvedValue('valid')
    })

    test('initializes isEnabled from secure storage on mount', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')

        const { result } = renderHook(() => useBiometrics())

        expect(result.current.isEnabled).toBe(false)

        await waitFor(() => {
            expect(result.current.isEnabled).toBe(true)
        })
    })

    // `checkBiometricsAvailable` is false for a lockout, a busy sensor and a
    // pending security update as well as for "nothing enrolled" — Android folds
    // every non-SUCCESS `canAuthenticate` code into the same boolean. Deleting
    // the blob here made a lockout, which clears itself, permanently cost the
    // user their opt-in.
    test('checkBiometricsEnabled keeps the blob when biometrics are merely unavailable', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let isEnabled: boolean = true
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(false)
        expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
        expect(kmsMocks.biometricBytes).not.toBeNull()
        expect(result.current.isEnabled).toBe(false)
    })

    // The Android lockout repro: the opt-in has to come back on its own once the
    // lockout expires, with no visit to Settings.
    test('checkBiometricsEnabled re-arms the opt-in once availability returns', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { result } = await renderAndSettle()
        expect(result.current.isEnabled).toBe(false)

        mockCheckBiometricsAvailable.mockResolvedValue(true)
        let isEnabled: boolean = false
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(true)
        expect(result.current.isEnabled).toBe(true)
    })

    // Same rule as the unconfirmable-level case below: a blob the reconcile
    // keeps must still be re-bound, or it would outlive the PIN it mirrors and
    // come back armed against the old one when the lockout clears.
    test('refreshBiometricsBinding re-binds a blob kept through a transient unavailability', async () => {
        kmsMocks.pinBytes = new Uint8Array([10, 20, 30, 40])
        kmsMocks.biometricBytes = new Uint8Array([99])
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { result } = await renderAndSettle()
        expect(kmsMocks.biometricBytes).not.toBeNull()

        mockCheckBiometricsAvailable.mockResolvedValue(false)
        await act(async () => {
            await result.current.refreshBiometricsBinding()
        })

        expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
        expect(kmsMocks.commitSecret).toHaveBeenCalledWith(
            expect.objectContaining({ id: BIOMETRIC_BLOB_KEY_ID }),
        )
    })

    test('checkBiometricsEnabled drops the blob when the remaining enrollment is only weak', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('weak')

        const { result } = await renderAndSettle()

        let isEnabled: boolean = true
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(false)
        expect(kmsMocks.removeSecret).toHaveBeenCalledWith(
            BIOMETRIC_BLOB_KEY_ID,
        )
        expect(result.current.isEnabled).toBe(false)
    })

    // Neither level is a revocation report. iOS reports `isEnrolledAsync` true
    // during biometry lockout (an explicit special case in expo's native module)
    // while `getEnrolledLevelAsync` drops to 'secret', which clears when the
    // user enters their device passcode. 'none' is what the service returns when
    // `getEnrolledLevelAsync` throws, which may be permanent — but a report it
    // could not make is still not a report that the enrollment is gone.
    test.each(['secret', 'none'] as const)(
        'checkBiometricsEnabled reports disabled but keeps the blob at level %s',
        async level => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckBiometricsAvailable.mockResolvedValue(true)
            mockGetSecurityLevel.mockResolvedValue(level)

            const { result } = await renderAndSettle()

            let isEnabled: boolean = true
            await act(async () => {
                isEnabled = await result.current.checkBiometricsEnabled()
            })

            expect(isEnabled).toBe(false)
            expect(result.current.isEnabled).toBe(false)
            expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
            expect(kmsMocks.biometricBytes).not.toBeNull()
        },
    )

    // The reported PERA-4702 symptom was a stale ON toggle in Settings while the
    // lock screen had fallen back to PIN, so the downgrade has to clear the
    // shared flag for every consumer — not just for the one that reconciled.
    test('a downgrade to an unconfirmable level clears isEnabled for every mounted consumer', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('strong')

        const lockScreen = await renderAndSettle()
        const settings = await renderAndSettle()
        expect(settings.result.current.isEnabled).toBe(true)

        mockGetSecurityLevel.mockResolvedValue('secret')
        await act(async () => {
            await lockScreen.result.current.checkBiometricsEnabled()
        })

        expect(settings.result.current.isEnabled).toBe(false)
    })

    // The blob can vanish under a mounted hook — another consumer's reconcile,
    // a wipe — and the shared flag has to follow it down.
    test('checkBiometricsEnabled clears isEnabled when the blob disappears underneath it', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('strong')

        const { result } = await renderAndSettle()
        expect(result.current.isEnabled).toBe(true)

        kmsMocks.biometricBytes = null
        await act(async () => {
            await result.current.checkBiometricsEnabled()
        })

        expect(result.current.isEnabled).toBe(false)
    })

    // A class-2 ("weak") enrollment can never be bound, and with `isEnabled`
    // false the Settings toggle reads OFF — so its delete branch is unpressable
    // and the blob would be stranded. Refusing an explicit enable is the
    // user-driven moment where clearing it is unambiguously safe.
    test('enableBiometrics clears a blob it refuses to bind for a weak enrollment', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('weak')

        const { result } = await renderAndSettle()

        await act(async () => {
            await result.current.enableBiometrics()
        })

        expect(kmsMocks.removeSecret).toHaveBeenCalledWith(
            BIOMETRIC_BLOB_KEY_ID,
        )
        expect(kmsMocks.biometricBytes).toBeNull()
    })

    // 'secret'/'none' is ambiguous: iOS reports enrolled-but-'secret' during a
    // Face ID lockout the user clears with the device passcode, not from inside
    // the app. Binding is refused, but the opt-in must survive so unlock
    // auto-restores when the lockout clears — dropping it would turn a
    // self-clearing lockout into a permanent opt-out.
    test('enableBiometrics preserves the opt-in for an unconfirmed level (iOS Face ID lockout)', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('secret')

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'unconfirmed' })
        expect(mockAuthenticate).not.toHaveBeenCalled()
        // The blob must survive the lockout so unlock recovers on its own.
        expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
        expect(kmsMocks.biometricBytes).not.toBeNull()
    })

    test('authenticateWithBiometrics reports unavailable when only a weak biometric remains', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('weak')
        // Succeeds if reached, so a regression surfaces as "a weak biometric
        // unlocked the wallet" rather than an undefined mock return.
        mockAuthenticate.mockResolvedValue({ success: true })

        const { result } = await renderAndSettle()

        let authenticated: BiometricsAuthenticateResult | undefined
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toEqual({ success: false, reason: 'unavailable' })
        // A doomed OS prompt must never pop for an enrollment that can't bind.
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    // A surviving blob must never hold a stale PinRecord: the reconcile keeps it
    // when the enrollment can't be confirmed, so the PIN change still has to
    // re-bind it or biometrics would come back armed against the old PIN.
    test('refreshBiometricsBinding re-binds a blob the reconcile kept but could not confirm', async () => {
        kmsMocks.pinBytes = new Uint8Array([10, 20, 30, 40])
        kmsMocks.biometricBytes = new Uint8Array([99])
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('strong')

        const { result } = await renderAndSettle()

        mockGetSecurityLevel.mockResolvedValue('secret')
        await act(async () => {
            await result.current.refreshBiometricsBinding()
        })

        expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
        expect(kmsMocks.commitSecret).toHaveBeenCalledWith(
            expect.objectContaining({ id: BIOMETRIC_BLOB_KEY_ID }),
        )
    })

    test('refreshBiometricsBinding does not re-arm the blob when the remaining enrollment is only weak', async () => {
        kmsMocks.pinBytes = new Uint8Array([10, 20, 30, 40])
        kmsMocks.biometricBytes = new Uint8Array([99])
        // Strong at mount, downgraded afterwards, per the sibling test above:
        // the blob must survive mount, or refresh bails at its `hasSecret`
        // guard and the assertions below prove nothing.
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('strong')

        const { result } = await renderAndSettle()
        expect(kmsMocks.biometricBytes).not.toBeNull()

        mockGetSecurityLevel.mockResolvedValue('weak')
        await act(async () => {
            await result.current.refreshBiometricsBinding()
        })

        expect(kmsMocks.removeSecret).toHaveBeenCalledWith(
            BIOMETRIC_BLOB_KEY_ID,
        )
        expect(kmsMocks.commitSecret).not.toHaveBeenCalled()
    })

    test('initializes isAvailable from biometrics service on mount', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { result } = renderHook(() => useBiometrics())

        expect(result.current.isAvailable).toBe(false)

        await waitFor(() => {
            expect(result.current.isAvailable).toBe(true)
        })
    })

    test('checkBiometricsEnabled returns true when biometric data exists', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')

        const { result } = await renderAndSettle()

        let isEnabled: boolean = false
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(true)
        expect(kmsMocks.hasSecret).toHaveBeenCalledWith(BIOMETRIC_BLOB_KEY_ID)
    })

    test('checkBiometricsEnabled returns false when no biometric data', async () => {
        const { result } = await renderAndSettle()

        let isEnabled: boolean = true
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(false)
        expect(kmsMocks.hasSecret).toHaveBeenCalledWith(BIOMETRIC_BLOB_KEY_ID)
    })

    test('checkBiometricsAvailable returns true when available', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { result } = await renderAndSettle()

        let isAvailable: boolean = false
        await act(async () => {
            isAvailable = await result.current.checkBiometricsAvailable()
        })

        expect(isAvailable).toBe(true)
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
    })

    test('checkBiometricsAvailable returns false when not available', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let isAvailable: boolean = true
        await act(async () => {
            isAvailable = await result.current.checkBiometricsAvailable()
        })

        expect(isAvailable).toBe(false)
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
    })

    test('refreshBiometricsBinding is a no-op when biometrics are not enabled', async () => {
        wireBlobMocks()
        // PIN exists but biometrics aren't enabled yet.
        kmsMocks.pinBytes = new Uint8Array([1, 2, 3])

        const { result } = await renderAndSettle()

        await act(async () => {
            await result.current.refreshBiometricsBinding()
        })

        // Should not have written anything to the biometric blob.
        expect(kmsMocks.commitSecret).not.toHaveBeenCalled()
        expect(kmsMocks.biometricBytes).toBeNull()
    })

    test('refreshBiometricsBinding copies the current PIN_RECORD bytes to the biometric blob', async () => {
        wireBlobMocks()
        const pinRecordBytes = new Uint8Array([10, 20, 30, 40])
        kmsMocks.pinBytes = pinRecordBytes
        // Pretend biometrics are already enabled by seeding the blob.
        kmsMocks.biometricBytes = new Uint8Array([99])

        const { result } = await renderAndSettle()

        await act(async () => {
            await result.current.refreshBiometricsBinding()
        })

        expect(kmsMocks.commitSecret).toHaveBeenCalledWith({
            id: BIOMETRIC_BLOB_KEY_ID,
            bytes: pinRecordBytes,
        })
    })

    test('enableBiometrics returns no-pin reason when PIN is not enabled', async () => {
        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'no-pin' })
        expect(kmsMocks.withSecret).toHaveBeenCalledWith(
            PIN_RECORD_KEY_ID,
            expect.any(Function),
        )
        expect(result.current.isEnabled).toBe(false)
    })

    test('enableBiometrics returns no-pin reason when PIN data not found', async () => {
        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'no-pin' })
        expect(kmsMocks.withSecret).toHaveBeenCalledWith(
            PIN_RECORD_KEY_ID,
            expect.any(Function),
        )
    })

    test('enableBiometrics forwards the prompt to the biometrics service', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue({ success: true })

        const { result } = await renderAndSettle()
        const prompt = { title: 'Enable', cancelLabel: 'Cancel' }

        await act(async () => {
            await result.current.enableBiometrics(prompt)
        })

        expect(mockAuthenticate).toHaveBeenCalledWith(prompt)
    })

    test('authenticateWithBiometrics forwards the prompt to the biometrics service', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockAuthenticate.mockResolvedValue({ success: true })

        const { result } = await renderAndSettle()
        const prompt = { title: 'Unlock', cancelLabel: 'Cancel' }

        await act(async () => {
            await result.current.authenticateWithBiometrics(prompt)
        })

        expect(mockAuthenticate).toHaveBeenCalledWith(prompt)
    })

    test('enableBiometrics successfully copies PIN to biometric storage and sets isEnabled', async () => {
        const pinData = new TextEncoder().encode('123456')
        kmsMocks.pinBytes = pinData
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue({ success: true })

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: true })
        expect(kmsMocks.withSecret).toHaveBeenCalledWith(
            PIN_RECORD_KEY_ID,
            expect.any(Function),
        )
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
        expect(mockAuthenticate).toHaveBeenCalled()
        expect(kmsMocks.commitSecret).toHaveBeenCalledWith({
            id: BIOMETRIC_BLOB_KEY_ID,
            bytes: pinData,
        })
        expect(result.current.isEnabled).toBe(true)
    })

    test('enableBiometrics returns error reason on unexpected failure', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockRejectedValue(new Error('Auth error'))

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'error' })
    })

    test('enableBiometrics returns unavailable reason when biometrics are not available', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'unavailable' })
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    test('enableBiometrics returns weak-biometric reason and does not prompt when only a weak biometric is enrolled', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('weak')

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'weak-biometric' })
        // The OS prompt must not fire, and nothing is bound to the keystore.
        expect(mockAuthenticate).not.toHaveBeenCalled()
        const commits = kmsMocks.commitSecret.mock.calls.filter(
            call => call[0].id === BIOMETRIC_BLOB_KEY_ID,
        )
        expect(commits).toHaveLength(0)
        expect(result.current.isEnabled).toBe(false)
    })

    test('enableBiometrics returns declined reason when the user declines authentication', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue({
            success: false,
            reason: 'user-cancel',
        })

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'declined' })
        // The biometric blob must not be committed when auth fails.
        const commits = kmsMocks.commitSecret.mock.calls.filter(
            call => call[0].id === BIOMETRIC_BLOB_KEY_ID,
        )
        expect(commits).toHaveLength(0)
    })

    test('disableBiometrics removes biometric data and sets isEnabled to false', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue({ success: true })

        const { result } = await renderAndSettle()

        await act(async () => {
            await result.current.enableBiometrics()
        })

        expect(result.current.isEnabled).toBe(true)

        await act(async () => {
            await result.current.disableBiometrics()
        })

        expect(kmsMocks.removeSecret).toHaveBeenCalledWith(
            BIOMETRIC_BLOB_KEY_ID,
        )
        expect(result.current.isEnabled).toBe(false)
    })

    test('authenticateWithBiometrics reports unavailable when biometrics not enabled', async () => {
        const { result } = await renderAndSettle()

        let authenticated: BiometricsAuthenticateResult | undefined
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toEqual({ success: false, reason: 'unavailable' })
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    test('authenticateWithBiometrics reports success when biometrics enabled and auth succeeds', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockAuthenticate.mockResolvedValue({ success: true })

        const { result } = await renderAndSettle()

        let authenticated: BiometricsAuthenticateResult | undefined
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toEqual({ success: true })
        expect(mockAuthenticate).toHaveBeenCalled()
    })

    test('authenticateWithBiometrics reports unavailable when biometric data missing', async () => {
        mockAuthenticate.mockResolvedValue({ success: true })

        const { result } = await renderAndSettle()

        let authenticated: BiometricsAuthenticateResult | undefined
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toEqual({ success: false, reason: 'unavailable' })
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    test('authenticateWithBiometrics passes the service failure through unmodified', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockAuthenticate.mockResolvedValue({
            success: false,
            reason: 'system-cancel',
        })

        const { result } = await renderAndSettle()

        let authenticated: BiometricsAuthenticateResult | undefined
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toEqual({
            success: false,
            reason: 'system-cancel',
        })
    })

    // The QA gap in the first revision: the reconcile cleared the blob but only
    // the calling screen's copy of isEnabled, so Settings kept showing ON while
    // the lock screen had already fallen back to PIN (PERA-4702).
    test('a revoked blob clears isEnabled for every mounted consumer', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')

        const settings = await renderAndSettle()
        const lockScreen = await renderAndSettle()

        expect(settings.result.current.isEnabled).toBe(true)
        expect(lockScreen.result.current.isEnabled).toBe(true)

        // Enrollment replaced in OS settings while the app was running. Keyed on
        // the binding rather than on availability, which no longer revokes.
        mockCheckEnrollmentBinding.mockResolvedValue('changed')

        await act(async () => {
            await lockScreen.result.current.checkBiometricsEnabled()
        })

        expect(lockScreen.result.current.isEnabled).toBe(false)
        expect(settings.result.current.isEnabled).toBe(false)
    })

    test('authenticateWithBiometrics reports unknown on error', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockAuthenticate.mockRejectedValue(new Error('Auth error'))

        const { result } = await renderAndSettle()

        let authenticated: BiometricsAuthenticateResult | undefined
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toEqual({ success: false, reason: 'unknown' })
    })

    // Remove-then-re-add of a fingerprint leaves every other signal reporting a
    // healthy strong enrollment, so the binding is the only thing standing
    // between a biometric the user never approved and the wallet.
    describe('enrollment binding', () => {
        test('checkBiometricsEnabled drops the opt-in when the enrolled set changed', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckEnrollmentBinding.mockResolvedValue('changed')

            const { result } = await renderAndSettle()

            let isEnabled: boolean = true
            await act(async () => {
                isEnabled = await result.current.checkBiometricsEnabled()
            })

            expect(isEnabled).toBe(false)
            expect(kmsMocks.biometricBytes).toBeNull()
            expect(mockClearEnrollmentBinding).toHaveBeenCalled()
            expect(result.current.isEnabled).toBe(false)
        })

        test('authenticateWithBiometrics refuses to prompt after the enrolled set changed', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckEnrollmentBinding.mockResolvedValue('changed')
            // Succeeds if reached, so a regression reads as "a re-enrolled
            // biometric unlocked the wallet".
            mockAuthenticate.mockResolvedValue({ success: true })

            const { result } = await renderAndSettle()

            let authenticated: BiometricsAuthenticateResult | undefined
            await act(async () => {
                authenticated =
                    await result.current.authenticateWithBiometrics()
            })

            expect(authenticated).toEqual({
                success: false,
                reason: 'unavailable',
            })
            expect(mockAuthenticate).not.toHaveBeenCalled()
        })

        // Every install that opted in before bindings existed, plus everything
        // arriving through the legacy-app migration. Forcing those users to
        // re-opt-in would be the safer read of an absent binding, but adopting
        // protects them from every change after the upgrade at no cost.
        test('checkBiometricsEnabled adopts the current set when no binding is recorded', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckEnrollmentBinding.mockResolvedValue('absent')

            const { result } = await renderAndSettle()

            let isEnabled: boolean = false
            await act(async () => {
                isEnabled = await result.current.checkBiometricsEnabled()
            })

            expect(isEnabled).toBe(true)
            expect(mockCreateEnrollmentBinding).toHaveBeenCalled()
            expect(kmsMocks.biometricBytes).not.toBeNull()
        })

        // A reading that could not be taken is not a report that the set
        // changed — same rule the security-level branch follows for 'secret'.
        test('checkBiometricsEnabled keeps the opt-in when the binding cannot be read', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckEnrollmentBinding.mockResolvedValue('unavailable')

            const { result } = await renderAndSettle()

            let isEnabled: boolean = false
            await act(async () => {
                isEnabled = await result.current.checkBiometricsEnabled()
            })

            expect(isEnabled).toBe(true)
            expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
            expect(mockCreateEnrollmentBinding).not.toHaveBeenCalled()
        })

        test('enableBiometrics records a binding before arming the blob', async () => {
            kmsMocks.pinBytes = new TextEncoder().encode('123456')
            mockAuthenticate.mockResolvedValue({ success: true })

            const { result } = await renderAndSettle()

            await act(async () => {
                await result.current.enableBiometrics()
            })

            expect(mockCreateEnrollmentBinding).toHaveBeenCalled()
            expect(
                mockCreateEnrollmentBinding.mock.invocationCallOrder[0],
            ).toBeLessThan(kmsMocks.commitSecret.mock.invocationCallOrder[0])
        })

        test('disableBiometrics clears the binding along with the blob', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')

            const { result } = await renderAndSettle()

            await act(async () => {
                await result.current.disableBiometrics()
            })

            expect(kmsMocks.biometricBytes).toBeNull()
            expect(mockClearEnrollmentBinding).toHaveBeenCalled()
        })
    })

    // Turning biometrics off silently is what makes it feel broken rather than
    // protective, so every app-initiated drop records why.
    describe('disabled reason', () => {
        test.each([
            ['changed enrollment', 'changed', 'strong', 'enrollment-changed'],
            ['class-2 downgrade', 'valid', 'weak', 'weak-biometric'],
        ] as const)(
            'records %s as the reason it disabled biometrics',
            async (_label, binding, level, expected) => {
                kmsMocks.biometricBytes = new TextEncoder().encode('123456')
                mockCheckEnrollmentBinding.mockResolvedValue(binding)
                mockGetSecurityLevel.mockResolvedValue(level)

                const { result } = await renderAndSettle()

                await act(async () => {
                    await result.current.checkBiometricsEnabled()
                })

                expect(result.current.disabledReason).toBe(expected)
            },
        )

        // Android-only in practice: an enrollment that satisfies
        // `canAuthenticate(WEAK)` but not STRONG reaches the level check inside
        // the enable flow. Clearing the reason there dismissed the prompt that
        // triggered the enable, so the user got an error toast and nothing left
        // to retry against.
        test('keeps the offer open when an enable is refused for a weak enrollment', async () => {
            kmsMocks.pinBytes = new TextEncoder().encode('123456')
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckBiometricsAvailable.mockResolvedValue(true)
            mockGetSecurityLevel.mockResolvedValue('weak')

            const { result } = await renderAndSettle()

            let enableResult: EnableBiometricsResult | undefined
            await act(async () => {
                enableResult = await result.current.enableBiometrics()
            })

            expect(enableResult).toEqual({
                ok: false,
                reason: 'weak-biometric',
            })
            expect(result.current.disabledReason).toBe('weak-biometric')
        })

        // The distinction ticket 2 could not make with a boolean: both of these
        // read as "unavailable", but only one of them is the user's problem to
        // solve.
        test.each(['none-enrolled', 'denied'] as const)(
            'explains a persistent %s state without destroying the opt-in',
            async availability => {
                kmsMocks.biometricBytes = new TextEncoder().encode('123456')
                mockCheckBiometricsAvailable.mockResolvedValue(false)
                mockGetAvailability.mockResolvedValue(availability)

                const { result } = await renderAndSettle()

                await act(async () => {
                    await result.current.checkBiometricsEnabled()
                })

                expect(result.current.disabledReason).toBe('not-available')
                expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
                expect(kmsMocks.biometricBytes).not.toBeNull()
            },
        )

        // An Android fingerprint lockout lands here. It clears itself, so
        // telling the user to go and fix their device settings would be both
        // wrong and alarming.
        test.each(['unavailable', 'unknown'] as const)(
            'stays silent while biometrics are transiently %s',
            async availability => {
                kmsMocks.biometricBytes = new TextEncoder().encode('123456')
                mockCheckBiometricsAvailable.mockResolvedValue(false)
                mockGetAvailability.mockResolvedValue(availability)

                const { result } = await renderAndSettle()

                await act(async () => {
                    await result.current.checkBiometricsEnabled()
                })

                expect(result.current.disabledReason).toBeNull()
                expect(kmsMocks.biometricBytes).not.toBeNull()
            },
        )

        // The blob survives a `not-available` state, so the user can recover it
        // entirely in device settings without ever touching Pera. Leaving the
        // reason behind would then greet them with a screen offering to fix
        // something that already works.
        test('drops the explanation once biometrics work again', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckBiometricsAvailable.mockResolvedValue(false)
            mockGetAvailability.mockResolvedValue('denied')

            const { result } = await renderAndSettle()
            await act(async () => {
                await result.current.checkBiometricsEnabled()
            })
            expect(result.current.disabledReason).toBe('not-available')

            // Permission granted back in device settings.
            mockCheckBiometricsAvailable.mockResolvedValue(true)
            mockGetAvailability.mockResolvedValue('available')
            await act(async () => {
                await result.current.checkBiometricsEnabled()
            })

            expect(result.current.isEnabled).toBe(true)
            expect(result.current.disabledReason).toBeNull()
        })

        // `not-available` is re-derived from device state on every reconcile, so
        // without remembering the decline the offer would return on every
        // unlock until the user gave in.
        test('does not re-offer a persistent state the user declined', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckBiometricsAvailable.mockResolvedValue(false)
            mockGetAvailability.mockResolvedValue('none-enrolled')

            const { result } = await renderAndSettle()
            await act(async () => {
                await result.current.checkBiometricsEnabled()
            })
            expect(result.current.disabledReason).toBe('not-available')

            act(() => {
                result.current.acknowledgeBiometricsDisabled()
            })
            await act(async () => {
                await result.current.checkBiometricsEnabled()
            })

            expect(result.current.disabledReason).toBeNull()
        })

        // Declining once must not make the user permanently un-warnable: a drop
        // that actually destroys the opt-in is a new event.
        test('offers again when a later drop destroys the opt-in', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckBiometricsAvailable.mockResolvedValue(false)
            mockGetAvailability.mockResolvedValue('none-enrolled')

            const { result } = await renderAndSettle()
            await act(async () => {
                await result.current.checkBiometricsEnabled()
            })
            act(() => {
                result.current.acknowledgeBiometricsDisabled()
            })

            // A biometric is enrolled again, and it is not the bound one.
            mockCheckBiometricsAvailable.mockResolvedValue(true)
            mockGetAvailability.mockResolvedValue('available')
            mockCheckEnrollmentBinding.mockResolvedValue('changed')
            await act(async () => {
                await result.current.checkBiometricsEnabled()
            })

            expect(result.current.disabledReason).toBe('enrollment-changed')
        })

        test('records no reason when the user disables biometrics themselves', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')

            const { result } = await renderAndSettle()

            await act(async () => {
                await result.current.disableBiometrics()
            })

            expect(result.current.disabledReason).toBeNull()
        })

        test('clears the reason once biometrics are enabled again', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            kmsMocks.pinBytes = new TextEncoder().encode('123456')
            mockCheckEnrollmentBinding.mockResolvedValue('changed')
            mockAuthenticate.mockResolvedValue({ success: true })

            const { result } = await renderAndSettle()
            await act(async () => {
                await result.current.checkBiometricsEnabled()
            })
            expect(result.current.disabledReason).toBe('enrollment-changed')

            mockCheckEnrollmentBinding.mockResolvedValue('valid')
            await act(async () => {
                await result.current.enableBiometrics()
            })

            expect(result.current.disabledReason).toBeNull()
        })

        // A decline has to stick, or the sheet returns on every unlock.
        test('acknowledgeBiometricsDisabled clears the reason without re-enabling', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckEnrollmentBinding.mockResolvedValue('changed')

            const { result } = await renderAndSettle()
            await act(async () => {
                await result.current.checkBiometricsEnabled()
            })

            act(() => {
                result.current.acknowledgeBiometricsDisabled()
            })

            expect(result.current.disabledReason).toBeNull()
            expect(result.current.isEnabled).toBe(false)
        })
    })
})
