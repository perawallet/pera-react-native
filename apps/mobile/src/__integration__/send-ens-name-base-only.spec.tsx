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

// Sending to an ENS name from a build where Ethereum is not enabled: ENS still
// lives on Ethereum L1, so the pick check has to reach it with Ethereum's own
// endpoints and no Ethereum chain registered. Copy is asserted by key: this
// project renders i18n keys.

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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { server } from '@test-utils/msw-server'
import {
    ALICE_BASE,
    ALICE_ETHEREUM,
    BASE_RPC,
    BASE_SENDER,
    COIN_TYPE_BASE,
    COIN_TYPE_ETHEREUM,
    L1_RPC,
    searchResult,
} from './__fixtures__/ens-send'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    const { BASE_RPC, L1_RPC } = await import('./__fixtures__/ens-send')
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            // No Ethereum: the chain isn't registered, only its endpoints exist.
            chains: { enabled: ['algorand', 'base'], capabilities: {} },
        },
        hasPeraBackend: (
            scope: Parameters<typeof withBackend.hasPeraBackend>[0],
        ) =>
            scope.chainId === 'algorand'
                ? withBackend.hasPeraBackend(scope)
                : true,
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) => {
            if (chainId === 'ethereum') {
                return { mainnet: [L1_RPC], sepolia: [L1_RPC] }
            }
            if (chainId === 'base') return { mainnet: [BASE_RPC] }
            return withBackend.chainEndpointsFor(chainId)
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
const { fireEvent, screen, waitFor } = await import('@testing-library/react')
const { Decimal } = await import('decimal.js')
const { Notifier } = await import('react-native-notifier')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { nativeAssetFor, upsertAssets } =
    await import('@perawallet/wallet-core-assets')
const { addressCodecs } = await import('@perawallet/wallet-core-chain-contract')
const { ensResolverCallResponder, evmRpcHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { mockNameSearch } =
    await import('@perawallet/wallet-core-nfd/test-handlers')
const { getProvider } = await import('@perawallet/wallet-extension-provider')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { useSendFundsStore } = await import('@modules/transactions')
const { SelectDestinationScreen } =
    await import('@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen')
const { SLOW_WAIT_TIMEOUT_MS } = await import('./__fixtures__/timeouts')

const backendFinds = (
    ...results: ReturnType<typeof searchResult>[]
): ReturnType<typeof mockNameSearch> =>
    mockNameSearch({ response: { count: results.length, results } })

const l1Holds = (
    records: { name: string; coinType: bigint; address: `0x${string}` }[],
) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: L1_RPC,
            responses: { eth_call: ensResolverCallResponder(records) },
        }),
    )

const prefillBaseSend = () => {
    useSendFundsStore
        .getState()
        .setSelectedAsset({ chainId: 'base', assetId: 'native' })
    useSendFundsStore.getState().setAmount(new Decimal('0.1'))
}

const selectSender = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

const typeName = async (value: string) => {
    const fields = await screen.findAllByPlaceholderText(
        'address_entry.search_placeholder_evm',
    )
    fireEvent.change(fields[fields.length - 1], { target: { value } })
}

const findResultRow = (address: string) =>
    screen.findByText(addressCodecs.get('base').truncate(address), undefined, {
        timeout: SLOW_WAIT_TIMEOUT_MS,
    })

describe('Flow: send to an ENS name with Ethereum not enabled', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await upsertAssets({
            items: [nativeAssetFor('base')],
            scope: { chainId: 'base', networkId: 'mainnet' },
        })
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
        server.use(...evmRpcHandlers({ rpcUrl: BASE_RPC }))
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
    })

    it('Given a build without Ethereum, then the Ethereum chain is not registered', () => {
        expect(getProvider().chains.has('ethereum')).toBe(false)
        expect(getProvider().chains.has('base')).toBe(true)
    })

    it("Given a send on Base, when the user picks a name with a Base record, then Base's record becomes the destination, not the name's Ethereum one", async () => {
        selectSender(BASE_SENDER)
        prefillBaseSend()
        server.use(
            backendFinds(searchResult('alice.eth', ALICE_BASE, 'eip155:8453')),
        )
        l1Holds([
            {
                name: 'alice.eth',
                coinType: COIN_TYPE_ETHEREUM,
                address: ALICE_ETHEREUM,
            },
            {
                name: 'alice.eth',
                coinType: COIN_TYPE_BASE,
                address: ALICE_BASE,
            },
        ])
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        await typeName('alice.eth')
        const row = await findResultRow(ALICE_BASE)

        fireEvent.click(row)

        await waitFor(() =>
            expect(
                useSendFundsStore.getState().destination?.toLowerCase(),
            ).toBe(ALICE_BASE.toLowerCase()),
        )
    })

    it("Given a send on Base, when the backend offers the name's Ethereum address, then ENS refuses it, the destination stays unset and the user is told it doesn't match", async () => {
        selectSender(BASE_SENDER)
        prefillBaseSend()
        server.use(
            backendFinds(
                searchResult('alice.eth', ALICE_ETHEREUM, 'eip155:8453'),
            ),
        )
        l1Holds([
            {
                name: 'alice.eth',
                coinType: COIN_TYPE_ETHEREUM,
                address: ALICE_ETHEREUM,
            },
        ])
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        await typeName('alice.eth')
        fireEvent.click(await findResultRow(ALICE_ETHEREUM))

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.destination.ens_mismatch_title',
                }),
            ),
        )
        expect(useSendFundsStore.getState().destination).toBeUndefined()
        expect(
            vi
                .mocked(Notifier.showNotification)
                .mock.calls.map(([options]) => JSON.stringify(options))
                .join(),
        ).not.toContain('nfd')
    })
})
