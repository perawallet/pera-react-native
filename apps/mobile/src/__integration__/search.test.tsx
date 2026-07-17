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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { SearchScreen } from '@modules/search/screens/SearchScreen'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

// Shared substring that matches both the seeded account name and the seeded
// contact name, so a single typed query surfaces results across two scopes.
const SHARED_QUERY = 'orbit'

const SEARCH_ACCOUNT: WalletAccount = {
    id: 'search-account-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'search-account-key',
    name: `${SHARED_QUERY} account`,
}

const addTestContact = (name: string, address: string) => {
    const { result } = renderHook(() => useContacts())
    result.current.addContact({ name, address })
}

const resetTestContacts = () => {
    const { result } = renderHook(() => useContacts())
    for (const c of result.current.contacts) {
        result.current.deleteContact(c)
    }
}

const typeQuery = (query: string) => {
    const input = screen.getByTestId('search_input')
    fireEvent.change(input, { target: { value: query } })
}

describe('Flow: Global search', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([SEARCH_ACCOUNT])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(SEARCH_ACCOUNT.address)
        resetTestContacts()
    })

    afterEach(() => {
        resetTestContacts()
    })

    it(
        'Given a matching account and contact, when the user types a shared query, then results from both scopes surface',
        async () => {
            addTestContact(`${SHARED_QUERY} contact`, HD_TEST_ADDRESS)

            renderWithNavigation(SearchScreen, 'Search')

            typeQuery(SHARED_QUERY)

            await waitFor(() => {
                expect(
                    screen.getByTestId(
                        `search_result_account_${SEARCH_ACCOUNT.address}`,
                    ),
                ).toBeTruthy()
            })
            expect(
                screen.getByTestId(`search_result_contact_${HD_TEST_ADDRESS}`),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a matching account result, when the user taps it, then it becomes the selected account',
        async () => {
            // Seed a second, currently-selected account so the tap produces an
            // observable change in the selected address.
            const otherAccount: WalletAccount = {
                id: 'other-account-1',
                type: AccountTypes.watch,
                address: HD_TEST_ADDRESS,
                name: 'unrelated',
            }
            useAccountsStore
                .getState()
                .setAccounts([otherAccount, SEARCH_ACCOUNT])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(otherAccount.address)

            renderWithNavigation(SearchScreen, 'Search')

            typeQuery(SHARED_QUERY)

            const accountRow = await screen.findByTestId(
                `search_result_account_${SEARCH_ACCOUNT.address}`,
            )
            fireEvent.click(accountRow)

            await waitFor(() => {
                expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                    SEARCH_ACCOUNT.address,
                )
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a matching contact result, when the user taps it, then it becomes the selected contact',
        async () => {
            addTestContact(`${SHARED_QUERY} contact`, HD_TEST_ADDRESS)

            renderWithNavigation(SearchScreen, 'Search')

            typeQuery(SHARED_QUERY)

            const contactRow = await screen.findByTestId(
                `search_result_contact_${HD_TEST_ADDRESS}`,
            )
            fireEvent.click(contactRow)

            await waitFor(() => {
                const { result } = renderHook(() => useContacts())
                expect(result.current.selectedContact?.address).toBe(
                    HD_TEST_ADDRESS,
                )
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a query that matches nothing, when the user types it, then no result rows render',
        async () => {
            addTestContact(`${SHARED_QUERY} contact`, HD_TEST_ADDRESS)

            renderWithNavigation(SearchScreen, 'Search')

            typeQuery('zzzznomatch')

            await waitFor(() => {
                expect(
                    screen.queryByTestId(
                        `search_result_account_${SEARCH_ACCOUNT.address}`,
                    ),
                ).toBeNull()
            })
            expect(
                screen.queryByTestId(
                    `search_result_contact_${HD_TEST_ADDRESS}`,
                ),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
