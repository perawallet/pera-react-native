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
import { type WalletMode } from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    type Contact,
    replaceAllContacts,
} from '@perawallet/wallet-core-contacts'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { navigationRef } from '@routes/navigationRef'

import type { DevE2eFixtureDeeplink, E2eFixtureName } from '../types'
import {
    snapshotOnNextState,
    startNavTracer,
    traceSnapshot,
} from './e2eNavTracer'

const READY_TIMEOUT_MS = 3000

type NetworkFixture = 'testnet' | 'mainnet'

const NETWORK_MODES: Record<NetworkFixture, WalletMode> = {
    testnet: 'developer',
    mainnet: 'live',
}

const isNetworkFixture = (name: E2eFixtureName): name is NetworkFixture =>
    name in NETWORK_MODES

export type E2eFixtureDeeplinkHandler = (
    deeplink: Pick<DevE2eFixtureDeeplink, 'fixture'>,
) => void

// e2e/resources/contacts.resource mirrors these values; change both together.
const FIXTURE_CONTACTS: Record<
    Exclude<E2eFixtureName, 'home' | NetworkFixture>,
    Contact[]
> = {
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
 * Those do nothing without a wallet: TabBar only exists once an account does,
 * and resetting onto it anyway yields a state no user can reach. Creating the
 * wallet stays a UI journey so this hook never touches key material.
 * `testnet` and `mainnet` are the exception: they switch every chain to its
 * default test or live network and stay on the current screen, so an import
 * from Welcome can find accounts that only exist on testnet. Remove All
 * Accounts also restores the build's default network.
 */
export const useE2eFixtureDeeplink = (): E2eFixtureDeeplinkHandler => {
    const hasAccounts = useHasAccounts()
    const setMode = useNetworkStore(state => state.setMode)

    useEffect(startNavTracer, [])

    return useCallback(
        ({ fixture }) => {
            if (isNetworkFixture(fixture)) {
                setMode(NETWORK_MODES[fixture])
                // No navigation follows, so the harness's applied marker is logged here.
                traceSnapshot(`fixture:${fixture}`)
                return
            }
            if (!hasAccounts) return
            // A dev client's LogBox toast sits over bottom-anchored buttons;
            // the errors still reach Metro.
            LogBox.ignoreAllLogs()
            // Sheets live above navigation, so a reset alone leaves the last
            // test's sheet up to swallow the next tap.
            useBottomSheetStore.getState().dismissAll()
            resetWhenReady(fixture)
        },
        [hasAccounts, setMode],
    )
}

// Navigation can be briefly unready (a theme switch remounts the container);
// dropping the fixture then would leave the test on the previous screen.
const resetWhenReady = (
    fixture: Exclude<E2eFixtureName, NetworkFixture>,
    waitedMs = 0,
): void => {
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
    replaceAllContacts(FIXTURE_CONTACTS[fixture])
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
