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

// History on an account holding one address on every EVM network: each
// network keeps one state (loaded, failed, or without a history service) on All
// and under its own chip, through a Retry and a chip tap. Copy is asserted by
// key: this project renders i18n keys.

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
import { http, HttpResponse } from 'msw'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
            chains: {
                enabled: [
                    'algorand',
                    'ethereum',
                    'base',
                    'bsc',
                    'arbitrum',
                    'optimism',
                    'polygon',
                    'avalanche',
                ],
                capabilities: {},
            },
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
const { resetPeraScopeRefusals } =
    await import('@perawallet/wallet-core-config')
const { evmHistoryItem } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { historyPath } =
    await import('@packages/chain-ethereum/src/history/api/endpoints')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AccountHistory } =
    await import('@modules/accounts/components/AccountHistory/AccountHistory')
const { useAssetListViewStore } =
    await import('@modules/accounts/hooks/useAssetListViewStore')
const { onlineManager } = await import('@tanstack/react-query')
const { useNetworkStatusStore } = await import('@modules/network')

const ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const COUNTERPARTY = '0x1111111111111111111111111111111111111111'

const NETWORKS = [
    { chainId: 'ethereum', eip155: 1 },
    { chainId: 'base', eip155: 8453 },
    { chainId: 'bsc', eip155: 56 },
    { chainId: 'arbitrum', eip155: 42_161 },
    { chainId: 'optimism', eip155: 10 },
    { chainId: 'polygon', eip155: 137 },
    { chainId: 'avalanche', eip155: 43_114 },
] as const
type NetworkId = (typeof NETWORKS)[number]['chainId']

const eip155Of = (chainId: NetworkId) =>
    NETWORKS.find(network => network.chainId === chainId)!.eip155

const ACCOUNT: WalletAccount = {
    id: 'every-evm-network',
    custody: { kind: 'watch' },
    chains: Object.fromEntries(
        NETWORKS.map(({ chainId }) => [chainId, { address: ADDRESS }]),
    ),
    name: 'Every EVM network',
}

const hashOf = (chainId: NetworkId) =>
    `0x${String(eip155Of(chainId)).padStart(64, '0')}`

// One row per network, a day apart in network order.
const rowOf = (chainId: NetworkId): EvmHistoryItemResponse => {
    const day = NETWORKS.findIndex(network => network.chainId === chainId) + 1
    return evmHistoryItem({
        hash: hashOf(chainId),
        block_time: `2026-01-${String(day).padStart(2, '0')}T00:00:00Z`,
        from: COUNTERPARTY,
        to: ADDRESS,
        value: '1000000000000000000',
    })
}

const serveChain = (
    chainId: NetworkId,
    answer: () => Response | Promise<Response>,
) => http.get(`*${historyPath(eip155Of(chainId), ':address')}`, () => answer())

const rows = (chainId: NetworkId) =>
    HttpResponse.json({
        next: null,
        previous: null,
        results: [rowOf(chainId)],
    })

const failing = () => HttpResponse.json({}, { status: 500 })
const notEnabled = () =>
    HttpResponse.json(
        { error: 'Chain is not enabled.', code: 'chain_not_enabled' },
        { status: 422 },
    )

const serveActivityEverywhere = () =>
    server.use(
        ...NETWORKS.map(({ chainId }) =>
            serveChain(chainId, () => rows(chainId)),
        ),
        ...peraEvmHistoryHandlers({ history: {} }),
    )

const holdRead = () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>(resolve => {
        release = resolve
    })
    return { gate, release }
}

const setConnectivity = (isOnline: boolean) => {
    onlineManager.setOnline(isOnline)
    useNetworkStatusStore.getState().setHasInternet(isOnline)
}

const rowIds = () =>
    screen
        .queryAllByTestId(/^transaction_row_0x[0-9a-f]+$/)
        .map(row => row.getAttribute('data-testid'))

