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

// An EVM address reads as its verified ENS primary name wherever an NFD name
// would show, through the same batched, cached lookup, with the names coming
// from Pera's backend and never from a node. Copy is asserted by key: this
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
import type { EvmHistoryItemResponse } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import type { AddressNamesRequestBody } from '@perawallet/wallet-core-names/test-handlers'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'
import { ENS_UNIVERSAL_RESOLVER } from './__fixtures__/ens-send'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    const { BASE_RPC } = await import('./__fixtures__/ens-send')
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: {
                enabled: ['algorand', 'ethereum', 'base'],
                capabilities: {},
            },
        },
        // The real config has no Pera deployment for an EVM scope.
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
                return { mainnet: ['https://mainnet.rpc.test/'] }
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
vi.doMock(
    '@react-navigation/native',
    () => import('@test-utils/test-navigator'),
)
vi.doMock('@react-navigation/native-stack', async () => ({
    createNativeStackNavigator: (await import('@test-utils/test-navigator'))
        .createNativeStackNavigator,
}))
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { act, fireEvent, renderHook, screen, waitFor } =
    await import('@testing-library/react')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { addressCodecs } = await import('@perawallet/wallet-core-chain-contract')
const { useContacts } = await import('@perawallet/wallet-core-contacts')
const { evmHistoryItem, evmRpcHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { mockAddressNames } =
    await import('@perawallet/wallet-core-names/test-handlers')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { closestPressable } = await import('@test-utils/rnw')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { TransactionDetailsScreen } = await import('@modules/signing/routes')
const { AccountHistory } =
    await import('@modules/accounts/components/AccountHistory/AccountHistory')
const { ViewContactScreen } =
    await import('@modules/contacts/screens/ViewContactScreen/ViewContactScreen')

const ETHEREUM_CAIP2 = 'eip155:1'
const BASE_CAIP2 = 'eip155:8453'

const OWN_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const ETH_ACCOUNT: WalletAccount = {
    id: 'eth-watch',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: OWN_ADDRESS } },
    name: 'Ethereum watch',
}
const BASE_ACCOUNT: WalletAccount = {
    id: 'base-watch',
    custody: { kind: 'watch' },
    chains: { base: { address: OWN_ADDRESS } },
    name: 'Base watch',
}

const COUNTERPARTIES = [
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333',
    '0x4444444444444444444444444444444444444444',
    '0x5555555555555555555555555555555555555555',
] as const
const [ALICE, BOB, CAROL, DAVE, ERIN] = COUNTERPARTIES

const hashOf = (n: number) => `0x${String(n).padStart(64, '0')}`

const received = (n: number, from: string): EvmHistoryItemResponse =>
    evmHistoryItem({
        hash: hashOf(n),
        block_time: `2026-01-01T00:${String(n).padStart(2, '0')}:00Z`,
        from,
        to: OWN_ADDRESS,
        value: '1000000000000000000',
    })

const rowIds = () =>
    screen
        .queryAllByTestId(/^transaction_row_0x/)
        .map(row => row.getAttribute('data-testid') ?? '')

const rowText = (hash: string) =>
    screen.getByTestId(`transaction_row_${hash}`).textContent ?? ''

type NamesByChain = Record<string, Record<string, string>>

const requests: AddressNamesRequestBody[] = []

// Answers as the backend does: each address with its verified primary name on
// the chain asked about, or none.
const serveNames = (namesByChain: NamesByChain, status = 200) =>
    server.use(
        mockAddressNames({
            status,
            response: body => {
                requests.push(body)
                return {
                    results: body.addresses.map(address => {
                        const name =
                            namesByChain[body.chain]?.[address.toLowerCase()]
                        // The backend answers EVM addresses lowercased.
                        return {
                            address: address.toLowerCase(),
                            name: name
                                ? { name, source: 'ens', image: null }
                                : null,
                        }
                    }),
                }
            },
        }),
    )

const askedAddresses = () =>
    requests.flatMap(body => body.addresses.map(a => a.toLowerCase()))

const rpcBodies: Promise<string>[] = []
const trackRpc = ({ request }: { request: Request }) => {
    if (new URL(request.url).hostname.endsWith('.rpc.test')) {
        rpcBodies.push(request.clone().text())
    }
}

// Rows show the checksummed spelling, whatever case the address was handed in.
const truncated = (chainId: 'ethereum' | 'base', address: string) => {
    const codec = addressCodecs.get(chainId)
    return codec.truncate(codec.normalize(address))
}

