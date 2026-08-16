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

// Covers the Settings → Passkeys removal flow end-to-end: tapping a passkey's
// trash icon opens the shared ConfirmActionContent sheet, confirming runs the
// real useRemovePasskeyMutation against the in-memory keystore + native autofill
// stub, and a failed removal surfaces an error toast while leaving the row in
// place. (The state/notice rendering lives in `settings-passkeys.test.tsx`.)

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    readMasterKey,
    resetTestKeystore,
    storage,
} from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { NativeStoredCredential } from '@perawallet/wallet-extension-passkey-autofill'
import {
    PASSKEY_MIGRATION_NEEDED,
    sealNativeProviderRecord,
} from '@perawallet/wallet-core-passkeys'
import {
    AccountTypes,
    DerivationTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SettingsPasskeyScreen } from '@modules/settings/screens/SettingsPasskeysScreen'
import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

const HD_ACCOUNT: WalletAccount = {
    id: 'hd-1',
    type: AccountTypes.hdWallet,
    address: HD_TEST_ADDRESS,
    name: 'Universal',
    keyPairId: 'hd-key-1',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: DerivationTypes.Peikert,
    },
}

const NATIVE_CREDENTIAL: NativeStoredCredential = {
    credentialId: 'cred-123',
    rpId: 'example.com',
    userHandle: 'alice',
    name: 'Alice Example',
    createdAt: 1_700_000_000_000,
}

type AutofillMock = {
    isProviderActive: ReturnType<typeof vi.fn>
    getStoredCredentials: ReturnType<typeof vi.fn>
    openProviderSettings: ReturnType<typeof vi.fn>
    deleteCredential: ReturnType<typeof vi.fn>
    refreshCredentialIdentities: ReturnType<typeof vi.fn>
}

const getAutofill = (): AutofillMock =>
    (getProvider() as unknown as { passkeyAutofill: AutofillMock })
        .passkeyAutofill

type KeyStore = {
    import: (key: {
        id: string
        type: string
        metadata: Record<string, unknown>
    }) => Promise<string>
    remove: (id: string) => Promise<void>
}

const getKeyStore = (): KeyStore =>
    (getProvider() as unknown as { key: { store: KeyStore } }).key.store

// The platform-driver biometrics mock has no getSecurityLevel; without it the
// screen reads "no screen lock" and shows the prereq notice. Pin it to 'strong'
// so the populated list renders cleanly. (See settings-passkeys.test.tsx.)
const setStrongBiometric = () => {
    ;(
        getProvider().biometrics as unknown as {
            getSecurityLevel: () => Promise<string>
        }
    ).getSecurityLevel = vi.fn().mockResolvedValue('strong')
}

// ConfirmActionContent's buttons carry no testID; under the integration setup
// i18n falls back to the key string, so match the button by its label key.
const tapButtonByLabel = (label: string) => {
    const button = screen
        .getAllByRole('button')
        .find(b => (b.textContent ?? '').includes(label))
    if (!button) throw new Error(`No button labelled "${label}"`)
    fireEvent.click(button)
}

const importKeystorePasskey = (id: string, isFlagged: boolean) =>
    getKeyStore().import({
        id,
        type: 'hd-derived-p256',
        metadata: {
            origin: 'example.com',
            userHandle: 'alice',
            createdAt: 1_700_000_000_000,
            ...(isFlagged ? { migration: PASSKEY_MIGRATION_NEEDED } : {}),
        },
    })

const nativeCredential = (credentialId: string): NativeStoredCredential => ({
    credentialId,
    rpId: 'example.com',
    userHandle: 'alice',
    name: credentialId,
    createdAt: 1_700_000_000_000,
})

// The majority shape of a flagged credential after the upgrade: upstream's
// `migrateLegacyPasskeys` stamps `metadata.migration` on the `k/` record and
// `repairs/0002-rematerialize-passkey-credentials` then deletes that record,
// leaving the marker only in the flat bare-id record the native providers
// read. The credential therefore reaches the screen as a native
// identity-store row — `source: 'native'`, whose shape has no metadata bag and
// so always reports `needsMigration: false`.
const seedFlaggedFlatRecord = async (id: string) => {
    const masterKey = Uint8Array.from(await readMasterKey())
    const sealed = await sealNativeProviderRecord(
        globalThis.crypto.subtle,
        masterKey,
        {
            id,
            type: 'hd-derived-p256',
            publicKey: [1, 2, 3],
            privateKey: [4, 5, 6],
            metadata: {
                origin: 'example.com',
                userHandle: 'alice',
                createdAt: 1_700_000_000_000,
                migration: PASSKEY_MIGRATION_NEEDED,
            },
        },
    )
    storage.set(id, sealed)
}

