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
import { createHash } from 'crypto'
import { bytesToHex } from '@perawallet/wallet-core-shared'

const kmsMocks = vi.hoisted(() => ({
    pinBytes: null as Uint8Array | null,
    biometricBytes: null as Uint8Array | null,
    commitSecret: vi.fn(),
    withSecret: vi.fn(),
    hasSecret: vi.fn(),
    removeSecret: vi.fn(),
    getSecretMetadata: vi.fn().mockReturnValue(null),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMSService: () => ({
        commitSecret: kmsMocks.commitSecret,
        withSecret: kmsMocks.withSecret,
        hasSecret: kmsMocks.hasSecret,
        removeSecret: kmsMocks.removeSecret,
        getSecretMetadata: kmsMocks.getSecretMetadata,
    }),
}))

const mockCheckBiometricsAvailable = vi.fn()
const mockGetAvailability = vi.fn()
const mockGetSecurityLevel = vi.fn()
const mockCheckEnrollmentBinding = vi.fn()
const mockClearEnrollmentBinding = vi.fn()

const mockBiometricsService = {
    checkBiometricsAvailable: mockCheckBiometricsAvailable,
    getAvailability: mockGetAvailability,
    getSecurityLevel: mockGetSecurityLevel,
    getSupportedBiometricType: vi.fn(),
    checkEnrollmentBinding: mockCheckEnrollmentBinding,
    clearEnrollmentBinding: mockClearEnrollmentBinding,
    armBiometricBinding: vi.fn().mockResolvedValue(null),
    unwrapBiometricToken: vi
        .fn()
        .mockResolvedValue({ success: false, reason: 'unavailable' }),
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        biometrics: mockBiometricsService,
    }),
}))

import { useBiometrics, type EnableBiometricsResult } from '../useBiometrics'
import { PIN_RECORD_KEY_ID, BIOMETRIC_BLOB_KEY_ID } from '../../constants'
import { PIN_RECORD_VERSION, serializePinRecord } from '../../pinRecord'
import { useSecurityStore } from '../../store'

