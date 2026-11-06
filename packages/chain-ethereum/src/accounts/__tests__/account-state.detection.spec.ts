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
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { getAddress, type Hex } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import { createEthereumAccountStateOps } from '../account-state'
import {
    createHistoryScanBudget,
    createTokenSightings,
    TOKEN_SCAN_INTERVAL_MS,
} from '../token-detection'
import {
    nativeWhitelistItem,
    unknownAssetItem,
} from '../../assets/api/msw-handlers'
import { evmHistoryItem } from '../../history/api/msw-handlers'
import type { EvmHistoryItemResponse } from '../../history/api/schema'
import { peraEvmHandlers } from '../msw-handlers'
import {
    erc20CallResponder,
    EvmCallBurnsGas,
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type Erc20Fixture,
} from '../../blockchain/msw-handlers'
import {
    TEST_PERA_URL,
    TEST_RPC_URL,
    testChainContext,
} from '../../__tests__/context'
import { ETHEREUM } from '../../__tests__/evm-chains'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const storedHoldings = vi.hoisted(() => ({
    ids: [] as string[],
    error: undefined as unknown,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    getAccountHeldAssets: vi.fn(async () => {
        if (storedHoldings.error) throw storedHoldings.error
        return storedHoldings.ids.map(assetId => ({ assetId, scope: SCOPE }))
    }),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ADDRESS: Hex = '0x00000000000000000000000000000000000000aa'
const HOLDER = getAddress(ADDRESS)
const TSLAX = getAddress('0x8aD3c73F833d3F9A523aB01476625F269aEb7Cf0')
const HOSTILE = getAddress('0x00000000000000000000000000000000000000cc')
const USDC = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
const HINT = { priorChainState: undefined }
const SYNC_HINT = { priorChainState: undefined, isPersisted: true }
const evmState = (tokenScanBlock?: number) => ({
    family: 'evm' as const,
    nonce: { latest: 0, pending: 0 },
    ...(tokenScanBlock !== undefined && { tokenScanBlock }),
})

const STORED_HINT = { priorChainState: evmState(), isPersisted: true }

const token = (balance: bigint): Erc20Fixture => ({
    name: 'Tesla xStock',
    symbol: 'TSLAx',
    decimals: 18,
    totalSupply: 10n ** 24n,
    balances: { [HOLDER]: balance },
})

const receivedTsla = (
    block: number,
    contract: string = TSLAX,
): EvmHistoryItemResponse =>
    evmHistoryItem({
        block_number: block,
        token_transfers: [
            {
                asset_id: `eip155:1/erc20:${contract.toLowerCase()}`,
                contract: contract.toLowerCase(),
                from: '0x00000000000000000000000000000000000000bb',
                to: ADDRESS,
                value: '5',
                token_name: null,
                token_symbol: null,
                token_decimals: null,
            },
        ],
    })

const server = setupServer()
let historyRequests = 0

beforeAll(() => {
    server.events.on('request:start', ({ request }) => {
        if (request.url.includes('/transactions/')) historyRequests++
    })
    server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
    server.resetHandlers()
    storedHoldings.ids = []
    storedHoldings.error = undefined
    historyRequests = 0
})
afterAll(() => server.close())

// A token whose call burns the gas of any aggregate that names it.
const failingOn =
    (hostile: string, answer: ReturnType<typeof erc20CallResponder>) =>
    (params: readonly unknown[]) => {
        const { to } = params[0] as { to: string }
        return to.toLowerCase() === hostile.toLowerCase()
            ? new EvmCallBurnsGas()
            : answer(params)
    }

const serve = (
    history: EvmHistoryItemResponse[][] | number,
    balances: Record<string, Erc20Fixture> = { [TSLAX]: token(5n) },
    listed: string[] = [],
) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_blockNumber: '0x64',
                eth_getBalance: '0x1',
                eth_call: failingOn(HOSTILE, erc20CallResponder(balances)),
            },
        }),
        ...peraEvmHandlers({
            baseUrl: TEST_PERA_URL,
            whitelist: {
                1: [
                    nativeWhitelistItem(1),
                    ...listed.map(address => ({
                        ...unknownAssetItem(
                            `eip155:1/erc20:${address.toLowerCase()}`,
                        ),
                        type: 'erc20' as const,
                        fraction_decimals: 6,
                        is_swappable: true,
                        is_fundable: false,
                    })),
                ],
            },
            history:
                typeof history === 'number' ? history : { [ADDRESS]: history },
        }),
    )

const opsWith = (
    services: string[],
    options: {
        now?: () => number
        tokenSightings?: ReturnType<typeof createTokenSightings>
    } = {},
) =>
    createEthereumAccountStateOps(testChainContext({ services }), ETHEREUM, {
        scanBudget: createHistoryScanBudget(1_000, 60_000, () => 0),
        ...options,
    })

const SERVICES = ['assets', 'history', 'blockFollowing']

