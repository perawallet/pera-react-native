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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { usePinCode } from '@perawallet/wallet-core-security'
import { SettingsSecurityScreen } from '@modules/settings/screens/SettingsSecurityScreen'

const SLOW_TEST_TIMEOUT_MS = 30000
const TEST_PIN = '123456'

const renderSettingsSecurityScreen = () =>
    renderWithNavigation(SettingsSecurityScreen, 'SettingsSecurity')

// Render the security settings screen and wait for the initial
// `useEffect` that hydrates `isPinEnabled` from the keystore to
// settle. The PIN toggle's `checked` prop matches `isPinEnabled` once
// hydration is done — assert on it before driving the rest of the
// test.
const waitForPinToggleHydration = async (
    expectedChecked: boolean,
): Promise<HTMLInputElement> => {
    let toggle: HTMLInputElement | null = null
    await waitFor(() => {
        toggle = screen.getByTestId(
            'settings_security_pin_toggle',
        ) as HTMLInputElement
        expect(toggle.checked).toBe(expectedChecked)
    })
    return toggle!
}

describe('Flow: PIN lifecycle from Settings → Security', () => {
    beforeEach(() => {
        // The keystore reset wipes any previous test's PIN record so
        // each test starts from "no PIN configured" unless it
        // explicitly seeds one.
        resetTestKeystore()
        vi.clearAllMocks()
    })

    afterEach(() => {
        resetTestKeystore()
    })

    it(
        'Given no PIN is configured, when the user flips the PIN toggle ON, then the PinEditView mounts in setup mode (the gate the user must complete to actually save a PIN)',
        async () => {
            renderSettingsSecurityScreen()

            const toggle = await waitForPinToggleHydration(false)
            // The PinEditView's bottom-sheet host is hidden until
            // `pinViewMode` becomes non-null. PWNumpad is only rendered
            // inside the open sheet, so its absence is the proof the
            // gate is closed.
            expect(screen.queryByTestId('PWNumpad')).toBeNull()

            fireEvent.click(toggle)

            // Toggle ON → `pinViewMode='setup'` → PinEditView mounts
            // → PinEntry's title text reads the setup i18n key
            // (translations fall back to keys under the integration
            // setup, so we match by key rather than translated text).
            await waitFor(() => {
                expect(screen.getByTestId('PWNumpad')).toBeTruthy()
            })
            expect(screen.getByText('security.pin.setup_title')).toBeTruthy()

            // Side-effect contract: the pin-record typed-secret is
            // NOT yet committed — the user still has to enter the
            // pin twice to confirm. This keeps the gate honest:
            // flipping the toggle alone must never enable a PIN.
            const { result: pinHook } = renderHook(() => usePinCode())
            await waitFor(async () => {
                expect(await pinHook.current.checkPinEnabled()).toBe(false)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a PIN is already configured, when the user flips the PIN toggle OFF, then the PinEditView mounts in verify mode (so the user must prove they know the current PIN before disabling it)',
        async () => {
            const { result: pinHook } = renderHook(() => usePinCode())
            await waitFor(async () => {
                await pinHook.current.savePin(TEST_PIN)
                expect(await pinHook.current.checkPinEnabled()).toBe(true)
            })

            renderSettingsSecurityScreen()
            const toggle = await waitForPinToggleHydration(true)

            fireEvent.click(toggle)

            // Toggle OFF (with PIN already set) → `pinViewMode='verify'`
            // → PinEditView mounts. Title proves we're in verify
            // mode, not setup or change_old.
            await waitFor(() => {
                expect(screen.getByTestId('PWNumpad')).toBeTruthy()
            })
            expect(screen.getByText('security.pin.verify_title')).toBeTruthy()

            // The PIN record is still in place — disable doesn't
            // happen until the verify flow completes successfully.
            // The gate IS the protection.
            expect(await pinHook.current.checkPinEnabled()).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a PIN is already configured, when the user taps the change-PIN row, then the PinEditView mounts in change_old mode (verify the existing PIN before swapping)',
        async () => {
            const { result: pinHook } = renderHook(() => usePinCode())
            await waitFor(async () => {
                await pinHook.current.savePin(TEST_PIN)
                expect(await pinHook.current.checkPinEnabled()).toBe(true)
            })

            renderSettingsSecurityScreen()
            await waitForPinToggleHydration(true)

            // Change-PIN row only renders when isPinEnabled === true,
            // so its presence in the DOM is itself a signal that the
            // hydration finished correctly.
            const changeButton = await waitFor(() =>
                screen.getByTestId('settings_security_change_pin_button'),
            )
            fireEvent.click(changeButton)

            await waitFor(() => {
                expect(screen.getByTestId('PWNumpad')).toBeTruthy()
            })
            expect(
                screen.getByText('security.pin.change_old_title'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the PIN hook is driven directly (bypassing the UI gate that fights React 19 numpad timing), when savePin then savePin(null) run, then checkPinEnabled and the keystore record both flip true → false in lockstep',
        async () => {
            // This test is the integration-level proof that the side
            // effects backing the gates above actually persist
            // correctly through the kms typed-secret store. The UI
            // tests above stop at "the right gate appears"; this one
            // closes the loop on "and when the gate completes, the
            // keystore reflects it." Driving via the hook avoids the
            // React 19 deferred-commit race we hit when typing
            // through PWNumpad in view-passphrase.test.tsx.
            const { result: pinHook } = renderHook(() => usePinCode())

            // Initial state: no PIN.
            await waitFor(async () => {
                expect(await pinHook.current.checkPinEnabled()).toBe(false)
            })

            // Save a PIN → enabled.
            await pinHook.current.savePin(TEST_PIN)
            expect(await pinHook.current.checkPinEnabled()).toBe(true)

            // Verify with the correct PIN succeeds.
            expect(await pinHook.current.verifyPin(TEST_PIN)).toBe(true)
            // Verify with the wrong PIN fails. This is the gate
            // production code uses to reject disable / change /
            // unlock attempts.
            expect(await pinHook.current.verifyPin('000000')).toBe(false)

            // Disable: save null → flag flips back, no record.
            await pinHook.current.savePin(null)
            expect(await pinHook.current.checkPinEnabled()).toBe(false)
            // After disable, even verifying the previously-correct
            // PIN returns false (the record is gone, not just hidden).
            expect(await pinHook.current.verifyPin(TEST_PIN)).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