const hasButtonWithLabel = (label: string): boolean =>
    screen
        .getAllByRole('button')
        .some(b => (b.textContent ?? '').includes(label))

describe('Flow: Settings → Passkeys removal', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterAll(() => server.close())

    beforeEach(() => {
        vi.restoreAllMocks()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([HD_ACCOUNT])
        setStrongBiometric()

        const a = getAutofill()
        a.isProviderActive.mockReset()
        a.getStoredCredentials.mockReset()
        a.deleteCredential.mockReset()
        a.refreshCredentialIdentities.mockReset()
        a.isProviderActive.mockResolvedValue(true)
        a.getStoredCredentials.mockResolvedValue([])
        a.deleteCredential.mockResolvedValue(undefined)
        a.refreshCredentialIdentities.mockResolvedValue(undefined)

        vi.mocked(Notifier.showNotification).mockClear()
    })

    it(
        'confirms removal of a passkey and deletes it from the native autofill store',
        async () => {
            getAutofill().getStoredCredentials.mockResolvedValue([
                NATIVE_CREDENTIAL,
            ])

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')
            await waitFor(() =>
                expect(
                    screen.getByTestId('settings_passkeys_item_cred-123'),
                ).toBeTruthy(),
            )

            fireEvent.click(screen.getByTestId('touchable-icon-trash'))
            await waitFor(() =>
                expect(
                    hasButtonWithLabel('settings.passkeys.remove_confirm'),
                ).toBe(true),
            )
            tapButtonByLabel('settings.passkeys.remove_confirm')

            await waitFor(() =>
                expect(getAutofill().deleteCredential).toHaveBeenCalledWith(
                    'cred-123',
                ),
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'leaves the passkey untouched when the confirmation sheet is cancelled',
        async () => {
            getAutofill().getStoredCredentials.mockResolvedValue([
                NATIVE_CREDENTIAL,
            ])

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')
            await waitFor(() =>
                expect(
                    screen.getByTestId('settings_passkeys_item_cred-123'),
                ).toBeTruthy(),
            )

            fireEvent.click(screen.getByTestId('touchable-icon-trash'))
            await waitFor(() =>
                expect(
                    hasButtonWithLabel('settings.passkeys.remove_cancel'),
                ).toBe(true),
            )
            tapButtonByLabel('settings.passkeys.remove_cancel')

            // Sheet closes and no deletion is attempted.
            await waitFor(() =>
                expect(
                    hasButtonWithLabel('settings.passkeys.remove_confirm'),
                ).toBe(false),
            )
            expect(getAutofill().deleteCredential).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'surfaces an error toast and keeps the row when the keystore removal fails',
        async () => {
            // A keystore-backed passkey: only this source routes through the
            // keystore remove, which is the call whose rejection propagates.
            await getKeyStore().import({
                id: 'keystore-cred',
                type: 'hd-derived-p256',
                metadata: {
                    origin: 'example.com',
                    userHandle: 'alice',
                    createdAt: 1_700_000_000_000,
                },
            })
            vi.spyOn(getKeyStore(), 'remove').mockRejectedValue(
                new Error('keystore busy'),
            )

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')
            await waitFor(() =>
                expect(
                    screen.getByTestId('settings_passkeys_item_keystore-cred'),
                ).toBeTruthy(),
            )

            fireEvent.click(screen.getByTestId('touchable-icon-trash'))
            await waitFor(() =>
                expect(
                    hasButtonWithLabel('settings.passkeys.remove_confirm'),
                ).toBe(true),
            )
            tapButtonByLabel('settings.passkeys.remove_confirm')

            await waitFor(() =>
                expect(Notifier.showNotification).toHaveBeenCalled(),
            )
            // The removal failed, so the passkey is still listed.
            expect(
                screen.getByTestId('settings_passkeys_item_keystore-cred'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // R7: a flagged passkey can't be recovered from the recovery passphrase and
    // its replacement can only be registered while Pera is the active provider,
    // so removing one with the provider off is a one-way lockout. The list row
    // is a second way to reach that delete — withholding it only on the
    // migration banner leaves the hole open two taps below. A row neither
    // source reports as flagged is derivable again from the passphrase, so it
    // stays removable.
    //
    // Both rows here are keystore-backed, the one source that carries the
    // marker on the row itself; the un-adopted majority is the case below.
    it(
        'withholds removal of a flagged passkey while the provider is off, without withholding it for the rest',
        async () => {
            getAutofill().isProviderActive.mockResolvedValue(false)
            await importKeystorePasskey('flagged-cred', true)
            await importKeystorePasskey('plain-cred', false)

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')
            await waitFor(() =>
                expect(
                    screen.getByTestId('settings_passkeys_item_plain-cred'),
                ).toBeTruthy(),
            )

            const flaggedRow = screen.getByTestId(
                'settings_passkeys_item_flagged-cred',
            )
            expect(
                within(flaggedRow).queryByTestId('touchable-icon-trash'),
            ).toBeFalsy()

            // The row renders before the migration read settles, and until it
            // does no row offers removal — so wait for the icon, not the row.
            const plainTrash = await within(
                screen.getByTestId('settings_passkeys_item_plain-cred'),
            ).findByTestId('touchable-icon-trash')
            fireEvent.click(plainTrash)
            await waitFor(() =>
                expect(
                    hasButtonWithLabel('settings.passkeys.remove_confirm'),
                ).toBe(true),
            )
            tapButtonByLabel('settings.passkeys.remove_confirm')

            await waitFor(() =>
                expect(
                    screen.queryByTestId('settings_passkeys_item_plain-cred'),
                ).toBeFalsy(),
            )
            expect(
                screen.getByTestId('settings_passkeys_item_flagged-cred'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // The case above is the minority one: a credential `repairs/0002` declined
    // to un-adopt, so its `k/` record survives and `usePasskeysQuery` can read
    // the marker off it. For every credential the repair did un-adopt — all but
    // that one — the row is a `source: 'native'` projection of the native
    // identity store, whose shape carries no metadata bag, so `needsMigration`
    // is hardcoded `false` and gating on it alone leaves the trash icon on the
    // one row that must never offer it.
    it(
        'withholds removal of a flagged credential the passkey list reports unflagged, while the rest of the list still deletes',
        async () => {
            getAutofill().isProviderActive.mockResolvedValue(false)
            await seedFlaggedFlatRecord('native-flagged')
            getAutofill().getStoredCredentials.mockResolvedValue([
                nativeCredential('native-flagged'),
                nativeCredential('native-plain'),
            ])

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')
            const plainRow = await screen.findByTestId(
                'settings_passkeys_item_native-plain',
            )
            // The banner reads the same flat record, so its presence is what
            // says the marker was found at all — without it this test would
            // pass on a screen that simply never learned the credential exists.
            await waitFor(() =>
                expect(
                    screen.getByTestId('settings_passkeys_migration_blocked'),
                ).toBeTruthy(),
            )

            // Exactly one trash icon on a two-row list: the flagged row has
            // none and the unflagged one is untouched.
            await waitFor(() =>
                expect(
                    screen.getAllByTestId('touchable-icon-trash'),
                ).toHaveLength(1),
            )
            expect(
                within(
                    screen.getByTestId('settings_passkeys_item_native-flagged'),
                ).queryByTestId('touchable-icon-trash'),
            ).toBeFalsy()

            // Drive the surviving icon all the way through the real removal, so
            // "the flagged credential was not deleted" is a statement about the
            // gate rather than about a screen where deletion is broken.
            fireEvent.click(
                within(plainRow).getByTestId('touchable-icon-trash'),
            )
            await waitFor(() =>
                expect(
                    hasButtonWithLabel('settings.passkeys.remove_confirm'),
                ).toBe(true),
            )
            tapButtonByLabel('settings.passkeys.remove_confirm')

            await waitFor(() =>
                expect(getAutofill().deleteCredential).toHaveBeenCalledWith(
                    'native-plain',
                ),
            )
            expect(getAutofill().deleteCredential).not.toHaveBeenCalledWith(
                'native-flagged',
            )
            expect(
                screen.getByTestId('settings_passkeys_item_native-flagged'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