describe('Flow: ENS primary names for EVM addresses', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        requests.length = 0
        rpcBodies.length = 0
        server.events.on('request:start', trackRpc)
        server.use(
            ...evmRpcHandlers({
                responses: { eth_getTransactionByHash: () => null },
            }),
        )
    })

    afterEach(() => {
        server.events.removeListener('request:start', trackRpc)
        useAccountsStore.getState().setAccounts([])
    })

    const useAccount = (account: WalletAccount) => {
        useAccountsStore.getState().setAccounts([account])
        useAccountsStore.getState().setSelectedAccountId(account.id)
    }

    const renderHistory = () =>
        renderWithNavigation(AccountHistory, 'AccountHistory', {
            additionalScreens: [
                {
                    name: 'TransactionDetails',
                    component: TransactionDetailsScreen,
                },
            ],
        })

    const serveFiftyReceipts = () => {
        const records = Array.from({ length: 50 }, (_, i) =>
            received(i + 1, COUNTERPARTIES[i % COUNTERPARTIES.length]!),
        )
        server.use(
            ...peraEvmHistoryHandlers({
                history: { [OWN_ADDRESS]: [records] },
            }),
        )
    }

    const expectedLabel = (hash: string, names: Record<string, string>) => {
        const counterparty =
            COUNTERPARTIES[(Number(hash.slice(2)) - 1) % COUNTERPARTIES.length]!
        return names[counterparty] ?? truncated('ethereum', counterparty)
    }

    it('Given 50 rows over 5 counterparties, 4 of them named, when History opens, then each is asked about once, the unnamed one stays truncated, no node is asked, and reopening the app asks nothing again', async () => {
        const names = {
            [ALICE]: 'alice.eth',
            [BOB]: 'bob.eth',
            [CAROL]: 'carol.eth',
            [DAVE]: 'dave.eth',
        }
        serveNames({ [ETHEREUM_CAIP2]: names })
        serveFiftyReceipts()
        useAccount(ETH_ACCOUNT)

        const first = renderHistory()

        await waitFor(
            () => {
                const ids = rowIds()
                expect(ids.length).toBeGreaterThan(COUNTERPARTIES.length)
                for (const id of ids) {
                    const hash = id.replace('transaction_row_', '')
                    expect(rowText(hash)).toContain(expectedLabel(hash, names))
                }
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(rowText(hashOf(5))).toContain(truncated('ethereum', ERIN))

        const asked = askedAddresses()
        expect(new Set(asked).size).toBe(asked.length)
        expect(
            asked.filter(a => COUNTERPARTIES.some(c => c === a)),
        ).toHaveLength(COUNTERPARTIES.length)
        expect(requests.every(body => body.chain === ETHEREUM_CAIP2)).toBe(true)
        expect(await Promise.all(rpcBodies)).toEqual([])

        const askedBefore = requests.length
        first.unmount()
        renderHistory()

        await waitFor(() => expect(rowText(hashOf(1))).toContain('alice.eth'), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(requests).toHaveLength(askedBefore)
    })

    it('Given a row from alice.eth, when it is opened, then the sender shows the name and no node is asked to resolve it', async () => {
        serveNames({ [ETHEREUM_CAIP2]: { [ALICE]: 'alice.eth' } })
        server.use(
            ...peraEvmHistoryHandlers({
                history: { [OWN_ADDRESS]: [[received(1, ALICE)]] },
            }),
        )
        useAccount(ETH_ACCOUNT)
        renderHistory()

        const row = await screen.findByTestId(
            `transaction_row_${hashOf(1)}`,
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        fireEvent.click(closestPressable(row) ?? row)

        await waitFor(
            () =>
                expect(
                    screen.getByTestId('transaction_detail_from').textContent,
                ).toContain('alice.eth'),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        const bodies = await Promise.all(rpcBodies)
        expect(
            bodies.some(body =>
                body.toLowerCase().includes(ENS_UNIVERSAL_RESOLVER),
            ),
        ).toBe(false)
    })

    it('Given the names route answers 503, when History opens, then every counterparty shows truncated with no error state', async () => {
        serveNames({}, 503)
        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [OWN_ADDRESS]: [[received(1, ALICE), received(2, BOB)]],
                },
            }),
        )
        useAccount(ETH_ACCOUNT)

        renderHistory()

        await waitFor(() => expect(requests.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        await waitFor(
            () => {
                expect(rowText(hashOf(1))).toContain(
                    truncated('ethereum', ALICE),
                )
                expect(rowText(hashOf(2))).toContain(truncated('ethereum', BOB))
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.queryByText('common.error.title')).toBeNull()
    })

    it("Given a Base account whose counterparties name differently on Ethereum, when History opens, then only Base's own answers show and Base is the only chain asked", async () => {
        serveNames({
            [BASE_CAIP2]: { [ALICE]: 'alice.base.eth', [BOB]: 'bob.eth' },
            [ETHEREUM_CAIP2]: { [CAROL]: 'carol.eth' },
        })
        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [OWN_ADDRESS]: [
                        [
                            received(1, ALICE),
                            received(2, BOB),
                            received(3, CAROL),
                        ],
                    ],
                },
            }),
        )
        useAccount(BASE_ACCOUNT)

        renderHistory()

        await waitFor(
            () => {
                expect(rowText(hashOf(1))).toContain('alice.base.eth')
                expect(rowText(hashOf(2))).toContain('bob.eth')
                expect(rowText(hashOf(3))).toContain(truncated('base', CAROL))
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.queryByText('carol.eth')).toBeNull()
        expect(requests.length).toBeGreaterThan(0)
        expect(requests.every(body => body.chain === BASE_CAIP2)).toBe(true)
        expect(await Promise.all(rpcBodies)).toEqual([])
    })

    it('Given a contact with an EVM address named alice.eth, when it is viewed, then its name shows under an ENS heading', async () => {
        serveNames({ [ETHEREUM_CAIP2]: { [ALICE]: 'alice.eth' } })
        const contacts = renderHook(() => useContacts()).result
        act(() => {
            contacts.current.addContact({
                name: 'Alice',
                addresses: { evm: ALICE },
            })
        })
        const alice = renderHook(() => useContacts()).result.current
            .contacts[0]!
        act(() => {
            contacts.current.setSelectedContact(alice)
        })

        renderWithNavigation(ViewContactScreen, 'ViewContact')

        const section = await screen.findByTestId(
            'view_contact_name_evm',
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(section.textContent).toContain('contacts.view_contact.ens_label')
        expect(section.textContent).toContain('alice.eth')
        expect(requests.every(body => body.chain === ETHEREUM_CAIP2)).toBe(true)
    })
})