describe('Flow: History on an account with every EVM network', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetPeraScopeRefusals()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ACCOUNT.id)
        useAssetListViewStore.setState({ selectedChainId: null })
        serveActivityEverywhere()
    })

    afterEach(() => {
        setConnectivity(true)
        server.resetHandlers()
        resetPeraScopeRefusals()
        useAccountsStore.getState().setAccounts([])
    })

    it('Given activity on every network, when History opens on All, then it lists the rows of each network, labelled with it', async () => {
        renderWithNavigation(AccountHistory, 'AccountHistory')

        await waitFor(() => expect(rowIds()).toHaveLength(NETWORKS.length), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        for (const { chainId } of NETWORKS) {
            expect(
                within(
                    screen.getByTestId(`transaction_row_${hashOf(chainId)}`),
                ).getByTestId(`chain_label_${chainId}`),
            ).toBeTruthy()
        }
        expect(screen.queryByTestId('history_network_failed')).toBeNull()
        expect(screen.queryByTestId('history_network_unavailable')).toBeNull()
    })

    it.each(NETWORKS.filter(({ chainId }) => chainId !== 'ethereum'))(
        'Given activity on every network, when the $chainId chip is tapped, then only its rows show',
        async ({ chainId }) => {
            renderWithNavigation(AccountHistory, 'AccountHistory')
            await waitFor(
                () => expect(rowIds()).toHaveLength(NETWORKS.length),
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )

            fireEvent.click(
                screen.getByTestId(`history_network_filter_${chainId}`),
            )

            await waitFor(
                () =>
                    expect(rowIds()).toEqual([
                        `transaction_row_${hashOf(chainId)}`,
                    ]),
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )
        },
    )

    it("Given BNB Chain's history fails, when its chip is tapped while the re-read is held, then it keeps showing the failure and offers Retry once settled, never the empty state", async () => {
        server.use(serveChain('bsc', failing))
        renderWithNavigation(AccountHistory, 'AccountHistory')
        await screen.findByTestId('history_network_failed', undefined, {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        const { gate, release } = holdRead()
        let heldReads = 0
        server.use(
            serveChain('bsc', async () => {
                heldReads += 1
                await gate
                return failing()
            }),
        )
        fireEvent.click(screen.getByTestId('history_network_filter_bsc'))
        await waitFor(() => expect(heldReads).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        // Asserted without waiting: the failure must hold while the re-read is out.
        expect(screen.getByText('common.error.title')).toBeTruthy()
        expect(
            screen.queryByText(
                'asset_details.transaction_list.empty_on_network_body',
            ),
        ).toBeNull()

        release()

        // The button shows a spinner instead of its label while the re-read runs.
        expect(
            await screen.findByText('common.retry.label', undefined, {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            }),
        ).toBeTruthy()
        expect(screen.getByText('common.error.title')).toBeTruthy()
        expect(
            screen.queryByText(
                'asset_details.transaction_list.empty_on_network_body',
            ),
        ).toBeNull()
    })

    it("Given Base answers 422 chain_not_enabled, when History opens on All, then Base is named as unavailable, not failed, and its chip says it isn't available, with no Retry", async () => {
        server.use(serveChain('base', notEnabled))
        renderWithNavigation(AccountHistory, 'AccountHistory')

        const notice = await screen.findByTestId(
            'history_network_unavailable',
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            within(notice).getByText(
                'asset_details.transaction_list.network_unavailable',
            ),
        ).toBeTruthy()
        expect(screen.queryByTestId('history_network_failed')).toBeNull()

        fireEvent.click(screen.getByTestId('history_network_filter_base'))

        expect(
            await screen.findByText(
                'common.network_unavailable.title',
                undefined,
                {
                    timeout: SLOW_WAIT_TIMEOUT_MS,
                },
            ),
        ).toBeTruthy()
        expect(screen.queryByText('common.retry.label')).toBeNull()
        expect(
            screen.queryByText(
                'asset_details.transaction_list.empty_on_network_body',
            ),
        ).toBeNull()
    })

    it("Given BNB Chain fails and Base is refused, when Retry is tapped with BNB Chain's read held, then both notices stay until it answers, and only the failed one clears", async () => {
        server.use(serveChain('bsc', failing), serveChain('base', notEnabled))
        renderWithNavigation(AccountHistory, 'AccountHistory')
        const failed = await screen.findByTestId(
            'history_network_failed',
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        await screen.findByTestId('history_network_unavailable', undefined, {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        const { gate, release } = holdRead()
        let heldReads = 0
        server.use(
            serveChain('bsc', async () => {
                heldReads += 1
                await gate
                return rows('bsc')
            }),
        )
        fireEvent.click(within(failed).getByText('common.retry.label'))
        await waitFor(() => expect(heldReads).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        expect(screen.getByTestId('history_network_failed')).toBeTruthy()
        expect(screen.getByTestId('history_network_unavailable')).toBeTruthy()

        release()

        await waitFor(
            () =>
                expect(rowIds()).toContain(`transaction_row_${hashOf('bsc')}`),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.queryByTestId('history_network_failed')).toBeNull()
        expect(screen.getByTestId('history_network_unavailable')).toBeTruthy()
    })

    it("Given BNB Chain's history fails, when the device goes offline and its chip is tapped, then it shows the offline state, and once back online the error with Retry, never an empty history", async () => {
        server.use(serveChain('bsc', failing))
        renderWithNavigation(AccountHistory, 'AccountHistory')
        await screen.findByTestId('history_network_failed', undefined, {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        act(() => setConnectivity(false))
        fireEvent.click(screen.getByTestId('history_network_filter_bsc'))

        expect(
            await screen.findByText('common.offline_mode', undefined, {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            }),
        ).toBeTruthy()
        expect(
            screen.queryByText(
                'asset_details.transaction_list.offline_empty_title',
            ),
        ).toBeNull()
        expect(
            screen.queryByText(
                'asset_details.transaction_list.empty_on_network_body',
            ),
        ).toBeNull()

        act(() => setConnectivity(true))

        expect(
            await screen.findByText('common.error.title', undefined, {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            }),
        ).toBeTruthy()
        expect(
            screen.queryByText(
                'asset_details.transaction_list.empty_on_network_body',
            ),
        ).toBeNull()

        const { gate, release } = holdRead()
        let heldReads = 0
        server.use(
            serveChain('bsc', async () => {
                heldReads += 1
                await gate
                return failing()
            }),
        )
        fireEvent.click(screen.getByText('common.retry.label'))
        await waitFor(() => expect(heldReads).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        expect(screen.getByText('common.error.title')).toBeTruthy()
        expect(
            screen.queryByText(
                'asset_details.transaction_list.empty_on_network_body',
            ),
        ).toBeNull()

        release()

        expect(
            await screen.findByText('common.retry.label', undefined, {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            }),
        ).toBeTruthy()
        expect(
            screen.queryByText(
                'asset_details.transaction_list.empty_on_network_body',
            ),
        ).toBeNull()
    })
})
