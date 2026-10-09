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

import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@test-utils/render'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SettingsLaunchScreen } from '@modules/settings/screens/SettingsLaunchScreen'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'

const TRADING: WalletAccount = {
    id: 'a-1',
    custody: { kind: 'local', seed: 'algo25' },
    chains: { algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' } },
    name: 'Trading',
}

const SAVINGS: WalletAccount = {
    id: 'a-2',
    custody: { kind: 'local', seed: 'algo25' },
    chains: { algorand: { address: HD_TEST_ADDRESS, keyPairId: 'b-key' } },
    name: 'Savings',
}

/**
 * Stands in for a cold start: bootstrap awaits store rehydration then calls
 * this, before the splash lifts. `useAppBootstrap.spec.ts` covers the wiring
 * that gets us here; this file covers what the user ends up looking at.
 */
const coldStart = () => {
    useAccountsStore.getState().applyLaunchAccountPreference()
}

describe('launch account selection', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useAccountsStore.getState().setAccounts([TRADING, SAVINGS])
        useAccountsStore.getState().setSelectedAccountId(TRADING.id)
    })

    it('keeps the last used account across a cold start by default', () => {
        useAccountsStore.getState().setSelectedAccountId(SAVINGS.id)

        coldStart()

        expect(useAccountsStore.getState().selectedAccountId).toBe(SAVINGS.id)
    })

    it('pins an account through the Launch Settings screen', async () => {
        renderWithNavigation(SettingsLaunchScreen, 'LaunchSettings')

        fireEvent.click(screen.getByTestId('settings_launch_specific_radio'))

        await waitFor(() => {
            expect(
                screen.getByTestId(
                    `settings_launch_account-${addressOf(SAVINGS)}`,
                ),
            ).toBeTruthy()
        })
        fireEvent.click(
            screen.getByTestId(`settings_launch_account-${addressOf(SAVINGS)}`),
        )

        await waitFor(() => {
            expect(useAccountsStore.getState().launchAccountId).toBe(SAVINGS.id)
        })
    })

    it('selects the pinned account on the next cold start', () => {
        useAccountsStore
            .getState()
            .setLaunchAccountPreference('specific', SAVINGS.id)
        // The user wandered off to another account before closing the app.
        useAccountsStore.getState().setSelectedAccountId(TRADING.id)

        coldStart()

        expect(useAccountsStore.getState().selectedAccountId).toBe(SAVINGS.id)
    })

    // Deep links resolve from mounted UI, strictly after bootstrap — so a
    // notification tap still wins for that session, and the pin reasserts on
    // the launch after it. Losing this ordering would land the user on a
    // transaction screen under the wrong account.
    it('lets a deep link override the pin for that session only', () => {
        useAccountsStore
            .getState()
            .setLaunchAccountPreference('specific', SAVINGS.id)

        coldStart()
        expect(useAccountsStore.getState().selectedAccountId).toBe(SAVINGS.id)

        // What useDeepLink does on a notification tap.
        useAccountsStore.getState().setSelectedAccountId(TRADING.id)
        expect(useAccountsStore.getState().selectedAccountId).toBe(TRADING.id)

        coldStart()
        expect(useAccountsStore.getState().selectedAccountId).toBe(SAVINGS.id)
    })

    it('falls back to last used once the pinned account is removed', () => {
        useAccountsStore
            .getState()
            .setLaunchAccountPreference('specific', SAVINGS.id)

        useAccountsStore.getState().setAccounts([TRADING])

        expect(useAccountsStore.getState().launchAccountMode).toBe('lastUsed')
        expect(useAccountsStore.getState().launchAccountId).toBeNull()

        coldStart()

        expect(useAccountsStore.getState().selectedAccountId).toBe(TRADING.id)
    })
})
