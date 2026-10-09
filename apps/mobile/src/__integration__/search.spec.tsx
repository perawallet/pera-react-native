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
import {
    insertAssetHolding,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAssets,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { SearchScreen } from '@modules/search/screens/SearchScreen'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { NFT_TEST_ASSET, NFT_TEST_ASSET_ID } from './__fixtures__/assets'
import { addressOf } from './__fixtures__/accounts'

const MAINNET_SCOPE = scopeForLegacyNetwork('mainnet')

// Shared substring that matches both the seeded account name and the seeded
// contact name, so a single typed query surfaces results across two scopes.
const SHARED_QUERY = 'orbit'

const SEARCH_ACCOUNT: WalletAccount = {
    id: 'search-account-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: {
            address: ALGO25_TEST_ADDRESS,
            keyPairId: 'search-account-key',
        },
    },
    name: `${SHARED_QUERY} account`,
}

const addTestContact = (name: string, address: string) => {
    const { result } = renderHook(() => useContacts())
    result.current.addContact({ name, addresses: { algorand: address } })
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
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([SEARCH_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(SEARCH_ACCOUNT.id)
        resetTestContacts()
    })

    afterEach(() => {
        resetTestContacts()
    })

    it('Given a matching account and contact, when the user types a shared query, then results from both scopes surface', async () => {
        addTestContact(`${SHARED_QUERY} contact`, HD_TEST_ADDRESS)

        renderWithNavigation(SearchScreen, 'Search')

        typeQuery(SHARED_QUERY)

        await waitFor(() => {
            expect(
                screen.getByTestId(
                    `search_result_account_${addressOf(SEARCH_ACCOUNT)}`,
                ),
            ).toBeTruthy()
        })
        expect(
            screen.getByTestId(`search_result_contact_${HD_TEST_ADDRESS}`),
        ).toBeTruthy()
    })

    it('Given a matching account result, when the user taps it, then it becomes the selected account', async () => {
        // Seed a second, currently-selected account so the tap produces an
        // observable change in the selected address.
        const otherAccount: WalletAccount = {
            id: 'other-account-1',
            custody: { kind: 'watch' },
            chains: { algorand: { address: HD_TEST_ADDRESS } },
            name: 'unrelated',
        }
        useAccountsStore.getState().setAccounts([otherAccount, SEARCH_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(otherAccount.id)

        renderWithNavigation(SearchScreen, 'Search')

        typeQuery(SHARED_QUERY)

        const accountRow = await screen.findByTestId(
            `search_result_account_${addressOf(SEARCH_ACCOUNT)}`,
        )
        fireEvent.click(accountRow)

        await waitFor(() => {
            expect(useAccountsStore.getState().selectedAccountId).toBe(
                SEARCH_ACCOUNT.id,
            )
        })
    })

    it('Given a matching contact result, when the user taps it, then it becomes the selected contact', async () => {
        addTestContact(`${SHARED_QUERY} contact`, HD_TEST_ADDRESS)

        renderWithNavigation(SearchScreen, 'Search')

        typeQuery(SHARED_QUERY)

        const contactRow = await screen.findByTestId(
            `search_result_contact_${HD_TEST_ADDRESS}`,
        )
        fireEvent.click(contactRow)

        await waitFor(() => {
            const { result } = renderHook(() => useContacts())
            expect(result.current.selectedContact?.addresses.algorand).toBe(
                HD_TEST_ADDRESS,
            )
        })
    })

    it('Given an NFT held by another account, when the user taps the result, then that account becomes selected', async () => {
        // The asset scope spans every account, so searching from
        // SEARCH_ACCOUNT surfaces an NFT that only NFT_HOLDER holds. Both
        // detail screens read the selected account for the owner row, so
        // the tap has to move the selection there.
        const nftHolder: WalletAccount = {
            id: 'nft-holder-1',
            custody: { kind: 'watch' },
            chains: { algorand: { address: HD_TEST_ADDRESS } },
            name: 'nft holder',
        }
        useAccountsStore.getState().setAccounts([SEARCH_ACCOUNT, nftHolder])
        useAccountsStore.getState().setSelectedAccountId(SEARCH_ACCOUNT.id)
        await seedAlgoAsset()
        await seedAssets([NFT_TEST_ASSET])
        await insertAssetHolding({
            accountAddress: addressOf(nftHolder),
            assetId: NFT_TEST_ASSET_ID,
            scope: MAINNET_SCOPE,
            amount: '1',
        })

        renderWithNavigation(SearchScreen, 'Search')

        typeQuery('Test Collectible')

        const assetRow = await screen.findByTestId(
            `search_result_asset_${NFT_TEST_ASSET_ID}`,
        )
        fireEvent.click(assetRow)

        await waitFor(() => {
            expect(useAccountsStore.getState().selectedAccountId).toBe(
                nftHolder.id,
            )
        })
    })

    it('Given a query that matches nothing, when the user types it, then no result rows render', async () => {
        addTestContact(`${SHARED_QUERY} contact`, HD_TEST_ADDRESS)

        renderWithNavigation(SearchScreen, 'Search')

        typeQuery('zzzznomatch')

        await waitFor(() => {
            expect(
                screen.queryByTestId(
                    `search_result_account_${addressOf(SEARCH_ACCOUNT)}`,
                ),
            ).toBeNull()
        })
        expect(
            screen.queryByTestId(`search_result_contact_${HD_TEST_ADDRESS}`),
        ).toBeNull()
    })
})
