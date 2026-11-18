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
// would show, through the same batched, cached lookup. The names come from
// Pera's backend and show only once ENS on Ethereum L1 resolves each back to
// the address. Copy is asserted by key: this project renders i18n keys.

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
import { Decimal } from 'decimal.js'
import type {
    EnsRecordFixture,
    EvmHistoryItemResponse,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import type { AddressNamesRequestBody } from '@perawallet/wallet-core-names/test-handlers'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'
import { COIN_TYPE_BASE, ENS_UNIVERSAL_RESOLVER } from './__fixtures__/ens-send'

const L1_RPC = 'https://mainnet.rpc.test/'
const DEFAULT_EVM_COIN_TYPE = 1n << 31n

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
const {
    ensResolverCallResponder,
    EvmRpcErrorFixture,
    evmHistoryItem,
    evmRpcHandlers,
} = await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { mockAddressNames } =
    await import('@perawallet/wallet-core-names/test-handlers')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { closestPressable } = await import('@test-utils/rnw')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { useSendFundsStore } = await import('@modules/transactions')
const { TransactionConfirmationScreen } =
    await import('@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen')
const { TransactionProcessingScreen } =
    await import('@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen')
const { TransactionSuccessScreen } =
    await import('@modules/transactions/routes')
const {
    ETHEREUM_SENDER,
    renderSendConfirmationStack,
    seedEthereumAssets,
    seedSenderEther,
    selectSender,
    UNKNOWN_RECIPIENT,
} = await import('./__fixtures__/ethereum-send')
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

const rpcCalls: Promise<{ host: string; body: string }>[] = []
const trackRpc = ({ request }: { request: Request }) => {
    const { hostname } = new URL(request.url)
    if (hostname.endsWith('.rpc.test')) {
        rpcCalls.push(
            request
                .clone()
                .text()
                .then(body => ({ host: hostname, body: body.toLowerCase() })),
        )
    }
}

// Reads of the ENS Universal Resolver, which every forward check makes.
const ensReads = async () =>
    (await Promise.all(rpcCalls)).flatMap(({ host, body }) =>
        Array<string>(body.split(ENS_UNIVERSAL_RESOLVER).length - 1).fill(host),
    )

// Forward records on Ethereum L1, the one place ENS is read for every EVM chain.
const serveEns = (records: EnsRecordFixture[]) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: L1_RPC,
            responses: { eth_call: ensResolverCallResponder(records) },
        }),
    )

const record = (
    name: string,
    address: string,
    coinType = 60n,
): EnsRecordFixture => ({
    name,
    address: address as EnsRecordFixture['address'],
    coinType,
})

// Rows show the checksummed spelling, whatever case the address was handed in.
const truncated = (chainId: 'ethereum' | 'base', address: string) => {
    const codec = addressCodecs.get(chainId)
    return codec.truncate(codec.normalize(address))
}

