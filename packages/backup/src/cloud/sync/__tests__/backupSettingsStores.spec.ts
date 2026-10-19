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
    AccountSortModes,
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
const OTHER_ID = 'other-id'
const ETH_ONLY_ID = 'eth-only-id'

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
            sortMode: AccountSortModes.alphabeticalAsc,
            manualAccountOrder: [HELD_ID],
        })

        expect(readBackupSettings('algorand')).toEqual({
            currency: { preferred: 'EUR', fallback: 'ALGO' },
            language: 'tr',
            confirmationMode: 'tap',
            launchAccount: { mode: 'specific', address: 'HELD' },
            accountOrder: { mode: 'alphabeticalAsc', addresses: ['HELD'] },
        })
    })

    it('applies every present setting', () => {
        applyBackupSettings(
            {
                currency: { preferred: 'EUR', fallback: 'ALGO' },
                language: 'de',
                confirmationMode: 'tap',
                launchAccount: { mode: 'specific', address: 'HELD' },
                accountOrder: { mode: 'balanceDesc', addresses: ['HELD'] },
            },
            'algorand',
        )

        expect(readBackupSettings('algorand')).toEqual({
            currency: { preferred: 'EUR', fallback: 'ALGO' },
            language: 'de',
            confirmationMode: 'tap',
            launchAccount: { mode: 'specific', address: 'HELD' },
            accountOrder: { mode: 'balanceDesc', addresses: ['HELD'] },
        })
    })

    describe('account order', () => {
        beforeEach(() => {
            useAccountsStore.getState().setAccounts([
                {
                    id: HELD_ID,
                    custody: { kind: 'watch' },
                    chains: { algorand: { address: 'HELD' } },
                },
                {
                    id: ETH_ONLY_ID,
                    custody: { kind: 'watch' },
                    chains: { ethereum: { address: '0xeth' } },
                },
                {
                    id: OTHER_ID,
                    custody: { kind: 'watch' },
                    chains: {
                        algorand: { address: 'OTHER' },
                        ethereum: { address: '0xother' },
                    },
                },
            ])
        })

        it("names each account by its scope chain's address, else its first", () => {
            expect(
                readBackupSettings('algorand').accountOrder.addresses,
            ).toEqual(['HELD', '0xeth', 'OTHER'])
        })

        it("puts the named accounts first and keeps the rest in this device's order", () => {
            applyBackupSettings(
                {
                    accountOrder: {
                        mode: 'manual',
                        addresses: ['0xother', 'NOT_HELD', 'HELD'],
                    },
                },
                'algorand',
            )

            expect(useAccountsStore.getState().manualAccountOrder).toEqual([
                OTHER_ID,
                HELD_ID,
                ETH_ONLY_ID,
            ])
        })

        it('keeps the sort mode when the backup names one this device lacks', () => {
            useAccountsStore.setState({ sortMode: AccountSortModes.balanceAsc })

            applyBackupSettings(
                { accountOrder: { mode: 'byColour', addresses: [] } },
                'algorand',
            )

            expect(useAccountsStore.getState().sortMode).toBe(
                AccountSortModes.balanceAsc,
            )
        })
    })

    it.each([
        ['a fiat fallback', 'EUR', 'EUR'],
        ['an ALGO fallback', 'ALGO', 'USD'],
    ])(
        'restores an ALGO preference with %s as fiat',
        (_label, fallback, expected) => {
            applyBackupSettings(
                { currency: { preferred: 'ALGO', fallback } },
                'algorand',
            )

            expect(readBackupSettings('algorand').currency).toEqual({
                preferred: expected,
                fallback: 'ALGO',
            })
        },
    )

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
