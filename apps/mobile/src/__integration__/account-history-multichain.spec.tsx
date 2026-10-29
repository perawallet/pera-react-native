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

// History on an account with Algorand and Ethereum: All interleaves both
// networks by time, and the History chips narrow it through the same store the
// Assets chips write. Copy is asserted by key: this project renders i18n keys.

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
import { Decimal } from 'decimal.js'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import type { EvmHistoryItemResponse } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh, the test theme the setup installed included.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { upsertTransactions } =
    await import('@perawallet/wallet-core-transactions')
const { evmHistoryItem } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AccountHistory } =
    await import('@modules/accounts/components/AccountHistory/AccountHistory')
const { useAssetListViewStore } =
    await import('@modules/accounts/hooks/useAssetListViewStore')

const ALGO_ADDRESS = 'VALID_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const COUNTERPARTY = '0x1111111111111111111111111111111111111111'
const ALGORAND_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const ACCOUNT: WalletAccount = {
    id: 'two-chains',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: ALGO_ADDRESS },
        ethereum: { address: ETH_ADDRESS },
    },
    name: 'Two chains',
}

const hashOf = (n: number) => `0x${String(n).padStart(64, '0')}`

const received = (n: number, blockTime: string): EvmHistoryItemResponse =>
    evmHistoryItem({
        hash: hashOf(n),
        block_time: blockTime,
        from: COUNTERPARTY,
        to: ETH_ADDRESS,
        value: '1000000000000000000',
    })

const algoPayment = (
    id: string,
    roundTime: number,
): TransactionHistoryItem => ({
    id,
    txType: 'pay',
    sender: ALGO_ADDRESS,
    receiver: ALGO_ADDRESS,
    assetSender: null,
    confirmedRound: 100,
    roundTime,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: new Decimal(0),
    asset: null,
    balanceImpacts: [],
})

// Algorand's cached rows always have an API page queued behind them, so its
// oldest row is a cutoff; the older one sits below every Ethereum row to keep
// them all on screen.
const ALGO_TX = algoPayment(
    'ALGOTX0000000000000000000000000000000000000000000000001',
    1_767_312_000, // 2026-01-02T00:00:00Z
)
const ALGO_OLDER_TX = algoPayment(
    'ALGOTX0000000000000000000000000000000000000000000000002',
    1_767_139_200, // 2025-12-31T00:00:00Z
)

const serveEthereumHistory = () =>
    server.use(
        ...peraEvmHistoryHandlers({
            history: {
                [ETH_ADDRESS]: [
                    [
                        received(3, '2026-01-03T00:00:00Z'),
                        received(1, '2026-01-01T00:00:00Z'),
                    ],
                ],
            },
        }),
    )

const rowIds = () =>
    screen
        .queryAllByTestId(/^transaction_row_(0x|ALGOTX)[0-9A-Za-z]+$/)
        .map(row => row.getAttribute('data-testid'))

describe('Flow: History on an account with Algorand and Ethereum', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ACCOUNT.id)
        useAssetListViewStore.setState({ selectedChainId: null })
        await upsertTransactions({
            items: [ALGO_TX, ALGO_OLDER_TX],
            accountAddress: ALGO_ADDRESS,
            scope: ALGORAND_SCOPE,
        })
        serveEthereumHistory()
    })

    afterEach(() => {
        server.resetHandlers()
        useAccountsStore.getState().setAccounts([])
    })

    it('Given history on both networks, when History opens on All, then it interleaves them newest first and labels each row with its network', async () => {
        renderWithNavigation(AccountHistory, 'AccountHistory')

        await waitFor(
            () =>
                expect(rowIds()).toEqual([
                    `transaction_row_${hashOf(3)}`,
                    `transaction_row_${ALGO_TX.id}`,
                    `transaction_row_${hashOf(1)}`,
                    `transaction_row_${ALGO_OLDER_TX.id}`,
                ]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            within(
                screen.getByTestId(`transaction_row_${ALGO_TX.id}`),
            ).getByTestId('chain_label_algorand'),
        ).toBeTruthy()
        expect(
            within(
                screen.getByTestId(`transaction_row_${hashOf(3)}`),
            ).getByTestId('chain_label_ethereum'),
        ).toBeTruthy()
        expect(
            screen.queryByText('asset_details.transaction_list.csv'),
        ).toBeNull()
    })

    it("Given Ethereum's history fails, when History opens on All, then Algorand's rows show under a notice naming Ethereum whose Retry brings its rows in", async () => {
        server.use(...peraEvmHistoryHandlers({ history: 503 }))

        renderWithNavigation(AccountHistory, 'AccountHistory')

        const notice = await screen.findByTestId(
            'history_network_failed',
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(rowIds()).toEqual([
            `transaction_row_${ALGO_TX.id}`,
            `transaction_row_${ALGO_OLDER_TX.id}`,
        ])
        expect(
            within(notice).getByText(
                'asset_details.transaction_list.network_failed',
            ),
        ).toBeTruthy()

        serveEthereumHistory()
        fireEvent.click(within(notice).getByText('common.retry.label'))

        await waitFor(() => expect(rowIds()).toHaveLength(4), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(screen.queryByTestId('history_network_failed')).toBeNull()
    })

    it('Given History on All, when the Ethereum chip is tapped, then only Ethereum rows show and the Assets chips follow', async () => {
        renderWithNavigation(AccountHistory, 'AccountHistory')
        await waitFor(() => expect(rowIds()).toHaveLength(4), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        fireEvent.click(screen.getByTestId('history_network_filter_ethereum'))

        await waitFor(
            () =>
                expect(rowIds()).toEqual([
                    `transaction_row_${hashOf(3)}`,
                    `transaction_row_${hashOf(1)}`,
                ]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(useAssetListViewStore.getState().selectedChainId).toBe(
            'ethereum',
        )
        expect(screen.queryByTestId('chain_label_ethereum')).toBeNull()
    })
})