const full = (chainId: 'ethereum' | 'base', address: string) =>
    addressCodecs.get(chainId).normalize(address)

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
        rpcCalls.length = 0
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

    it('Given 50 rows over 5 counterparties, 4 of them named, when History opens, then each is asked about once, the unnamed one stays truncated, ENS reads each named one once, and reopening the app asks neither the names route nor ENS again', async () => {
        const names = {
            [ALICE]: 'alice.eth',
            [BOB]: 'bob.eth',
            [CAROL]: 'carol.eth',
            [DAVE]: 'dave.eth',
        }
        serveNames({ [ETHEREUM_CAIP2]: names })
        serveEns(
            Object.entries(names).map(([address, name]) =>
                record(name, address),
            ),
        )
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
        expect(await ensReads()).toHaveLength(Object.keys(names).length)

        const askedBefore = requests.length
        const readsBefore = (await ensReads()).length
        first.unmount()
        renderHistory()

        await waitFor(() => expect(rowText(hashOf(1))).toContain('alice.eth'), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(requests).toHaveLength(askedBefore)
        expect(await ensReads()).toHaveLength(readsBefore)
    })

    it('Given a row from alice.eth, when it is opened, then the sender shows the full address with the verified name beneath it', async () => {
        serveNames({ [ETHEREUM_CAIP2]: { [ALICE]: 'alice.eth' } })
        serveEns([record('alice.eth', ALICE)])
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
                    screen.getByTestId('transaction_detail_from_name')
                        .textContent,
                ).toContain('alice.eth'),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            screen.getByTestId('transaction_detail_from').textContent,
        ).toContain(full('ethereum', ALICE))
    })

    it('Given the backend names a counterparty vitalik.eth whose ENS record points elsewhere, when History opens, then its rows show the truncated address, vitalik.eth shows nowhere, and its detail row shows no name', async () => {
        serveNames({ [ETHEREUM_CAIP2]: { [ALICE]: 'vitalik.eth' } })
        serveEns([record('vitalik.eth', BOB)])
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
        await waitFor(async () => expect(await ensReads()).toHaveLength(1), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(rowText(hashOf(1))).toContain(truncated('ethereum', ALICE))
        expect(screen.queryByText(/vitalik\.eth/)).toBeNull()

        fireEvent.click(closestPressable(row) ?? row)

        await screen.findByTestId('transaction_detail_from', undefined, {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(screen.queryByTestId('transaction_detail_from_name')).toBeNull()
        expect(screen.queryByText(/vitalik\.eth/)).toBeNull()
    })

    it('Given ENS cannot be read, when History opens, then named counterparties show truncated', async () => {
        serveNames({ [ETHEREUM_CAIP2]: { [ALICE]: 'alice.eth' } })
        server.use(
            ...evmRpcHandlers({
                rpcUrl: L1_RPC,
                responses: {
                    eth_call: new EvmRpcErrorFixture(-32_000, 'node down'),
                },
            }),
        )
        server.use(
            ...peraEvmHistoryHandlers({
                history: { [OWN_ADDRESS]: [[received(1, ALICE)]] },
            }),
        )
        useAccount(ETH_ACCOUNT)

        renderHistory()

        await waitFor(
            async () => expect(await ensReads()).not.toHaveLength(0),
            {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            },
        )
        await waitFor(
            () =>
                expect(rowText(hashOf(1))).toContain(
                    truncated('ethereum', ALICE),
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(screen.queryByText(/alice\.eth/)).toBeNull()
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
        serveEns([
            record('alice.base.eth', ALICE, COIN_TYPE_BASE),
            record('bob.eth', BOB, DEFAULT_EVM_COIN_TYPE),
        ])
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
        const reads = await ensReads()
        expect(reads.length).toBeGreaterThan(0)
        expect(reads.every(host => host === 'mainnet.rpc.test')).toBe(true)
    })

    it('Given a contact with an EVM address named alice.eth, when it is viewed, then its name shows under an ENS heading', async () => {
        serveNames({ [ETHEREUM_CAIP2]: { [ALICE]: 'alice.eth' } })
        serveEns([record('alice.eth', ALICE)])
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

    describe('on the send confirmation', () => {
        const reviewSendTo = async (destination: string) => {
            await seedEthereumAssets()
            await seedSenderEther('10000000000000000000')
            selectSender(ETHEREUM_SENDER)
            useSendFundsStore
                .getState()
                .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
            useSendFundsStore.getState().setAmount(new Decimal('0.5'))
            useSendFundsStore.getState().setDestination(destination)
            useSendFundsStore.getState().setSendMode('normal')

            renderSendConfirmationStack({
                confirmation: TransactionConfirmationScreen,
                processing: TransactionProcessingScreen,
                success: TransactionSuccessScreen,
            })
            return screen.findByTestId('send_confirm_recipient')
        }

        afterEach(() => {
            useSendFundsStore.getState().reset()
        })

        it('Given a recipient whose backend name alice.eth ENS confirms, when the user reviews the send, then it shows the name and the full checksummed address', async () => {
            serveNames({
                [ETHEREUM_CAIP2]: {
                    [UNKNOWN_RECIPIENT.toLowerCase()]: 'alice.eth',
                },
            })
            serveEns([record('alice.eth', UNKNOWN_RECIPIENT)])

            const recipient = await reviewSendTo(UNKNOWN_RECIPIENT)

            await waitFor(
                () => expect(recipient.textContent).toContain('alice.eth'),
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )
            expect(recipient.textContent).toContain(
                full('ethereum', UNKNOWN_RECIPIENT),
            )
        })

        it('Given the backend names the recipient alice.eth but its ENS record points elsewhere, when the user reviews the send, then it shows the full address and no name', async () => {
            serveNames({
                [ETHEREUM_CAIP2]: {
                    [UNKNOWN_RECIPIENT.toLowerCase()]: 'alice.eth',
                },
            })
            serveEns([record('alice.eth', ALICE)])

            const recipient = await reviewSendTo(UNKNOWN_RECIPIENT)

            await waitFor(
                async () => expect(await ensReads()).toHaveLength(1),
                {
                    timeout: SLOW_WAIT_TIMEOUT_MS,
                },
            )
            expect(recipient.textContent).toContain(
                full('ethereum', UNKNOWN_RECIPIENT),
            )
            expect(screen.queryByText(/alice\.eth/)).toBeNull()
        })
    })
})
