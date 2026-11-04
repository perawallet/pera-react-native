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
    vi,
} from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    seedAlgorandAccountState,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { SearchScreen } from '@modules/search/screens/SearchScreen'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    ALGO_SCOPE,
    ETH_ADDRESS,
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
} from './__fixtures__/multichainHoldings'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const ALGORAND_ONLY: WalletAccount = {
    id: 'algo-only',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: HD_TEST_ADDRESS, keyPairId: 'a2-key' } },
    name: 'Solo',
}

// The harness mounts no navigation header, where the filter button lives, so
// the spec keeps the icon the screen asks the header to show and presses it.
const header = vi.hoisted(() => ({ right: null as ReactNode }))

vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: ({ right }: { right?: ReactNode }) => {
        header.right = right
    },
}))

const pressFilterButton = async () => {
    const { onPress } = (header.right as ReactElement<{ onPress: () => void }>)
        .props
    await act(async () => onPress())
}

const typeQuery = (query: string) => {
    fireEvent.change(screen.getByTestId('search_input'), {
        target: { value: query },
    })
}

const accountRowId = `search_result_account_${ALGO25_TEST_ADDRESS}`
const soloRowId = `search_result_account_${HD_TEST_ADDRESS}`

describe('Flow: Global search across networks', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedHoldings()
        await seedAlgorandAccountState({
            accountAddress: HD_TEST_ADDRESS,
            scope: ALGO_SCOPE,
            nativeBalance: new Decimal(1_000_000),
        })
        useAccountsStore
            .getState()
            .setAccounts([TWO_CHAIN_ACCOUNT, ALGORAND_ONLY])
        useAccountsStore.getState().setSelectedAccountId(TWO_CHAIN_ACCOUNT.id)
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    it('Given an account with an Ethereum address, when the user types part of it, then the row shows the 0x address and its network', async () => {
        renderWithNavigation(SearchScreen, 'Search')

        typeQuery(ETH_ADDRESS.slice(0, 6))

        await screen.findByTestId(accountRowId)
        const matched = screen.getByTestId('search_matched_address')
        expect(matched.textContent).toContain(ETH_ADDRESS.slice(0, 6))
        expect(matched.textContent).toContain('Ethereum')
        expect(screen.queryByTestId(soloRowId)).toBeNull()
    })

    it('Given accounts on different networks, when the user types a network name, then only the accounts with an address on it are listed, each with that address', async () => {
        renderWithNavigation(SearchScreen, 'Search')

        typeQuery('ethereum')

        await screen.findByTestId(accountRowId)
        expect(
            screen.getByTestId('search_matched_address').textContent,
        ).toMatch(/^0x/)
        expect(screen.queryByTestId(soloRowId)).toBeNull()
    })

    it('Given an account, when the user types part of its Algorand address, then the row reads as it always has', async () => {
        renderWithNavigation(SearchScreen, 'Search')

        typeQuery(ALGO25_TEST_ADDRESS.slice(0, 6))

        await screen.findByTestId(accountRowId)
        expect(screen.queryByTestId('search_matched_address')).toBeNull()
    })

    it('Given a coin held on Ethereum, when the user types its symbol, then it is listed with its network', async () => {
        renderWithNavigation(SearchScreen, 'Search')

        typeQuery('eth')

        const ether = nativeAssetFor('ethereum')
        const row = await screen.findByTestId(
            `search_result_asset_ethereum_${ether.assetId}`,
        )
        expect(
            row.querySelector('[data-testid="chain_label_ethereum"]'),
        ).toBeTruthy()
    })

    it('Given the Network filter, when Ethereum is chosen, then only accounts on Ethereum are listed', async () => {
        renderWithNavigation(SearchScreen, 'Search')
        await pressFilterButton()

        fireEvent.click(
            await screen.findByTestId('search_network_filter_ethereum'),
        )
        typeQuery('o')

        await screen.findByTestId(accountRowId)
        await waitFor(() => expect(screen.queryByTestId(soloRowId)).toBeNull())
        expect(
            screen.getByTestId('search_matched_address').textContent,
        ).toMatch(/^0x/)
    })
})
