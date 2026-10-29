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

// The onboarding passkey step as rendered. The harness has no `chrome` global
// and resolves the keystore package to its dist, so the WebAuthn ceremony is
// scripted at spec level, the way integrity-degraded.spec.tsx scripts web
// modules. Copy is asserted by key: this project renders i18n keys.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { fireEvent, render, screen, waitFor } from '@test-utils/render'
import {
    recordAnalyticsEvents,
    type AnalyticsRecorder,
} from '@test-utils/analytics-recorder'
import { PasskeyUnlockSetupScreen } from '@modules/vault/screens/PasskeyUnlockSetupScreen/PasskeyUnlockSetupScreen'
import { usePasskeySetupStore } from '@modules/vault/hooks/usePasskeySetupStore.web'

const mocks = vi.hoisted(() => ({
    enablePasskeyUnlockWithSession: vi.fn<() => Promise<void>>(),
    readPasskeySetupPending: vi.fn(async () => true),
    writePasskeySetupPending: vi.fn(async (_isPending: boolean) => {}),
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => {
    class NamedError extends Error {
        constructor(name: string, message = name) {
            super(message)
            this.name = name
        }
    }
    return {
        enablePasskeyUnlockWithSession: mocks.enablePasskeyUnlockWithSession,
        enablePasskeyUnlock: vi.fn(),
        readPasskeySetupPending: mocks.readPasskeySetupPending,
        writePasskeySetupPending: mocks.writePasskeySetupPending,
        isPasskeyUnlockSupported: vi.fn(async () => true),
        isPasskeyUnlockEnabled: vi.fn(async () => false),
        getLockoutRemainingSeconds: vi.fn(async () => 0),
        verifyVaultPassword: vi.fn(),
        verifyPasskey: vi.fn(),
        InvalidPasswordError: class extends NamedError {
            constructor(message: string) {
                super('InvalidPasswordError', message)
            }
        },
        PasskeyPrfUnsupportedError: class extends NamedError {
            constructor() {
                super('PasskeyPrfUnsupportedError')
            }
        },
        VaultReauthRequiredError: class extends NamedError {
            constructor() {
                super('VaultReauthRequiredError')
            }
        },
        VaultLockedError: class extends NamedError {
            constructor(message: string) {
                super('VaultLockedError', message)
            }
        },
        VaultLockedOutError: class extends NamedError {
            constructor(readonly remainingSeconds: number) {
                super('VaultLockedOutError')
            }
        },
        PasskeyUnlockError: class extends NamedError {
            constructor() {
                super('PasskeyUnlockError')
            }
        },
        VaultCorruptedError: class extends NamedError {
            constructor() {
                super('VaultCorruptedError')
            }
        },
    }
})

describe('Flow: passkey unlock offered after Create Password', () => {
    let analytics: AnalyticsRecorder

    beforeEach(() => {
        vi.clearAllMocks()
        analytics = recordAnalyticsEvents()
        useSettingsStore.getState().resetState()
        usePasskeySetupStore.getState().resetState()
    })

    afterEach(() => {
        analytics.restore()
    })

    it('Given the step, when the browser rejects with NotAllowedError, then it stays with the not-saved error, the hint and Try again, and nothing continues', async () => {
        mocks.enablePasskeyUnlockWithSession.mockRejectedValue(
            new DOMException('closed', 'NotAllowedError'),
        )
        const onDone = vi.fn()
        render(<PasskeyUnlockSetupScreen onDone={onDone} />)

        fireEvent.click(screen.getByText('vault.passkey_setup.enable_button'))

        await waitFor(() =>
            expect(
                screen.getByText('vault.passkey_setup.error_not_saved'),
            ).toBeTruthy(),
        )
        expect(
            screen.getByText('vault.passkey_setup.hint_not_saved_title'),
        ).toBeTruthy()
        expect(
            screen.getByText('vault.passkey_setup.retry_button'),
        ).toBeTruthy()
        expect(onDone).not.toHaveBeenCalled()
        expect(mocks.writePasskeySetupPending).not.toHaveBeenCalledWith(false)
        expect(analytics.events(['vault_passkey_enable_fail'])).toEqual([
            {
                name: 'vault_passkey_enable_fail',
                payload: {
                    screen: 'onboarding',
                    error_root_cause: 'not-saved:NotAllowedError',
                },
            },
        ])
    })

    it('Given the step, when enabling succeeds, then the success view shows and Continue clears the step and calls onDone', async () => {
        mocks.enablePasskeyUnlockWithSession.mockResolvedValue(undefined)
        const onDone = vi.fn()
        render(<PasskeyUnlockSetupScreen onDone={onDone} />)

        fireEvent.click(screen.getByText('vault.passkey_setup.enable_button'))
        await waitFor(() =>
            expect(
                screen.getByText('vault.passkey_setup.success_title'),
            ).toBeTruthy(),
        )
        fireEvent.click(screen.getByText('vault.passkey_setup.continue_button'))

        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
        expect(mocks.writePasskeySetupPending).toHaveBeenCalledWith(false)
        expect(analytics.events(['vault_passkey_enable_success'])).toHaveLength(
            1,
        )
    })

    it('Given the step, when Not now is pressed, then the one-time offer is spent, the step is cleared and onDone runs', async () => {
        const onDone = vi.fn()
        render(<PasskeyUnlockSetupScreen onDone={onDone} />)

        fireEvent.click(screen.getByText('vault.passkey_setup.not_now_button'))

        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
        expect(
            useSettingsStore
                .getState()
                .getPreference(UserPreferences._passkeyUnlockOfferPrompt),
        ).toBe(true)
        expect(mocks.writePasskeySetupPending).toHaveBeenCalledWith(false)
        expect(analytics.events(['vault_passkey_offer_skip'])).toHaveLength(1)
    })
})
