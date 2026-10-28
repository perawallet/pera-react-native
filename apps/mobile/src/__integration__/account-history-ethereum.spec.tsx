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

// An Ethereum account's History reads the Pera backend's records page by page,
// since Ethereum keeps no cached history rows, and a refused read offers a
// retry rather than a skeleton that never resolves. Copy is asserted by key:
// this project renders i18n keys.

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
import React from 'react'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
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
const { evmHistoryItem } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { createTestQueryClient, getTestTheme } =
    await import('@test-utils/render')
const { QueryClientProvider } = await import('@tanstack/react-query')
const { ThemeProvider } = await import('@rneui/themed')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AccountHistory } =
    await import('@modules/accounts/components/AccountHistory/AccountHistory')
const { useAccountHistory } =
    await import('@modules/accounts/components/AccountHistory/useAccountHistory')

const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const COUNTERPARTY = '0x1111111111111111111111111111111111111111'

const ETH_ACCOUNT: WalletAccount = {
    id: 'eth-watch',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: ETH_ADDRESS } },
    name: 'Ethereum watch',
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

const rowIds = () =>
    screen
        .queryAllByTestId(/^transaction_row_0x/)
        .map(row => row.getAttribute('data-testid'))

describe('Flow: History on an Ethereum account', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAccountsStore.getState().setAccounts([ETH_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ETH_ACCOUNT.id)
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    const serveTwoPages = () =>
        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [ETH_ADDRESS]: [
                        [
                            received(3, '2026-01-03T00:00:00Z'),
                            received(2, '2026-01-02T00:00:00Z'),
                        ],
                        [received(1, '2026-01-01T00:00:00Z')],
                    ],
                },
            }),
        )

    it('Given mined transactions, when History opens, then they list newest first', async () => {
        serveTwoPages()

        renderWithNavigation(AccountHistory, 'AccountHistory')

        await waitFor(
            () =>
                expect(rowIds()).toEqual([
                    `transaction_row_${hashOf(3)}`,
                    `transaction_row_${hashOf(2)}`,
                ]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            screen.queryByText('asset_details.transaction_list.empty_body'),
        ).toBeNull()
    })

    it('Given a second page, when the list reaches its end, then the older page follows', async () => {
        serveTwoPages()
        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ThemeProvider theme={getTestTheme()}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </ThemeProvider>
        )
        const { result } = renderHook(() => useAccountHistory(), { wrapper })
        const recordIds = () =>
            result.current.rows.flatMap(row =>
                row.kind === 'record' ? [row.record.id] : [],
            )

        await waitFor(
            () => expect(recordIds()).toEqual([hashOf(3), hashOf(2)]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(result.current.hasNextPage).toBe(true)

        // What the list's onEndReached calls; jsdom has no layout to scroll.
        act(() => result.current.handleLoadMore())

        await waitFor(
            () =>
                expect(recordIds()).toEqual([hashOf(3), hashOf(2), hashOf(1)]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    it('Given the history service refuses, when History opens, then it offers a retry that lists the history once it answers', async () => {
        server.use(...peraEvmHistoryHandlers({ history: 503 }))

        renderWithNavigation(AccountHistory, 'AccountHistory')

        await screen.findByText('common.error.title', undefined, {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [ETH_ADDRESS]: [[received(1, '2026-01-01T00:00:00Z')]],
                },
            }),
        )
        fireEvent.click(screen.getByText('common.retry.label'))

        await waitFor(
            () => expect(rowIds()).toEqual([`transaction_row_${hashOf(1)}`]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
    })
})
