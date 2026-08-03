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

// Cross-package routing coverage for the widened Network union:
//
//   chain reads   ─►  must hit the ACTIVE network's algod/indexer
//   pera reads    ─►  must NOT reach any Pera backend (none deployed)
//   signing       ─►  must reject another chain's genesis hash
//   history       ─►  must come from the chain's indexer, not the backend
//
// Unit tests mock the wire; these prove the assembled client stack points
// where it should once every layer is wired together. MSW's request events
// are observed directly (rather than rendering a screen) so the assertion is
// "which host did this reach", which is exactly what these flows must prove.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { http, HttpResponse } from 'msw'

import {
    Networks,
    PeraServiceUnavailableError,
    decodeFromBase64,
} from '@perawallet/wallet-core-shared'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import {
    getAlgorandClient,
    useNetworkStore,
    useCustomNetworkStore,
    getExpectedGenesisHash,
} from '@perawallet/wallet-core-blockchain'
import { fetchTransactionHistory } from '@perawallet/wallet-core-transactions'
import { fetchAssets } from '@perawallet/wallet-core-assets'
import {
    assertTransactionsMatchNetwork,
    GenesisHashMismatchError,
} from '@perawallet/wallet-core-signing'

import { server } from '@test-utils/msw-server'

// Both betanet and custom are covered because chain truth reaches the client
// stack two different ways: betanet's endpoints and genesis come from baked
// config, while custom's config is deliberately EMPTY and the custom-network
// store overlays every value at runtime.
//
// The assertions are identical, hence the parameterization. Dropping either row
// loses coverage of one of those two paths.
const BETANET_ALGOD = 'https://betanet-api.algonode.cloud'
const BETANET_INDEXER = 'https://betanet-idx.algonode.cloud'
// Read, never hardcoded: `backendUrl` comes from TESTNET_BACKEND_URL, which
// tools/setup-env-secrets.sh sets for every developer. Pinning its default here
// made this suite go false-red on any machine that had run that script.
//
// Still needed even though betanet/custom no longer borrow it: the history
// test below registers this as a handler to prove Pera's transaction feed is
// never consulted for TestNet-adjacent data on those networks.
const TESTNET_PERA = getNetworkConfig(Networks.testnet).backendUrl

const BETANET_GENESIS = 'mFgazF+2uRS1tMiL9dsj01hJGySEmPN28B/TjjvpVW0='
const TESTNET_GENESIS = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='

// Deliberately a LAN address on non-standard-for-the-suite ports: nothing about
// the custom slot may fall back to a baked default, so these must not resemble
// any value in network-config.ts.
const CUSTOM_ALGOD = 'http://10.0.0.5:4001'
const CUSTOM_INDEXER = 'http://10.0.0.5:8980'
const CUSTOM_GENESIS = 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw='

type NetworkFixture = {
    label: string
    network: typeof Networks.betanet | typeof Networks.custom
    algodUrl: string
    indexerUrl: string
    genesisHash: string
    /** Puts the chain endpoints where the client stack will look for them. */
    configure: () => void
}

const FIXTURES: NetworkFixture[] = [
    {
        label: 'betanet (baked config)',
        network: Networks.betanet,
        algodUrl: BETANET_ALGOD,
        indexerUrl: BETANET_INDEXER,
        genesisHash: BETANET_GENESIS,
        configure: () => {
            useCustomNetworkStore.getState().resetState()
        },
    },
    {
        label: 'custom (runtime store overlay)',
        network: Networks.custom,
        algodUrl: CUSTOM_ALGOD,
        indexerUrl: CUSTOM_INDEXER,
        genesisHash: CUSTOM_GENESIS,
        configure: () => {
            useCustomNetworkStore.getState().setCustomNetwork({
                algodUrl: CUSTOM_ALGOD,
                indexerUrl: CUSTOM_INDEXER,
                genesisHash: CUSTOM_GENESIS,
                genesisId: 'dockernet-v1',
            })
        },
    },
]

// A syntactically valid, checksum-correct Algorand address (same value as
// HD_TEST_ADDRESS in ./__fixtures__/onboarding.ts). Nothing here signs with
// it — it only has to be well-formed enough for algokit-utils/indexer
// response decoding, which these flows exercise for real.
const ADDRESS = 'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'

// Requests are matched on the PARSED origin (plus the base URL's path prefix,
// for bases that carry one) rather than on a raw string prefix. `url.startsWith
// (base)` also passes for a different host that merely begins with the expected
// one — `https://betanet-api.algonode.cloud.example.test` — so it is both the
// weaker assertion and what CodeQL flags as incomplete URL sanitization.
const matchesBase = (url: string, base: string): boolean => {
    const requestUrl = new URL(url)
    const baseUrl = new URL(base)

    return (
        requestUrl.origin === baseUrl.origin &&
        requestUrl.pathname.startsWith(baseUrl.pathname)
    )
}