const sha256Hex = (bytes: Uint8Array): string =>
    bytesToHex(new Uint8Array(createHash('sha256').update(bytes).digest()))

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

    // The reported symptom was a stale ON toggle in Settings while the
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
        // The blob must survive the lockout so unlock recovers on its own.
        expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
        expect(kmsMocks.biometricBytes).not.toBeNull()
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

    test('enableBiometrics forwards the prompt to the biometrics service', async () => {
        const token = new Uint8Array([1, 2, 3])
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockBiometricsService.armBiometricBinding.mockResolvedValue({
            blob: 'ct',
            tokenHash: sha256Hex(token),
        })
        mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
            success: true,
            token,
        })

        const { result } = await renderAndSettle()
        const prompt = { title: 'Enable', cancelLabel: 'Cancel' }

        await act(async () => {
            await result.current.enableBiometrics(prompt)
        })

        expect(mockBiometricsService.unwrapBiometricToken).toHaveBeenCalledWith(
            'ct',
            prompt,
        )
    })

    test('enableBiometrics returns error reason on unexpected failure', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockBiometricsService.armBiometricBinding.mockRejectedValue(
            new Error('Arming error'),
        )

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'error' })
    })

    test('enableBiometrics returns unavailable reason when biometrics are not available', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'unavailable' })
        expect(mockBiometricsService.armBiometricBinding).not.toHaveBeenCalled()
    })

    test('enableBiometrics returns weak-biometric reason and does not prompt when only a weak biometric is enrolled', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockGetSecurityLevel.mockResolvedValue('weak')

        const { result } = await renderAndSettle()

        let enableResult: EnableBiometricsResult | undefined
        await act(async () => {
            enableResult = await result.current.enableBiometrics()
        })

        expect(enableResult).toEqual({ ok: false, reason: 'weak-biometric' })
        // The confirmation ceremony must not fire, and nothing is bound to the
        // keystore.
        expect(mockBiometricsService.armBiometricBinding).not.toHaveBeenCalled()
        const commits = kmsMocks.commitSecret.mock.calls.filter(
            call => call[0].id === BIOMETRIC_BLOB_KEY_ID,
        )
        expect(commits).toHaveLength(0)
        expect(result.current.isEnabled).toBe(false)
    })

    test('disableBiometrics removes biometric data and sets isEnabled to false', async () => {
        const token = new Uint8Array([1, 2, 3])
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockBiometricsService.armBiometricBinding.mockResolvedValue({
            blob: 'ct',
            tokenHash: sha256Hex(token),
        })
        mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
            success: true,
            token,
        })

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

    // The QA gap in the first revision: the reconcile cleared the blob but only
    // the calling screen's copy of isEnabled, so Settings kept showing ON while
    // the lock screen had already fallen back to PIN.
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
            const token = new Uint8Array([1, 2, 3])
            kmsMocks.biometricBytes = new TextEncoder().encode('123456')
            mockCheckEnrollmentBinding.mockResolvedValue('changed')
            mockBiometricsService.armBiometricBinding.mockResolvedValue({
                blob: 'ct',
                tokenHash: sha256Hex(token),
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: true,
                token,
            })

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

    describe('enableBiometrics with an OS-bound binding', () => {
        test('arms, confirms by unwrapping, then stores the blob with its hash', async () => {
            const token = new Uint8Array([7, 7, 7])
            // Captured before the call: enableBiometrics zeroes the released
            // token in a `finally` once it has been checked, so recomputing
            // the hash from `token` after the call would hash the wipe.
            const tokenHash = sha256Hex(token)
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
            mockBiometricsService.armBiometricBinding.mockResolvedValue({
                blob: 'ct',
                tokenHash,
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: true,
                token,
            })

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() => result.current.enableBiometrics())

            expect(outcome).toEqual({ ok: true })
            expect(kmsMocks.commitSecret).toHaveBeenCalledWith({
                id: BIOMETRIC_BLOB_KEY_ID,
                bytes: expect.any(Uint8Array),
                metadata: { biometricTokenHash: tokenHash },
            })
        })

        test('frames the stored blob with the current version byte', async () => {
            const token = new Uint8Array([7, 7, 7])
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
            mockBiometricsService.armBiometricBinding.mockResolvedValue({
                blob: 'ct',
                tokenHash: sha256Hex(token),
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: true,
                token,
            })

            const { result } = renderHook(() => useBiometrics())
            await act(() => result.current.enableBiometrics())

            const written = kmsMocks.commitSecret.mock.calls.find(
                call => call[0].id === BIOMETRIC_BLOB_KEY_ID,
            )![0].bytes as Uint8Array
            expect(written[0]).toBe(2)
            expect(new TextDecoder().decode(written.subarray(1))).toBe('ct')
        })

        test('succeeds with no PIN record at all', async () => {
            const token = new Uint8Array([7, 7, 7])
            // Nothing under any secret id. The old flow wrapped its whole body in
            // withSecret(PIN_RECORD_KEY_ID, ...) and bailed with 'no-pin'; the
            // token is PIN-independent, so this now has to succeed.
            kmsMocks.withSecret.mockResolvedValue(null)
            kmsMocks.hasSecret.mockReturnValue(false)
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
            mockBiometricsService.armBiometricBinding.mockResolvedValue({
                blob: 'ct',
                tokenHash: sha256Hex(token),
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: true,
                token,
            })

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() => result.current.enableBiometrics())

            expect(outcome).toEqual({ ok: true })
        })

        test('clears the binding when the confirmation ceremony is declined', async () => {
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
            mockBiometricsService.armBiometricBinding.mockResolvedValue({
                blob: 'ct',
                tokenHash: 'deadbeef',
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: false,
                reason: 'user-cancel',
            })

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() => result.current.enableBiometrics())

            expect(outcome).toEqual({ ok: false, reason: 'declined' })
            expect(
                mockBiometricsService.clearEnrollmentBinding,
            ).toHaveBeenCalled()
            expect(kmsMocks.commitSecret).not.toHaveBeenCalled()
        })

        // `armBiometricBinding` is destructive-idempotent: it deletes the old
        // key before minting a new one, so a pre-existing blob is sealed
        // under a key that is already gone the moment arming succeeds. A
        // cancelled ceremony must not leave that dead blob behind, or the
        // next reconcile reports 'absent' and drops it as 'rebind-required'
        // — a plain Cancel would have permanently destroyed a working opt-in.
        test('drops a stale blob left behind by a prior key once arming succeeds, even if the ceremony is declined', async () => {
            kmsMocks.biometricBytes = new TextEncoder().encode('stale-blob')
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
            mockBiometricsService.armBiometricBinding.mockResolvedValue({
                blob: 'ct',
                tokenHash: 'deadbeef',
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: false,
                reason: 'user-cancel',
            })

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() => result.current.enableBiometrics())

            expect(outcome).toEqual({ ok: false, reason: 'declined' })
            expect(kmsMocks.removeSecret).toHaveBeenCalledWith(
                BIOMETRIC_BLOB_KEY_ID,
            )
            expect(
                mockBiometricsService.clearEnrollmentBinding,
            ).toHaveBeenCalled()
            expect(kmsMocks.biometricBytes).toBeNull()
        })

        test('fails without writing a blob when arming is refused', async () => {
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
            mockBiometricsService.armBiometricBinding.mockResolvedValue(null)

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() => result.current.enableBiometrics())

            expect(outcome).toEqual({ ok: false, reason: 'error' })
            expect(kmsMocks.commitSecret).not.toHaveBeenCalled()
        })

        // A successful ceremony proves the key works, but the write that
        // records it can still fail. Left alone, that would leave the key
        // armed with no blob pointing at it — invisible to the reconcile's
        // early return on a missing blob, so it would report enabled
        // forever while every unlock burned a real ceremony and failed.
        test('clears the binding when the write fails after a successful ceremony', async () => {
            const token = new Uint8Array([7, 7, 7])
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
            mockBiometricsService.armBiometricBinding.mockResolvedValue({
                blob: 'ct',
                tokenHash: sha256Hex(token),
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: true,
                token,
            })
            kmsMocks.commitSecret.mockRejectedValueOnce(new Error('boom'))

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() => result.current.enableBiometrics())

            expect(outcome).toEqual({ ok: false, reason: 'error' })
            expect(
                mockBiometricsService.clearEnrollmentBinding,
            ).toHaveBeenCalled()
            expect(result.current.isEnabled).toBe(false)
        })
    })

    describe('checkBiometricsEnabled against the key-pair probe', () => {
        beforeEach(() => {
            kmsMocks.hasSecret.mockReturnValue(true)
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
        })

        test('drops with rebind-required when no key pair backs the blob', async () => {
            mockBiometricsService.checkEnrollmentBinding.mockResolvedValue(
                'absent',
            )

            const { result } = renderHook(() => useBiometrics())
            const enabled = await act(() =>
                result.current.checkBiometricsEnabled(),
            )

            expect(enabled).toBe(false)
            expect(kmsMocks.removeSecret).toHaveBeenCalledWith(
                BIOMETRIC_BLOB_KEY_ID,
            )
            expect(result.current.disabledReason).toBe('rebind-required')
        })

        test('keeps the blob when the probe cannot answer', async () => {
            mockBiometricsService.checkEnrollmentBinding.mockResolvedValue(
                'unavailable',
            )

            const { result } = renderHook(() => useBiometrics())
            const enabled = await act(() =>
                result.current.checkBiometricsEnabled(),
            )

            expect(enabled).toBe(false)
            expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
            expect(result.current.disabledReason).toBeNull()
        })

        test('still reports enrollment-changed for an invalidated key', async () => {
            mockBiometricsService.checkEnrollmentBinding.mockResolvedValue(
                'changed',
            )

            const { result } = renderHook(() => useBiometrics())
            await act(() => result.current.checkBiometricsEnabled())

            expect(result.current.disabledReason).toBe('enrollment-changed')
        })
    })

    describe('unlockWithBiometrics', () => {
        // A framed v2 blob, as `encodeBlob` writes it.
        const framed = (blob: string) =>
            Uint8Array.from([2, ...new TextEncoder().encode(blob)])

        beforeEach(() => {
            kmsMocks.hasSecret.mockReturnValue(true)
            mockBiometricsService.checkBiometricsAvailable.mockResolvedValue(
                true,
            )
            mockBiometricsService.getSecurityLevel.mockResolvedValue('strong')
            mockBiometricsService.checkEnrollmentBinding.mockResolvedValue(
                'valid',
            )
        })

        test('reports ok when the released token matches the stored hash', async () => {
            const token = new Uint8Array([4, 2])
            kmsMocks.withSecret.mockImplementation(
                async (_id: string, handler: (b: Uint8Array) => unknown) =>
                    handler(framed('ct')),
            )
            kmsMocks.getSecretMetadata.mockReturnValue({
                biometricTokenHash: sha256Hex(token),
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: true,
                token,
            })

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() =>
                result.current.unlockWithBiometrics(),
            )

            expect(outcome).toEqual({ kind: 'ok' })
        })

        test('reports mismatch and drops the blob when the hash disagrees', async () => {
            kmsMocks.withSecret.mockImplementation(
                async (_id: string, handler: (b: Uint8Array) => unknown) =>
                    handler(framed('ct')),
            )
            kmsMocks.getSecretMetadata.mockReturnValue({
                biometricTokenHash: 'not-the-right-hash',
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: true,
                token: new Uint8Array([9]),
            })

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() =>
                result.current.unlockWithBiometrics(),
            )

            expect(outcome).toEqual({ kind: 'mismatch' })
            expect(result.current.disabledReason).toBe('rebind-required')
        })

        // A pre-binding blob held serialized JSON, so it always starts 0x7B —
        // never the version byte. `decodeBlob` has to refuse it outright
        // rather than hand it to the enclave and let it come back as a
        // decryption error.
        test('rejects a pre-binding blob at the version-byte guard before it reaches the enclave', async () => {
            // Hand-rolled rather than built with `serializePinRecord`: what
            // matters is only that the bytes are the JSON a pre-binding build
            // wrote, so this must not track the current record's shape.
            const legacyBlob = new TextEncoder().encode(
                JSON.stringify({
                    version: 2,
                    salt: '00'.repeat(16),
                    hash: '00'.repeat(32),
                    failedAttempts: 0,
                    lockoutEndTime: null,
                }),
            )
            kmsMocks.withSecret.mockImplementation(
                async (_id: string, handler: (b: Uint8Array) => unknown) =>
                    handler(legacyBlob),
            )

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() =>
                result.current.unlockWithBiometrics(),
            )

            expect(outcome).toEqual({ kind: 'mismatch' })
            expect(result.current.disabledReason).toBe('rebind-required')
            expect(
                mockBiometricsService.unwrapBiometricToken,
            ).not.toHaveBeenCalled()
        })

        test('refuses before prompting while the record is locked out', async () => {
            const lockoutEndTime = Date.now() + 60_000
            kmsMocks.withSecret.mockImplementation(
                async (id: string, handler: (b: Uint8Array) => unknown) =>
                    id === PIN_RECORD_KEY_ID
                        ? handler(
                              serializePinRecord({
                                  version: PIN_RECORD_VERSION,
                                  salt: '00'.repeat(16),
                                  hash: '00'.repeat(32),
                                  duressSalt: '00'.repeat(16),
                                  duressHash: '00'.repeat(32),
                                  duressEnabled: 0,
                                  failedAttempts: 5,
                                  lockoutEndTime,
                              }),
                          )
                        : handler(framed('ct')),
            )

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() =>
                result.current.unlockWithBiometrics(),
            )

            expect(outcome).toEqual({ kind: 'locked', lockoutEndTime })
            expect(
                mockBiometricsService.unwrapBiometricToken,
            ).not.toHaveBeenCalled()
            expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
        })

        test('preserves the opt-in when the ceremony is cancelled', async () => {
            kmsMocks.withSecret.mockImplementation(
                async (_id: string, handler: (b: Uint8Array) => unknown) =>
                    handler(framed('ct')),
            )
            kmsMocks.getSecretMetadata.mockReturnValue({
                biometricTokenHash: 'deadbeef',
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: false,
                reason: 'system-cancel',
            })

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() =>
                result.current.unlockWithBiometrics(),
            )

            expect(outcome).toEqual({ kind: 'failed', reason: 'system-cancel' })
            expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
        })

        test('drops the opt-in when the OS reports the key invalidated', async () => {
            kmsMocks.withSecret.mockImplementation(
                async (_id: string, handler: (b: Uint8Array) => unknown) =>
                    handler(framed('ct')),
            )
            kmsMocks.getSecretMetadata.mockReturnValue({
                biometricTokenHash: 'deadbeef',
            })
            mockBiometricsService.unwrapBiometricToken.mockResolvedValue({
                success: false,
                reason: 'invalidated',
            })

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() =>
                result.current.unlockWithBiometrics(),
            )

            expect(outcome).toEqual({ kind: 'mismatch' })
            expect(kmsMocks.removeSecret).toHaveBeenCalledWith(
                BIOMETRIC_BLOB_KEY_ID,
            )
            expect(result.current.disabledReason).toBe('enrollment-changed')
        })

        test('preserves the opt-in when the keystore read itself fails', async () => {
            // hasSecret stays true (the record exists) but the read resolves
            // null — ambiguous, unlike a decode failure on bytes that came
            // back.
            kmsMocks.withSecret.mockResolvedValue(null)

            const { result } = renderHook(() => useBiometrics())
            const outcome = await act(() =>
                result.current.unlockWithBiometrics(),
            )

            expect(outcome).toEqual({ kind: 'failed', reason: 'unavailable' })
            expect(kmsMocks.removeSecret).not.toHaveBeenCalled()
        })
    })
})
