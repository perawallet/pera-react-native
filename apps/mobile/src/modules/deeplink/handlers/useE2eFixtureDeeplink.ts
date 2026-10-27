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

import { useCallback, useEffect } from 'react'
import { LogBox } from 'react-native'

import { useHasAccounts } from '@perawallet/wallet-core-accounts'
import {
    type Contact,
    useContactsStore,
} from '@perawallet/wallet-core-contacts'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { navigationRef } from '@routes/navigationRef'

import {
    E2E_STRESS_CONTACT_COUNTS,
    type E2eStressContactCount,
} from '../e2e-fixture-names'
import type { DevE2eFixtureDeeplink, E2eFixtureName } from '../types'
import { snapshotOnNextState, startNavTracer } from './e2eNavTracer'

const READY_TIMEOUT_MS = 3000

export type E2eFixtureDeeplinkHandler = (
    deeplink: Pick<DevE2eFixtureDeeplink, 'fixture'>,
) => void

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// No checksum, like the mock contacts: the contact UI only formats and truncates
// the address. The index sits in the low digits so every address differs.
const syntheticAddress = (index: number): string => {
    let digits = ''
    let rest = index
    do {
        digits = BASE32[rest % 32] + digits
        rest = Math.floor(rest / 32)
    } while (rest > 0)
    return digits.padStart(58, 'A')
}

const stressContacts = (count: number): Contact[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `e2e-stress-contact-${index}`,
        name: `Stress contact ${index}`,
        addresses: { algorand: syntheticAddress(index) },
    }))

const STRESS_FIXTURE_CONTACTS = Object.fromEntries(
    E2E_STRESS_CONTACT_COUNTS.map(count => [
        `contacts-${count}`,
        stressContacts(count),
    ]),
) as Record<`contacts-${E2eStressContactCount}`, Contact[]>

// e2e/resources/contacts.resource mirrors these values; change both together.
const FIXTURE_CONTACTS: Record<Exclude<E2eFixtureName, 'home'>, Contact[]> = {
    ...STRESS_FIXTURE_CONTACTS,
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
 * `home` lands on Home and leaves data alone; the contacts fixtures replace
 * contacts wholesale and land on the contacts list. Either way the back stack is
 * fresh and no sheet is open, so a test starts from the same screen whatever the
 * last one left up.
 * Does nothing without a wallet: TabBar only exists once an account does, and
 * resetting onto it anyway yields a state no user can reach. Creating the
 * wallet stays a UI journey so this hook never touches key material.
 */
export const useE2eFixtureDeeplink = (): E2eFixtureDeeplinkHandler => {
    const hasAccounts = useHasAccounts()

    useEffect(startNavTracer, [])

    return useCallback(
        ({ fixture }) => {
            if (!hasAccounts) return
            // A dev client's LogBox toast sits over bottom-anchored buttons;
            // the errors still reach Metro.
            LogBox.ignoreAllLogs()
            // Sheets live above navigation, so a reset alone leaves the last
            // test's sheet up to swallow the next tap.
            useBottomSheetStore.getState().dismissAll()
            resetWhenReady(fixture)
        },
        [hasAccounts],
    )
}

// Navigation can be briefly unready (a theme switch remounts the container);
// dropping the fixture then would leave the test on the previous screen.
const resetWhenReady = (fixture: E2eFixtureName, waitedMs = 0): void => {
    if (!navigationRef.isReady()) {
        if (waitedMs < READY_TIMEOUT_MS) {
            setTimeout(() => resetWhenReady(fixture, waitedMs + 100), 100)
        }
        return
    }
    // A fresh key remounts the tab shell, which also closes the account
    // drawer: its open state is local to the shell, not in navigation.
    const tabBar = { name: 'TabBar', key: `TabBar-e2e-${Date.now()}` }
    snapshotOnNextState(`fixture:${fixture}`)
    if (fixture === 'home') {
        navigationRef.reset({ index: 0, routes: [tabBar] })
        return
    }
    useContactsStore.setState({
        contacts: FIXTURE_CONTACTS[fixture],
        selectedContact: null,
    })
    navigationRef.reset({
        index: 1,
        routes: [
            tabBar,
            {
                name: 'Contacts',
                state: { routes: [{ name: 'ContactsList' }] },
            },
        ],
    })
}