describe.each(FIXTURES)(
    'multi-network routing — $label',
    ({ network, algodUrl, indexerUrl, genesisHash, configure }) => {
        const requested: string[] = []

        const record = ({ request }: { request: Request }) => {
            requested.push(request.url)
        }

        beforeAll(() => {
            server.listen({ onUnhandledRequest: 'bypass' })
            server.events.on('request:start', record)
        })

        afterAll(() => {
            server.events.removeListener('request:start', record)
            server.close()
        })

        beforeEach(() => {
            requested.length = 0
            configure()
            useNetworkStore.getState().setNetwork(network)
        })

        afterEach(() => {
            server.resetHandlers()
            useNetworkStore.getState().setNetwork(Networks.mainnet)
            useCustomNetworkStore.getState().resetState()
        })

        it('sends chain reads to the active network, not the fallback', async () => {
            server.use(
                http.get(`${algodUrl}/v2/accounts/:address`, () =>
                    HttpResponse.json({
                        address: ADDRESS,
                        amount: 1_000_000,
                        'min-balance': 100_000,
                        round: 1,
                        'total-apps-opted-in': 0,
                        'total-assets-opted-in': 0,
                        'total-created-apps': 0,
                        'total-created-assets': 0,
                    }),
                ),
            )

            await getAlgorandClient()
                .client.algod.accountInformation(ADDRESS)
                .do()

            expect(requested.some(url => matchesBase(url, algodUrl))).toBe(true)
            expect(
                requested.some(url =>
                    matchesBase(
                        url,
                        getNetworkConfig(Networks.testnet).algodUrl,
                    ),
                ),
            ).toBe(false)
        })

        it("reaches no Pera backend at all, rather than borrowing TestNet's", async () => {
            // No MSW handler on purpose: an escaped request would show up in
            // `requested` and fail the second assertion.
            //
            // The exact error class matters — this is the only place unmocked
            // ky runs, so it's the only test that can tell the typed refusal
            // apart from ky failing to parse a relative URL against an empty
            // prefix, which normalizes into a generic
            // PeraNetworkError('unknown').
            await expect(
                fetchAssets(['31566704'], network),
            ).rejects.toBeInstanceOf(PeraServiceUnavailableError)

            expect(
                requested.some(url =>
                    matchesBase(
                        url,
                        getNetworkConfig(Networks.testnet).backendUrl,
                    ),
                ),
            ).toBe(false)
        })

        it('reads history from the chain indexer, never the borrowed backend', async () => {
            server.use(
                http.get(
                    `${indexerUrl}/v2/accounts/:address/transactions`,
                    () =>
                        HttpResponse.json({
                            'current-round': 42,
                            transactions: [
                                {
                                    id: 'FROM_INDEXER',
                                    'tx-type': 'pay',
                                    sender: ADDRESS,
                                    fee: 1000,
                                    'confirmed-round': 41,
                                    'round-time': 1_700_000_000,
                                    'payment-transaction': {
                                        amount: 5000,
                                        receiver: ADDRESS,
                                    },
                                },
                            ],
                        }),
                ),
                http.get(
                    `${TESTNET_PERA}/v1/accounts/:address/transactions/`,
                    () =>
                        HttpResponse.json({
                            current_round: 1,
                            next: null,
                            previous: null,
                            results: [
                                {
                                    id: 'FROM_PERA_MUST_NOT_APPEAR',
                                    tx_type: 'pay',
                                    sender: ADDRESS,
                                    confirmed_round: 1,
                                    round_time: 1,
                                    fee: '1000',
                                },
                            ],
                        }),
                ),
            )

            const result = await fetchTransactionHistory({
                accountAddress: ADDRESS,
                network,
            })

            const ids = result.transactions.map(transaction => transaction.id)
            expect(ids).toContain('FROM_INDEXER')
            expect(ids).not.toContain('FROM_PERA_MUST_NOT_APPEAR')
        })

        it('rejects a transaction carrying another chain genesis hash', () => {
            // No MSW handler here on purpose: getExpectedGenesisHash is
            // synchronous and network-free (see resolveGenesisHash.ts), so the
            // expected hash comes straight from build-time config (betanet) or
            // the custom store — never from a node response. Asserting the
            // exact value is what stops the mismatch check below from passing
            // vacuously on an empty hash.
            const expected = getExpectedGenesisHash(network)
            expect(expected).toBe(genesisHash)

            // A dApp that (mistakenly, or via a stale session) builds with
            // testnet's genesis while the wallet is active elsewhere must be
            // rejected regardless of chain-id pairing — this is the safety net.
            const transactions = [
                { genesisHash: decodeFromBase64(TESTNET_GENESIS) },
            ] as Parameters<typeof assertTransactionsMatchNetwork>[0]

            expect(() =>
                assertTransactionsMatchNetwork(transactions, network, expected),
            ).toThrow(GenesisHashMismatchError)
        })
    },
)
