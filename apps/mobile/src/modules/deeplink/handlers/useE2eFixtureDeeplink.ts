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

import { useCallback } from 'react'
import { LogBox } from 'react-native'

import { useHasAccounts } from '@perawallet/wallet-core-accounts'
import {
    type Contact,
    useContactsStore,
} from '@perawallet/wallet-core-contacts'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { navigationRef } from '@routes/navigationRef'

import type { DevE2eFixtureDeeplink, E2eFixtureName } from '../types'

export type E2eFixtureDeeplinkHandler = (
    deeplink: Pick<DevE2eFixtureDeeplink, 'fixture'>,
) => void

// e2e/resources/contacts.resource mirrors these values; change both together.
const FIXTURE_CONTACTS: Record<E2eFixtureName, Contact[]> = {
    'contacts-empty': [],
    'contacts-one': [
        {
            id: 'e2e-fixture-contact',
            name: 'AutoTestContact',
            addresses: {
                algorand:
                    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA',
            },
        },
    ],
}

/**
 * Replaces contacts wholesale and lands on the contacts list with a fresh back
 * stack and no sheet open, so a test starts from the same screen whatever the
 * last one left up.
 * Does nothing without a wallet: TabBar only exists once an account does, and
 * resetting onto it anyway yields a state no user can reach. Creating the
 * wallet stays a UI journey so this hook never touches key material.
 */
export const useE2eFixtureDeeplink = (): E2eFixtureDeeplinkHandler => {
    const hasAccounts = useHasAccounts()

    return useCallback(
        ({ fixture }) => {
            if (!hasAccounts) return
            // A dev client's LogBox toast sits over bottom-anchored buttons;
            // the errors still reach Metro.
            LogBox.ignoreAllLogs()
            // Sheets live above navigation, so a reset alone leaves the last
            // test's sheet up to swallow the next tap.
            useBottomSheetStore.getState().dismissAll()
            useContactsStore.setState({
                contacts: FIXTURE_CONTACTS[fixture],
                selectedContact: null,
            })
            if (!navigationRef.isReady()) return
            navigationRef.reset({
                index: 1,
                routes: [
                    { name: 'TabBar' },
                    {
                        name: 'Contacts',
                        state: { routes: [{ name: 'ContactsList' }] },
                    },
                ],
            })
        },
        [hasAccounts],
    )
}