describe('fetchAccountState received-token detection', () => {
    it('holds a token only the history names from the read after its scan, and records where the scan ended', async () => {
        serve([[receivedTsla(90)]])
        const tokenSightings = createTokenSightings()
        const ops = opsWith(SERVICES, { tokenSightings })

        await ops.fetchAccountState(ADDRESS, SCOPE, SYNC_HINT)
        await vi.waitFor(() =>
            expect(tokenSightings.of(SCOPE, ADDRESS)).toEqual([TSLAX]),
        )
        const second = await ops.fetchAccountState(ADDRESS, SCOPE, STORED_HINT)

        expect(second.holdings.map(h => h.assetId)).toEqual(['native', TSLAX])
        expect(second.holdings[1]!.amount.toFixed()).toBe('5')
        expect(second.chainState).toMatchObject({ tokenScanBlock: 90 })
    })

    it('does not wait for the history before answering', async () => {
        serve([[receivedTsla(90)]])
        let finishHistory: () => void = () => {}
        server.use(
            http.get(/\/transactions\//, async () => {
                await new Promise<void>(resolve => {
                    finishHistory = resolve
                })
                return HttpResponse.json({ next: null, results: [] })
            }),
        )

        const state = await opsWith(SERVICES).fetchAccountState(
            ADDRESS,
            SCOPE,
            SYNC_HINT,
        )

        expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
        finishHistory()
    })

    it('never scans for a read the syncer does not persist', async () => {
        serve([[receivedTsla(90)]])
        const tokenSightings = createTokenSightings()

        await opsWith(SERVICES, { tokenSightings }).fetchAccountState(
            ADDRESS,
            SCOPE,
            HINT,
        )
        await new Promise(resolve => setTimeout(resolve, 20))

        expect(historyRequests).toBe(0)
        expect(tokenSightings.of(SCOPE, ADDRESS)).toEqual([])
    })

    it('scans again only once the interval has passed, from the recorded block', async () => {
        serve([[receivedTsla(95)]])
        let now = 1_000
        const tokenSightings = createTokenSightings()
        const ops = opsWith(SERVICES, { now: () => now, tokenSightings })
        await ops.fetchAccountState(ADDRESS, SCOPE, SYNC_HINT)
        await vi.waitFor(() => expect(historyRequests).toBe(1))
        now += TOKEN_SCAN_INTERVAL_MS - 1
        await ops.fetchAccountState(ADDRESS, SCOPE, STORED_HINT)
        expect(historyRequests).toBe(1)

        now += 1
        const state = await ops.fetchAccountState(ADDRESS, SCOPE, {
            priorChainState: evmState(90),
            isPersisted: true,
        })
        await vi.waitFor(() => expect(historyRequests).toBe(2))

        expect(state.chainState).toMatchObject({ tokenScanBlock: 95 })
    })

    it('keeps a stored token and the marker when the history read fails', async () => {
        // A status ky doesn't retry: a 5xx comes back 300ms later, into the
        // history count of whichever test is running by then.
        serve(400)
        storedHoldings.ids = [TSLAX]
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const ops = opsWith(SERVICES)
        const read = { priorChainState: evmState(90), isPersisted: true }

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, read)
        await vi.waitFor(() =>
            expect(warn).toHaveBeenCalledWith(
                'Received-token scan failed; keeping stored tokens',
                expect.anything(),
            ),
        )
        const next = await ops.fetchAccountState(ADDRESS, SCOPE, read)

        expect(historyRequests).toBe(1)
        expect(state.holdings.map(h => h.assetId)).toEqual(['native', TSLAX])
        expect(state.chainState).toMatchObject({ tokenScanBlock: 90 })
        expect(next.holdings.map(h => h.assetId)).toEqual(['native', TSLAX])
        expect(next.chainState).toMatchObject({ tokenScanBlock: 90 })
        warn.mockRestore()
    })

    it('makes no history request on a scope without the history service', async () => {
        serve([[receivedTsla(90)]])

        const state = await opsWith(['assets']).fetchAccountState(
            ADDRESS,
            SCOPE,
            SYNC_HINT,
        )

        expect(historyRequests).toBe(0)
        expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
        expect(state.chainState).not.toHaveProperty('tokenScanBlock')
    })

    it('keeps the stored token rows when the stored ids cannot be read', async () => {
        serve([])
        storedHoldings.error = new Error('db locked')

        const state = await opsWith(SERVICES).fetchAccountState(
            ADDRESS,
            SCOPE,
            SYNC_HINT,
        )

        expect(state.unrefreshedHoldings?.includes(TSLAX)).toBe(true)
        expect(state.unrefreshedHoldings?.includes('native')).toBe(false)
        expect(state.unrefreshedHoldings?.error).toEqual(new Error('db locked'))
    })

    it('reads a token the broadcaster saw arrive', async () => {
        serve([])
        const tokenSightings = createTokenSightings()
        tokenSightings.record(SCOPE, ADDRESS, [TSLAX])

        const state = await opsWith(SERVICES, {
            tokenSightings,
        }).fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native', TSLAX])
    })

    it('loses only its own balance to an off-list token whose call fails the aggregate', async () => {
        serve([], { [TSLAX]: token(5n), [USDC]: token(7n) }, [USDC])
        storedHoldings.ids = [HOSTILE, TSLAX]

        const state = await opsWith(SERVICES).fetchAccountState(
            ADDRESS,
            SCOPE,
            HINT,
        )

        expect(state.holdings.map(h => h.assetId)).toEqual([
            'native',
            USDC,
            TSLAX,
        ])
    })

    it('keeps the stored row of an off-list token whose own read fails', async () => {
        serve([], { [TSLAX]: token(5n) })
        storedHoldings.ids = [HOSTILE, TSLAX]

        const state = await opsWith(SERVICES).fetchAccountState(
            ADDRESS,
            SCOPE,
            HINT,
        )

        expect(state.unrefreshedHoldings?.includes(HOSTILE)).toBe(true)
        expect(state.unrefreshedHoldings?.includes(TSLAX)).toBe(false)
        expect(state.unrefreshedHoldings?.includes('native')).toBe(false)
    })

    it('does not hold the refresh in a failed state for a sighted token that cannot be read', async () => {
        serve([], { [TSLAX]: token(5n) })
        const tokenSightings = createTokenSightings()
        tokenSightings.record(SCOPE, ADDRESS, [HOSTILE])

        const state = await opsWith(SERVICES, {
            tokenSightings,
        }).fetchAccountState(ADDRESS, SCOPE, HINT)

        // Whatever else the read skipped (this scope serves no NFTs), the
        // broken sighted token is not one of the rows it reports as unread.
        expect(state.unrefreshedHoldings?.includes(HOSTILE) ?? false).toBe(
            false,
        )
        expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
    })

    it('scans an account from scratch when it has no stored state, as after a re-import', async () => {
        serve([[receivedTsla(90)]])
        let now = 1_000
        const tokenSightings = createTokenSightings()
        const ops = opsWith(SERVICES, { now: () => now, tokenSightings })
        await ops.fetchAccountState(ADDRESS, SCOPE, SYNC_HINT)
        await vi.waitFor(() =>
            expect(tokenSightings.of(SCOPE, ADDRESS)).toEqual([TSLAX]),
        )
        // Older history only a scan from scratch reaches.
        serve([[receivedTsla(90)], [receivedTsla(50, USDC)]])
        now += TOKEN_SCAN_INTERVAL_MS

        await ops.fetchAccountState(ADDRESS, SCOPE, SYNC_HINT)

        await vi.waitFor(() =>
            expect(tokenSightings.of(SCOPE, ADDRESS)).toContain(USDC),
        )
    })

    it('starts the scan even when the node read fails, and does not restart it while the account has no stored state', async () => {
        serve([[receivedTsla(90)]])
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_blockNumber: new EvmRpcErrorFixture(
                        -32_000,
                        'header not found',
                    ),
                },
            }),
        )
        const ops = opsWith(SERVICES)

        await expect(
            ops.fetchAccountState(ADDRESS, SCOPE, SYNC_HINT),
        ).rejects.toThrow()

        await vi.waitFor(() => expect(historyRequests).toBe(1))
        // The account still has no stored state, as the syncer would find it.
        await expect(
            ops.fetchAccountState(ADDRESS, SCOPE, SYNC_HINT),
        ).rejects.toThrow()
        await new Promise(resolve => setTimeout(resolve, 20))
        expect(historyRequests).toBe(1)
    })
})

describe('fetchChangeSignal for received tokens', () => {
    it('reports a change while a scan is due, without asking the block follower', async () => {
        serve([])

        const signal = await opsWith(SERVICES).fetchChangeSignal(
            [ADDRESS],
            SCOPE,
            100,
        )

        expect(signal).toEqual({ changed: true, cursor: 100 })
    })

    it('reports a change until a read takes up what a scan found, then goes quiet', async () => {
        serve([[receivedTsla(90)]])
        const tokenSightings = createTokenSightings()
        const ops = opsWith(SERVICES, { tokenSightings })
        await ops.fetchAccountState(ADDRESS, SCOPE, SYNC_HINT)
        await vi.waitFor(() =>
            expect(tokenSightings.of(SCOPE, ADDRESS)).toEqual([TSLAX]),
        )

        const beforeRead = await ops.fetchChangeSignal([ADDRESS], SCOPE, 100)
        await ops.fetchAccountState(ADDRESS, SCOPE, STORED_HINT)
        const afterRead = await ops.fetchChangeSignal([ADDRESS], SCOPE, 100)

        expect(beforeRead).toEqual({ changed: true, cursor: 100 })
        expect(afterRead).toEqual({ changed: false, cursor: 100 })
    })
})
