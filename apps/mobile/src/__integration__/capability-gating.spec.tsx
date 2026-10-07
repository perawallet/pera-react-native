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

// Entry points read the real chain registry, so a developer override of a
// capability must remove the element from the tree: nothing renders disabled.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

// MenuScreen reaches PWWebView through the @modules/webview barrel; the real
// component drags in the native provider chain, which doesn't resolve under
// vitest (same workaround as gift-card-flag.spec.tsx).
vi.mock('@modules/webview/components/PWWebView', () => ({
    PWWebView: () => null,
}))

import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { BottomSheetIdContext } from '@modules/bottom-sheet'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { MenuScreen } from '@modules/menu/routes'
import { AddAccountScreen } from '@modules/onboarding/screens/AddAccountScreen/AddAccountScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import { ButtonPanel } from '@modules/accounts/components/ButtonPanel'
import { AccountOverviewModalContext } from '@modules/accounts/components/AccountOverview/AccountOverviewModalContext'
import { RekeyOptionsContent } from '@modules/accounts/components/AccountOptionsContent/RekeyOptionsContent'

const ACCOUNT = {
    id: 'a1',
    custody: { kind: 'local', seed: 'algo25' },
    address: 'A'.repeat(58),
} as WalletAccount

const PanelScreen = () => (
    <AccountOverviewModalContext.Provider
        value={{
            account: ACCOUNT,
            openSendFunds: () => undefined,
            openReceiveFunds: () => undefined,
            openAccountOptions: () => undefined,
        }}
    >
        <ButtonPanel />
    </AccountOverviewModalContext.Provider>
)

const RekeySheet = () => (
    <BottomSheetIdContext.Provider value='rekey-options'>
        <RekeyOptionsContent />
    </BottomSheetIdContext.Provider>
)

const enableOverrides = async (): Promise<void> => {
    // Rehydrate first or the persist middleware's async hydration lands after
    // the override and clobbers it.
    await useRemoteConfigStore.persist.rehydrate()
}

describe('Flow: capability gating', () => {
    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    describe('Ledger entry points', () => {
        it('offers the Ledger rows at the Algorand defaults', () => {
            renderWithNavigation(ImportAccountOptionsScreen, 'ImportOptions')
            expect(
                screen.getByTestId('import_account_options_pair_ledger_button'),
            ).toBeTruthy()
        })

        it('removes every Ledger row from the import options when ledger is off', async () => {
            await enableOverrides()
            setCapabilityOverrides({ ledger: false })

            renderWithNavigation(ImportAccountOptionsScreen, 'ImportOptions')

            // A sibling row still renders, so the absence below means something.
            expect(
                screen.getByTestId(
                    'import_account_options_recover_wallet_button',
                ),
            ).toBeTruthy()
            expect(
                screen.queryByTestId(
                    'import_account_options_pair_ledger_button',
                ),
            ).toBeNull()
            expect(
                screen.queryByTestId(
                    'import_account_options_pair_ledger_usb_button',
                ),
            ).toBeNull()
        })

        it('removes the Ledger rekey target when ledger is off', async () => {
            await enableOverrides()
            setCapabilityOverrides({ ledger: false })

            renderWithNavigation(RekeySheet, 'RekeyOptions')

            expect(screen.getByTestId('rekey_option_standard')).toBeTruthy()
            expect(screen.queryByTestId('rekey_option_ledger')).toBeNull()
        })
    })

    describe('Swap entry points', () => {
        it('shows the Swap button on the account panel at the defaults', () => {
            renderWithNavigation(PanelScreen, 'Panel')

            expect(screen.getByTestId('swap_button')).toBeTruthy()
        })

        it('removes the Swap button, and only it, when swap is off', async () => {
            await enableOverrides()
            setCapabilityOverrides({ swap: false })

            renderWithNavigation(PanelScreen, 'Panel')

            expect(screen.getByTestId('send_button')).toBeTruthy()
            expect(screen.queryByTestId('swap_button')).toBeNull()
        })
    })

    describe('Menu entry points', () => {
        it('removes the Staking row when staking is off', async () => {
            await enableOverrides()
            setCapabilityOverrides({ staking: false })

            renderWithNavigation(MenuScreen, 'Menu')

            expect(screen.getByTestId('menu_contacts_button')).toBeTruthy()
            expect(screen.queryByTestId('menu_staking_button')).toBeNull()
        })

        // The gift-card flag and its capability are separate switches, and a
        // row needs both.
        it.each([
            ['flag on, capability off', true, false, false],
            ['flag off, capability on', false, true, false],
            ['flag on, capability on', true, true, true],
        ])(
            'gift cards with %s',
            async (_, isFlagOn, isCapabilityOn, isRowShown) => {
                await enableOverrides()
                useRemoteConfigStore
                    .getState()
                    .setConfigOverride('enable_gift_cards', isFlagOn)
                setCapabilityOverrides({ giftCards: isCapabilityOn })

                renderWithNavigation(MenuScreen, 'Menu')

                expect(screen.queryByText('menu.buy_gift_card') !== null).toBe(
                    isRowShown,
                )
            },
        )
    })

    describe('Pera Card entry points', () => {
        // The card flag and its capability are separate switches, and an entry
        // point needs both.
        it.each([
            ['flag on, capability off', true, false, false],
            ['flag off, capability on', false, true, false],
            ['flag on, capability on', true, true, true],
        ])(
            'the add-account card option with %s',
            async (_, isFlagOn, isCapabilityOn, isOptionShown) => {
                await enableOverrides()
                useRemoteConfigStore
                    .getState()
                    .setConfigOverride('enable_pera_card', isFlagOn)
                setCapabilityOverrides({ card: isCapabilityOn })

                renderWithNavigation(AddAccountScreen, 'AddAccountHome')

                expect(
                    screen.queryByTestId('add_account_pera_card_button') !==
                        null,
                ).toBe(isOptionShown)
            },
        )
    })
})
