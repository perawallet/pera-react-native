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

// Choosing an ENS name as the receiver: Pera's backend finds the address, and
// ENS on Ethereum L1 has to confirm it for the chain being sent on before it
// becomes the destination. Typing reads no node. Copy is asserted by key:
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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { http, HttpResponse, server } from '@test-utils/msw-server'
import {
    ALICE_ETHEREUM,
    COIN_TYPE_ETHEREUM,
    ENS_UNIVERSAL_RESOLVER,
    ETHEREUM_SENDER,
    L1_RPC,
    searchResult,
} from './__fixtures__/ens-send'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    const { L1_RPC } = await import('./__fixtures__/ens-send')
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: {
                enabled: ['algorand', 'ethereum'],
                capabilities: {},
            },
        },
        // The helper answers per service; name lookups only ask whether the
        // scope has a deployment at all.
        hasPeraBackend: (
            scope: Parameters<typeof withBackend.hasPeraBackend>[0],
        ) =>
            scope.chainId === 'algorand'
                ? withBackend.hasPeraBackend(scope)
                : true,
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) => {
            return chainId === 'ethereum'
                ? { mainnet: [L1_RPC], sepolia: [L1_RPC] }
                : withBackend.chainEndpointsFor(chainId)
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
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} = await import('@test-utils/database-setup')
const { useSendFundsStore } = await import('@modules/transactions')
const { SelectDestinationScreen } =
    await import('@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen')
const { ALGO25_TEST_ADDRESS } = await import('./__fixtures__/onboarding')
const { SLOW_WAIT_TIMEOUT_MS } = await import('./__fixtures__/timeouts')

const ALGORAND_SENDER: WalletAccount = {
    id: 'algo-sender',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo-key' },
    },
    name: 'Algo sender',
}

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

const prefillSend = (chainId: 'ethereum' | 'algorand') => {
    useSendFundsStore.getState().setSelectedAsset({
        chainId,
        assetId: chainId === 'algorand' ? '0' : 'native',
    })
    useSendFundsStore.getState().setAmount(new Decimal('0.1'))
}

const selectSender = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

const typeName = async (placeholderKey: string, value: string) => {
    const fields = await screen.findAllByPlaceholderText(placeholderKey)
    fireEvent.change(fields[fields.length - 1], { target: { value } })
}

const shortened = (chainId: string, address: string) =>
    addressCodecs.get(chainId as 'ethereum').truncate(address)

const findResultRow = (chainId: string, address: string) =>
    screen.findByText(shortened(chainId, address), undefined, {
        timeout: SLOW_WAIT_TIMEOUT_MS,
    })

describe('Flow: send to an ENS name', () => {
    const requested: { url: URL; callTargets: string[] }[] = []
    const recordRequest = async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const body: unknown = await request
            .clone()
            .json()
            .catch(() => undefined)
        const calls = Array.isArray(body) ? body : [body]
        requested.push({
            url,
            callTargets: calls
                .filter(call => call?.method === 'eth_call')
                .map(call => String(call.params?.[0]?.to).toLowerCase()),
        })
    }
    // The sender's own sync also reads the node; the name check is the read of ENS's resolver.
    const ensReads = () =>
        requested.filter(
            ({ url, callTargets }) =>
                url.origin + '/' === L1_RPC &&
                callTargets.includes(ENS_UNIVERSAL_RESOLVER),
        )

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await upsertAssets({
            items: [nativeAssetFor('ethereum')],
            scope: { chainId: 'ethereum', networkId: 'mainnet' },
        })
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
        requested.length = 0
        server.events.on('request:start', recordRequest)
        server.use(...evmRpcHandlers({ rpcUrl: L1_RPC }))
    })

    afterEach(() => {
        server.events.removeListener('request:start', recordRequest)
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
    })

    it("Given an Ethereum send, when the user types a mixed-case ENS name and picks it, then no node is read until the pick, and ENS's record becomes the destination", async () => {
        selectSender(ETHEREUM_SENDER)
        prefillSend('ethereum')
        server.use(
            backendFinds(searchResult('alice.eth', ALICE_ETHEREUM, 'eip155:1')),
        )
        l1Holds([
            {
                name: 'alice.eth',
                coinType: COIN_TYPE_ETHEREUM,
                address: ALICE_ETHEREUM,
            },
        ])
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        await typeName('address_entry.search_placeholder_evm', 'Alice.ETH')

        const row = await findResultRow('ethereum', ALICE_ETHEREUM)
        expect(screen.getByText('address_entry.ens_results')).toBeTruthy()
        expect(screen.queryByText('address_entry.nfd_results')).toBeNull()
        const search = requested.find(({ url }) =>
            url.pathname.endsWith('/api/v4/name-services/search/'),
        )
        expect(search?.url.searchParams.get('chain')).toBe('eip155:1')
        expect(search?.url.searchParams.get('name')).toBe('alice.eth')
        expect(ensReads()).toEqual([])

        fireEvent.click(row)

        await waitFor(() =>
            expect(
                useSendFundsStore.getState().destination?.toLowerCase(),
            ).toBe(ALICE_ETHEREUM.toLowerCase()),
        )
        expect(ensReads().length).toBeGreaterThan(0)
    })

    it('Given an Ethereum send, when ENS cannot be reached as the name is picked, then the destination stays unset and the user is told ENS could not verify it', async () => {
        selectSender(ETHEREUM_SENDER)
        prefillSend('ethereum')
        server.use(
            backendFinds(searchResult('alice.eth', ALICE_ETHEREUM, 'eip155:1')),
            http.post(L1_RPC, () => HttpResponse.error()),
        )
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        await typeName('address_entry.search_placeholder_evm', 'alice.eth')
        fireEvent.click(await findResultRow('ethereum', ALICE_ETHEREUM))

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.destination.ens_unavailable_title',
                }),
            ),
        )
        expect(useSendFundsStore.getState().destination).toBeUndefined()
    })

    it("Given an Ethereum send, when Pera's backend is unreachable, then search shows no ENS result and no message", async () => {
        selectSender(ETHEREUM_SENDER)
        prefillSend('ethereum')
        server.use(
            mockNameSearch({
                response: { count: 0, results: [] },
                status: 503,
            }),
        )
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        await typeName('address_entry.search_placeholder_evm', 'alice.eth')

        await waitFor(() =>
            expect(
                requested.some(({ url }) =>
                    url.pathname.endsWith('/api/v4/name-services/search/'),
                ),
            ).toBe(true),
        )
        expect(screen.queryByText('address_entry.ens_results')).toBeNull()
        expect(Notifier.showNotification).not.toHaveBeenCalled()
    })

    it('Given an Algorand send, when the user types an NFD name, then the v4 search is asked for Algorand and the result sits under the NFD heading', async () => {
        await seedAlgoAsset('mainnet')
        selectSender(ALGORAND_SENDER)
        prefillSend('algorand')
        server.use(
            mockNameSearch({
                response: {
                    count: 1,
                    results: [
                        {
                            name: 'bob.algo',
                            address: ALGO25_TEST_ADDRESS,
                            chain: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
                            service: { name: 'NFD', logo: '' },
                        },
                    ],
                },
            }),
        )
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        await typeName('address_entry.search_placeholder', 'bob.algo')

        expect(
            await screen.findByText('address_entry.nfd_results', undefined, {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            }),
        ).toBeTruthy()
        expect(screen.queryByText('address_entry.ens_results')).toBeNull()
        const search = requested.find(({ url }) =>
            url.pathname.endsWith('/api/v4/name-services/search/'),
        )
        expect(search?.url.searchParams.get('chain')).toBe(
            'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
        )
    })
})
