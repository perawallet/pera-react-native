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

import { useEffect } from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import * as Clipboard from 'expo-clipboard'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCardSessionStore } from '@perawallet/wallet-core-card'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { AccountMenu } from '@modules/accounts/components/AccountMenu/AccountMenu'
import { AccountOptionsContent } from '@modules/accounts/components/AccountOptionsContent'
import { useBottomSheet } from '@modules/bottom-sheet'

// Pera Card is gated behind a remote-config feature flag; enable it so the
// account-switcher card row renders in these flows.
vi.mock('@hooks/useIsPeraCardEnabled', () => ({
    useIsPeraCardEnabled: () => true,
}))

// Production opens the account-options sheet through `requestBottomSheet`
// (see useAccountOverview.openAccountOptions). Mirror that here so the
// content mounts inside a real BottomSheetHost — the content reads
// `useBottomSheetResult` from the host's context, so an inline render
// would throw. The BottomSheetManager itself is provided by TestProviders
// (apps/mobile/src/test-utils/render.tsx), mirroring production's
// app-root wiring.
const AccountOptionsHost = ({ account }: { account: WalletAccount }) => {
    const { request } = useBottomSheet()
    useEffect(() => {
        void request({
            contents: (
                <AccountOptionsContent
                    account={account}
                    onShowAddress={() => {}}
                />
            ),
            options: { size: 'modal', enablePanDownToClose: true },
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
}

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

const SLOW_TEST_TIMEOUT_MS = 30_000

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
    // Only the notification-mute test below actually hits the network (the
    // rest of this file's writes are local-only per the PERA-4585 audit) —
    // but an unmatched request here would otherwise escape MSW and hit real
    // staging, so give this file its own server lifecycle rather than
    // relying on another integration file's beforeAll having started it.
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        resetNotificationPreferences()
        vi.mocked(Notifier.showNotification).mockClear()
        vi.mocked(Clipboard.setStringAsync).mockClear()
        // Other tests in this file (rename, remove) also piggyback a
        // best-effort device PUT once a device id is registered — leave the
        // store at its ambient "no device" default here so they're unaffected.
        // The notification-mute test below seeds its own device id locally.
        useDeviceStore.getState().resetState()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        resetNotificationPreferences()
        // Reset the card session so an activated state doesn't leak into other
        // tests (it flips the Pera Card row between its activate/connected forms).
        useCardSessionStore.getState().setAuthenticated(false)
        useDeviceStore.getState().resetState()
        server.resetHandlers()
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
                () => <AccountOptionsHost account={ACCOUNT_B} />,
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
        'Given a Ledger account imported without an id, when the user removes it via the options sheet, then it is gone from the store and sibling accounts from the same device stay',
        async () => {
            // Hardware accounts from the Ledger pairing flow carry no `id`
            // (they are deduped by address). Removal used to silently no-op
            // for them while still showing the success toast (PERA-4293).
            const ledgerAccount = (
                address: string,
                accountIndex: number,
                name: string,
            ): WalletAccount => ({
                id: `hw-ledger-${accountIndex}`,
                type: AccountTypes.hardware,
                address,
                name,
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'nano-x-1',
                    deviceName: 'Ledger Nano X',
                    accountIndex,
                    transportType: 'ble',
                },
            })
            const ledgerA = ledgerAccount(ALGO25_TEST_ADDRESS, 0, 'Ledger 1')
            const ledgerB = ledgerAccount(HD_TEST_ADDRESS, 1, 'Ledger 2')
            useAccountsStore.getState().setAccounts([ledgerA, ledgerB])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(ledgerA.address)

            renderWithNavigation(
                () => <AccountOptionsHost account={ledgerA} />,
                'AccountOptionsHost',
            )

            // Hardware accounts hold no local key material, so the
            // backup-warning gate is skipped — straight to the confirm.
            tapButtonByLabel('account_options.remove_account')

            await waitFor(() =>
                tapButtonByLabel('account_options.remove_confirm'),
            )

            await waitFor(() => {
                expect(useAccountsStore.getState().accounts).toHaveLength(1)
            })
            // The sibling from the same device (same deviceId, different
            // address) must survive the removal.
            expect(useAccountsStore.getState().accounts[0].address).toBe(
                ledgerB.address,
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
            const seedKeyId = key!.seedKey.id ?? ''
            const childKeyId = key!.signKeyId
            // Sanity: both keystore entries are present before removal —
            // the seed and the ed25519 signing child committed alongside.
            const keysBefore = getKeystoreStore().state.keys.map(k => k.id)
            expect(keysBefore).toContain(seedKeyId)
            expect(keysBefore).toContain(childKeyId)

            // Account.keyPairId references the derived ed25519 child key;
            // the seed is reachable via the child's metadata.parentKeyId.
            const algo25Account: WalletAccount = {
                id: 'signer-1',
                type: AccountTypes.algo25,
                address: ALGO25_TEST_ADDRESS,
                keyPairId: childKeyId,
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
                () => <AccountOptionsHost account={algo25Account} />,
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

            // Both the seed and its ed25519 signing child are gone — the
            // removal path follows the child up to its parent seed and
            // sweeps both. Leaving the seed behind would be a security
            // bug (it carries the mnemonic-recoverable bytes, so an
            // attacker could re-import the supposedly-deleted account).
            const keysAfter = getKeystoreStore().state.keys.map(k => k.id)
            expect(keysAfter).not.toContain(seedKeyId)
            expect(keysAfter).not.toContain(childKeyId)
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
            // useAccountNotificationEnabledMutation falls back to
            // `deviceID ?? ''` when the device isn't registered, which would
            // PATCH `/v1/devices//accounts/...` — a URL no handler matches.
            // Seed a known device id (both networks, since the test env's
            // default network isn't pinned here) so the request below is
            // addressable; the shared afterEach resets it for other tests.
            useDeviceStore.getState().setDeviceID('mainnet', 'test-device-id')
            useDeviceStore.getState().setDeviceID('testnet', 'test-device-id')
            // Sanity: notifications are enabled by default — we want to
            // observe the toggle flipping a fresh account, not the
            // recovery from a prior disabled state.
            const { result: notifBefore } = renderHook(() =>
                useNotificationPreferences(),
            )
            expect(notifBefore.current.disabledAccounts).toEqual([])

            // The toggle now genuinely PATCHes the backend (that's the whole
            // point of PERA-4585's fix) — mock it here rather than letting the
            // request escape to the real network. Captures the payload too, so
            // this pins the property Task 3 exists to guarantee: the right
            // account and status are actually sent, not just the local store
            // flip.
            let patchBody: Record<string, unknown> | undefined
            server.use(
                http.patch(
                    `*/v1/devices/test-device-id/accounts/${ACCOUNT_A.address}/`,
                    async ({ request }) => {
                        patchBody = (await request.json()) as Record<
                            string,
                            unknown
                        >
                        return HttpResponse.json(
                            { has_new_notification: false },
                            { status: 200 },
                        )
                    },
                ),
            )

            renderWithNavigation(
                () => <AccountOptionsHost account={ACCOUNT_A} />,
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
            // assert a toast with the muted-state title was shown. We match
            // by title rather than asserting on the *last* call: toasts
            // dispatch on real-timer setTimeouts, so a delayed toast from a
            // prior test can land here and isn't necessarily the most recent
            // call.
            await waitFor(() => {
                const titles = vi
                    .mocked(Notifier.showNotification)
                    .mock.calls.map(call => call[0].title)
                expect(titles).toContain('account_options.notifications_muted')
            })

            // The success toast only fires after the PATCH resolves, so by
            // this point the request has already landed — confirm it carried
            // the correct (disabled) status for this account.
            expect(patchBody).toEqual({ receive_notifications: false })
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
                () => <AccountOptionsHost account={ACCOUNT_A} />,
                'AccountOptionsHost',
            )

            // The copy-address row is in the "general" section of the
            // sheet (see AccountOptionsContent.tsx generalOptions
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
                () => <AccountOptionsHost account={ACCOUNT_A} />,
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

    it(
        'Given showPeraCardActivation, when the Pera Card Activate button is tapped, then the row renders and the activate intent fires',
        async () => {
            useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(ACCOUNT_A.address)
            const handlePeraCardActivate = vi.fn()

            renderWithNavigation(
                () => (
                    <AccountMenu
                        onSelected={vi.fn()}
                        onAddAccount={() => {}}
                        onOpenSort={() => {}}
                        onPeraCardActivate={handlePeraCardActivate}
                        showPeraCardActivation
                    />
                ),
                'AccountMenuHost',
            )

            // i18n falls back to the raw key under the integration setup, so
            // match the title/button keys directly.
            await waitFor(() => {
                expect(
                    screen.getByText('peraCard.account_item.title'),
                ).toBeTruthy()
            })

            tapButtonByLabel('peraCard.account_item.activate')

            // The intent fires so the host can close the menu sheet and
            // navigate to the Pera Card intro.
            expect(handlePeraCardActivate).toHaveBeenCalledTimes(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an activated card session, when the connected Pera Card row is tapped, then the open intent fires',
        async () => {
            useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(ACCOUNT_A.address)
            // An authenticated card session renders the connected (tappable)
            // row instead of the dashed Activate CTA.
            useCardSessionStore.getState().setAuthenticated(true)
            const handlePeraCardOpen = vi.fn()

            renderWithNavigation(
                () => (
                    <AccountMenu
                        onSelected={vi.fn()}
                        onAddAccount={() => {}}
                        onOpenSort={() => {}}
                        onPeraCardOpen={handlePeraCardOpen}
                        showPeraCardActivation
                    />
                ),
                'AccountMenuHost',
            )

            const row = await screen.findByTestId('pera_card_connected_row')
            fireEvent.click(row)

            expect(handlePeraCardOpen).toHaveBeenCalledTimes(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
