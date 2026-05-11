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
import * as Clipboard from 'expo-clipboard'
import { Notifier } from 'react-native-notifier'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { AccountMenu } from '@modules/accounts/components/AccountMenu/AccountMenu'
import { AccountOptionsBottomSheet } from '@modules/accounts/components/AccountOptionsBottomSheet/AccountOptionsBottomSheet'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'

const ACCOUNT_A: WalletAccount = {
    id: 'a-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'a-key',
    name: 'Trading',
}

const ACCOUNT_B: WalletAccount = {
    id: 'b-1',
    type: AccountTypes.watch,
    address: HD_TEST_ADDRESS,
    name: 'Cold backup',
}

// Helper: tap the row whose visible text matches the supplied account
// name. AccountMenu renders each account inside a PWTouchableOpacity
// (mocked as <button>) wrapping AccountWithBalance — there's no per-row
// testid in production, so we walk the DOM instead.
const tapAccountRow = (accountName: string) => {
    const matches = screen.getAllByText((_, node) =>
        (node?.textContent ?? '').includes(accountName),
    )
    const leaf = matches.find(el => el.children.length === 0) ?? matches[0]
    const button = leaf.closest('button')
    if (!button) {
        throw new Error(`Row not found for account "${accountName}"`)
    }
    fireEvent.click(button)
}

// Helper: find a button whose visible label text matches an i18n key.
// PWButton's mock places the title text inside the button; i18n falls
// back to the key string under the integration setup, so we match keys
// directly. (Several remove-flow buttons don't carry explicit testids.)
const tapButtonByLabel = (i18nKey: string) => {
    const buttons = screen.getAllByRole('button')
    const button = buttons.find(b => (b.textContent ?? '').includes(i18nKey))
    if (!button) {
        throw new Error(`Button not found for label "${i18nKey}"`)
    }
    fireEvent.click(button)
}

const SLOW_TEST_TIMEOUT_MS = 30000

// Notification preferences are persisted via a Zustand store inside
// `@perawallet/wallet-core-messages`; the store itself isn't re-exported
// from the package's public entry, so we drive resets through the hook.
const resetNotificationPreferences = () => {
    const { result } = renderHook(() => useNotificationPreferences())
    // Re-enable everything that any prior test disabled so subsequent
    // tests start with a clean enabled-by-default state.
    result.current.disabledAccounts.forEach(addr => {
        result.current.setAccountEnabled(addr, true)
    })
}

