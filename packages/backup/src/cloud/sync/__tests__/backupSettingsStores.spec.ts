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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    LaunchAccountModes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import {
    applyBackupSettings,
    readBackupSettings,
    subscribeBackupSettings,
} from '../backupSettingsStores'
import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'

const HELD_ID = 'held-id'

describe('backupSettingsStores', () => {
    beforeEach(() => {
        useCurrenciesStore.getState().resetState()
        useSettingsStore.getState().resetState()
        useAccountsStore.getState().resetState()
        useAccountsStore.setState({
            accounts: [
                {
                    id: HELD_ID,
                    custody: { kind: 'watch' },
                    chains: { algorand: { address: 'HELD' } },
                },
            ],
        })
        registerFakeBackupAdapter()
    })

    it('reads every synced setting from its store', () => {
        useCurrenciesStore.setState({
            preferredCurrency: 'EUR',
            fallbackCurrency: 'ALGO',
        })
        useSettingsStore.setState({ language: 'tr', confirmationMode: 'tap' })
        useAccountsStore.setState({
            launchAccountMode: LaunchAccountModes.specific,
            launchAccountId: HELD_ID,
        })

        expect(readBackupSettings('algorand')).toEqual({
            currency: { preferred: 'EUR', fallback: 'ALGO' },
            language: 'tr',
            confirmationMode: 'tap',
            launchAccount: { mode: 'specific', address: 'HELD' },
        })
    })

    it('applies every present setting', () => {
        applyBackupSettings(
            {
                currency: { preferred: 'EUR', fallback: 'ALGO' },
                language: 'de',
                confirmationMode: 'tap',
                launchAccount: { mode: 'specific', address: 'HELD' },
            },
            'algorand',
        )

        expect(readBackupSettings('algorand')).toEqual({
            currency: { preferred: 'EUR', fallback: 'ALGO' },
            language: 'de',
            confirmationMode: 'tap',
            launchAccount: { mode: 'specific', address: 'HELD' },
        })
    })

    it('skips values this device does not recognise or cannot honour', () => {
        const before = readBackupSettings('algorand')

        applyBackupSettings(
            {
                confirmationMode: 'hold',
                launchAccount: { mode: 'specific', address: 'NOT_HELD' },
            },
            'algorand',
        )

        expect(readBackupSettings('algorand')).toEqual(before)
    })

    it('notifies on a write to any of the three stores until unsubscribed', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeBackupSettings(listener)

        useCurrenciesStore.getState().setPreferredCurrency('EUR')
        useSettingsStore.getState().setLanguage('tr')
        useAccountsStore
            .getState()
            .setLaunchAccountPreference(LaunchAccountModes.specific, HELD_ID)
        unsubscribe()
        useSettingsStore.getState().setLanguage('de')

        expect(listener).toHaveBeenCalledTimes(3)
    })
})
