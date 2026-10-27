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
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { screen } from '@testing-library/react'

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AccountMenu } from '@modules/accounts/components/AccountMenu/AccountMenu'
import { AccountScreen } from '@modules/accounts/screens/AccountScreen/AccountScreen'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

// A build that registers fewer chains than the wallet's accounts hold, as when
// a wallet that gained Ethereum on a multichain build runs an Algorand-only one.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand'], capabilities: {} },
        },
    }
})

const ACCOUNT_ON_BOTH: WalletAccount = {
    id: 'both-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
        ethereum: {
            address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
            keyPairId: 'e-key',
        },
    },
    name: 'On both',
}

const ETHEREUM_ONLY: WalletAccount = {
    id: 'eth-only-1',
    custody: { kind: 'local', seed: null },
    chains: {
        ethereum: {
            address: '0x1111111111111111111111111111111111111111',
            keyPairId: 'e-key-2',
        },
    },
    name: 'Ethereum only',
}

const noop = () => {}

describe('Flow: a stored chain the build does not register', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAccountsStore
            .getState()
            .setAccounts([ACCOUNT_ON_BOTH, ETHEREUM_ONLY])
    })

    it('Given an Algorand-only build and an account that also holds Ethereum, when the account list renders, then the account shows instead of crashing', async () => {
        renderWithNavigation(
            () => (
                <AccountMenu
                    onSelected={noop}
                    onAddAccount={noop}
                    onOpenSort={noop}
                />
            ),
            'AccountMenuHost',
        )

        expect(await screen.findByText('On both')).toBeTruthy()
        expect(screen.getByText('Ethereum only')).toBeTruthy()
    })

    it('Given an Algorand-only build and a selected account that only holds Ethereum, when the account screen renders, then it shows the account instead of crashing', async () => {
        useAccountsStore.getState().setSelectedAccountId(ETHEREUM_ONLY.id)

        renderWithNavigation(AccountScreen, 'Account')

        expect(await screen.findByText('Ethereum only')).toBeTruthy()
    })
})