describe('Flow: Account management', () => {
    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        resetNotificationPreferences()
        vi.mocked(Notifier.showNotification).mockClear()
        vi.mocked(Clipboard.setStringAsync).mockClear()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        resetNotificationPreferences()
    })

    it('Given two accounts with the first selected, when the user taps the second in the account menu, then the selected address switches', async () => {
        useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])
        useAccountsStore.getState().setSelectedAccountAddress(ACCOUNT_A.address)

        const handleSelected = vi.fn()
        const noop = () => {}
        renderWithNavigation(
            () => (
                <AccountMenu
                    onSelected={handleSelected}
                    onAddAccount={noop}
                    onOpenSort={noop}
                />
            ),
            'AccountMenuHost',
        )

        tapAccountRow(ACCOUNT_B.name as string)

        await waitFor(() => {
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                ACCOUNT_B.address,
            )
        })
        // The host also fires the onSelected callback so callers (e.g.
        // bottom-sheet host) can dismiss themselves.
        expect(handleSelected).toHaveBeenCalledWith(
            expect.objectContaining({ address: ACCOUNT_B.address }),
        )
    })

    it(
        'Given two accounts and the watch account selected, when the user removes it via the options sheet, then it is gone from the store and the other account is selected',
        async () => {
            useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(ACCOUNT_B.address)

            renderWithNavigation(
                () => (
                    <AccountOptionsBottomSheet
                        isVisible
                        onClose={() => {}}
                        onShowAddress={() => {}}
                        account={ACCOUNT_B}
                    />
                ),
                'AccountOptionsHost',
            )

            // Open the destructive remove option in the management section.
            // Watch accounts skip the backup warning and go straight to the
            // confirmation sheet.
            tapButtonByLabel('account_options.remove_account')

            // Tap "Confirm remove" in the confirmation sheet.
            await waitFor(() =>
                tapButtonByLabel('account_options.remove_confirm'),
            )

            await waitFor(() => {
                expect(useAccountsStore.getState().accounts).toHaveLength(1)
            })
            expect(useAccountsStore.getState().accounts[0].id).toBe(
                ACCOUNT_A.id,
            )
            // setAccounts re-points selectedAccountAddress to the first
            // remaining account when the previously selected one is gone.
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                ACCOUNT_A.address,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an algo25 account with real keystore keys, when the user removes it, then the backup-warning gate appears, the account is removed, and the keystore key plus its `-seed` sibling are wiped (no orphans)',
        async () => {
            // Mint a real algo25 key from the pinned mnemonic so the
            // keystore actually has both the root key and its `-seed`
            // sibling — the production removal path strips both, so we
            // need both present to assert they end up gone.
            const { result: kms } = renderHook(() => useKMS())
            let key: Algo25KeyResult | null = null
            await waitFor(async () => {
                key = await kms.current.createAlgo25Key({
                    mnemonic: ALGO25_TEST_MNEMONIC,
                })
                expect(key).not.toBeNull()
            })
            const keyPairId = key!.keyPair.id ?? ''
            // Sanity: both keystore entries are present before removal.
            const keysBefore = getKeystoreStore().state.keys.map(k => k.id)
            expect(keysBefore).toContain(keyPairId)
            expect(keysBefore).toContain(`${keyPairId}-seed`)

            const algo25Account: WalletAccount = {
                id: 'signer-1',
                type: AccountTypes.algo25,
                address: ALGO25_TEST_ADDRESS,
                keyPairId,
                name: 'Signing account',
            }
            // Watch account stays in the list so the post-removal
            // "select fallback" branch fires and we can sanity-check
            // it.
            useAccountsStore.getState().setAccounts([algo25Account, ACCOUNT_B])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(algo25Account.address)

            renderWithNavigation(
                () => (
                    <AccountOptionsBottomSheet
                        isVisible
                        onClose={() => {}}
                        onShowAddress={() => {}}
                        account={algo25Account}
                    />
                ),
                'AccountOptionsHost',
            )

            tapButtonByLabel('account_options.remove_account')

            // Algo25 accounts have signing keys → the production flow
            // routes through `BackupWarningBottomSheet` first (so the
            // user can't accidentally orphan a non-backed-up key).
            // Confirm the gate is showing, then continue past it.
            await waitFor(() =>
                tapButtonByLabel('account_options.backup_warning_continue'),
            )

            await waitFor(() =>
                tapButtonByLabel('account_options.remove_confirm'),
            )

            await waitFor(() => {
                expect(useAccountsStore.getState().accounts).toHaveLength(1)
            })
            expect(useAccountsStore.getState().accounts[0].id).toBe(
                ACCOUNT_B.id,
            )
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                ACCOUNT_B.address,
            )

            // Both the root key and its `-seed` sibling are gone — the
            // removal path uses `useKMS().deleteKey` for the root and
            // `keyStore.remove(...-seed)` for the mnemonic-recovery
            // sibling. Leaving either behind would be a security bug
            // (the `-seed` entry is the only way to recover the
            // 25-word phrase, which would let an attacker re-import
            // the supposedly-deleted account).
            const keysAfter = getKeystoreStore().state.keys.map(k => k.id)
            expect(keysAfter).not.toContain(keyPairId)
            expect(keysAfter).not.toContain(`${keyPairId}-seed`)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an account whose notifications are enabled, when the user taps "mute notifications" in the options sheet, then the address is added to the notification-disabled list',
        async () => {
            useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(ACCOUNT_A.address)
            // Sanity: notifications are enabled by default — we want to
            // observe the toggle flipping a fresh account, not the
            // recovery from a prior disabled state.
            const { result: notifBefore } = renderHook(() =>
                useNotificationPreferences(),
            )
            expect(notifBefore.current.disabledAccounts).toEqual([])

            renderWithNavigation(
                () => (
                    <AccountOptionsBottomSheet
                        isVisible
                        onClose={() => {}}
                        onShowAddress={() => {}}
                        account={ACCOUNT_A}
                    />
                ),
                'AccountOptionsHost',
            )

            // Initial label is the "mute" form because notifications are
            // currently enabled. After the tap, the production hook flips
            // the entry into `notificationDisabledAccounts` and the toast
            // is shown via Notifier.
            tapButtonByLabel('account_options.mute_notifications')

            const { result: notifAfter } = renderHook(() =>
                useNotificationPreferences(),
            )
            await waitFor(() => {
                expect(
                    notifAfter.current.isAccountEnabled(ACCOUNT_A.address),
                ).toBe(false)
            })
            // The non-selected account is unaffected — confirms we
            // didn't accidentally globally mute.
            expect(notifAfter.current.isAccountEnabled(ACCOUNT_B.address)).toBe(
                true,
            )

            // The hook also fires a toast so the user gets feedback —
            // assert it ran with the muted-state title.
            const toastCalls = vi.mocked(Notifier.showNotification).mock.calls
            expect(toastCalls.length).toBeGreaterThan(0)
            const lastCall = toastCalls[toastCalls.length - 1][0]
            expect(lastCall.title).toBe('account_options.notifications_muted')
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an account in the options sheet, when the user taps "Copy address", then the address is written to the clipboard',
        async () => {
            useAccountsStore.getState().setAccounts([ACCOUNT_A])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(ACCOUNT_A.address)

            renderWithNavigation(
                () => (
                    <AccountOptionsBottomSheet
                        isVisible
                        onClose={() => {}}
                        onShowAddress={() => {}}
                        account={ACCOUNT_A}
                    />
                ),
                'AccountOptionsHost',
            )

            // The copy-address row is in the "general" section of the
            // sheet (see AccountOptionsBottomSheet.tsx generalOptions
            // filter). Title comes from `account_options.copy_address`.
            tapButtonByLabel('account_options.copy_address')

            // useClipboard.copyToClipboard awaits Clipboard.setStringAsync
            // before the toast fires. Wait for the call rather than
            // asserting synchronously.
            await waitFor(() => {
                expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
                    ACCOUNT_A.address,
                )
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an account in the options sheet, when the user renames it, then the new name is persisted',
        async () => {
            useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(ACCOUNT_A.address)

            renderWithNavigation(
                () => (
                    <AccountOptionsBottomSheet
                        isVisible
                        onClose={() => {}}
                        onShowAddress={() => {}}
                        account={ACCOUNT_A}
                    />
                ),
                'AccountOptionsHost',
            )

            tapButtonByLabel('account_options.rename_account')

            // RenameAccountBottomSheet renders a PWInput + a save button.
            // The input has no explicit testID — find the only input on
            // the screen and change it.
            const inputs = document.querySelectorAll('input')
            const renameInput = inputs[inputs.length - 1] // the rename
            fireEvent.change(renameInput, {
                target: { value: 'Long-term hold' },
            })

            // The save button is labeled with `account_options.rename_save`.
            tapButtonByLabel('account_options.rename_save')

            await waitFor(() => {
                const updated = useAccountsStore
                    .getState()
                    .accounts.find(a => a.id === ACCOUNT_A.id)
                expect(updated?.name).toBe('Long-term hold')
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
